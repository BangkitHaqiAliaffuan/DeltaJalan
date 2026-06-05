<?php

namespace App\Notifications;

use App\Models\Report;
use Illuminate\Notifications\Notification;

class RepairCompletedNotification extends Notification
{

    public function __construct(
        public Report $report,
        public string $completedBy,
    ) {}

    public function via($notifiable): array
    {
        return ['database', 'webpush'];
    }

    public function toWebPush($notifiable): array
    {
        return [
            'title'   => 'Perbaikan Selesai',
            'message' => 'Perbaikan laporan ' . $this->report->report_code . ' selesai oleh ' . $this->completedBy,
            'url'     => '/detail-report?reportId=' . $this->report->id,
        ];
    }

    public function toDatabase($notifiable): array
    {
        return [
            'type'        => 'repair_completed',
            'message'     => 'Perbaikan laporan ' . $this->report->report_code . ' selesai oleh ' . $this->completedBy,
            'report_id'   => $this->report->id,
            'report_code' => $this->report->report_code,
            'actor_name'  => $this->completedBy,
            'actor_role'  => 'petugas_eksekusi',
        ];
    }
}
