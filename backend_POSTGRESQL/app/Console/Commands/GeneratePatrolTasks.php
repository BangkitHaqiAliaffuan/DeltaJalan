<?php

namespace App\Console\Commands;

use App\Models\PatrolSchedule;
use App\Models\SurveyTask;
use App\Models\User;
use App\Notifications\PatrolTaskGeneratedNotification;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;

class GeneratePatrolTasks extends Command
{
    protected $signature = 'patrol:generate-tasks
        {--days=7 : Number of days ahead to generate}
        {--schedule= : Generate for a specific schedule ID only}';

    protected $description = 'Generate survey tasks from active patrol schedules';

    private const DAY_MAP = [
        'Minggu' => 0, 'Senin' => 1, 'Selasa' => 2, 'Rabu' => 3,
        'Kamis' => 4, 'Jumat' => 5, 'Sabtu' => 6,
    ];

    public function handle(): int
    {
        $days = (int) $this->option('days');
        $scheduleId = $this->option('schedule');

        $query = PatrolSchedule::where('status', 'aktif');
        if ($scheduleId) {
            $query->where('id', $scheduleId);
        }

        $schedules = $query->get();

        if ($schedules->isEmpty()) {
            $this->warn('Tidak ada jadwal aktif ditemukan.');

            return 0;
        }

        $start = Carbon::today();
        $end = Carbon::today()->addDays($days)->endOfDay();
        $totalGenerated = 0;

        foreach ($schedules as $schedule) {
            if ($schedule->end_date && Carbon::parse($schedule->end_date)->isBefore($start)) {
                continue;
            }

            $scheduleStart = max($start, Carbon::parse($schedule->start_date));
            $scheduleEnd = $schedule->end_date
                ? min($end, Carbon::parse($schedule->end_date)->endOfDay())
                : $end;

            $dayNumbers = array_map(fn ($d) => self::DAY_MAP[$d] ?? -1, $schedule->hari ?? []);
            $dayNumbers = array_filter($dayNumbers, fn ($n) => $n >= 0);

            $generated = $this->generateForSchedule($schedule, $scheduleStart, $scheduleEnd, $dayNumbers);
            $totalGenerated += $generated;

            if ($generated > 0) {
                $petugas = User::where('team_id', $schedule->team_id)
                    ->where('role', 'petugas')
                    ->get();
                if ($petugas->isNotEmpty()) {
                    Notification::send($petugas, new PatrolTaskGeneratedNotification(
                        teamName: $schedule->team?->name ?? 'Tim Satgas',
                        count: $generated,
                        period: "{$days} hari",
                    ));
                }
            }

            $this->info("  {$schedule->team?->name}: {$generated} shift");
        }

        $this->info("Selesai: {$totalGenerated} shift digenerate untuk {$days} hari ke depan.");

        return 0;
    }

    private function generateForSchedule(PatrolSchedule $schedule, Carbon $start, Carbon $end, array $dayNumbers): int
    {
        $current = $start->copy()->startOfDay();
        $endDate = $end->copy()->startOfDay();
        $count = 0;
        $batch = [];
        $kecList = $schedule->kecamatan_list ?? [];
        $kecCount = count($kecList);
        $kecIndex = 0;

        while ($current <= $endDate) {
            if (in_array((int) $current->format('w'), $dayNumbers)) {
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
}
