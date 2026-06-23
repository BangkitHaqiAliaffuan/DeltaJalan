<?php

namespace App\Notifications\Channels;

use App\Services\WebPushService;
use Illuminate\Notifications\Notification;

class WebPushChannel
{
    public function __construct(
        private WebPushService $webPush,
    ) {}

    public function send(object $notifiable, Notification $notification): void
    {
        if (! method_exists($notification, 'toWebPush')) {
            return;
        }

        $payload = $notification->toWebPush($notifiable);
        if (empty($payload)) {
            return;
        }

        $this->webPush->sendToUser($notifiable, $payload);
    }
}
