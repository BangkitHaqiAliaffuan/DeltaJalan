<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Http\Exceptions\HttpResponseException;

/**
 * Aturan akun warga yang dipakai bersama oleh jalur Google dan jalur OTP.
 *
 * Diekstrak dari helper privat GoogleAuthController supaya
 * AuthController::verifyRegistration() dan GoogleAuthController::complete()
 * tidak bisa menyimpang satu sama lain. Aturan role/banned/firebase_uid HARUS
 * identik di kedua jalur — kalau tidak, akun bisa lolos lewat celah yang satu.
 */
final class WargaAccountGuard
{
    /**
     * Pastikan akun boleh melanjutkan onboarding Google.
     *
     * @throws HttpResponseException
     */
    public static function assertCanContinue(User $user, string $uid): void
    {
        if ($user->role !== 'warga') {
            throw ApiError::httpFail(
                'Akun Google hanya dapat digunakan untuk akun warga.',
                403,
                'GOOGLE_WARGA_ONLY',
            );
        }

        if ($user->banned_at) {
            throw ApiError::httpFail(
                'Akun telah dinonaktifkan. Hubungi administrator.',
                403,
                'ACCOUNT_BANNED',
            );
        }

        if ($user->firebase_uid && $user->firebase_uid !== $uid) {
            throw ApiError::httpFail(
                'Akun ini sudah terhubung dengan akun Google lain.',
                409,
                'FIREBASE_UID_CONFLICT',
            );
        }
    }

    /**
     * Isi phone/firebase_uid yang belum ada pada akun yang sudah terdaftar.
     *
     * @throws HttpResponseException
     */
    public static function applyOnboarding(User $user, string $phone, string $uid): void
    {
        if (filled($user->phone) && $user->phone !== $phone) {
            throw ApiError::httpFail(
                'Nomor telepon akun sudah terisi.',
                409,
                'PHONE_ALREADY_SET',
            );
        }

        // forceFill: firebase_uid tidak ada di $fillable (sengaja — bukan input user).
        // email_verified_at: jalur ini hanya tercapai setelah email terbukti
        // (OTP terverifikasi atau klaim `email_verified` Firebase), jadi akun
        // lama yang belum pernah ditandai ikut ditandai di sini.
        $user->forceFill([
            'phone' => $user->phone ?: $phone,
            'firebase_uid' => $user->firebase_uid ?: $uid,
            'email_verified_at' => $user->email_verified_at ?? now(),
        ])->save();
    }
}
