<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

class PatrolEveningNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public string $teamName,
        public string $tanggal,
        public string $jamSelesai = '16:00',
    ) {}

    public function via($notifiable): array
    {
        return ['database', 'webpush', 'fcm'];
    }

    public function toWebPush($notifiable): array
    {
        return [
            'title' => 'Patroli Selesai',
            'message' => "Waktunya menyelesaikan patrol hari ini ({$this->tanggal}) — shift berakhir pukul {$this->jamSelesai}. Pastikan semua laporan sudah diisi.",
            'url' => '/tugas-saya',
        ];
    }

    public function toFcm($notifiable): array
    {
        return [
            'title' => 'Patroli Selesai',
            'body' => "Waktunya menyelesaikan patrol hari ini ({$this->tanggal}) — shift berakhir pukul {$this->jamSelesai}. Pastikan semua laporan sudah diisi.",
            'data' => [
                'type' => 'patrol_evening_reminder',
                'team_name' => $this->teamName,
                'tanggal' => $this->tanggal,
            ],
            'android' => ['channel_id' => 'delta_jalan_general'],
        ];
    }

    public function toDatabase($notifiable): array
    {
        return [
            'type' => 'patrol_evening_reminder',
            'message' => "Waktunya menyelesaikan patrol hari ini ({$this->tanggal}) — shift berakhir pukul {$this->jamSelesai}. Pastikan semua laporan sudah diisi.",
            'team_name' => $this->teamName,
            'tanggal' => $this->tanggal,
        ];
    }
}
