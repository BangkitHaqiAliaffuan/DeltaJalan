<?php

namespace App\Console\Commands;

use App\Models\PatrolSchedule;
use App\Models\User;
use App\Notifications\PatrolEveningNotification;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Notification;

class PatrolEveningReminder extends Command
{
    protected $signature = 'patrol:reminder-evening';

    protected $description = 'Send 17:00 reminder to petugas to complete today patrol reports';

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

            $petugas = User::where('team_id', $schedule->team_id)
                ->where('role', 'petugas')
                ->get();

            if ($petugas->isNotEmpty()) {
                Notification::send($petugas, new PatrolEveningNotification(
                    teamName: $schedule->team?->name ?? 'Tim Satgas',
                    tanggal: $today->format('Y-m-d'),
                ));
                $sent++;
            }
        }

        $this->info("Patrol evening reminder: {$sent} teams notified.");

        return 0;
    }
}
