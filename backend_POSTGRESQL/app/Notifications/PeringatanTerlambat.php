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
        public string $type // 'review' atau 'resolution'
    ) {}

    public function via($notifiable): array
    {
        return ['database', 'webpush', 'mail'];
    }

    public function toMail($notifiable): MailMessage
    {
        $isReview = $this->type === 'review';
        $subject = $isReview
            ? '🚨 Deadline Terlewat — Review Laporan ' . $this->report->report_code
            : '🚨 Deadline Terlewat — Perbaikan Laporan ' . $this->report->report_code;

        $deadlineLabel = $isReview ? 'Batas Review' : 'Batas Perbaikan';
        $deadline = $isReview
            ? $this->report->deadline_review
            : $this->report->deadline_resolusi;

        return (new MailMessage)
            ->subject($subject)
            ->greeting('Yth. ' . $notifiable->name)
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
        $label = $this->type === 'review' ? 'Review' : 'Perbaikan';
        return [
            'title'   => "🚨 Deadline Terlewat — {$label}",
            'message' => "Laporan {$this->report->report_code} (prioritas {$this->report->priority}) telah melewati deadline {$label}.",
            'url'     => '/review?reportId=' . $this->report->id,
        ];
    }

    public function toDatabase($notifiable): array
    {
        return [
            'type'        => 'deadline_terlambat',
            'message'     => "Deadline Terlewat: Laporan {$this->report->report_code} (prioritas {$this->report->priority}) telah melewati deadline " . ($this->type === 'review' ? 'review' : 'perbaikan') . ".",
            'report_id'   => $this->report->id,
            'report_code' => $this->report->report_code,
            'deadline_type'    => $this->type,
            'actor_name'  => 'Sistem',
            'actor_role'  => 'system',
        ];
    }
}
