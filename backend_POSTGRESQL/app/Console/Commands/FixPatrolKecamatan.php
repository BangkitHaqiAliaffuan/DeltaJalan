<?php

namespace App\Console\Commands;

use App\Models\PatrolSchedule;
use App\Models\SurveyTask;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Str;

class FixPatrolKecamatan extends Command
{
    protected $signature = 'patrol:fix-kecamatan {scheduleId? : Specific schedule ID to fix}';

    protected $description = 'Fix survey task kecamatan assignments to match patrol schedule sequential cycling';

    public function handle(): int
    {
        $scheduleId = $this->argument('scheduleId');

        $query = PatrolSchedule::where('status', 'aktif');
        if ($scheduleId) {
            $query->where('id', $scheduleId);
        }

        $schedules = $query->get();

        if ($schedules->isEmpty()) {
            $this->warn('Tidak ada jadwal aktif ditemukan.');

            return 0;
        }

        $totalFixed = 0;
        $totalCreated = 0;

        foreach ($schedules as $schedule) {
            $kecList = $schedule->kecamatan_list ?? [];
            $kecCount = count($kecList);

            if ($kecCount === 0) {
                $this->warn("  {$schedule->team?->name}: kecamatan list kosong, skip");

                continue;
            }

            $start = Carbon::parse($schedule->start_date)->startOfDay();
            $end = $schedule->end_date
                ? Carbon::parse($schedule->end_date)->startOfDay()
                : Carbon::today()->addMonths(3)->startOfDay();

            $current = $start->copy();
            $kecIndex = 0;
            $fixed = 0;
            $created = 0;

            while ($current <= $end) {
                if ($schedule->isPatrolDay($current)) {
                    $tanggal = $current->format('Y-m-d');
                    $expectedKec = $kecList[$kecIndex % $kecCount];
                    $kecIndex++;

                    $existingTask = SurveyTask::where('team_id', $schedule->team_id)
                        ->where('tanggal_patroli', $tanggal)
                        ->where('status', 'aktif')
                        ->first();

                    if ($existingTask) {
                        if ($existingTask->kecamatan !== $expectedKec) {
                            $conflict = SurveyTask::where('team_id', $schedule->team_id)
                                ->where('kecamatan', $expectedKec)
                                ->where('tanggal_patroli', $tanggal)
                                ->where('status', 'aktif')
                                ->where('id', '!=', $existingTask->id)
                                ->exists();

                            if ($conflict) {
                                $this->warn("    {$tanggal}: {$existingTask->kecamatan} → {$expectedKec} (skip, konflik UNIQUE)");
                            } else {
                                $existingTask->update(['kecamatan' => $expectedKec]);
                                $this->info("    {$tanggal}: {$existingTask->kecamatan} → {$expectedKec} ✓");
                                $fixed++;
                            }
                        }
                    } else {
                        SurveyTask::create([
                            'id' => (string) Str::uuid(),
                            'team_id' => $schedule->team_id,
                            'kecamatan' => $expectedKec,
                            'tanggal_patroli' => $tanggal,
                            'jam_mulai' => $schedule->jam_mulai ?? '09:00',
                            'jam_selesai' => $schedule->jam_selesai ?? '16:00',
                            'alasan_tugas' => $schedule->alasan_tugas ?? 'rutin',
                            'status' => 'aktif',
                        ]);
                        $this->info("    {$tanggal}: {$expectedKec} (dibuat) ✓");
                        $created++;
                    }
                }
                $current->addDay();
            }

            $this->info("  {$schedule->team?->name}: {$fixed} diperbaiki, {$created} dibuat");
            $totalFixed += $fixed;
            $totalCreated += $created;
        }

        $this->info("Selesai: {$totalFixed} task diperbaiki, {$totalCreated} task baru dibuat.");

        return 0;
    }
}
