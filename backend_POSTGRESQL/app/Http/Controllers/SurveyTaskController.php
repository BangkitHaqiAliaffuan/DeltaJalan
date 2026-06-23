<?php

namespace App\Http\Controllers;

use App\Models\SurveyTask;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SurveyTaskController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $query = SurveyTask::with('team')
            ->withCount('reports')
            ->orderBy('created_at', 'desc');

        if ($request->filled('team_id')) {
            $query->where('team_id', $request->team_id);
        } elseif ($user->role !== 'supervisor' && $user->role !== 'admin') {
            $query->where('team_id', $user->team_id);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }
        if ($request->filled('priority')) {
            $query->where('priority', $request->priority);
        }
        if ($request->filled('q')) {
            $q = $request->q;
            $query->where(function ($qry) use ($q) {
                $qry->where('road_name', 'ilike', "%{$q}%")
                    ->orWhere('kecamatan', 'ilike', "%{$q}%");
            });
        }
        if ($request->filled('tanggal_patroli')) {
            $tanggal = $request->tanggal_patroli;
            if ($tanggal === 'today') {
                $tanggal = now()->format('Y-m-d');
            }
            $query->where('tanggal_patroli', $tanggal);
        }

        $perPage = min((int) $request->get('per_page', 20), 100);
        $tasks = $query->paginate($perPage);

        return response()->json($tasks);
    }

    public function stats(Request $request): JsonResponse
    {
        $user = $request->user();

        $query = SurveyTask::query();

        if ($request->filled('team_id')) {
            $query->where('team_id', $request->team_id);
        } elseif ($user->role !== 'supervisor' && $user->role !== 'admin') {
            $query->where('team_id', $user->team_id);
        }

        $stats = $query->selectRaw("
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE status = 'aktif') as aktif,
            COUNT(*) FILTER (WHERE status = 'selesai') as selesai,
            COUNT(*) FILTER (WHERE status = 'dibatalkan') as dibatalkan
        ")->first();

        return response()->json([
            'total' => (int) $stats->total,
            'aktif' => (int) $stats->aktif,
            'selesai' => (int) $stats->selesai,
            'dibatalkan' => (int) $stats->dibatalkan,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        if ($user->role !== 'supervisor' && $user->role !== 'admin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'road_name' => 'nullable|string|max:255',
            'kecamatan' => 'required|string|max:100',
            'road_geometry' => 'nullable|array',
            'road_geometry.*' => 'array|size:2',
            'road_length_m' => 'nullable|numeric|min:0',
            'team_id' => 'required|exists:teams,id',
            'priority' => 'nullable|in:Tinggi,Sedang,Rendah',
            'catatan' => 'nullable|string|max:1000',
            'tanggal_patroli' => 'nullable|date',
            'alasan_tugas' => 'nullable|string|in:rutin,tindak_lanjut,pengaduan',
        ]);

        $validated['status'] = 'aktif';
        $validated['road_geometry'] = $request->input('road_geometry', []);
        if (! isset($validated['tanggal_patroli'])) {
            $validated['tanggal_patroli'] = now()->format('Y-m-d');
        }
        if (! isset($validated['alasan_tugas'])) {
            $validated['alasan_tugas'] = 'rutin';
        }

        $task = DB::transaction(function () use ($validated) {
            return SurveyTask::create($validated);
        });

        $task->load('team');

        return response()->json([
            'data' => $task,
            'message' => 'Shift patroli berhasil dibuat.',
        ], 201);
    }

    public function show(string $id): JsonResponse
    {
        $user = request()->user();

        $task = SurveyTask::with([
            'team',
            'reports' => function ($q) {
                $q->orderBy('created_at', 'desc');
            },
        ])->withCount('reports')->find($id);

        if (! $task) {
            return response()->json(['message' => 'Shift tidak ditemukan.'], 404);
        }

        if ($user->role !== 'supervisor' && $user->role !== 'admin') {
            if ($task->team_id !== $user->team_id) {
                return response()->json(['message' => 'Forbidden'], 403);
            }
        }

        return response()->json(['data' => $task]);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        if ($user->role !== 'supervisor' && $user->role !== 'admin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $task = SurveyTask::find($id);
        if (! $task) {
            return response()->json(['message' => 'Shift tidak ditemukan.'], 404);
        }

        $validated = $request->validate([
            'road_name' => 'nullable|string|max:255',
            'kecamatan' => 'sometimes|string|max:100',
            'road_geometry' => 'nullable|array',
            'road_length_m' => 'nullable|numeric|min:0',
            'team_id' => 'sometimes|exists:teams,id',
            'priority' => 'sometimes|in:Tinggi,Sedang,Rendah',
            'catatan' => 'nullable|string|max:1000',
            'tanggal_patroli' => 'sometimes|date',
            'alasan_tugas' => 'sometimes|string|in:rutin,tindak_lanjut,pengaduan',
        ]);

        $task->update($validated);
        $task->load('team');

        return response()->json([
            'data' => $task,
            'message' => 'Shift berhasil diperbarui.',
        ]);
    }

    public function destroy(string $id): JsonResponse
    {
        $user = request()->user();
        if ($user->role !== 'supervisor' && $user->role !== 'admin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $task = SurveyTask::find($id);
        if (! $task) {
            return response()->json(['message' => 'Shift tidak ditemukan.'], 404);
        }
        if ($task->reports()->exists()) {
            return response()->json(['message' => 'Shift dengan laporan tidak bisa dihapus.'], 422);
        }

        $task->delete();

        return response()->json(['message' => 'Shift berhasil dihapus.']);
    }

    public function selesai(string $id): JsonResponse
    {
        $task = SurveyTask::find($id);
        if (! $task) {
            return response()->json(['message' => 'Shift tidak ditemukan.'], 404);
        }
        if ($task->status !== 'aktif') {
            return response()->json(['message' => 'Hanya shift aktif yang bisa diselesaikan.'], 422);
        }

        $task->update([
            'status' => 'selesai',
            'selesai_at' => now(),
        ]);

        return response()->json(['message' => 'Shift berhasil diselesaikan.']);
    }

    public function batalkan(string $id): JsonResponse
    {
        $user = request()->user();
        if ($user->role !== 'supervisor' && $user->role !== 'admin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $task = SurveyTask::find($id);
        if (! $task) {
            return response()->json(['message' => 'Shift tidak ditemukan.'], 404);
        }

        $task->update(['status' => 'dibatalkan']);

        return response()->json(['message' => 'Shift berhasil dibatalkan.']);
    }
}
