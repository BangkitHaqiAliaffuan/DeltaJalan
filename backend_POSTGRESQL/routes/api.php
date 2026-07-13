<?php

use App\Http\Controllers\AIController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\PatrolScheduleController;
use App\Http\Controllers\PushSubscriptionController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\ReportExportController;
use App\Http\Controllers\ReverseGeocodeController;
use App\Http\Controllers\RoadController;
use App\Http\Controllers\SettingController;
use App\Http\Controllers\StatusLogController;
use App\Http\Controllers\SurveyTaskController;
use App\Http\Controllers\TeamController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\WargaReportController;
use App\Http\Controllers\WorkerLocationController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

// ── API Routes — DeltaJalan Backend ─────────────────────────────────────────

// ── Health Check / Ping (public) ──────────────────────────────────────────
Route::get('/ping', function () {
    return response()->json(['success' => true, 'timestamp' => now()->toIso8601String()]);
});

// ── Routes DeltaJalan ──────────────────────────────────────────────────────

// ── Proxy endpoint ──────────────────────────────────────────────────────────
Route::middleware(['auth:sanctum', 'throttle:60,1'])->group(function () {
    /**
     * POST /api/analyze
     * Proxy endpoint untuk analisis AI single foto (forward ke FastAPI).
     */
    Route::post('/analyze', [ReportController::class, 'analyze']);

    /**
     * POST /api/reports
     * Simpan laporan kerusakan jalan baru ke PostgreSQL (single upload).
     */
    Route::post('/reports', [ReportController::class, 'store']);
});

/**
 * GET /api/v1/reports/check-duplicate
 * Pengecekan duplikasi laporan — PUBLIK, tidak perlu autentikasi.
 * Query params: latitude, longitude, district, road_name
 */
Route::get('/v1/reports/check-duplicate', [ReportController::class, 'checkDuplicate']);

// ── Auth routes (public) ──────────────────────────────────────────────────
Route::post('/auth/login', [AuthController::class, 'login']);
Route::post('/auth/register', [AuthController::class, 'register']);
Route::post('/auth/logout', [AuthController::class, 'logout'])->middleware('auth:sanctum');
Route::get('/auth/me', [AuthController::class, 'me'])->middleware('auth:sanctum');

/**
 * POST /api/reports/track
 * Lacak laporan secara publik menggunakan kode laporan (tidak perlu login).
 */
Route::post('/reports/track', [WargaReportController::class, 'track'])->middleware('throttle:10,1');

// ── Public Warga Reports (no auth) ─────────────────────────────────────
Route::post('/public/reports', [WargaReportController::class, 'storePublic'])
    ->middleware('throttle:10,1');
Route::get('/public/reports', [WargaReportController::class, 'indexByPhone'])
    ->middleware('throttle:10,1');
Route::get('/public/stats', [WargaReportController::class, 'publicStats']);

/**
 * GET /api/v1/reports/remaining
 * Cek sisa kuota upload harian — PUBLIK, tidak perlu autentikasi.
 * Optional header: X-Device-ID untuk limit device, Authorization untuk limit user.
 */
Route::get('/v1/reports/remaining', [WargaReportController::class, 'checkRemaining'])
    ->middleware('throttle:30,1');

