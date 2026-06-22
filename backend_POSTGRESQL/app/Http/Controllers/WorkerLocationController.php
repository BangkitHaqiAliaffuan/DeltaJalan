<?php

namespace App\Http\Controllers;

use App\Models\Upr;
use App\Models\WorkerLocation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WorkerLocationController extends Controller
{
    /**
     * POST /api/worker/location
     * Kirim lokasi terkini petugas eksekusi.
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->role !== 'petugas_eksekusi') {
            return response()->json(['success' => false, 'message' => 'Hanya petugas eksekusi yang dapat mengirim lokasi.'], 403);
        }

        $validated = $request->validate([
            'latitude' => 'required|numeric|between:-90,90',
            'longitude' => 'required|numeric|between:-180,180',
            'battery_level' => 'nullable|integer|between:0,100',
            'tracked_at' => 'nullable|date_format:Y-m-d H:i:s',
        ]);

        $location = WorkerLocation::create([
            'user_id' => $user->id,
            'latitude' => $validated['latitude'],
            'longitude' => $validated['longitude'],
            'battery_level' => $validated['battery_level'] ?? null,
            'tracked_at' => $validated['tracked_at'] ?? now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Lokasi tersimpan.',
            'data' => [
                'id' => $location->id,
            ],
        ], 201);
    }

    /**
     * GET /api/worker/uprs/nearest?lat=X&lng=Y
     * Daftar UPR/tim satgas diurutkan berdasarkan jarak ke lokasi laporan.
     * Jarak dihitung dari lokasi terakhir anggota tim yang aktif (tracked_at < 1 jam).
     */
    public function nearest(Request $request): JsonResponse
    {
        $request->validate([
            'lat' => 'required|numeric|between:-90,90',
            'lng' => 'required|numeric|between:-180,180',
        ]);

        $targetLat = (float) $request->input('lat');
        $targetLng = (float) $request->input('lng');

        // Ambil UPR aktif beserta lokasi terakhir anggota-anggotanya (max 1 jam)
        $uprs = Upr::where('is_active', true)
            ->with(['members' => function ($q) {
                $q->whereHas('locations', function ($q2) {
                    $q2->where('tracked_at', '>=', now()->subHour());
                })->with(['locations' => function ($q3) {
                    $q3->where('tracked_at', '>=', now()->subHour())
                        ->orderBy('tracked_at', 'desc');
                }]);
            }])
            ->get()
            ->map(function ($upr) use ($targetLat, $targetLng) {
                $locations = $upr->members->pluck('locations')->flatten();

                if ($locations->isEmpty()) {
                    return [
                        'id' => $upr->id,
                        'name' => $upr->name,
                        'leader_name' => $upr->leader_name,
                        'anggota_count' => $upr->members->count(),
                        'lat' => null,
                        'lng' => null,
                        'distance_m' => null,
                        'distance_label' => 'Tidak ada data lokasi',
                    ];
                }

                // Rata-rata koordinat dari semua anggota yang aktif
                $avgLat = $locations->avg('latitude');
                $avgLng = $locations->avg('longitude');

                $distance = $this->haversine($targetLat, $targetLng, $avgLat, $avgLng);

                return [
                    'id' => $upr->id,
                    'name' => $upr->name,
                    'leader_name' => $upr->leader_name,
                    'anggota_count' => $upr->members->count(),
                    'lat' => round($avgLat, 7),
                    'lng' => round($avgLng, 7),
                    'distance_m' => round($distance),
                    'distance_label' => $this->formatDistance($distance),
                ];
            })
            ->sortBy(function ($item) {
                return $item['distance_m'] ?? PHP_FLOAT_MAX;
            })
            ->values();

        return response()->json([
            'success' => true,
            'data' => $uprs,
        ]);
    }

    /**
     * GET /api/worker/uprs/{id}/locations?since=...
     * Riwayat lokasi anggota suatu UPR (untuk peta).
     */
    public function teamLocations(Request $request, int $id): JsonResponse
    {
        $upr = Upr::find($id);

        if (! $upr) {
            return response()->json(['success' => false, 'message' => 'UPR tidak ditemukan.'], 404);
        }

        $since = $request->input('since', now()->subHour()->toIso8601String());

        $locations = WorkerLocation::with('user')
            ->whereIn('user_id', function ($q) use ($id) {
                $q->select('id')->from('users')->where('upr_id', $id);
            })
            ->where('tracked_at', '>=', $since)
            ->orderBy('tracked_at', 'desc')
            ->limit(200)
            ->get()
            ->map(fn ($loc) => [
                'user_id' => $loc->user_id,
                'user_name' => $loc->user?->name ?? 'Unknown',
                'latitude' => $loc->latitude,
                'longitude' => $loc->longitude,
                'tracked_at' => $loc->tracked_at->toIso8601String(),
            ]);

        return response()->json([
            'success' => true,
            'data' => $locations,
        ]);
    }

    private function haversine(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $R = 6371000;
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);
        $a = sin($dLat / 2) ** 2
           + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;

        return $R * 2 * atan2(sqrt($a), sqrt(1 - $a));
    }

    private function formatDistance(float $meters): string
    {
        if ($meters < 1) {
            return '< 1 m';
        }
        if ($meters < 1000) {
            return '~'.round($meters).' m';
        }

        return '~'.round($meters / 1000, 1).' km';
    }
}
