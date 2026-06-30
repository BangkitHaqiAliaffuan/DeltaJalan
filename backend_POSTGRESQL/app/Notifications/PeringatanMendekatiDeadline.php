<?php

namespace App\Notifications;

use App\Models\Report;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class PeringatanMendekatiDeadline extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public Report $report,
        public string $type // 'review', 'resolution', atau 'mulai'
    ) {}

    public function via($notifiable): array
    {
        $channels = ['database'];
        if (config('services.webpush.enabled') || config('webpush.enabled')) {
            $channels[] = 'webpush';
        }
        if (config('mail.mailers.smtp.username')) {
            $channels[] = 'mail';
        }
        if (config('firebase.credentials') && file_exists(config('firebase.credentials'))) {
            $channels[] = 'fcm';
        }
        return $channels;
    }

    public function toMail($notifiable): MailMessage
    {
        $subject = match ($this->type) {
            'review' => '⚠️ Peringatan Deadline — Review Laporan '.$this->report->report_code,
            'mulai' => '⚠️ Peringatan Deadline — Mulai Perbaikan '.$this->report->report_code,
            default => '⚠️ Peringatan Deadline — Perbaikan Laporan '.$this->report->report_code,
        };

        [$deadlineLabel, $deadline] = match ($this->type) {
            'review' => ['Batas Review', $this->report->deadline_review],
            'mulai' => ['Batas Mulai Perbaikan', $this->report->deadline_mulai],
            default => ['Batas Perbaikan', $this->report->deadline_resolusi],
        };

        return (new MailMessage)
            ->subject($subject)
            ->greeting('Yth. '.$notifiable->name)
            ->line('Deadline untuk laporan berikut akan segera tiba:')
            ->line("Kode Laporan: **{$this->report->report_code}**")
            ->line("Lokasi: {$this->report->road_name}, {$this->report->district}")
            ->line("Prioritas: {$this->report->priority}")
            ->line("Status: {$this->report->status}")
            ->line("{$deadlineLabel}: {$deadline?->format('d/m/Y H:i')}")
            ->action('Lihat Laporan', url("/review?reportId={$this->report->id}"))
            ->line('Harap segera ditindaklanjuti.');
    }

    public function toWebPush($notifiable): array
    {
        $label = match ($this->type) {
            'review' => 'Review',
            'mulai' => 'Mulai Perbaikan',
            default => 'Perbaikan',
        };

        return [
            'title' => "⚠️ Peringatan Deadline — {$label}",
            'message' => "Laporan {$this->report->report_code} (prioritas {$this->report->priority}) akan melewati deadline {$label}.",
            'url' => '/review?reportId='.$this->report->id,
        ];
    }

    public function toFcm($notifiable): array
    {
        $label = match ($this->type) {
            'review' => 'Review',
            'mulai' => 'Mulai Perbaikan',
            default => 'Perbaikan',
        };

        return [
            'title' => 'Peringatan Deadline — '.$label,
            'body' => "Laporan {$this->report->report_code} (prioritas {$this->report->priority}) akan melewati deadline {$label}."."\n\nKlik buka",
            'data' => [
                'type' => 'deadline_warning',
                'report_id' => $this->report->id,
                'report_code' => $this->report->report_code,
                'deadline_type' => $this->type,
            ],
            'android' => ['channel_id' => 'delta_jalan_general'],
        ];
    }

    public function toDatabase($notifiable): array
    {
        return [
            'type' => 'deadline_warning',
            'message' => "Peringatan Deadline: Laporan {$this->report->report_code} (prioritas {$this->report->priority}) mendekati deadline ".match ($this->type) { 'review' => 'review', 'mulai' => 'mulai perbaikan', default => 'perbaikan' }.'.',
            'report_id' => $this->report->id,
            'report_code' => $this->report->report_code,
            'deadline_type' => $this->type,
            'actor_name' => 'Sistem',
            'actor_role' => 'system',
        ];
    }
}