// ── Routes yang memerlukan autentikasi Sanctum ────────────────────────────
Route::middleware('auth:sanctum')->group(function () {
    /**
     * POST /api/v1/reports/{id}/add-evidence
     * Tambahkan foto bukti ke laporan yang sudah ada.
     */
    Route::post('/v1/reports/{id}/add-evidence', [ReportController::class, 'addEvidence']);

    /**
     * POST /api/analyze-batch
     * Analisis batch foto ke AI Server (maks 20 foto sekaligus).
     * Satu request ke Laravel → satu per satu ke FastAPI → return semua hasil.
     */
    Route::post('/analyze-batch', [AIController::class, 'analyzeBatch']);

    /**
     * POST /api/v1/reports/extract-exif-gps
     * Ekstrak koordinat GPS dari EXIF foto — fallback untuk mobile browser
     * yang strip data EXIF dari File object JavaScript.
     */
    Route::post('/v1/reports/extract-exif-gps', [ReportController::class, 'extractExifGpsFromUpload']);

    /**
     * POST /api/reports/batch
     * Simpan laporan batch (satu laporan utama + sub-laporan per foto).
     * Menghitung trust score otomatis dan validasi nama jalan vs koordinat.
     */
    Route::post('/reports/batch', [ReportController::class, 'storeBatch']);

    /**
     * POST /api/reports/check-duplicate
     * Alias dari GET /api/v1/reports/check-duplicate untuk kompatibilitas.
     */
    Route::post('/reports/check-duplicate', [ReportController::class, 'checkDuplicate']);

    /**
     * GET /api/reports
     * Daftar laporan — petugas hanya melihat laporannya sendiri,
     * supervisor melihat semua (bisa difilter via ?status=).
     */
    Route::get('/reports', [ReportController::class, 'index']);

    /**
     * GET /api/reports/stats
     * HARUS sebelum /reports/{id} agar "stats" tidak tertangkap sebagai UUID.
     */
    Route::get('/reports/stats', [ReportController::class, 'stats']);

    /**
     * GET /api/reports/map-data
     * HARUS sebelum /reports/{id}.
     * Data agregat per kecamatan + laporan + statistik untuk Peta Interaktif GIS.
     */
    Route::get('/reports/map-data', [ReportController::class, 'mapData']);

    /**
     * GET /api/reports/stats-by-team
     * HARUS sebelum /reports/{id}.
     */
    Route::get('/reports/stats-by-team', [ReportController::class, 'statsByTeam']);

    /**
     * GET /api/reports/{id}
     * Detail satu laporan.
     */
    Route::get('/reports/{id}', [ReportController::class, 'show']);

    /**
     * POST /api/reports/{id}/approve
     * Supervisor menyetujui laporan.
     */
    Route::post('/reports/{id}/approve', [ReportController::class, 'approve']);

    /**
     * POST /api/reports/{id}/analyze-ai
     * Analisis AI foreground — panggil FastAPI sinkron, simpan hasil.
     */
    Route::post('/reports/{id}/analyze-ai', [ReportController::class, 'analyzeReport']);

    /**
     * POST /api/reports/{id}/confirm-ai
     * Supervisor mengonfirmasi hasil AI dan menugaskan tim satgas.
     */
    Route::post('/reports/{id}/confirm-ai', [ReportController::class, 'confirmAiResult']);

    /**
     * POST /api/reports/{id}/approve-and-assign
     * Supervisor menyetujui laporan warga/telegram + AI analysis + auto-assign tim dalam satu langkah.
     */
    Route::post('/reports/{id}/approve-and-assign', [ReportController::class, 'approveAndAssign']);

    /**
     * POST /api/reports/{id}/tolak
     * Supervisor menolak laporan dengan alasan.
     */
    Route::post('/reports/{id}/tolak', [ReportController::class, 'tolak']);

    /**
     * POST /api/reports/{id}/disposisi
     * Supervisor mendisposisi laporan untuk pengerjaan.
     */
    Route::post('/reports/{id}/disposisi', [ReportController::class, 'disposisi']);

    /**
     * POST /api/reports/{id}/mulai
     * Menandai bahwa perbaikan dimulai (status → Sedang Diperbaiki).
     */
    Route::post('/reports/{id}/mulai', [ReportController::class, 'mulai']);

    /**
     * POST /api/reports/{id}/complete
     * Menyelesaikan laporan dengan foto after + catatan.
     */
    Route::post('/reports/{id}/complete', [ReportController::class, 'complete']);

    /**
     * POST /api/reports/{id}/progress
     * Upload progress foto + catatan selama pengerjaan.
     */
    Route::post('/reports/{id}/progress', [ReportController::class, 'updateProgress']);

    /**
     * GET /api/reports/{id}/progress
     * Daftar progress updates untuk timeline.
     */
    Route::get('/reports/{id}/progress', [ReportController::class, 'getProgress']);

    /**
     * POST /api/reports/bulk-approve
     * Approve multiple laporan sekaligus.
     */
    Route::post('/reports/bulk-approve', [ReportController::class, 'bulkApprove']);

    /**
     * POST /api/reports/bulk-tolak
     * Tolak multiple laporan sekaligus.
     */
    Route::post('/reports/bulk-tolak', [ReportController::class, 'bulkTolak']);

    /**
     * POST /api/reports/{id}/reopen
     * Re-open laporan yang sudah selesai.
     */
    Route::post('/reports/{id}/reopen', [ReportController::class, 'reopen']);

    /**
     * GET /api/reports/export/monthly-pdf
     * Export PDF rekap bulanan (supervisor only).
     * Query params: ?month=5&year=2026
     */
    Route::get('/reports/export/monthly-pdf', [ReportExportController::class, 'exportMonthlyPdf']);

    /**
     * GET /api/reports/export/monthly-excel
     * Export Excel rekap bulanan (supervisor only).
     * Query params: ?month=5&year=2026
     */
    Route::get('/reports/export/monthly-excel', [ReportExportController::class, 'exportMonthlyExcel']);

    /**
     * POST /api/reports/{id}/mulai-edit
     * Petugas mulai mengedit laporan yang masih Menunggu Review.
     */
    Route::post('/reports/{id}/mulai-edit', [ReportController::class, 'mulaiEdit']);

    /**
     * POST /api/reports/{id}/batal-edit
     * Petugas batal mengedit — kembali ke Menunggu Review.
     */
    Route::post('/reports/{id}/batal-edit', [ReportController::class, 'batalEdit']);

    /**
     * PUT /api/reports/{id}
     * Update field laporan (hanya jika status = Diedit).
     */
    Route::put('/reports/{id}', [ReportController::class, 'update']);

    /**
     * POST /api/reports/{id}/mulai-review
     * Supervisor mulai membaca laporan — set status = Ditinjau.
     */
    Route::post('/reports/{id}/mulai-review', [ReportController::class, 'mulaiReview']);

    /**
     * POST /api/reports/{id}/update-triage
     * Petugas memperbarui kategori kerusakan (severity) dan/atau prioritas.
     */
    Route::post('/reports/{id}/update-triage', [ReportController::class, 'updateTriage']);

    /**
     * DELETE /api/reports/{id}/duplicate
     * Supervisor menghapus marking duplikasi dari laporan.
     */
    Route::delete('/reports/{id}/duplicate', [ReportController::class, 'destroyDuplicate']);

    /**
     * DELETE /api/reports/{id}
     * Petugas lapangan menghapus laporan miliknya sendiri.
     * Hanya laporan milik user yang sedang login yang bisa dihapus.
     */
    Route::delete('/reports/{id}', [ReportController::class, 'destroy']);

    /**
     * DELETE /api/admin/reports/{id}
     * Admin menghapus laporan APAPUN tanpa batasan kepemilikan.
     */
    Route::delete('/admin/reports/{id}', [ReportController::class, 'adminDestroy']);

    /**
     * POST /api/admin/reports/{id}/status
     * Admin mengubah status laporan secara paksa ke status apapun.
     * Body: { status: "Menunggu Review" | "Disetujui" | "Ditolak" | "Sedang Diperbaiki" | "Selesai" }
     */
    Route::post('/admin/reports/{id}/status', [ReportController::class, 'adminUpdateStatus']);

    // ── Notifikasi ────────────────────────────────────────────────────────
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount']);
    Route::post('/notifications/{id}/read', [NotificationController::class, 'markRead']);
    Route::post('/notifications/read-all', [NotificationController::class, 'markAllRead']);
    Route::delete('/notifications', [NotificationController::class, 'destroyAll']);

    // ── Push Notification (WebPush + FCM) ──────────────────────────────────
    Route::get('/push/vapid-key', [PushSubscriptionController::class, 'vapidKey']);
    Route::post('/push/subscribe', [PushSubscriptionController::class, 'subscribe']);
    Route::post('/push/unsubscribe', [PushSubscriptionController::class, 'unsubscribe']);
    Route::post('/push/fcm-token', [PushSubscriptionController::class, 'storeFcmToken']);
    Route::delete('/push/fcm-token', [PushSubscriptionController::class, 'removeFcmToken']);

    // ── Activity / Status Logs ─────────────────────────────────────────────
    Route::get('/activity', [StatusLogController::class, 'index']);

    // ── Settings ────────────────────────────────────────────────────────────
    Route::get('/settings', [SettingController::class, 'index']);
    Route::put('/settings', [SettingController::class, 'update']);

    // ── Survey Tasks (Ruas Jalan) ────────────────────────────────────────────
    Route::get('/survei', [SurveyTaskController::class, 'index']);
    Route::get('/survei/stats', [SurveyTaskController::class, 'stats']);
    Route::post('/survei', [SurveyTaskController::class, 'store']);
    Route::get('/survei/{id}', [SurveyTaskController::class, 'show']);
    Route::put('/survei/{id}', [SurveyTaskController::class, 'update']);
    Route::delete('/survei/{id}', [SurveyTaskController::class, 'destroy']);

    // ── Patrol Schedules ─────────────────────────────────────────────────────
    Route::get('/patrol-schedules/preview', [PatrolScheduleController::class, 'preview']);
    Route::get('/patrol-schedules', [PatrolScheduleController::class, 'index']);
    Route::post('/patrol-schedules', [PatrolScheduleController::class, 'store']);
    Route::get('/patrol-schedules/{id}', [PatrolScheduleController::class, 'show']);
    Route::put('/patrol-schedules/{id}', [PatrolScheduleController::class, 'update']);
    Route::delete('/patrol-schedules/{id}', [PatrolScheduleController::class, 'destroy']);
    Route::post('/patrol-schedules/{id}/generate', [PatrolScheduleController::class, 'generate']);
    Route::post('/patrol-schedules/{id}/toggle', [PatrolScheduleController::class, 'toggle']);

    // ── Teams ────────────────────────────────────────────────────────────────
    Route::get('/teams', [TeamController::class, 'index']);
    Route::post('/teams', [TeamController::class, 'store']);
    Route::get('/teams/{id}', [TeamController::class, 'show']);
    Route::put('/teams/{id}', [TeamController::class, 'update']);
    Route::delete('/teams/{id}', [TeamController::class, 'destroy']);
    Route::post('/teams/{id}/members', [TeamController::class, 'assignMembers']);
    Route::delete('/teams/{id}/members/{userId}', [TeamController::class, 'removeMember']);
    Route::get('/teams/{id}/roads', [TeamController::class, 'roads']);
    Route::post('/teams/{id}/roads', [TeamController::class, 'assignRoads']);
    Route::delete('/teams/{id}/roads/{taskId}', [TeamController::class, 'unassignRoad']);

    // ── Reverse Geocode (OSM Nominatim + local roads) ──────────────────────
    Route::get('/v1/reverse-geocode', ReverseGeocodeController::class);

    // ── Roads (OSM data) ────────────────────────────────────────────────────
    Route::get('/roads', [RoadController::class, 'index']);
    Route::post('/roads', [RoadController::class, 'store']);

    // ── Worker Location Tracking ────────────────────────────────────────────
    Route::post('/worker/location', [WorkerLocationController::class, 'store']);
    Route::get('/worker/teams/nearest', [WorkerLocationController::class, 'nearest']);
    Route::get('/worker/teams/{id}/locations', [WorkerLocationController::class, 'teamLocations']);

    // ── Users CRUD ─────────────────────────────────────────────────────────
    Route::get('/users', [UserController::class, 'index']);
    Route::post('/users', [UserController::class, 'store']);
    Route::get('/users/{id}', [UserController::class, 'show']);
    Route::put('/users/{id}', [UserController::class, 'update']);
    Route::delete('/users/{id}', [UserController::class, 'destroy']);

    // ── Warga Reports ─────────────────────────────────────────────────────
    Route::post('/warga/reports', [WargaReportController::class, 'store'])
        ->middleware('role:warga');
    Route::get('/warga/reports', [WargaReportController::class, 'index'])
        ->middleware('role:warga');
    Route::get('/warga/reports/{id}', [WargaReportController::class, 'show'])
        ->middleware('role:warga');
});

// ── EXIF Test (public, untuk halaman test-exif.html) ──────────────────────────
Route::post('/test/extract-exif', [ReportController::class, 'extractFullExif']);

// ── Telegram Bot Webhook (public) ── dipindah ke routes/web.php
