<?php

namespace App\Http\Controllers;

use App\Models\SurveyTask;
use App\Services\GeographicService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class ReverseGeocodeController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'lat' => 'required|numeric|between:-8.5,-7',
            'lng' => 'required|numeric|between:112.3,113.1',
        ]);

        $lat = (float) $validated['lat'];
        $lng = (float) $validated['lng'];

        // 1. Detect kecamatan from bounding box
        $kecamatan = GeographicService::detectKecamatan($lat, $lng);

        // 2. Get known roads in that kecamatan from survey_tasks
        $nearbyRoads = collect();
        if ($kecamatan) {
            $nearbyRoads = SurveyTask::where('kecamatan', $kecamatan)
                ->where('status', 'aktif')
                ->pluck('road_name')
                ->unique()
                ->values();
        }

        // 3. Reverse geocode via Nominatim (cached 24 jam)
        $cacheKey = 'reverse_geo_'.md5("{$lat},{$lng}");
        $geo = Cache::remember($cacheKey, 86400, function () use ($lat, $lng) {
            return $this->callNominatim($lat, $lng);
        });

        return response()->json([
            'success' => true,
            'data' => [
                'nama_jalan' => $geo['nama_jalan'] ?? null,
                'kecamatan' => $kecamatan,
                'sumber' => $geo['sumber'] ?? null,
                'nearby_roads' => $nearbyRoads,
                'lat' => $lat,
                'lng' => $lng,
            ],
        ]);
    }

    private function callNominatim(float $lat, float $lng): array
    {
        try {
            $response = Http::timeout(5)
                ->withHeaders([
                    'User-Agent' => 'DeltaJalan/1.0',
                    'Accept-Language' => 'id',
                ])
                ->get('https://nominatim.openstreetmap.org/reverse', [
                    'lat' => $lat,
                    'lon' => $lng,
                    'format' => 'jsonv2',
                    'zoom' => 18,
                    'addressdetails' => 1,
                ]);

            if (! $response->ok()) {
                return $this->callLocationIQ($lat, $lng);
            }

            $data = $response->json();
            $addr = $data['address'] ?? [];

            $namaJalan = $addr['road'] ?? $addr['pedestrian'] ?? $addr['path'] ?? null;
            if ($namaJalan) {
                $namaJalan = preg_replace('/^Jalan\s+/i', 'Jl. ', $namaJalan);
            }

            if (! $namaJalan && ! empty($data['display_name'])) {
                $parts = explode(',', $data['display_name']);
                $namaJalan = trim($parts[0]);
            }

            return [
                'nama_jalan' => $namaJalan,
                'sumber' => 'nominatim',
            ];
        } catch (\Exception $e) {
            return $this->callLocationIQ($lat, $lng);
        }
    }

    private function callLocationIQ(float $lat, float $lng): array
    {
        $key = config('services.locationiq.key');
        if (! $key) {
            return ['nama_jalan' => null, 'sumber' => null];
        }

        try {
            $response = Http::timeout(5)->get('https://us1.locationiq.com/v1/reverse', [
                'key' => $key,
                'lat' => $lat,
                'lon' => $lng,
                'format' => 'json',
                'zoom' => 18,
            ]);

            if (! $response->ok()) {
                return ['nama_jalan' => null, 'sumber' => null];
            }

            $data = $response->json();
            $addr = $data['address'] ?? [];

            $namaJalan = $addr['road'] ?? $addr['pedestrian'] ?? $addr['path'] ?? null;
            if ($namaJalan) {
                $namaJalan = preg_replace('/^Jalan\s+/i', 'Jl. ', $namaJalan);
            }

            return [
                'nama_jalan' => $namaJalan,
                'sumber' => 'locationiq',
            ];
        } catch (\Exception $e) {
            return ['nama_jalan' => null, 'sumber' => null];
        }
    }
}
