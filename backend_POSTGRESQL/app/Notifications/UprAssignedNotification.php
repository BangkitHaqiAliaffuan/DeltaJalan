<?php

namespace App\Notifications;

use App\Models\Report;
use Illuminate\Notifications\Notification;

class UprAssignedNotification extends Notification
{

    public function __construct(
        public Report $report,
        public string $assignedBy,
        public ?string $uprName,
    ) {}

    public function via($notifiable): array
    {
        return ['database', 'webpush'];
    }

    public function toWebPush($notifiable): array
    {
        return [
            'title'   => 'Tugas Baru',
            'message' => 'Tugas baru: laporan ' . $this->report->report_code . ' di ' . $this->report->district . ($this->uprName ? ' — ' . $this->uprName : ''),
            'url'     => '/detail-report?reportId=' . $this->report->id,
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
