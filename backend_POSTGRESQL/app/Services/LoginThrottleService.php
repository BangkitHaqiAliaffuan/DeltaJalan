<?php

namespace App\Services;

use Illuminate\Support\Facades\RateLimiter;

/**
 * Pembatas percobaan login per AKUN.
 *
 * ── Mengapa ini ada ───────────────────────────────────────────────────────
 * Sebelumnya login hanya dibatasi `throttle:10,1` yang dihitung per alamat
 * IP. Penyerang yang memakai banyak IP (atau botnet/proxy) bisa mencoba
 * password tanpa batas terhadap satu akun. Password minimum aplikasi hanya
 * 6 karakter, sehingga tebak-paksa kata sandi umum realistis.
 *
 * Pembatas ini menutup celah tersebut dengan menghitung percobaan GAGAL per
 * akun, bukan per IP:
 *
 *   maksimal 5 kegagalan per akun dalam 15 menit → akun dikunci sementara
 *
 * Sandi yang benar tidak dihitung sebagai kegagalan dan langsung mengosongkan
 * hitungan, sehingga pengguna sah yang salah ketik beberapa kali tidak
 * terkunci lama.
 *
 * ── Kunci memakai hash, bukan email mentah ────────────────────────────────
 * Email tidak pernah ditulis ke cache dalam bentuk asli. Selain itu hash
 * membuat kunci tidak bisa ditebak dari luar.
 */
class LoginThrottleService
{
    /** Jumlah kegagalan maksimum sebelum akun dikunci sementara. */
    public const MAX_ATTEMPTS = 5;

    /** Jendela waktu hitungan & lama kunci (menit). */
    public const DECAY_MINUTES = 15;

    /**
     * Identitas akun untuk kunci cache.
     *
     * Memakai email yang sudah dinormalisasi (huruf kecil, trim) agar
     * "Budi@x.com" dan "budi@x.com" dihitung sebagai akun yang sama — kalau
     * tidak, penyerang bisa mengganti-ganti kapitalisasi untuk menghindari
     * batas.
     */
    public function key(string $identifier): string
    {
        return 'login-fail:'.hash('sha256', mb_strtolower(trim($identifier)));
    }

    /**
     * Apakah akun ini sedang dikunci?
     */
    public function isLocked(string $identifier): bool
    {
        return RateLimiter::tooManyAttempts($this->key($identifier), self::MAX_ATTEMPTS);
    }

    /**
     * Sisa detik sebelum akun bisa dicoba lagi.
     */
    public function availableIn(string $identifier): int
    {
        return RateLimiter::availableIn($this->key($identifier));
    }

    /**
     * Catat satu kegagalan login.
     */
    public function recordFailure(string $identifier): void
    {
        RateLimiter::hit($this->key($identifier), self::DECAY_MINUTES * 60);
    }

    /**
     * Kosongkan hitungan setelah login berhasil.
     */
    public function clear(string $identifier): void
    {
        RateLimiter::clear($this->key($identifier));
    }

    /**
     * Pesan penolakan yang ramah untuk pengguna.
     *
     * Sengaja TIDAK menyebut "akun ini terkunci" secara spesifik, agar tidak
     * membocorkan bahwa email tersebut terdaftar. Pengguna sah tetap mendapat
     * informasi yang cukup (menunggu berapa lama).
     */
    public function message(string $identifier): string
    {
        $menit = max(1, (int) ceil($this->availableIn($identifier) / 60));

        return "Terlalu banyak percobaan masuk yang gagal. Coba lagi dalam {$menit} menit.";
    }
}
