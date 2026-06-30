<?php

namespace App\Notifications;

use App\Models\Report;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

class RepairStartedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public Report $report,
        public string $startedBy,
    ) {}

    public function via($notifiable): array
    {
        return ['database', 'webpush', 'fcm'];
    }

    public function toWebPush($notifiable): array
    {
        return [
            'title' => 'Perbaikan Dimulai',
            'message' => 'Perbaikan laporan '.$this->report->report_code.' telah dimulai oleh '.$this->startedBy,
            'url' => '/detail-report?reportId='.$this->report->id,
        ];
    }

    public function toFcm($notifiable): array
    {
        return [
            'title' => 'Perbaikan Dimulai',
            'body' => 'Perbaikan laporan '.$this->report->report_code.' telah dimulai oleh '.$this->startedBy."\n\nKlik buka",
            'data' => [
                'type' => 'repair_started',
                'report_id' => $this->report->id,
                'report_code' => $this->report->report_code,
            ],
            'android' => ['channel_id' => 'delta_jalan_general'],
        ];
    }

    public function toDatabase($notifiable): array
    {
        return [
            'type' => 'repair_started',
            'message' => 'Perbaikan laporan '.$this->report->report_code.' telah dimulai oleh '.$this->startedBy,
            'report_id' => $this->report->id,
            'report_code' => $this->report->report_code,
            'actor_name' => $this->startedBy,
            'actor_role' => 'petugas',
        ];
    }
}
