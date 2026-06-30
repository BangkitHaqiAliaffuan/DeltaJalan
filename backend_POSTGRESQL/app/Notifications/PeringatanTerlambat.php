<?php

namespace App\Notifications;

use App\Models\Report;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class PeringatanTerlambat extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public Report $report,
        public string $type // 'review', 'resolution', atau 'mulai'
    ) {}

    public function via($notifiable): array
    {
        return ['database', 'webpush', 'mail', 'fcm'];
    }

    public function toMail($notifiable): MailMessage
    {
        $isMulai = $this->type === 'mulai';
        $isReview = ! $isMulai && $this->type === 'review';

        $subject = match ($this->type) {
            'review' => '🚨 Deadline Terlewat — Review Laporan '.$this->report->report_code,
            'mulai' => '🚨 Deadline Terlewat — Mulai Perbaikan '.$this->report->report_code,
            default => '🚨 Deadline Terlewat — Perbaikan Laporan '.$this->report->report_code,
        };

        [$deadlineLabel, $deadline] = $isMulai
            ? ['Batas Mulai Perbaikan', $this->report->deadline_mulai]
            : ($isReview
                ? ['Batas Review', $this->report->deadline_review]
                : ['Batas Perbaikan', $this->report->deadline_resolusi]);

        return (new MailMessage)
            ->subject($subject)
            ->greeting('Yth. '.$notifiable->name)
            ->line('Deadline untuk laporan berikut telah terlewati:')
            ->line("Kode Laporan: **{$this->report->report_code}**")
            ->line("Lokasi: {$this->report->road_name}, {$this->report->district}")
            ->line("Prioritas: {$this->report->priority}")
            ->line("Status: {$this->report->status}")
            ->line("{$deadlineLabel}: {$deadline?->format('d/m/Y H:i')}")
            ->action('Lihat Laporan', url("/review?reportId={$this->report->id}"))
            ->line('Segera lakukan tindakan lanjutan.');
    }

    public function toWebPush($notifiable): array
    {
        $label = match ($this->type) {
            'review' => 'Review',
            'mulai' => 'Mulai Perbaikan',
            default => 'Perbaikan',
        };

        return [
            'title' => "🚨 Deadline Terlewat — {$label}",
            'message' => "Laporan {$this->report->report_code} (prioritas {$this->report->priority}) telah melewati deadline {$label}.",
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
            'title' => 'Deadline Terlewat — '.$label,
            'body' => "Laporan {$this->report->report_code} (prioritas {$this->report->priority}) telah melewati deadline {$label}."."\n\nKlik buka",
            'data' => [
                'type' => 'deadline_terlambat',
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
            'type' => 'deadline_terlambat',
            'message' => "Deadline Terlewat: Laporan {$this->report->report_code} (prioritas {$this->report->priority}) telah melewati deadline ".match ($this->type) { 'review' => 'review', 'mulai' => 'mulai perbaikan', default => 'perbaikan' }.'.',
            'report_id' => $this->report->id,
            'report_code' => $this->report->report_code,
            'deadline_type' => $this->type,
            'actor_name' => 'Sistem',
            'actor_role' => 'system',
        ];
    }
}
