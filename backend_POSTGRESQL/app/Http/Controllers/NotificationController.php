<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Facades\Log;

class NotificationController extends Controller
{
    /**
     * GET /api/notifications
     * Semua notifikasi user, newest first.
     */
    public function index(Request $request): JsonResponse
    {
        $perPage = min((int) $request->input('per_page', 20), 50);
        $notifications = $request->user()
            ->notifications()
            ->orderBy('created_at', 'desc')
            ->paginate($perPage);

        return response()->json([
            'success' => true,
            'data'    => $notifications->items(),
            'meta'    => [
                'current_page' => $notifications->currentPage(),
                'last_page'    => $notifications->lastPage(),
                'total'        => $notifications->total(),
            ],
        ]);
    }

    /**
     * GET /api/notifications/unread-count
     * Jumlah notifikasi belum dibaca.
     */
    public function unreadCount(Request $request): JsonResponse
    {
        $count = $request->user()->unreadNotifications()->count();

        return response()->json([
            'success' => true,
            'data'    => ['unread' => $count],
        ]);
    }

    /**
     * POST /api/notifications/{id}/read
     * Tandai satu notifikasi sebagai sudah dibaca.
     */
    public function markRead(Request $request, string $id): JsonResponse
    {
        $notification = $request->user()->notifications()->find($id);
        if (!$notification) {
            return response()->json(['success' => false, 'message' => 'Notifikasi tidak ditemukan.'], 404);
        }

        $notification->markAsRead();

        return response()->json(['success' => true, 'message' => 'Notifikasi ditandai sudah dibaca.']);
    }

    /**
     * POST /api/notifications/read-all
     * Tandai semua notifikasi user sebagai sudah dibaca.
     */
    public function markAllRead(Request $request): JsonResponse
    {
        $count = $request->user()->unreadNotifications()->update(['read_at' => now()]);

        return response()->json([
            'success' => true,
            'message' => "{$count} notifikasi ditandai sudah dibaca.",
        ]);
    }

    /**
     * DELETE /api/notifications
     * Hapus semua notifikasi user (read + unread).
     */
    public function destroyAll(Request $request): JsonResponse
    {
        $count = $request->user()->notifications()->delete();

        return response()->json([
            'success' => true,
            'message' => "{$count} notifikasi berhasil dihapus.",
        ]);
    }
}
