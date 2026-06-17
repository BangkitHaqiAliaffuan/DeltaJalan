<?php

namespace App\Notifications;

use App\Models\Report;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

class UprAssignedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public Report $report,
        public string $assignedBy,
        public ?string $uprName,
    ) {}

    public function via($notifiable): array
    {
        return ['database', 'webpush', 'fcm'];
    }

    public function toWebPush($notifiable): array
    {
        return [
            'title'   => 'Tugas Baru',
            'message' => 'Tugas baru: laporan ' . $this->report->report_code . ' di ' . $this->report->district . ($this->uprName ? ' — ' . $this->uprName : ''),
            'url'     => '/detail-report?reportId=' . $this->report->id,
        ];
    }

    public function toFcm($notifiable): array
    {
        return [
            'title'   => 'Tugas Baru',
            'body'    => 'Tugas baru: laporan ' . $this->report->report_code . ' di ' . $this->report->district . ($this->uprName ? ' — ' . $this->uprName : ''),
            'data'    => [
                'type'        => 'upr_assigned',
                'report_id'   => $this->report->id,
                'report_code' => $this->report->report_code,
            ],
            'android' => ['channel_id' => 'delta_jalan_general'],
        ];
    }

    public function toDatabase($notifiable): array
    {
        return [
            'type'        => 'upr_assigned',
            'message'     => 'Tugas baru: laporan ' . $this->report->report_code . ' di ' . $this->report->district . ($this->uprName ? ' — ' . $this->uprName : ''),
            'report_id'   => $this->report->id,
            'report_code' => $this->report->report_code,
            'actor_name'  => $this->assignedBy,
            'actor_role'  => 'supervisor',
        ];
    }
}
