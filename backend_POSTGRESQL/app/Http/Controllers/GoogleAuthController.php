<?php

namespace App\Http\Controllers;

use App\Contracts\FirebaseTokenVerifier;
use App\Models\User;
use App\Services\WargaRegistrationService;
use App\Support\ApiError;
use App\Support\PhoneNumber;
use App\Support\UserPayload;
use App\Support\VerifiedFirebaseUser;
use App\Support\WargaAccountGuard;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Kreait\Firebase\Exception\Auth\FailedToVerifyToken;

class GoogleAuthController extends Controller
{
    private const ONBOARDING_TTL_MINUTES = 15;

    public function login(Request $request, FirebaseTokenVerifier $verifier): JsonResponse
    {
        $validated = $request->validate([
            'firebase_token' => ['required', 'string', 'max:4096'],
        ]);

        try {
            $identity = $verifier->verify($validated['firebase_token']);
        } catch (FailedToVerifyToken $e) {
            return $this->fail('Token Google tidak valid atau sudah kedaluwarsa.', 401, 'FIREBASE_TOKEN_INVALID');
        } catch (\Throwable $e) {
            Log::error('Google auth: verifikasi token gagal.', ['error' => $e->getMessage()]);

            return $this->fail('Layanan autentikasi Google sedang bermasalah.', 503, 'FIREBASE_UNAVAILABLE');
        }

        if ($identity->provider !== 'google.com') {
            return $this->fail('Gunakan login Google untuk melanjutkan.', 401, 'FIREBASE_TOKEN_INVALID');
        }

        if (! $identity->emailVerified || $identity->uid === '' || ! filter_var($identity->email, FILTER_VALIDATE_EMAIL)) {
            return $this->fail('Email Google belum terverifikasi.', 401, 'FIREBASE_TOKEN_INVALID');
        }

        $user = User::where('firebase_uid', $identity->uid)->first();

        if (! $user) {
            $user = User::whereRaw('LOWER(email) = ?', [$identity->email])->first();
        }

        if (! $user) {
            return $this->onboardingResponse($identity, null);
        }

        if ($user->role !== 'warga') {
            return $this->fail('Akun Google hanya dapat digunakan untuk akun warga.', 403, 'GOOGLE_WARGA_ONLY');
        }

        if ($user->banned_at) {
            return $this->fail('Akun telah dinonaktifkan. Hubungi administrator.', 403, 'ACCOUNT_BANNED');
        }

        if ($user->firebase_uid && $user->firebase_uid !== $identity->uid) {
            return $this->fail('Akun ini sudah terhubung dengan akun Google lain.', 409, 'FIREBASE_UID_CONFLICT');
        }

        if (! $user->firebase_uid) {
            $user->forceFill([
                'firebase_uid' => $identity->uid,
                // Email sudah diverifikasi Google — tandai agar UI tidak
                // menawarkan verifikasi yang sebenarnya sudah selesai.
                'email_verified_at' => $user->email_verified_at ?? now(),
            ])->save();
        }

        if (blank($user->phone)) {
            return $this->onboardingResponse($identity, $user);
        }

        return $this->tokenResponse($user, 'Login berhasil.');
    }

