<?php

namespace App\Http\Controllers;

use App\Models\PushSubscription;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class PushSubscriptionController extends Controller
{
    public function vapidKey(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => ['public_key' => config('webpush.vapid.publicKey')],
        ]);
    }

    public function subscribe(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'endpoint' => 'required|string',
            'p256dh_key' => 'required|string',
            'auth_key' => 'required|string',
        ]);

        $user = $request->user();

        PushSubscription::updateOrCreate(
            ['endpoint' => $validated['endpoint']],
            [
                'user_id' => $user->id,
                'p256dh_key' => $validated['p256dh_key'],
                'auth_key' => $validated['auth_key'],
                'user_agent' => $request->header('User-Agent'),
            ]
        );

        Log::info('WebPush: Subscribed.', ['user_id' => $user->id]);

        return response()->json(['success' => true, 'message' => 'Berlangganan notifikasi berhasil.']);
    }

    public function unsubscribe(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'endpoint' => 'required|string',
        ]);

        $deleted = PushSubscription::where('endpoint', $validated['endpoint'])
            ->where('user_id', $request->user()->id)
            ->delete();

        if ($deleted) {
            Log::info('WebPush: Unsubscribed.', ['user_id' => $request->user()->id]);
        }

        return response()->json(['success' => true, 'message' => 'Berhenti berlangganan notifikasi berhasil.']);
    }

    public function storeFcmToken(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'fcm_token' => 'required|string',
            'device_info' => 'nullable|array',
        ]);

        $user = $request->user();

        $existing = PushSubscription::where('fcm_token', $validated['fcm_token'])->first();
        if ($existing && $existing->user_id !== $user->id) {
            $existing->update(['user_id' => $user->id]);
        }

        $count = PushSubscription::where('user_id', $user->id)->where('type', 'fcm')->count();
        if ($count >= 5) {
            PushSubscription::where('user_id', $user->id)
                ->where('type', 'fcm')
                ->orderBy('updated_at')
                ->first()
                ?->delete();
        }

        PushSubscription::updateOrCreate(
            ['fcm_token' => $validated['fcm_token']],
            [
                'user_id' => $user->id,
                'type' => 'fcm',
                'device_info' => isset($validated['device_info']) ? json_encode($validated['device_info']) : null,
                'endpoint' => null,
                'p256dh_key' => '',
                'auth_key' => '',
            ]
        );

        Log::info('FCM: Token stored.', ['user_id' => $user->id]);

        return response()->json(['success' => true, 'message' => 'FCM token tersimpan.']);
    }

    public function removeFcmToken(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'fcm_token' => 'required|string',
        ]);

        $deleted = PushSubscription::where('fcm_token', $validated['fcm_token'])
            ->where('user_id', $request->user()->id)
            ->delete();

        if ($deleted) {
            Log::info('FCM: Token removed.', ['user_id' => $request->user()->id]);
        }

        return response()->json(['success' => true, 'message' => 'FCM token dihapus.']);
    }
}
