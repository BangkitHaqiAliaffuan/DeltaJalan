<?php

namespace App\Console\Commands;

use App\Models\PatrolSchedule;
use App\Models\SurveyTask;
use App\Models\User;
use App\Notifications\PatrolMorningNotification;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Notification;

class PatrolMorningReminder extends Command
{
    protected $signature = 'patrol:reminder-morning';

    protected $description = 'Send 09:00 reminder to petugas with active patrol today';

    private const DAY_MAP = [
        'Minggu' => 0, 'Senin' => 1, 'Selasa' => 2, 'Rabu' => 3,
        'Kamis' => 4, 'Jumat' => 5, 'Sabtu' => 6,
    ];

    public function handle(): int
    {
        $today = Carbon::today();
        $todayName = array_search((int) $today->format('w'), self::DAY_MAP);
        if ($todayName === false) {
            return 0;
        }

        $schedules = PatrolSchedule::where('status', 'aktif')
            ->where('start_date', '<=', $today->format('Y-m-d'))
            ->where(function ($q) use ($today) {
                $q->whereNull('end_date')
                    ->orWhere('end_date', '>=', $today->format('Y-m-d'));
            })
            ->get();

        $sent = 0;

        foreach ($schedules as $schedule) {
            $hari = $schedule->hari ?? [];
            if (! in_array($todayName, $hari)) {
                continue;
            }

            $tasks = SurveyTask::where('team_id', $schedule->team_id)
                ->where('tanggal_patroli', $today->format('Y-m-d'))
                ->where('status', 'aktif')
                ->get();

            if ($tasks->isEmpty()) {
                continue;
            }

            $kecList = $tasks->pluck('kecamatan')->filter()->unique()->values()->toArray();

            $petugas = User::where('team_id', $schedule->team_id)
                ->where('role', 'petugas')
                ->get();

            if ($petugas->isNotEmpty()) {
                Notification::send($petugas, new PatrolMorningNotification(
                    teamName: $schedule->team?->name ?? 'Tim Satgas',
                    kecamatan: $kecList,
                    hari: $todayName,
                    tanggal: $today->format('Y-m-d'),
                    jamMulai: $schedule->jam_mulai ?? '09:00',
                    jamSelesai: $schedule->jam_selesai ?? '16:00',
                ));
                $sent++;
            }
        }

        $this->info("Patrol morning reminder: {$sent} teams notified.");

        return 0;
    }
}
