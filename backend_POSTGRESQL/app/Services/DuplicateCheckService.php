<?php

namespace App\Services;

use App\Models\Report;
use App\Models\ReportPhoto;
use Illuminate\Support\Facades\DB;

class DuplicateCheckService
{
    public function checkByHash(string $imageHash): ?Report
    {
        if (! config('app.dedup_enabled')) {
            return null;
        }

        $report = Report::where('image_hash', $imageHash)->first();
        if ($report) {
            return $report;
        }

        $photo = ReportPhoto::where('image_hash', $imageHash)->first();
        if ($photo) {
            return Report::find($photo->report_id);
        }

        return null;
    }

    public function checkSpatial(float $lat, float $lng, float $radiusMeters = 6, ?string $excludeReportId = null): ?Report
    {
        if (! config('app.dedup_enabled')) {
            return null;
        }
        if ($lat < -11 || $lat > 6 || $lng < 95 || $lng > 141) {
            return null;
        }

        $excludeClause = $excludeReportId ? 'AND id != :exclude_id' : '';
        $params = [
            'lat1' => $lat, 'lng1' => $lng,
            'lat2' => $lat,
            'radius' => $radiusMeters,
        ];
        if ($excludeReportId) {
            $params['exclude_id'] = $excludeReportId;
        }

        $row = DB::selectOne("
            SELECT id FROM (
                SELECT id,
                       (
                           6371000 * acos(
                               LEAST(1.0, cos(radians(:lat1)) * cos(radians(latitude::float))
                               * cos(radians(longitude::float) - radians(:lng1))
                               + sin(radians(:lat2)) * sin(radians(latitude::float)))
                           )
                       ) AS distance_meters
                FROM reports
                WHERE status != 'Selesai'
                {$excludeClause}
            ) sub
            WHERE distance_meters <= :radius
            ORDER BY distance_meters ASC
            LIMIT 1
        ", $params);

        if ($row) {
            return Report::find($row->id);
        }

        return null;
    }

    public function checkSpatialDetailed(float $lat, float $lng, float $radiusMeters = 6, ?string $excludeReportId = null): ?array
    {
        if (! config('app.dedup_enabled')) {
            return null;
        }
        if ($lat < -11 || $lat > 6 || $lng < 95 || $lng > 141) {
            return null;
        }

        $excludeClause = $excludeReportId ? 'AND id != :exclude_id' : '';
        $params = [
            'lat1' => $lat, 'lng1' => $lng,
            'lat2' => $lat,
            'radius' => $radiusMeters,
        ];
        if ($excludeReportId) {
            $params['exclude_id'] = $excludeReportId;
        }

        $row = DB::selectOne("
            SELECT id, ROUND(distance_meters::numeric, 1) AS distance_meters
            FROM (
                SELECT id,
                       (
                           6371000 * acos(
                               LEAST(1.0, cos(radians(:lat1)) * cos(radians(latitude::float))
                               * cos(radians(longitude::float) - radians(:lng1))
                               + sin(radians(:lat2)) * sin(radians(latitude::float)))
                           )
                       ) AS distance_meters
                FROM reports
                WHERE status != 'Selesai'
                {$excludeClause}
            ) sub
            WHERE distance_meters <= :radius
            ORDER BY distance_meters ASC
            LIMIT 1
        ", $params);

        if ($row) {
            $report = Report::find($row->id);
            if ($report) {
                return [
                    'report' => $report,
                    'distance_meters' => (float) $row->distance_meters,
                ];
            }
        }

        return null;
    }

    public function checkBatch(array $photos, ?array $fallbackCoord = null): array
    {
        if (! config('app.dedup_enabled')) {
            return [
                'results' => array_map(fn ($photo, $idx) => [
                    'index' => $idx,
                    'class' => 'valid',
                    'report' => null,
                    'distance' => null,
                ], $photos, array_keys($photos)),
                'summary' => [
                    'duplicate_count' => 0,
                    'valid_count' => count($photos),
                    'all_duplicates' => false,
                ],
            ];
        }

        $results = [];
        foreach ($photos as $idx => $photo) {
            $hash = $photo['hash'] ?? null;
            $lat = isset($photo['lat']) && $photo['lat'] !== null && is_numeric($photo['lat'])
                ? (float) $photo['lat'] : null;
            $lng = isset($photo['lng']) && $photo['lng'] !== null && is_numeric($photo['lng'])
                ? (float) $photo['lng'] : null;

            if (($lat === null || $lng === null) && $fallbackCoord !== null) {
                $lat = $lat ?? ($fallbackCoord['lat'] ?? null);
                $lng = $lng ?? ($fallbackCoord['lng'] ?? null);
            }

            $class = 'valid';
            $matched = null;
            $distance = null;

            if ($lat !== null && $lng !== null) {
                $spatial = $this->checkSpatialDetailed($lat, $lng, 6);
                if ($spatial) {
                    $class = 'spatial_dup';
                    $matched = $spatial['report'];
                    $distance = $spatial['distance_meters'];
                }
            }

            if ($class === 'valid' && $hash) {
                $hashReport = $this->checkByHash($hash);
                if ($hashReport) {
                    $class = 'hash_dup';
                    $matched = $hashReport;
                    $distance = null;
                }
            }

            $results[] = [
                'index' => $idx,
                'class' => $class,
                'report' => $matched ? $this->reportPayload($matched, $distance) : null,
                'distance' => $distance,
            ];
        }

        $duplicateCount = count(array_filter($results, fn ($r) => $r['class'] !== 'valid'));

        return [
            'results' => $results,
            'summary' => [
                'duplicate_count' => $duplicateCount,
                'valid_count' => count($results) - $duplicateCount,
                'all_duplicates' => count($results) > 0 && $duplicateCount === count($results),
            ],
        ];
    }

    private function reportPayload(Report $report, ?float $distance = null): array
    {
        return [
            'id' => $report->id,
            'report_code' => $report->report_code,
            'road_name' => $report->road_name,
            'district' => $report->district,
            'latitude' => $report->latitude ? (float) $report->latitude : null,
            'longitude' => $report->longitude ? (float) $report->longitude : null,
            'status' => $report->status,
            'created_at' => $report->created_at?->toIso8601String(),
            'distance' => $distance,
        ];
    }

    public function checkTextual(string $district, ?string $roadName): ?Report
    {
        if (! config('app.dedup_enabled')) {
            return null;
        }
        $query = Report::where('status', '!=', 'Selesai')
            ->where('district', $district);

        if ($roadName && strlen(trim($roadName)) >= 1) {
            $query->where('road_name', 'ilike', '%'.trim($roadName).'%');
        }

        return $query->orderBy('created_at', 'desc')->first();
    }

    public function findNearest(float $lat, float $lng): ?array
    {
        if (! config('app.dedup_enabled')) {
            return null;
        }
        if ($lat < -11 || $lat > 6 || $lng < 95 || $lng > 141) {
            return null;
        }

        $row = DB::selectOne("
            SELECT id, ROUND(
                (6371000 * acos(
                    LEAST(1.0, cos(radians(:lat1)) * cos(radians(latitude::float))
                    * cos(radians(longitude::float) - radians(:lng1))
                    + sin(radians(:lat2)) * sin(radians(latitude::float)))
                ))::numeric, 1
            ) AS distance_meters
            FROM reports
            WHERE status != 'Selesai'
              AND latitude IS NOT NULL
              AND longitude IS NOT NULL
            ORDER BY distance_meters ASC
            LIMIT 1
        ", ['lat1' => $lat, 'lng1' => $lng, 'lat2' => $lat]);

        if ($row) {
            return ['id' => $row->id, 'distance_meters' => (float) $row->distance_meters];
        }

        return null;
    }

    public function hasImageDuplicate(string $imageHash): bool
    {
        if (! config('app.dedup_enabled')) {
            return false;
        }

        return Report::where('image_hash', $imageHash)->exists()
            || ReportPhoto::where('image_hash', $imageHash)->exists();
    }
}
