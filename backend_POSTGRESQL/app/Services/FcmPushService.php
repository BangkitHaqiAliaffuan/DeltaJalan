<?php

namespace App\Services;

use App\Models\PushSubscription;
use App\Models\User;
use Illuminate\Support\Facades\Log;
use Kreait\Firebase\Factory;
use Kreait\Firebase\Messaging\CloudMessage;
use Kreait\Firebase\Messaging\AndroidConfig;
use Kreait\Firebase\Messaging\Notification;

class FcmPushService
{
    private ?\Kreait\Firebase\Contract\Messaging $messaging = null;

    private function messaging(): \Kreait\Firebase\Contract\Messaging
    {
        if ($this->messaging === null) {
            $credPath = config('firebase.credentials');
            if (!$credPath || !file_exists($credPath)) {
                throw new \RuntimeException('Firebase service account not found at: ' . ($credPath ?? 'null'));
            }

            $this->messaging = (new Factory)
                ->withServiceAccount($credPath)
                ->createMessaging();
        }
        return $this->messaging;
    }

    public function sendToToken(string $token, array $payload): bool
    {
        try {
            $message = CloudMessage::new()
                ->withToken($token)
                ->withNotification(Notification::create(
                    $payload['title'] ?? 'DeltaJalan',
                    $payload['body'] ?? ''
                ))
                ->withData($payload['data'] ?? [])
                ->withAndroidConfig(
                    AndroidConfig::fromArray([
                        'priority' => 'high',
                        'notification' => [
                            'channel_id' => $payload['android']['channel_id'] ?? 'delta_jalan_general',
                            'sound' => 'default',
                        ],
                    ])
                );

            $this->messaging()->send($message);
            return true;
        } catch (\Kreait\Firebase\Exception\Messaging\NotFound $e) {
            Log::warning('FCM: Token not found (unregistered), deleting.', ['token' => substr($token, 0, 20) . '...']);
            PushSubscription::where('fcm_token', $token)->delete();
            return false;
        } catch (\Kreait\Firebase\Exception\MessagingException $e) {
            Log::warning('FCM: Send failed.', [
                'token' => substr($token, 0, 20) . '...',
                'error' => $e->getMessage(),
            ]);
            return false;
        } catch (\Throwable $e) {
            Log::error('FCM: Unexpected error.', [
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    public function sendToUser(User $user, array $payload): void
    {
        $subscriptions = PushSubscription::where('user_id', $user->id)
            ->where('type', 'fcm')
            ->whereNotNull('fcm_token')
            ->get();

        foreach ($subscriptions as $sub) {
            $this->sendToToken($sub->fcm_token, $payload);
        }
    }

    public function sendToUsers(iterable $users, array $payload): void
    {
        foreach ($users as $user) {
            $this->sendToUser($user, $payload);
        }
    }
}
