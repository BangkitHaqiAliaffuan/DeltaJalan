<?php

namespace App\Http\Controllers;

use App\Models\SurveyTask;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class ReverseGeocodeController extends Controller
{
    private const KECAMATAN_BBOX = [
        'Porong' => [-7.559, 112.659, -7.503, 112.808],
        'Tanggulangin' => [-7.535, 112.662, -7.476, 112.782],
        'Waru' => [-7.370, 112.708, -7.337, 112.828],
        'Gedangan' => [-7.415, 112.697, -7.364, 112.758],
        'Sidoarjo' => [-7.526, 112.660, -7.422, 112.824],
        'Candi' => [-7.519, 112.660, -7.452, 112.804],
        'Buduran' => [-7.480, 112.693, -7.406, 112.819],
        'Sedati' => [-7.485, 112.745, -7.330, 112.842],
        'Taman' => [-7.390, 112.615, -7.336, 112.720],
        'Krian' => [-7.438, 112.558, -7.368, 112.632],
        'Balongbendo' => [-7.439, 112.472, -7.397, 112.577],
        'Wonoayu' => [-7.455, 112.588, -7.401, 112.671],
        'Sukodono' => [-7.430, 112.625, -7.367, 112.706],
        'Krembung' => [-7.556, 112.605, -7.477, 112.672],
        'Tulangan' => [-7.510, 112.611, -7.442, 112.684],
        'Tarik' => [-7.471, 112.457, -7.425, 112.565],
        'Prambon' => [-7.504, 112.540, -7.432, 112.622],
        'Jabon' => [-7.577, 112.704, -7.493, 112.880],
    ];

    public function __invoke(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'lat' => 'required|numeric|between:-8.5,-7',
            'lng' => 'required|numeric|between:112.3,113.1',
        ]);

        $lat = (float) $validated['lat'];
        $lng = (float) $validated['lng'];

        // 1. Detect kecamatan from bounding box
        $kecamatan = $this->detectKecamatan($lat, $lng);

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

    private function detectKecamatan(float $lat, float $lng): ?string
    {
        foreach (self::KECAMATAN_BBOX as $name => [$s, $w, $n, $e]) {
            if ($lat >= $s && $lat <= $n && $lng >= $w && $lng <= $e) {
                return $name;
            }
        }

        return null;
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
