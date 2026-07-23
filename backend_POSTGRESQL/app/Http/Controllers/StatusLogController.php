<?php

namespace App\Http\Controllers;

use App\Models\StatusLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StatusLogController extends Controller
{
    /**
     * GET /api/status-logs
     * Riwayat aktivitas sistem — semua perubahan status laporan.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! in_array($user->role, ['supervisor', 'petugas', 'admin'], true)) {
            return response()->json(['success' => false, 'message' => 'Akses ditolak.'], 403);
        }

        $query = StatusLog::query()->with('report:id,report_code,road_name,district');

        if ($request->filled('report_id')) {
            $query->where('report_id', $request->input('report_id'));
        }

        if ($request->filled('actor_name')) {
            $query->where('actor_name', 'ilike', '%'.$request->input('actor_name').'%');
        }

        if ($request->filled('status')) {
            $query->where('new_status', $request->input('status'));
        }

        if ($request->filled('from')) {
            $query->where('created_at', '>=', $request->input('from'));
        }

        if ($request->filled('to')) {
            $query->where('created_at', '<=', $request->input('to').' 23:59:59');
        }

        $limit = min((int) $request->input('limit', 50), 100);
        $page = max(1, (int) $request->input('page', 1));

        $total = (clone $query)->count();

        $logs = $query->orderBy('created_at', 'desc')
            ->skip(($page - 1) * $limit)
            ->take($limit)
            ->get()
            ->map(fn ($log) => [
                'id' => $log->id,
                'report_id' => $log->report_id,
                'report_code' => $log->report?->report_code,
                'road_name' => $log->report?->road_name,
                'district' => $log->report?->district,
                'old_status' => $log->old_status,
                'new_status' => $log->new_status,
                'actor_name' => $log->actor_name,
                'actor_role' => $log->actor_role,
                'notes' => $log->notes,
                'created_at' => $log->created_at?->toIso8601String(),
            ]);

        return response()->json([
            'success' => true,
            'data' => $logs,
            'total' => $total,
            'page' => $page,
            'last_page' => max(1, (int) ceil($total / $limit)),
        ]);
    }
}
