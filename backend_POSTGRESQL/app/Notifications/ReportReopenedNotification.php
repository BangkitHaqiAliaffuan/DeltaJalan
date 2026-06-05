<?php

namespace App\Notifications;

use App\Models\Report;
use Illuminate\Notifications\Notification;

class ReportReopenedNotification extends Notification
{

    public function __construct(
        public Report $report,
        public string $reopenedBy,
    ) {}

    public function via($notifiable): array
    {
        return ['database', 'webpush'];
    }

    public function toWebPush($notifiable): array
    {
        return [
            'title'   => 'Laporan Dibuka Kembali',
            'message' => 'Laporan ' . $this->report->report_code . ' dibuka kembali oleh ' . $this->reopenedBy,
            'url'     => '/detail-report?reportId=' . $this->report->id,
        ];
    }

    public function toDatabase($notifiable): array
    {
        return [
            'type'        => 'report_reopened',
            'message'     => 'Laporan ' . $this->report->report_code . ' dibuka kembali oleh ' . $this->reopenedBy,
            'report_id'   => $this->report->id,
            'report_code' => $this->report->report_code,
            'actor_name'  => $this->reopenedBy,
            'actor_role'  => 'supervisor',
        ];
    }
}
