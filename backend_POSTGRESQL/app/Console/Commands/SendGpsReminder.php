<?php

namespace App\Console\Commands;

use App\Models\PushSubscription;
use App\Models\User;
use App\Services\FcmPushService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class SendGpsReminder extends Command
{
    protected $signature = 'gps:reminder {action : start or stop}';

    protected $description = 'Send FCM reminder to petugas eksekusi to turn GPS on/off';

    public function handle(FcmPushService $fcm): void
    {
        $action = $this->argument('action');

        if (! in_array($action, ['start', 'stop'], true)) {
            $this->error("Action must be 'start' or 'stop'.");

            return;
        }

        $users = User::where('role', 'petugas')->get();

        if ($users->isEmpty()) {
            $this->info('No petugas eksekusi found.');

            return;
        }

        $title = $action === 'start'
            ? 'Aktifkan GPS'
            : 'Nonaktifkan GPS';

        $body = $action === 'start'
            ? 'Waktu kerja dimulai. Silakan aktifkan GPS untuk pelacakan lokasi.'
            : 'Jam kerja selesai. GPS akan dimatikan otomatis.';

        $payload = [
            'title' => $title,
            'body' => $body,
            'data' => [
                'type' => 'gps_reminder',
                'action' => $action,
            ],
            'android' => ['channel_id' => 'delta_jalan_general'],
        ];

        $sent = 0;
        foreach ($users as $user) {
            $subscriptions = PushSubscription::where('user_id', $user->id)
                ->where('type', 'fcm')
                ->whereNotNull('fcm_token')
                ->get();

            foreach ($subscriptions as $sub) {
                $ok = $fcm->sendToToken($sub->fcm_token, $payload);
                if ($ok) {
                    $sent++;
                }
            }
        }

        Log::info("GPS Reminder '{$action}': sent to {$sent} devices.");
        $this->info("Sent '{$action}' reminder to {$sent} devices.");
    }
}
