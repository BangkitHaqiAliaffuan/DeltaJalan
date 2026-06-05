<?php

namespace App\Notifications;

use App\Models\Report;
use Illuminate\Notifications\Notification;

class ReportCreatedNotification extends Notification
{

    public function __construct(
        public Report $report
    ) {}

    public function via($notifiable): array
    {
        return ['database', 'webpush'];
    }

    public function toWebPush($notifiable): array
    {
        return [
            'title'       => 'Laporan Baru',
            'message'     => 'Laporan ' . $this->report->report_code . ' dari ' . $this->report->reporter_name . ' di ' . $this->report->district,
            'url'         => '/detail-report?reportId=' . $this->report->id,
        ];
    }

    public function toDatabase($notifiable): array
    {
        return [
            'type'        => 'report_created',
            'message'     => 'Laporan baru ' . $this->report->report_code . ' dari ' . $this->report->reporter_name . ' di ' . $this->report->district,
            'report_id'   => $this->report->id,
            'report_code' => $this->report->report_code,
            'actor_name'  => $this->report->reporter_name,
            'actor_role'  => 'petugas',
        ];
    }
}
