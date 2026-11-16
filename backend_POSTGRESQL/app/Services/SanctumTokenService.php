<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Carbon;

/**
 * Penerbit token Sanctum dengan masa berlaku terbatas.
 *
 * ── Mengapa tidak mengubah config/sanctum.php ─────────────────────────────
 * `sanctum.expiration` dihitung dari `created_at` token
 * (`Sanctum\Guard::isValidAccessToken`). Kalau nilai itu diset, SEMUA token
 * yang sudah ada dan lebih tua dari batas langsung mati pada detik deploy —
 * seluruh petugas lapangan ter-logout serentak.
 *
 * Pendekatan di sini memakai `expires_at` PER TOKEN (kolom yang sudah ada di
 * `personal_access_tokens`):
 *
 *   - Token baru  → punya `expires_at`, kedaluwarsa sesuai masa berlaku.
 *   - Token lama  → `expires_at` NULL, tetap hidup sampai pengguna login ulang
 *                   dan menerima token baru. Tidak ada logout massal.
 *
 * Ini menutup celah "token abadi" tanpa memutus layanan yang sedang berjalan.
 *
 * ── Mengapa masa berlakunya panjang ───────────────────────────────────────
 * Petugas mengukur di lapangan dan sering tidak membuka aplikasi selama
 * berhari-hari. Masa berlaku terlalu pendek berarti mereka ter-logout di
 * tengah pekerjaan, yang lebih berbahaya (data hilang) daripada manfaat
 * keamanannya. 90 hari cukup membatasi kerugian bila token bocor, tanpa
 * mengganggu operasional.
 */
class SanctumTokenService
{
    /** Nama token yang dipakai seluruh klien (web, Android, Capacitor). */
    public const TOKEN_NAME = 'jalankita-app';

    /** Masa berlaku token dalam hari. */
    public const LIFETIME_DAYS = 90;

    /**
     * Terbitkan token baru untuk pengguna.
     */
    public function issue(User $user): string
    {
        return $user->createToken(
            self::TOKEN_NAME,
            ['*'],
            Carbon::now()->addDays(self::LIFETIME_DAYS),
        )->plainTextToken;
    }

    /**
     * Cabut SEMUA token pengguna lalu terbitkan satu yang baru.
     *
     * ── TIDAK DIPAKAI SAAT LOGIN ──────────────────────────────────────────
     * `logout()` hanya mencabut `currentAccessToken()`, artinya aplikasi ini
     * memang mendukung login di beberapa perangkat sekaligus (mis. petugas
     * memakai HP dan tablet). Memanggil ini saat login akan memutus sesi di
     * perangkat lain secara diam-diam.
     *
     * Disediakan untuk keperluan administratif yang eksplisit, misalnya
     * memaksa login ulang setelah akun dipulihkan dari pembajakan.
     */
    public function revokeAllAndIssue(User $user): string
    {
        $user->tokens()->delete();

        return $this->issue($user);
    }
}
