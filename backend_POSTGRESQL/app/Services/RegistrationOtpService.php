<?php

namespace App\Services;

use App\Support\ApiError;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

/**
 * Challenge verifikasi OTP pendaftaran warga.
 *
 * Dipakai dua jalur: pendaftaran manual (AuthController::register) dan
 * pendaftaran lewat Google (GoogleAuthController::complete). Keduanya berakhir
 * di AuthController::verifyRegistration yang membuat baris users.
 *
 * Prinsip:
 *  - Challenge disimpan di Cache, bukan tabel baru — mengikuti pola
 *    `google_onboarding:` yang sudah ada di GoogleAuthController.
 *  - Klien memegang token acak 64 karakter; cache key adalah SHA-256-nya,
 *    sehingga isi cache tidak bisa dibaca dari token yang bocor di log.
 *  - Kata sandi masuk cache SUDAH di-hash. Plaintext tidak pernah tersimpan.
 *  - Kode OTP disimpan sebagai HMAC-SHA256 dan dibandingkan dengan
 *    hash_equals() (constant-time), bukan perbandingan string biasa.
 */
class RegistrationOtpService
{
    private const CACHE_PREFIX = 'registration:';

    /**
     * Mulai challenge baru: simpan payload + kirim kode.
     *
     * @param  array{name:string,email:string,phone:string,password_hash:string,registration_ip:?string,firebase_uid?:?string}  $payload
     * @return array{token:string,code:string,payload:array}
     */
    public function start(array $payload): array
    {
        $token = Str::random(64);
        $code = $this->generateCode();

        $this->put($token, $this->initialState($payload, $code));

        return ['token' => $token, 'code' => $code, 'payload' => $payload];
    }

    /**
     * Verifikasi kode TANPA membuang challenge.
     *
     * Challenge dibuang pemanggil lewat [discard] setelah baris `users`
     * berhasil dibuat — kalau tidak, kegagalan DB sementara memaksa pendaftar
     * mengulang dari langkah 1. Kode tetap single-use karena kode benar selalu
     * diikuti [discard].
     *
     * @return array payload pendaftaran (name, email, phone, password_hash, ...)
     *
     * @throws HttpResponseException
     */
    public function verify(string $token, string $code): array
    {
        return $this->withChallengeLock($token, function () use ($token, $code): array {
            $state = $this->load($token);

            if (($state['attempts'] ?? 0) >= $this->maxAttempts()) {
                $this->discardUnlocked($token);

                throw ApiError::httpFail(
                    'Terlalu banyak percobaan. Silakan daftar ulang.',
                    429,
                    'OTP_ATTEMPTS_EXCEEDED',
                );
            }

            if (! hash_equals((string) $state['code_hash'], $this->hashCode($code))) {
                $state['attempts'] = ((int) $state['attempts']) + 1;

                // Percobaan terakhir yang salah ikut membuang challenge.
                if ($state['attempts'] >= $this->maxAttempts()) {
                    $this->discardUnlocked($token);

                    throw ApiError::httpFail(
                        'Terlalu banyak percobaan. Silakan daftar ulang.',
                        429,
                        'OTP_ATTEMPTS_EXCEEDED',
                    );
                }

                $this->putState($token, $state);

                throw ApiError::httpFail(
                    'Kode verifikasi salah.',
                    422,
                    'OTP_INVALID',
                );
            }

            return $state['payload'];
        });
    }

