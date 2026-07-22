<?php

namespace App\Services;

use App\Models\Report;
use App\Models\ReportPhoto;
use Illuminate\Support\Facades\DB;

class DuplicateCheckService
{
    public function checkByHash(string $imageHash): ?Report
    {
        if (!config('app.dedup_enabled')) return null;

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
        if (!config('app.dedup_enabled')) return null;
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

    public function checkTextual(string $district, ?string $roadName): ?Report
    {
        if (!config('app.dedup_enabled')) return null;
        $query = Report::where('status', '!=', 'Selesai')
            ->where('district', $district);

        if ($roadName && strlen(trim($roadName)) >= 1) {
            $query->where('road_name', 'ilike', '%'.trim($roadName).'%');
        }

        return $query->orderBy('created_at', 'desc')->first();
    }

    public function findNearest(float $lat, float $lng): ?array
    {
        if (!config('app.dedup_enabled')) return null;
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
        if (!config('app.dedup_enabled')) return false;
        return Report::where('image_hash', $imageHash)->exists()
            || ReportPhoto::where('image_hash', $imageHash)->exists();
    }
}
