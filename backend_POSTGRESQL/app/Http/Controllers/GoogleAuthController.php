<?php

namespace App\Http\Controllers;

use App\Contracts\FirebaseTokenVerifier;
use App\Models\User;
use App\Support\PhoneNumber;
use App\Support\UserPayload;
use App\Support\VerifiedFirebaseUser;
use Illuminate\Database\QueryException;
use Illuminate\Http\Exceptions\HttpResponseException;
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
            $user->forceFill(['firebase_uid' => $identity->uid])->save();
        }

        if (blank($user->phone)) {
            return $this->onboardingResponse($identity, $user);
        }

        return $this->tokenResponse($user, 'Login berhasil.');
    }

    public function complete(Request $request): JsonResponse
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
        }

        if ($phoneQuery->exists()) {
            return $this->fail('Nomor telepon sudah terdaftar.', 422, 'PHONE_TAKEN');
        }

        try {
            $user = DB::transaction(function () use ($payload, $phone, $request) {
                $uid = (string) $payload['firebase_uid'];

                if (! empty($payload['user_id'])) {
                    $user = User::whereKey($payload['user_id'])->lockForUpdate()->first();

                    if (! $user) {
                        throw $this->httpFail('Akun tidak ditemukan.', 409, 'ACCOUNT_CONFLICT');
                    }

                    $this->assertWargaCanContinue($user, $uid);
                    $this->applyOnboardingFields($user, $phone, $uid);

                    return $user->fresh();
                }

                // Idempotensi: request bisa saja sukses di server tetapi response
                // jaringan hilang. Jangan buat baris kedua untuk UID yang sama.
                $existing = User::where('firebase_uid', $uid)->lockForUpdate()->first();
                if ($existing) {
                    $this->assertWargaCanContinue($existing, $uid);
                    $this->applyOnboardingFields($existing, $phone, $uid);

                    return $existing->fresh();
                }

                $emailUser = User::whereRaw('LOWER(email) = ?', [$payload['email']])
                    ->lockForUpdate()
                    ->first();

                if ($emailUser) {
                    $this->assertWargaCanContinue($emailUser, $uid);
                    $this->applyOnboardingFields($emailUser, $phone, $uid);

                    return $emailUser->fresh();
                }

                return User::create([
                    'name' => $this->safeName((string) ($payload['name'] ?? ''), (string) $payload['email']),
                    'email' => (string) $payload['email'],
                    'phone' => $phone,
                    'password' => Hash::make((string) $request->input('password')),
                    'role' => 'warga',
                    'firebase_uid' => $uid,
                    'registration_ip' => $request->ip(),
                    'email_verified_at' => now(),
                ]);
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

    private function assertWargaCanContinue(User $user, string $uid): void
    {
        if ($user->role !== 'warga') {
            throw $this->httpFail('Akun Google hanya dapat digunakan untuk akun warga.', 403, 'GOOGLE_WARGA_ONLY');
        }

        if ($user->banned_at) {
            throw $this->httpFail('Akun telah dinonaktifkan. Hubungi administrator.', 403, 'ACCOUNT_BANNED');
        }

        if ($user->firebase_uid && $user->firebase_uid !== $uid) {
            throw $this->httpFail('Akun ini sudah terhubung dengan akun Google lain.', 409, 'FIREBASE_UID_CONFLICT');
        }
    }

    private function applyOnboardingFields(User $user, string $phone, string $uid): void
    {
        if (filled($user->phone) && $user->phone !== $phone) {
            throw $this->httpFail('Nomor telepon akun sudah terisi.', 409, 'PHONE_ALREADY_SET');
        }

        $user->forceFill([
            'phone' => $user->phone ?: $phone,
            'firebase_uid' => $user->firebase_uid ?: $uid,
        ])->save();
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

    private function httpFail(string $message, int $status, string $code): HttpResponseException
    {
        return new HttpResponseException(response()->json([
            'success' => false,
            'message' => $message,
            'error_code' => $code,
        ], $status));
    }

    private function fail(string $message, int $status, string $code): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => $message,
            'error_code' => $code,
        ], $status);
    }
}
