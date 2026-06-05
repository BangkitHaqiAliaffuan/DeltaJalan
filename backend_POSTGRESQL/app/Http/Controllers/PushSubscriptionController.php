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
            'data'    => ['public_key' => config('webpush.vapid.publicKey')],
        ]);
    }

    public function subscribe(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'endpoint'  => 'required|string',
            'p256dh_key' => 'required|string',
            'auth_key'  => 'required|string',
        ]);

        $user = $request->user();

        PushSubscription::updateOrCreate(
            ['endpoint' => $validated['endpoint']],
            [
                'user_id'   => $user->id,
                'p256dh_key' => $validated['p256dh_key'],
                'auth_key'  => $validated['auth_key'],
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
}
