<?php

namespace App\Http\Controllers;

use App\Models\PatrolSchedule;
use App\Models\SurveyTask;
use App\Models\User;
use App\Notifications\PatrolTaskGeneratedNotification;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;

class PatrolScheduleController extends Controller
{
    private function generateTasks(PatrolSchedule $schedule, Carbon $start, Carbon $end): int
    {
        $current = $start->copy()->startOfDay();
        $endDate = $end->copy()->startOfDay();
        $count = 0;
        $batch = [];
        $kecList = $schedule->kecamatan_list ?? [];
        $kecCount = count($kecList);

        $kecIndex = 0;
        $tempCursor = Carbon::parse($schedule->start_date)->startOfDay();
        $genStartCursor = $start->copy()->startOfDay();
        while ($tempCursor < $genStartCursor) {
            if ($schedule->isPatrolDay($tempCursor)) {
                $kecIndex++;
            }
            $tempCursor->addDay();
        }

        while ($current <= $endDate) {
            if ($schedule->isPatrolDay($current)) {
                if ($kecCount === 0) {
                    break;
                }

                $tanggal = $current->format('Y-m-d');
                $kec = $kecList[$kecIndex % $kecCount];
                $kecIndex++;

                $exists = SurveyTask::where('team_id', $schedule->team_id)
                    ->where('tanggal_patroli', $tanggal)
                    ->where('status', 'aktif')
                    ->exists();

                if (! $exists) {
                    $batch[] = [
                        'id' => (string) Str::uuid(),
                        'team_id' => $schedule->team_id,
                        'kecamatan' => $kec,
                        'tanggal_patroli' => $tanggal,
                        'jam_mulai' => $schedule->jam_mulai ?? '09:00',
                        'jam_selesai' => $schedule->jam_selesai ?? '16:00',
                        'alasan_tugas' => $schedule->alasan_tugas ?? 'rutin',
                        'status' => 'aktif',
                        'created_at' => now(),
                        'updated_at' => now(),
                    ];
                    $count++;
                }
            }
            $current->addDay();

            if (count($batch) >= 50) {
                SurveyTask::insert($batch);
                $batch = [];
            }
        }

        if (! empty($batch)) {
            SurveyTask::insert($batch);
        }

        return $count;
    }

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        if ($user->role !== 'supervisor' && $user->role !== 'admin' && $user->role !== 'petugas') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $query = PatrolSchedule::with('team')
            ->with(['team.surveyTasks' => function ($q) {
                $q->where('status', 'aktif');
            }])
            ->orderBy('created_at', 'desc');

        if ($user->role === 'petugas') {
            $query->where('team_id', $user->team_id)->where('status', 'aktif');
        } elseif ($request->filled('team_id')) {
            $query->where('team_id', $request->team_id);
        }
        if ($request->filled('status') && $user->role !== 'petugas') {
            $query->where('status', $request->status);
        }

        $schedules = $query->paginate(min((int) $request->get('per_page', 20), 100));

