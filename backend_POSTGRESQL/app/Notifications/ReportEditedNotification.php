<?php

namespace App\Notifications;

use App\Models\Report;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

class ReportEditedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public Report $report,
        public string $editedBy,
        public ?string $editAction,
    ) {}

    public function via($notifiable): array
    {
        return ['database', 'webpush', 'fcm'];
    }

    public function toWebPush($notifiable): array
    {
        $action = $this->editAction === 'batal' ? 'Dibatalkan' : 'Diedit';

        return [
            'title' => 'Laporan '.$action,
            'message' => 'Laporan '.$this->report->report_code.' '.($this->editAction === 'batal' ? 'batal diedit' : 'diedit').' oleh '.$this->editedBy,
            'url' => '/detail-report?reportId='.$this->report->id,
        ];
    }

    public function toFcm($notifiable): array
    {
        $action = $this->editAction === 'batal' ? 'Dibatalkan' : 'Diedit';

        return [
            'title' => 'Laporan '.$action,
            'body' => 'Laporan '.$this->report->report_code.' '.($this->editAction === 'batal' ? 'batal diedit' : 'diedit').' oleh '.$this->editedBy."\n\nKlik buka",
            'data' => [
                'type' => 'report_edited',
                'report_id' => $this->report->id,
                'report_code' => $this->report->report_code,
            ],
            'android' => ['channel_id' => 'delta_jalan_general'],
        ];
    }

    public function toDatabase($notifiable): array
    {
        $action = $this->editAction === 'batal' ? 'dibatalkan' : 'diedit';

        return [
            'type' => 'report_edited',
            'message' => 'Laporan '.$this->report->report_code.' '.$action.' oleh '.$this->editedBy,
            'report_id' => $this->report->id,
            'report_code' => $this->report->report_code,
            'actor_name' => $this->editedBy,
            'actor_role' => 'petugas',
        ];
    }
}
