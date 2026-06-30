<?php

namespace App\Notifications;

use App\Models\SurveyTask;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

class SurveyTaskCancelledNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public SurveyTask $task,
    ) {}

    public function via($notifiable): array
    {
        return ['database', 'webpush', 'fcm'];
    }

    public function toWebPush($notifiable): array
    {
        $msg = "Shift patroli {$this->task->team?->name} — {$this->task->kecamatan} tanggal {$this->task->tanggal_patroli->format('d/m/Y')} dibatalkan.";

        return [
            'title' => 'Shift Patroli Dibatalkan',
            'message' => $msg,
            'url' => '/',
        ];
    }

    public function toFcm($notifiable): array
    {
        $msg = "Shift patroli {$this->task->team?->name} — {$this->task->kecamatan} tanggal {$this->task->tanggal_patroli->format('d/m/Y')} dibatalkan.";

        return [
            'title' => 'Shift Patroli Dibatalkan',
            'body' => $msg,
            'data' => [
                'type' => 'survey_task_cancelled',
                'survey_task_id' => $this->task->id,
                'team_name' => $this->task->team?->name,
                'kecamatan' => $this->task->kecamatan,
                'tanggal' => $this->task->tanggal_patroli->format('Y-m-d'),
            ],
            'android' => ['channel_id' => 'delta_jalan_general'],
        ];
    }

    public function toDatabase($notifiable): array
    {
        return [
            'type' => 'survey_task_cancelled',
            'message' => "Shift patroli {$this->task->team?->name} — {$this->task->kecamatan} dibatalkan.",
            'survey_task_id' => $this->task->id,
            'kecamatan' => $this->task->kecamatan,
            'tanggal' => $this->task->tanggal_patroli->format('Y-m-d'),
        ];
    }
}
