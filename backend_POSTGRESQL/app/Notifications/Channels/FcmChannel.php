<?php

namespace App\Notifications\Channels;

use App\Services\FcmPushService;
use Illuminate\Notifications\Notification;

class FcmChannel
{
    public function __construct(
        private FcmPushService $fcm,
    ) {}

    public function send(object $notifiable, Notification $notification): void
    {
        if (! method_exists($notification, 'toFcm')) {
            return;
        }

        $payload = $notification->toFcm($notifiable);
        if (empty($payload)) {
            return;
        }

        $this->fcm->sendToUser($notifiable, $payload);
    }
}
