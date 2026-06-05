<?php

namespace App\Services;

use App\Models\PushSubscription;
use App\Models\User;
use Illuminate\Support\Facades\Log;
use Minishlink\WebPush\WebPush;
use Minishlink\WebPush\Notification;
use Minishlink\WebPush\Subscription;

class WebPushService
{
    private ?WebPush $webPush = null;

    private function client(): WebPush
    {
        if ($this->webPush === null) {
            $this->webPush = new WebPush([
                'VAPID' => [
                    'subject'    => config('webpush.vapid.subject'),
                    'publicKey'  => config('webpush.vapid.publicKey'),
                    'privateKey' => config('webpush.vapid.privateKey'),
                ],
            ]);
        }
        return $this->webPush;
    }

    public function sendToSubscription(PushSubscription $subscription, array $payload): bool
    {
        try {
            $this->client()->queueNotification(
                new Subscription(
                    $subscription->endpoint,
                    $subscription->p256dh_key,
                    $subscription->auth_key
                ),
                json_encode($payload)
            );

            foreach ($this->client()->flush() as $report) {
                if (!$report->isSuccess()) {
                    if ($report->isSubscriptionExpired()) {
                        $subscription->delete();
                        Log::info('WebPush: Subscription expired, deleted.', [
                            'endpoint' => $subscription->endpoint,
                            'user_id'  => $subscription->user_id,
                        ]);
                    }
                    return false;
                }
            }
            return true;
        } catch (\Throwable $e) {
            Log::warning('WebPush gagal: ' . $e->getMessage(), [
                'endpoint' => $subscription->endpoint,
                'user_id'  => $subscription->user_id,
            ]);
            return false;
        }
    }

    public function sendToUser(User $user, array $payload): void
    {
        $subscriptions = PushSubscription::where('user_id', $user->id)->get();
        foreach ($subscriptions as $subscription) {
            $this->sendToSubscription($subscription, $payload);
        }
    }

    public function sendToUsers(iterable $users, array $payload): void
    {
        foreach ($users as $user) {
            $this->sendToUser($user, $payload);
        }
    }
}
