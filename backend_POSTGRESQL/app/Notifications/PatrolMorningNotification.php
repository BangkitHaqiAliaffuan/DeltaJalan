<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

class PatrolMorningNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public string $teamName,
        public array $kecamatan,
        public string $hari,
        public string $tanggal,
        public string $jamMulai = '09:00',
        public string $jamSelesai = '16:00',
    ) {}

    public function via($notifiable): array
    {
        return ['database', 'webpush', 'fcm'];
    }

    public function toWebPush($notifiable): array
    {
        $kecStr = implode(', ', $this->kecamatan);

        return [
            'title' => 'Pengingat Patroli Hari Ini',
            'message' => "Hari ini ({$this->hari}, {$this->tanggal}) kamu patroli di {$kecStr} — shift {$this->jamMulai}–{$this->jamSelesai}. Cek tugas kamu sekarang!",
            'url' => '/tugas-saya',
        ];
    }

    public function toFcm($notifiable): array
    {
        $kecStr = implode(', ', $this->kecamatan);

        return [
            'title' => 'Pengingat Patroli Hari Ini',
            'body' => "Hari ini ({$this->hari}, {$this->tanggal}) kamu patroli di {$kecStr} — shift {$this->jamMulai}–{$this->jamSelesai}.\n\nCek tugas kamu sekarang!",
            'data' => [
                'type' => 'patrol_morning_reminder',
                'team_name' => $this->teamName,
                'kecamatan' => json_encode($this->kecamatan),
                'tanggal' => $this->tanggal,
            ],
            'android' => ['channel_id' => 'delta_jalan_general'],
        ];
    }

    public function toDatabase($notifiable): array
    {
        $kecStr = implode(', ', $this->kecamatan);

        return [
            'type' => 'patrol_morning_reminder',
            'message' => "Hari ini ({$this->hari}, {$this->tanggal}) kamu patroli di {$kecStr} — shift {$this->jamMulai}–{$this->jamSelesai}. Cek tugas kamu sekarang!",
            'team_name' => $this->teamName,
            'kecamatan' => json_encode($this->kecamatan),
            'tanggal' => $this->tanggal,
        ];
    }
}
