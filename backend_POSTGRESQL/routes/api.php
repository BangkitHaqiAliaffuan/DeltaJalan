<?php

use App\Http\Controllers\AIController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\ReportController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes — JalanKita Backend
|--------------------------------------------------------------------------
*/

// ── Auth Routes (publik, tidak perlu token) ───────────────────────────────

/**
 * POST /api/auth/login
 * Throttle: maks 10 percobaan per menit per IP.
 * Cukup longgar untuk penggunaan normal, tapi mencegah brute force.
 */
Route::middleware('throttle:10,1')->post('/auth/login', [AuthController::class, 'login']);

// ── Auth Routes (butuh token Sanctum) ────────────────────────────────────
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/me',     [AuthController::class, 'me']);
});

// ── Routes JalanKita ──────────────────────────────────────────────────────

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
});