        return response()->json($schedules);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        if ($user->role !== 'supervisor' && $user->role !== 'admin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'team_id' => 'required|exists:teams,id',
            'hari' => 'required|array|min:3',
            'hari.*' => 'required|string|in:Senin,Selasa,Rabu,Kamis,Jumat,Sabtu,Minggu',
            'kecamatan_list' => 'required|array|min:1',
            'kecamatan_list.*' => 'required|string|max:100',
            'frekuensi' => 'required|string|in:setiap_minggu,dua_mingguan,bulanan',
            'start_date' => 'required|date|after_or_equal:today',
            'end_date' => 'nullable|date|after_or_equal:start_date',
            'alasan_tugas' => 'nullable|string|in:rutin,tindak_lanjut,pengaduan',
            'jam_mulai' => 'nullable|string|date_format:H:i',
            'jam_selesai' => 'nullable|string|date_format:H:i',
        ]);

        if (isset($validated['kecamatan_list'])) {
            $validated['kecamatan_list'] = array_values(array_unique($validated['kecamatan_list']));
        }

        $duplicate = PatrolSchedule::where('team_id', $validated['team_id'])
            ->where('status', 'aktif')
            ->exists();

        if ($duplicate) {
            return response()->json(['message' => 'Tim satgas ini sudah memiliki jadwal aktif.'], 409);
        }

        $schedule = DB::transaction(function () use ($validated, $user) {
            $validated['status'] = 'aktif';
            $validated['created_by'] = $user->id;

            $schedule = PatrolSchedule::create($validated);

            $start = Carbon::parse($schedule->start_date);
            $end = $schedule->end_date
                ? Carbon::parse($schedule->end_date)
                : $start->copy()->addWeeks(2)->endOfDay();

            $generated = $this->generateTasks($schedule, $start, $end);

            $schedule->generated_count = $generated;

            return $schedule;
        });

        $schedule->load('team');

        if (($schedule->generated_count ?? 0) > 0) {
            $this->notifyTeam($schedule->team_id, $schedule->team?->name ?? 'Tim Satgas', $schedule->generated_count);
        }

        return response()->json([
            'data' => $schedule,
            'message' => "Jadwal patroli dibuat dengan {$schedule->generated_count} shift.",
        ], 201);
    }

    public function show(string $id): JsonResponse
    {
        $user = request()->user();
        if ($user->role !== 'supervisor' && $user->role !== 'admin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $schedule = PatrolSchedule::with('team')->find($id);
        if (! $schedule) {
            return response()->json(['message' => 'Jadwal tidak ditemukan.'], 404);
        }

        $endDate = $schedule->end_date ?? now()->addYear()->format('Y-m-d');
        $schedule->load(['team.surveyTasks' => function ($q) use ($schedule, $endDate) {
            $q->where('status', 'aktif')
                ->whereBetween('tanggal_patroli', [$schedule->start_date, $endDate])
                ->withCount('reports')
                ->orderBy('tanggal_patroli', 'asc');
        }]);

        return response()->json(['data' => $schedule]);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        if ($user->role !== 'supervisor' && $user->role !== 'admin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $schedule = PatrolSchedule::find($id);
        if (! $schedule) {
            return response()->json(['message' => 'Jadwal tidak ditemukan.'], 404);
        }

        $validated = $request->validate([
            'team_id' => 'sometimes|exists:teams,id',
            'hari' => 'sometimes|array|min:3',
            'hari.*' => 'required|string|in:Senin,Selasa,Rabu,Kamis,Jumat,Sabtu,Minggu',
            'kecamatan_list' => 'sometimes|array|min:1',
            'kecamatan_list.*' => 'required|string|max:100',
            'frekuensi' => 'sometimes|string|in:setiap_minggu,dua_mingguan,bulanan',
            'start_date' => 'sometimes|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
            'alasan_tugas' => 'nullable|string|in:rutin,tindak_lanjut,pengaduan',
            'status' => 'sometimes|string|in:aktif,nonaktif',
            'jam_mulai' => 'nullable|string|date_format:H:i',
            'jam_selesai' => 'nullable|string|date_format:H:i',
        ]);

        if (isset($validated['kecamatan_list'])) {
            $validated['kecamatan_list'] = array_values(array_unique($validated['kecamatan_list']));
        }

        $newCount = 0;
        DB::transaction(function () use ($schedule, $validated, &$newCount) {
            $schedule->update($validated);

            if ($schedule->wasChanged(['hari', 'kecamatan_list', 'frekuensi', 'start_date', 'end_date', 'team_id'])) {
                SurveyTask::where('team_id', $schedule->team_id)
                    ->whereNull('selesai_at')
                    ->where('status', 'aktif')
                    ->where('created_at', '>=', now()->subDays(30))
                    ->whereDoesntHave('reports')
                    ->delete();

                $start = Carbon::parse($schedule->start_date);
                $end = $schedule->end_date
                    ? Carbon::parse($schedule->end_date)
                    : $start->copy()->addWeeks(2)->endOfDay();

                $newCount = $this->generateTasks($schedule, $start, $end);
            }
        });

        $schedule->load('team');

        if ($newCount > 0) {
            $this->notifyTeam($schedule->team_id, $schedule->team?->name ?? 'Tim Satgas', $newCount);
        }

        return response()->json([
            'data' => $schedule,
            'message' => 'Jadwal patroli diperbarui.',
        ]);
    }

    public function destroy(string $id): JsonResponse
    {
        $user = request()->user();
        if ($user->role !== 'supervisor' && $user->role !== 'admin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $schedule = PatrolSchedule::find($id);
        if (! $schedule) {
            return response()->json(['message' => 'Jadwal tidak ditemukan.'], 404);
        }

        DB::transaction(function () use ($schedule) {
            SurveyTask::where('team_id', $schedule->team_id)
                ->whereNull('selesai_at')
                ->where('status', 'aktif')
                ->where('created_at', '>=', now()->subDays(30))
                ->whereDoesntHave('reports')
                ->delete();

            $schedule->delete();
        });

        return response()->json(['message' => 'Jadwal patroli berhasil dihapus.']);
    }

    public function generate(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        if ($user->role !== 'supervisor' && $user->role !== 'admin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $schedule = PatrolSchedule::find($id);
        if (! $schedule) {
            return response()->json(['message' => 'Jadwal tidak ditemukan.'], 404);
        }

        if ($schedule->status !== 'aktif') {
            return response()->json(['message' => 'Hanya jadwal aktif yang bisa digenerate.'], 422);
        }

        $validated = $request->validate([
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
        ]);

        $start = Carbon::parse($validated['start_date']);
        $end = Carbon::parse($validated['end_date']);

        $generated = $this->generateTasks($schedule, $start, $end);

        if ($generated > 0) {
            $schedule->load('team');
            $this->notifyTeam($schedule->team_id, $schedule->team?->name ?? 'Tim Satgas', $generated);
        }

        return response()->json([
            'message' => "{$generated} shift berhasil digenerate.",
            'generated_count' => $generated,
        ]);
    }

    public function toggle(string $id): JsonResponse
    {
        $user = request()->user();
        if ($user->role !== 'supervisor' && $user->role !== 'admin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $schedule = PatrolSchedule::find($id);
        if (! $schedule) {
            return response()->json(['message' => 'Jadwal tidak ditemukan.'], 404);
        }

        $schedule->update([
            'status' => $schedule->status === 'aktif' ? 'nonaktif' : 'aktif',
        ]);

        return response()->json([
            'data' => $schedule,
            'message' => $schedule->status === 'aktif' ? 'Jadwal diaktifkan.' : 'Jadwal dinonaktifkan.',
        ]);
    }

    public function preview(Request $request): JsonResponse
    {
        $user = $request->user();
        if ($user->role !== 'supervisor' && $user->role !== 'admin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'hari' => 'required|array|min:3',
            'hari.*' => 'required|string|in:Senin,Selasa,Rabu,Kamis,Jumat,Sabtu,Minggu',
            'kecamatan_list' => 'required|array|min:1',
            'kecamatan_list.*' => 'required|string|max:100',
            'frekuensi' => 'sometimes|string|in:setiap_minggu,dua_mingguan,bulanan',
            'start_date' => 'required|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
        ]);

        $kecamatanCount = count(array_unique($validated['kecamatan_list']));

        $start = Carbon::parse($validated['start_date']);
        $end = $validated['end_date']
            ? Carbon::parse($validated['end_date'])
            : $start->copy()->addWeeks(2)->endOfDay();

        $dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        $hariSet = array_flip($validated['hari']);
        $frekuensi = $validated['frekuensi'] ?? 'setiap_minggu';

        $taskCount = 0;
        $kecIndex = 0;
        $current = $start->copy()->startOfDay();
        while ($current <= $end) {
            $dayName = $dayNames[(int) $current->format('w')];
            if (isset($hariSet[$dayName])) {
                $isPatrol = match ($frekuensi) {
                    'dua_mingguan' => $this->weekIndexSincePreview($start, $current) % 2 === 0,
                    'bulanan' => $this->isFirstWeekdayInMonthPreview($current),
                    default => true,
                };
                if ($isPatrol && $kecamatanCount > 0) {
                    $taskCount++;
                    $kecIndex++;
                }
            }
            $current->addDay();
        }

        return response()->json([
            'preview' => [
                'total_hari' => $start->diffInDays($end) + 1,
                'hari_patroli' => count($validated['hari']),
                'kecamatan_count' => $kecamatanCount,
                'estimated_tasks' => $taskCount,
                'start_date' => $start->format('Y-m-d'),
                'end_date' => $end->format('Y-m-d'),
            ],
        ]);
    }

    private function notifyTeam(string $teamId, string $teamName, int $count, string $period = '2 minggu'): void
    {
        $petugas = User::where('team_id', $teamId)
            ->where('role', 'petugas')
            ->get();

        if ($petugas->isNotEmpty()) {
            Notification::send($petugas, new PatrolTaskGeneratedNotification(
                teamName: $teamName,
                count: $count,
                period: $period,
            ));
        }
    }

    private function weekIndexSincePreview(Carbon $start, Carbon $date): int
    {
        $startWeekStart = $start->copy()->startOfWeek();

        return (int) $startWeekStart->diffInWeeks($date->copy()->startOfWeek());
    }

    private function isFirstWeekdayInMonthPreview(Carbon $date): bool
    {
        $dayOfWeek = (int) $date->format('w');
        $firstOfMonth = $date->copy()->startOfMonth();
        $diff = ($dayOfWeek - (int) $firstOfMonth->format('w') + 7) % 7;
        $firstOccurrence = $firstOfMonth->addDays($diff);

        return $firstOccurrence->format('Y-m-d') === $date->format('Y-m-d');
    }
}
