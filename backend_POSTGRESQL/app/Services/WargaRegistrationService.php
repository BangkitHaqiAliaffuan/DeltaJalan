<?php

namespace App\Services;

use App\Models\User;
use App\Support\ApiError;
use App\Support\WargaAccountGuard;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Facades\DB;

/**
 * Pembuatan baris `users` untuk akun warga.
 *
 * Diekstrak dari AuthController::createWargaFromPayload supaya jalur OTP
 * (`/auth/register/verify`) dan jalur Google (`/auth/google/complete`) memakai
 * aturan yang sama persis: cek email/phone diulang di dalam transaksi +
 * lockForUpdate, idempotensi `firebase_uid`, dan `email_verified_at` diisi
 * karena email sudah terbukti (OTP atau klaim `email_verified` Firebase).
 */
final class WargaRegistrationService
{
    /**
     * @param  array{name:string,email:string,phone:string,password_hash:string,registration_ip?:?string,firebase_uid?:?string}  $payload
     *
     * @throws HttpResponseException konflik email/phone
     */
    public function create(array $payload, ?string $fallbackIp = null): User
    {
        return DB::transaction(function () use ($payload, $fallbackIp) {
            $email = (string) $payload['email'];
            $phone = (string) $payload['phone'];
            $uid = filled($payload['firebase_uid'] ?? null) ? (string) $payload['firebase_uid'] : null;

            // 1. Idempotensi jalur Google: request bisa saja sukses di server
            //    tetapi responsnya hilang. Jangan buat baris kedua untuk UID sama.
            if ($uid) {
                $existing = User::where('firebase_uid', $uid)->lockForUpdate()->first();

                if ($existing) {
                    WargaAccountGuard::assertCanContinue($existing, $uid);
                    WargaAccountGuard::applyOnboarding($existing, $phone, $uid);

                    return $existing->fresh();
                }
            }

            // 2. Email sudah terpakai. Untuk pendaftaran MANUAL ini konflik —
            //    OTP membuktikan pendaftar memegang email itu, tapi barisnya
            //    sudah ada lebih dulu. Untuk jalur GOOGLE, Firebase sudah
            //    memverifikasi email tersebut, jadi akun lama ditautkan.
            $emailUser = User::whereRaw('LOWER(email) = ?', [mb_strtolower($email)])
                ->lockForUpdate()
                ->first();

            if ($emailUser) {
                if ($uid === null) {
                    throw ApiError::httpFail('Email sudah terdaftar.', 422, 'REGISTRATION_CONFLICT');
                }

                WargaAccountGuard::assertCanContinue($emailUser, $uid);
                WargaAccountGuard::applyOnboarding($emailUser, $phone, $uid);

                return $emailUser->fresh();
            }

            // 3. Nomor telepon dipakai akun lain.
            //    `first()` (bukan `exists()`) supaya klausa FOR UPDATE tidak
            //    dikompilasi ke dalam subquery EXISTS — di PostgreSQL bentuk itu
            //    tidak sepadan nilainya dengan risiko errornya. Constraint unique
            //    tetap jaring terakhir kalau ada balapan.
            $phoneQuery = User::where('phone', $phone);
            if ($uid) {
                // Sertakan baris ber-firebase_uid NULL: `!=` biasa mengecualikan
                // NULL di SQL, sehingga konflik phone dengan akun non-Google
                // lolos pre-check (dan hanya tertangkap unique index).
                $phoneQuery->where(function ($query) use ($uid) {
                    $query->whereNull('firebase_uid')->orWhere('firebase_uid', '!=', $uid);
                });
            }

            if ($phoneQuery->lockForUpdate()->first() !== null) {
                throw ApiError::httpFail('Nomor telepon sudah terdaftar.', 422, 'REGISTRATION_CONFLICT');
            }

            // 4. Buat akun baru.
            $user = new User;
            $user->forceFill([
                'name' => (string) $payload['name'],
                'email' => $email,
                'phone' => $phone,
                'password' => (string) $payload['password_hash'],
                'role' => 'warga',
                'firebase_uid' => $uid,
                'registration_ip' => $payload['registration_ip'] ?? $fallbackIp,
                'email_verified_at' => now(),
            ])->save();

            return $user;
        });
    }
}
