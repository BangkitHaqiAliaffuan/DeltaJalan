<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

class PatrolTaskGeneratedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public string $teamName,
        public int $count,
        public ?string $period = null,
    ) {}

    public function via($notifiable): array
    {
        return ['database', 'webpush', 'fcm'];
    }

    public function toWebPush($notifiable): array
    {
        $period = $this->period ? " dalam {$this->period}" : '';
        $msg = "{$this->count} tugas patroli baru".($this->teamName ? " untuk {$this->teamName}" : '')."{$period}. Cek jadwal kamu sekarang.";

        return [
            'title' => 'Tugas Patroli Baru',
            'message' => $msg,
            'url' => '/tugas-saya',
        ];
    }

    public function toFcm($notifiable): array
    {
        $period = $this->period ? " dalam {$this->period}" : '';
        $msg = "{$this->count} tugas patroli baru".($this->teamName ? " untuk {$this->teamName}" : '')."{$period}.\n\nCek jadwal kamu sekarang.";

        return [
            'title' => 'Tugas Patroli Baru',
            'body' => $msg,
            'data' => [
                'type' => 'patrol_task_generated',
                'count' => (string) $this->count,
                'team_name' => $this->teamName,
            ],
            'android' => ['channel_id' => 'delta_jalan_general'],
        ];
    }

    public function toDatabase($notifiable): array
    {
        $period = $this->period ? " dalam {$this->period}" : '';

        return [
            'type' => 'patrol_task_generated',
            'message' => "{$this->count} tugas patroli baru".($this->teamName ? " untuk {$this->teamName}" : '')."{$period}.",
            'count' => $this->count,
            'team_name' => $this->teamName,
        ];
    }
}
