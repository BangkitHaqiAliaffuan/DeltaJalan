<?php

namespace App\Notifications;

use App\Models\Report;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

class ReportRejectedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public Report $report,
        public string $rejectedBy,
        public string $reason,
    ) {}

    public function via($notifiable): array
    {
        return ['database', 'webpush'];
    }

    public function toWebPush($notifiable): array
    {
        return [
            'title'   => 'Laporan Ditolak',
            'message' => 'Laporan ' . $this->report->report_code . ' ditolak oleh ' . $this->rejectedBy,
            'url'     => '/detail-report?reportId=' . $this->report->id,
        ];
    }

    public function toDatabase($notifiable): array
    {
        return [
            'type'        => 'report_rejected',
            'message'     => 'Laporan ' . $this->report->report_code . ' ditolak oleh ' . $this->rejectedBy . ': ' . $this->reason,
            'report_id'   => $this->report->id,
            'report_code' => $this->report->report_code,
            'actor_name'  => $this->rejectedBy,
            'actor_role'  => 'supervisor',
        ];
    }
}
