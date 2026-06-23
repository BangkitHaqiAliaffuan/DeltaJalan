<?php

namespace App\Notifications;

use App\Models\Report;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

class BulkActionNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public Report $report,
        public string $action,
        public string $performedBy,
    ) {}

    public function via($notifiable): array
    {
        return ['database', 'webpush', 'fcm'];
    }

    public function toWebPush($notifiable): array
    {
        $label = $this->action === 'approve' ? 'disetujui' : 'ditolak';

        return [
            'title' => 'Aksi Massal',
            'message' => 'Laporan '.$this->report->report_code.' '.$label.' (aksi massal) oleh '.$this->performedBy,
            'url' => '/detail-report?reportId='.$this->report->id,
        ];
    }

    public function toFcm($notifiable): array
    {
        $label = $this->action === 'approve' ? 'disetujui' : 'ditolak';

        return [
            'title' => 'Aksi Massal',
            'body' => 'Laporan '.$this->report->report_code.' '.$label.' (aksi massal) oleh '.$this->performedBy."\n\nKlik buka",
            'data' => [
                'type' => 'bulk_action',
                'report_id' => $this->report->id,
                'report_code' => $this->report->report_code,
            ],
            'android' => ['channel_id' => 'delta_jalan_general'],
        ];
    }

    public function toDatabase($notifiable): array
    {
        $label = $this->action === 'approve' ? 'disetujui' : 'ditolak';

        return [
            'type' => 'bulk_action',
            'message' => 'Laporan '.$this->report->report_code.' '.$label.' (aksi massal) oleh '.$this->performedBy,
            'report_id' => $this->report->id,
            'report_code' => $this->report->report_code,
            'actor_name' => $this->performedBy,
            'actor_role' => 'supervisor',
        ];
    }
}