    public function complete(Request $request, WargaRegistrationService $registrations): JsonResponse
    {
        $validated = $request->validate([
            'onboarding_token' => ['required', 'string', 'max:128'],
            'phone' => ['required', 'string', 'regex:'.PhoneNumber::VALIDATION_REGEX],
        ]);

        $cacheKey = $this->cacheKey($validated['onboarding_token']);
        $payload = Cache::get($cacheKey);

        if (! is_array($payload) || empty($payload['firebase_uid'])) {
            return $this->fail('Sesi pendaftaran sudah kedaluwarsa. Silakan login Google lagi.', 422, 'ONBOARDING_EXPIRED');
        }

        $isNewUser = (bool) ($payload['is_new_user'] ?? false);

        if ($isNewUser) {
            $request->validate([
                'password' => ['required', 'string', 'min:8', 'confirmed'],
            ]);
        }

        $phone = PhoneNumber::normalize($validated['phone']);
        $userId = $payload['user_id'] ?? null;

        $phoneQuery = User::where('phone', $phone);
        if ($userId) {
            $phoneQuery->whereKeyNot($userId);
        } elseif ($isNewUser && ! empty($payload['firebase_uid'])) {
            // Request `complete` ganda (respons pertama hilang di jaringan):
            // nomor yang sama milik akun yang baru saja dibuat untuk UID ini
            // bukan konflik — WargaRegistrationService akan mengembalikan akun
            // itu. Jangan sertakan baris ber-firebase_uid NULL.
            $uid = (string) $payload['firebase_uid'];
            $phoneQuery->where(function ($query) use ($uid) {
                $query->whereNull('firebase_uid')->orWhere('firebase_uid', '!=', $uid);
            });
        }

        if ($phoneQuery->exists()) {
            return $this->fail('Nomor telepon sudah terdaftar.', 422, 'PHONE_TAKEN');
        }

        // ── Akun baru: dibuat langsung di sini ──────────────────────────────
        // Email sudah dibuktikan Google: `login()` menolak token dengan
        // `email_verified != true` sebelum onboarding_token diterbitkan, dan
        // email diambil dari token (bukan diketik pengguna). OTP email karena
        // itu tidak menambah keamanan — hanya menambah titik gagal (SMTP mati
        // = pendaftaran Google ikut mati) dan satu langkah bagi pengguna.
        if ($isNewUser) {
            try {
                $user = $registrations->create([
                    'name' => $this->safeName((string) ($payload['name'] ?? ''), (string) $payload['email']),
                    'email' => (string) $payload['email'],
                    'phone' => $phone,
                    'password_hash' => Hash::make((string) $request->input('password')),
                    'registration_ip' => $request->ip(),
                    'firebase_uid' => (string) $payload['firebase_uid'],
                ], $request->ip());
            } catch (QueryException $e) {
                Log::warning('Google onboarding: konflik data.', ['error' => $e->getMessage()]);

                return $this->fail('Email atau nomor telepon sudah terdaftar.', 422, 'ONBOARDING_CONFLICT');
            }

            Cache::forget($cacheKey);

            return $this->tokenResponse($user, 'Pendaftaran berhasil.');
        }

        // ── Akun lama yang cuma kurang nomor telepon: tetap tanpa OTP ───────
        try {
            $user = DB::transaction(function () use ($payload, $phone): User {
                $uid = (string) $payload['firebase_uid'];

                $user = User::whereKey($payload['user_id'])->lockForUpdate()->first();

                if (! $user) {
                    throw ApiError::httpFail('Akun tidak ditemukan.', 409, 'ACCOUNT_CONFLICT');
                }

                WargaAccountGuard::assertCanContinue($user, $uid);
                WargaAccountGuard::applyOnboarding($user, $phone, $uid);

                return $user->fresh();
            });
        } catch (QueryException $e) {
            Log::warning('Google onboarding: konflik data.', ['error' => $e->getMessage()]);

            return $this->fail('Email atau nomor telepon sudah terdaftar.', 422, 'ONBOARDING_CONFLICT');
        }

        Cache::forget($cacheKey);

        return $this->tokenResponse($user, 'Pendaftaran berhasil.');
    }

    private function onboardingResponse(VerifiedFirebaseUser $identity, ?User $user): JsonResponse
    {
        $token = Str::random(64);
        $isNewUser = $user === null;
        $displayName = $isNewUser
            ? $this->safeName($identity->name, $identity->email)
            : $user->name;

        Cache::put($this->cacheKey($token), [
            'firebase_uid' => $identity->uid,
            'email' => $identity->email,
            'name' => $displayName,
            'user_id' => $user?->id,
            'is_new_user' => $isNewUser,
        ], now()->addMinutes(self::ONBOARDING_TTL_MINUTES));

        return response()->json([
            'success' => true,
            'message' => $isNewUser
                ? 'Lengkapi nomor telepon dan kata sandi untuk membuat akun.'
                : 'Lengkapi nomor telepon akun Anda.',
            'needs_onboarding' => true,
            'is_new_user' => $isNewUser,
            'missing_fields' => $isNewUser ? ['phone', 'password'] : ['phone'],
            'onboarding_token' => $token,
            'profile' => [
                'name' => $displayName,
                'email' => $isNewUser ? $identity->email : $user->email,
            ],
        ], 200);
    }

    private function tokenResponse(User $user, string $message): JsonResponse
    {
        $token = $user->createToken('jalankita-app')->plainTextToken;

        return response()->json([
            'success' => true,
            'message' => $message,
            'needs_onboarding' => false,
            'token' => $token,
            'user' => UserPayload::make($user),
        ], 200);
    }

    private function safeName(string $name, string $email): string
    {
        $name = preg_replace('/[\x00-\x1F\x7F]/u', '', $name) ?? '';
        $name = trim(preg_replace('/\s+/u', ' ', $name) ?? '');

        if ($name === '') {
            $local = strstr($email, '@', true) ?: 'Warga';
            $name = trim(str_replace(['.', '_', '-'], ' ', $local));
        }

        return $name !== '' ? Str::limit($name, 100, '') : 'Warga';
    }

    private function cacheKey(string $token): string
    {
        return 'google_onboarding:'.hash('sha256', $token);
    }

    /** Kontrak error bersama {@see ApiError} — `{success:false, message, error_code}`. */
    private function fail(string $message, int $status, string $code): JsonResponse
    {
        return ApiError::fail($message, $status, $code);
    }
}