    /**
     * Kirim ulang kode untuk challenge yang sama.
     * Token TIDAK berubah (klien tetap memakai token lamanya) — token hanya
     * disimpan sebagai hash, jadi nilai aslinya memang tidak bisa dikembalikan.
     *
     * @return array{token:string,code:string,payload:array}
     *
     * @throws HttpResponseException
     */
    public function resend(string $token): array
    {
        return $this->withChallengeLock($token, function () use ($token): array {
            $state = $this->load($token);

            $cooldown = $this->resendCooldown();
            $lastSentAt = (int) ($state['last_sent_at'] ?? 0);
            $waited = now()->timestamp - $lastSentAt;

            if ($waited < $cooldown) {
                throw ApiError::httpFail(
                    'Tunggu '.($cooldown - $waited).' detik sebelum meminta kode baru.',
                    429,
                    'OTP_RESEND_COOLDOWN',
                );
            }

            if ((int) ($state['sends'] ?? 0) >= $this->maxSends()) {
                throw ApiError::httpFail(
                    'Batas pengiriman kode tercapai. Silakan daftar ulang.',
                    429,
                    'OTP_SEND_LIMIT',
                );
            }

            $code = $this->generateCode();
            $state['code_hash'] = $this->hashCode($code);
            $state['sends'] = ((int) $state['sends']) + 1;
            $state['last_sent_at'] = now()->timestamp;

            $this->putState($token, $state);

            return ['token' => $token, 'code' => $code, 'payload' => $state['payload']];
        });
    }

    /** Buang challenge (mis. saat pengiriman email gagal, atau user membatalkan). */
    public function discard(string $token): void
    {
        $this->withChallengeLock($token, function () use ($token): void {
            $this->discardUnlocked($token);
        });
    }

    /**
     * Jalankan mutasi challenge di bawah lock terdistribusi per token.
     * Cache::lock() didukung oleh database/Redis/Memcached stores dan mencegah
     * dua request memproses attempts atau sends dari state yang sama.
     *
     * @template T
     *
     * @param  callable(): T  $callback
     * @return T
     */
    private function withChallengeLock(string $token, callable $callback): mixed
    {
        return Cache::lock($this->lockKey($token), 10)->block(10, $callback);
    }

    private function discardUnlocked(string $token): void
    {
        Cache::forget($this->cacheKey($token));
    }

    // ── Internal ─────────────────────────────────────────────────────────

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    private function initialState(array $payload, string $code): array
    {
        return [
            'payload' => $payload,
            'code_hash' => $this->hashCode($code),
            'attempts' => 0,
            'sends' => 1,
            'last_sent_at' => now()->timestamp,
        ];
    }

    /**
     * @return array<string, mixed>
     *
     * @throws HttpResponseException
     */
    private function load(string $token): array
    {
        $state = Cache::get($this->cacheKey($token));

        if (! is_array($state) || ! isset($state['payload'], $state['code_hash'])) {
            throw ApiError::httpFail(
                'Sesi pendaftaran sudah kedaluwarsa. Silakan daftar ulang.',
                422,
                'OTP_EXPIRED',
            );
        }

        return $state;
    }

    /**
     * @param  array<string, mixed>  $state
     */
    private function putState(string $token, array $state): void
    {
        Cache::put($this->cacheKey($token), $state, now()->addMinutes($this->ttlMinutes()));
    }

    /**
     * @param  array<string, mixed>  $state
     */
    private function put(string $token, array $state): void
    {
        $this->putState($token, $state);
    }

    private function cacheKey(string $token): string
    {
        return self::CACHE_PREFIX.hash('sha256', $token);
    }

    private function lockKey(string $token): string
    {
        return 'registration-lock:'.hash('sha256', $token);
    }

    /**
     * HMAC dengan APP_KEY — kode tidak tersimpan plaintext di cache.
     * Cache database bisa dibaca operator; kode OTP tidak boleh ikut terbaca.
     */
    private function hashCode(string $code): string
    {
        return hash_hmac('sha256', $code, (string) config('app.key'));
    }

    private function generateCode(): string
    {
        $length = $this->codeLength();
        $max = (10 ** $length) - 1;

        return str_pad((string) random_int(0, $max), $length, '0', STR_PAD_LEFT);
    }

    private function ttlMinutes(): int
    {
        return max(1, (int) config('registration.otp_ttl_minutes', 15));
    }

    private function codeLength(): int
    {
        return max(4, min(8, (int) config('registration.otp_length', 6)));
    }

    private function maxAttempts(): int
    {
        return max(1, (int) config('registration.otp_max_attempts', 5));
    }

    private function resendCooldown(): int
    {
        return max(0, (int) config('registration.otp_resend_cooldown_seconds', 60));
    }

    private function maxSends(): int
    {
        return max(1, (int) config('registration.otp_max_sends', 3));
    }
}
