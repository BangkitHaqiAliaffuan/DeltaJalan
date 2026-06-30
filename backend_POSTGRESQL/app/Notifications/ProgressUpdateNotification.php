<?php

namespace App\Notifications;

use App\Models\Report;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

class ProgressUpdateNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public Report $report,
        public string $updatedBy,
        public ?string $catatan,
    ) {}

    public function via($notifiable): array
    {
        return ['database', 'webpush', 'fcm'];
    }

    public function toWebPush($notifiable): array
    {
        $msg = $this->catatan
            ? 'Progress pada '.$this->report->report_code.': '.$this->catatan
            : 'Progress baru pada '.$this->report->report_code;

        return [
            'title' => 'Progress Perbaikan',
            'message' => $msg,
            'url' => '/detail-report?reportId='.$this->report->id,
        ];
    }

    public function toFcm($notifiable): array
    {
        $body = $this->catatan
            ? 'Progress: '.$this->catatan
            : 'Foto progress terbaru';

        return [
            'title' => 'Progress '.$this->report->report_code,
            'body' => $body."\n\nKlik buka",
            'data' => [
                'type' => 'progress_update',
                'report_id' => $this->report->id,
                'report_code' => $this->report->report_code,
            ],
            'android' => ['channel_id' => 'delta_jalan_general'],
        ];
    }

    public function toDatabase($notifiable): array
    {
        return [
            'type' => 'progress_update',
            'message' => $this->catatan
                ? 'Progress '.$this->report->report_code.': '.$this->catatan
                : 'Progress baru pada '.$this->report->report_code,
            'report_id' => $this->report->id,
            'report_code' => $this->report->report_code,
            'actor_name' => $this->updatedBy,
            'actor_role' => 'petugas',
        ];
    }
}
