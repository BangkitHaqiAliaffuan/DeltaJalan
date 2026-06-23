<?php

namespace App\Http\Controllers;

use App\Models\Road;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RoadController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Road::query();

        if ($request->filled('kecamatan')) {
            $query->where('kecamatan', $request->kecamatan);
        }
        if ($request->filled('q')) {
            $q = $request->q;
            $query->where('nama_ruas', 'ilike', "%{$q}%");
        }

        $roads = $query->orderBy('nama_ruas')->limit(20)->get();

        return response()->json(['data' => $roads]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'kode_ruas' => 'nullable|string|max:20',
            'nama_ruas' => 'required|string|max:255',
            'kecamatan' => 'required|string|max:100',
            'panjang_km' => 'nullable|numeric|min:0',
            'polyline' => 'nullable|array',
            'sumber_polyline' => 'nullable|string|in:osm,nominatim,locationiq',
        ]);

        $road = Road::updateOrCreate(
            ['nama_ruas' => $validated['nama_ruas'], 'kecamatan' => $validated['kecamatan']],
            $validated
        );

        return response()->json(['data' => $road, 'message' => 'Ruas jalan disimpan.'], 201);
    }
}
