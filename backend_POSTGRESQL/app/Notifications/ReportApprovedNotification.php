<?php

namespace App\Notifications;

use App\Models\Report;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

class ReportApprovedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public Report $report,
        public string $approvedBy
    ) {}

    public function via($notifiable): array
    {
        return ['database', 'webpush', 'fcm'];
    }

    public function toWebPush($notifiable): array
    {
        return [
            'title'   => 'Laporan Disetujui',
            'message' => 'Laporan ' . $this->report->report_code . ' disetujui oleh ' . $this->approvedBy,
            'url'     => '/detail-report?reportId=' . $this->report->id,
        ];
    }

    public function toFcm($notifiable): array
    {
        return [
            'title'   => 'Laporan Disetujui',
            'body'    => 'Laporan ' . $this->report->report_code . ' disetujui oleh ' . $this->approvedBy . "\n\nKlik buka",
            'data'    => [
                'type'        => 'report_approved',
                'report_id'   => $this->report->id,
                'report_code' => $this->report->report_code,
            ],
            'android' => ['channel_id' => 'delta_jalan_general'],
        ];
    }

    public function toDatabase($notifiable): array
    {
        return [
            'type'        => 'report_approved',
            'message'     => 'Laporan ' . $this->report->report_code . ' disetujui oleh ' . $this->approvedBy,
            'report_id'   => $this->report->id,
            'report_code' => $this->report->report_code,
            'actor_name'  => $this->approvedBy,
            'actor_role'  => 'supervisor',
        ];
    }
}
