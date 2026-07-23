<?php

namespace App\Http\Controllers;

use App\Models\Report;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class PciController extends Controller
{
    public function overview(Request $request): JsonResponse
    {
        $user = $request->user();

        $query = Report::whereNotNull('pci_score');

        if ($user->role !== 'admin') {
            $query->where('assigned_supervisor_id', $user->id);
        }

        $cacheKey = 'pci_overview_'.($user->id ?? '0');
        $data = Cache::remember($cacheKey, 120, function () use ($query) {
            $districts = (clone $query)
                ->select(
                    'district',
                    DB::raw('COUNT(*) as total'),
                    DB::raw('ROUND(AVG(pci_score)::numeric, 2) as avg_pci'),
                    DB::raw('MIN(pci_score) as min_pci'),
                    DB::raw('MAX(pci_score) as max_pci'),
                    DB::raw('SUM(CASE WHEN pci_score <= 40 THEN 1 ELSE 0 END) as kritis')
                )
                ->groupBy('district')
                ->orderBy('avg_pci')
                ->get();

            $kabupaten = (clone $query)
                ->selectRaw('
                    COUNT(*) as total_laporan,
                    ROUND(AVG(pci_score)::numeric, 2) as avg_pci,
                    SUM(CASE WHEN pci_score <= 40 THEN 1 ELSE 0 END) as kritis
                ')
                ->first();

            return [
                'districts' => $districts,
                'kabupaten' => $kabupaten,
            ];
        });

        return response()->json([
            'success' => true,
            'data' => $data,
        ]);
    }

    public function trend(Request $request): JsonResponse
    {
        $request->validate([
            'road_name' => 'required|string|max:255',
            'days' => 'nullable|integer|min:1|max:365',
        ]);

        $roadName = $request->input('road_name');
        $days = (int) $request->input('days', 90);

        $trend = Report::where('road_name', $roadName)
            ->whereNotNull('pci_score')
            ->where('created_at', '>=', now()->subDays($days))
            ->orderBy('created_at')
            ->get(['id', 'pci_score', 'pci_calculated_at', 'created_at', 'overall_severity', 'status', 'district']);

        $avgPci = $trend->avg('pci_score');

        return response()->json([
            'success' => true,
            'data' => [
                'road_name' => $roadName,
                'days' => $days,
                'avg_pci' => $avgPci ? round($avgPci, 2) : null,
                'total_reports' => $trend->count(),
                'trend' => $trend,
            ],
        ]);
    }

    public function kritis(Request $request): JsonResponse
    {
        $limit = min((int) $request->input('limit', 50), 100);

        $kritis = Report::where('pci_score', '<=', 40)
            ->whereNotNull('pci_score')
            ->whereNotIn('status', ['Selesai', 'Dibatalkan'])
            ->orderBy('pci_score')
            ->orderBy('created_at', 'asc')
            ->limit($limit)
            ->get([
                'id', 'report_code', 'road_name', 'district',
                'latitude', 'longitude', 'pci_score', 'overall_severity',
                'status', 'created_at', 'source',
            ]);

        return response()->json([
            'success' => true,
            'data' => $kritis,
            'meta' => [
                'total' => $kritis->count(),
                'limit' => $limit,
            ],
        ]);
    }
}
