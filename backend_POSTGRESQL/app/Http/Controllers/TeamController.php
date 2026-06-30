<?php

namespace App\Http\Controllers;

use App\Models\SurveyTask;
use App\Models\Team;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TeamController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! in_array($user->role, ['supervisor', 'admin'], true)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $teams = Team::withCount('members')
            ->with('uptd')
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $teams]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! in_array($user->role, ['supervisor', 'admin'], true)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string|max:1000',
        ]);

        $team = Team::create($validated);

        return response()->json(['data' => $team, 'message' => 'Tim berhasil dibuat.'], 201);
    }

    public function show(string $id): JsonResponse
    {
        $user = request()->user();
        if (! in_array($user->role, ['supervisor', 'admin'], true)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $team = Team::with('members')->find($id);
        if (! $team) {
            return response()->json(['message' => 'Tim tidak ditemukan.'], 404);
        }

        return response()->json(['data' => $team]);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        if (! in_array($user->role, ['supervisor', 'admin'], true)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $team = Team::find($id);
        if (! $team) {
            return response()->json(['message' => 'Tim tidak ditemukan.'], 404);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string|max:1000',
        ]);

        $team->update($validated);

        return response()->json(['data' => $team, 'message' => 'Tim berhasil diperbarui.']);
    }

    public function destroy(string $id): JsonResponse
    {
        $user = request()->user();
        if (! in_array($user->role, ['supervisor', 'admin'], true)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $team = Team::find($id);
        if (! $team) {
            return response()->json(['message' => 'Tim tidak ditemukan.'], 404);
        }

        $memberCount = $team->members()->count();
        if ($memberCount > 0) {
            return response()->json(['message' => 'Tim masih memiliki anggota. Hapus anggota terlebih dahulu.'], 422);
        }

        if ($team->periods()->exists()) {
            return response()->json(['message' => 'Tim memiliki periode survei. Tidak bisa dihapus.'], 422);
        }

        $team->delete();

        return response()->json(['message' => 'Tim berhasil dihapus.']);
    }

    public function assignMembers(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        if (! in_array($user->role, ['supervisor', 'admin'], true)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $team = Team::find($id);
        if (! $team) {
            return response()->json(['message' => 'Tim tidak ditemukan.'], 404);
        }

        $validated = $request->validate([
            'user_ids' => 'required|array',
            'user_ids.*' => 'integer|exists:users,id',
        ]);

        DB::transaction(function () use ($validated, $team) {
            User::whereIn('id', $validated['user_ids'])
                ->where('role', 'petugas')
                ->update(['team_id' => $team->id]);
        });

        $team->load('members');

        return response()->json(['data' => $team, 'message' => 'Anggota tim berhasil diperbarui.']);
    }

    public function removeMember(string $id, string $userId): JsonResponse
    {
        $user = request()->user();
        if (! in_array($user->role, ['supervisor', 'admin'], true)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $team = Team::find($id);
        if (! $team) {
            return response()->json(['message' => 'Tim tidak ditemukan.'], 404);
        }

        $member = User::where('id', $userId)->where('team_id', $team->id)->first();
        if (! $member) {
            return response()->json(['message' => 'Anggota tidak ditemukan dalam tim ini.'], 404);
        }

        $member->update(['team_id' => null]);

        return response()->json(['message' => 'Anggota berhasil dikeluarkan dari tim.']);
    }

    // ── Road management ────────────────────────────────────────────────────────

    public function roads(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        if (! in_array($user->role, ['supervisor', 'admin'], true)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $team = Team::find($id);
        if (! $team) {
            return response()->json(['message' => 'Tim tidak ditemukan.'], 404);
        }

        $tasks = SurveyTask::where('team_id', $team->id)
            ->withCount('reports')
            ->orderBy('road_name')
            ->get();

        return response()->json(['data' => $tasks]);
    }

    public function assignRoads(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        if (! in_array($user->role, ['supervisor', 'admin'], true)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $team = Team::find($id);
        if (! $team) {
            return response()->json(['message' => 'Tim tidak ditemukan.'], 404);
        }

        $validated = $request->validate([
            'road_name' => 'required|string|max:255',
            'kecamatan' => 'nullable|string|max:100',
            'road_geometry' => 'nullable|array',
            'road_geometry.*' => 'array|size:2',
            'road_length_m' => 'nullable|numeric|min:0',
            'catatan' => 'nullable|string|max:1000',
        ]);

        $validated['team_id'] = $team->id;
        $validated['status'] = 'aktif';

        $task = SurveyTask::create($validated);

        return response()->json(['data' => $task, 'message' => 'Ruas berhasil ditambahkan ke tim.'], 201);
    }

    public function unassignRoad(string $id, string $taskId): JsonResponse
    {
        $user = request()->user();
        if (! in_array($user->role, ['supervisor', 'admin'], true)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $task = SurveyTask::where('id', $taskId)->where('team_id', $id)->first();
        if (! $task) {
            return response()->json(['message' => 'Ruas tidak ditemukan dalam tim ini.'], 404);
        }
        if ($task->reports()->exists()) {
            return response()->json(['message' => 'Ruas dengan laporan tidak bisa dihapus.'], 422);
        }

        $task->delete();

        return response()->json(['message' => 'Ruas berhasil dihapus dari tim.']);
    }
}
