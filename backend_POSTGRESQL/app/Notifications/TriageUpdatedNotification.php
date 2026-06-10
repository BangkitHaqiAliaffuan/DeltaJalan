<?php

namespace App\Notifications;

use App\Models\Report;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

class TriageUpdatedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public Report $report,
        public string $updatedBy,
    ) {}

    public function via($notifiable): array
    {
        return ['database', 'webpush'];
    }

    public function toWebPush($notifiable): array
    {
        return [
            'title'   => 'Triage Diperbarui',
            'message' => 'Kategori kerusakan laporan ' . $this->report->report_code . ' diperbarui oleh ' . $this->updatedBy,
            'url'     => '/detail-report?reportId=' . $this->report->id,
        ];
    }

    public function toDatabase($notifiable): array
    {
        return [
            'type'        => 'triage_updated',
            'message'     => 'Kategori kerusakan laporan ' . $this->report->report_code . ' diperbarui oleh ' . $this->updatedBy,
            'report_id'   => $this->report->id,
            'report_code' => $this->report->report_code,
            'actor_name'  => $this->updatedBy,
            'actor_role'  => 'petugas_eksekusi',
        ];
    }
}
