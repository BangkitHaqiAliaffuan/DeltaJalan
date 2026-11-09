<?php

namespace App\Http\Controllers;

use App\Mail\OtpVerificationMail;
use App\Models\User;
use App\Services\RegistrationOtpService;
use App\Services\WargaRegistrationService;
use App\Support\ApiError;
use App\Support\PhoneNumber;
use App\Support\UserPayload;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;

/**
 * AuthController
 *
 * Menangani autentikasi pengguna DeltaJalan.
 * Mendukung 2 role: petugas dan supervisor.
 * Role ditentukan otomatis dari data user di database — tidak perlu dipilih saat login.
 *
 * Alur login:
 *   Frontend → POST /api/auth/login (email + password)
 *       ↓
 *   Cek kredensial di tabel users
 *       ↓
 *   Return data user + role → Frontend redirect sesuai role
 */
class AuthController extends Controller
{
    /**
     * Login pengguna.
     *
     * Menerima email dan password, memvalidasi kredensial,
     * dan mengembalikan data user beserta role-nya.
     * Frontend akan redirect ke halaman yang sesuai berdasarkan role.
     */
    public function login(Request $request): JsonResponse
    {
        // ── Validasi input ────────────────────────────────────────────────
        try {
            $request->validate([
                'email' => ['required', 'string'],
                'password' => ['required', 'string', 'min:6'],
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Format email atau password tidak valid.',
                'errors' => $e->errors(),
            ], 422);
        }

        // ── Normalisasi nomor telepon (sama seperti di register) ──────────
        $login = $request->email;
        $phone = $login;
        $phone = preg_replace('/[\s\-().]/', '', $phone);
        if (str_starts_with($phone, '+62')) {
            $phone = '0'.substr($phone, 3);
        } elseif (str_starts_with($phone, '62')) {
            $phone = '0'.substr($phone, 2);
        } elseif (! str_starts_with($phone, '0')) {
            $phone = null;
        }

        // ── Cari user berdasarkan email atau nomor telepon ─────────────────
        // Email dicocokkan case-insensitive: pendaftaran menyimpan huruf kecil,
        // tapi pengguna bisa saja mengetik "Budi@…" saat login.
        $user = User::whereRaw('LOWER(email) = ?', [mb_strtolower($login)])
            ->when($phone, fn ($q) => $q->orWhere('phone', $phone))
            ->first();

        // ── Verifikasi password ───────────────────────────────────────────
        // Gunakan Hash::check() untuk membandingkan password plain dengan hash bcrypt
        if (! $user || ! $user->password || ! Hash::check($request->password, $user->password)) {
            return response()->json([
                'success' => false,
                'message' => 'Email atau kata sandi salah.',
            ], 401);
        }

        // ── Cek apakah akun di-ban ────────────────────────────────────────
        if ($user->banned_at) {
            return response()->json([
                'success' => false,
                'message' => 'Akun telah dinonaktifkan. Hubungi administrator.',
            ], 403);
        }

        // ── Buat token Sanctum ────────────────────────────────────────────
        // Token ini akan dikirim ke frontend dan disimpan di localStorage
        // Nama token: 'jalankita-app' untuk identifikasi
        $token = $user->createToken('jalankita-app')->plainTextToken;

        // ── Return response ───────────────────────────────────────────────
        return response()->json([
            'success' => true,
            'message' => 'Login berhasil.',
            'token' => $token,
            'user' => UserPayload::make($user),
        ], 200);
    }

    /**
     * Langkah 1 pendaftaran warga: validasi + kirim OTP.
     *
     * Akun BELUM dibuat di sini. Baris users baru lahir di [verifyRegistration]
     * setelah kode OTP benar, sehingga email yang salah ketik / bukan milik
     * pendaftar tidak bisa mengklaim alamat tersebut (email adalah kredensial
     * login — lihat ::login).
     */
    public function register(Request $request, RegistrationOtpService $otp): JsonResponse
    {
        try {
            $validated = $request->validate([
                'name' => ['required', 'string', 'min:2', 'max:100', 'regex:/^[A-Za-zÀ-ÖØ-öø-ÿ \'.-]+$/'],
                'email' => ['required', 'email'],
                'phone' => ['required', 'string', 'regex:/^(?:\+62|62|0)8[1-9][0-9]{6,9}$/'],
                'password' => ['required', 'string', 'min:8', 'confirmed'],
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Validasi gagal.',
                'errors' => $e->errors(),
            ], 422);
        }

        $phone = PhoneNumber::normalize($validated['phone']);

        // ── Cek unique email case-insensitive ───────────────────────────────
        // `unique:users,email` membandingkan persis (case-sensitive) sementara
        // langkah verifikasi memakai LOWER(email); tanpa ini pendaftar
        // "Budi@x.com" tetap dikirimi OTP padahal "budi@x.com" sudah terdaftar
        // dan baru ditolak di langkah 2.
        if (User::whereRaw('LOWER(email) = ?', [mb_strtolower($validated['email'])])->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'Validasi gagal.',
                'errors' => ['email' => ['Email sudah terdaftar.']],
            ], 422);
        }

        // ── Cek unique nomor telepon (setelah normalisasi) ─────────────────
        if (User::where('phone', $phone)->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'Validasi gagal.',
                'errors' => ['phone' => ['Nomor telepon sudah terdaftar.']],
            ], 422);
        }

        $challenge = $otp->start([
            'name' => $validated['name'],
            // Simpan huruf kecil: email adalah kredensial login dan
            // perbandingannya selalu case-insensitive (lihat ::login).
            'email' => mb_strtolower($validated['email']),
            'phone' => $phone,
            // Hash di sini agar plaintext tidak pernah masuk Cache.
            'password_hash' => Hash::make($validated['password']),
            'registration_ip' => $request->ip(),
            'firebase_uid' => null,
        ]);

        return $this->sendOtpOrFail($otp, $challenge, 'Kode verifikasi telah dikirim ke email Anda.');
    }

    /**
     * Langkah 2 pendaftaran warga: verifikasi kode OTP → buat akun → login.
     *
     * Dipakai bersama oleh jalur daftar manual dan jalur Google (akun baru),
     * memakai `registration_token` yang sama.
     */
    public function verifyRegistration(
        Request $request,
        RegistrationOtpService $otp,
        WargaRegistrationService $registrations,
    ): JsonResponse {
        try {
            $validated = $request->validate([
                'registration_token' => ['required', 'string', 'max:128'],
                'code' => ['required', 'string', 'digits:'.config('registration.otp_length', 6)],
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Validasi gagal.',
                'errors' => $e->errors(),
            ], 422);
        }

        // Melempar ApiError::httpFail bila token mati / kode salah.
        $payload = $otp->verify($validated['registration_token'], $validated['code']);

        try {
            $user = $registrations->create($payload, $request->ip());
        } catch (QueryException $e) {
            Log::warning('Pendaftaran OTP: konflik data.', ['error' => $e->getMessage()]);

            return ApiError::fail(
                'Email atau nomor telepon sudah terdaftar.',
                422,
                'REGISTRATION_CONFLICT',
            );
        } finally {
            // Challenge dibuang SETELAH percobaan membuat user: kegagalan DB
            // sementara tidak lagi memaksa pendaftar mengulang dari langkah 1,
            // sementara kode tetap single-use.
            $otp->discard($validated['registration_token']);
        }

        return response()->json([
            'success' => true,
            'message' => 'Pendaftaran berhasil.',
            'token' => $user->createToken('jalankita-app')->plainTextToken,
            'user' => UserPayload::make($user),
        ], 200);
    }

    /**
     * Kirim ulang kode OTP untuk challenge yang sedang berjalan.
     * Token tidak berubah — klien tetap memakai `registration_token` lamanya.
     */
    public function resendRegistration(Request $request, RegistrationOtpService $otp): JsonResponse
    {
        try {
            $validated = $request->validate([
                'registration_token' => ['required', 'string', 'max:128'],
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Validasi gagal.',
                'errors' => $e->errors(),
            ], 422);
        }

        $challenge = $otp->resend($validated['registration_token']);

        return $this->sendOtpOrFail($otp, $challenge, 'Kode verifikasi baru telah dikirim ke email Anda.');
    }

    /**
     * Kirim email OTP; bila gagal, challenge dibuang supaya tidak ada token
     * hidup yang kodenya tidak pernah sampai ke user.
     *
     * @param  array{token:string,code:string,payload:array}  $challenge
     */
    private function sendOtpOrFail(
        RegistrationOtpService $otp,
        array $challenge,
        string $successMessage,
    ): JsonResponse {
        $payload = $challenge['payload'];

        // MAIL_MAILER=log di produksi = kegagalan senyap: Mail::send() sukses,
        // API membalas 200, tetapi tidak ada email yang pernah terkirim dan
        // pengguna berhenti di layar OTP. Tolak lebih awal dengan pesan jelas.
        if (app()->environment('production') && config('mail.default') === 'log') {
            $otp->discard($challenge['token']);

            Log::error('Pendaftaran OTP: MAIL_MAILER=log di produksi — email tidak akan terkirim.');

            return ApiError::fail(
                'Layanan email belum dikonfigurasi. Hubungi administrator.',
                503,
                'MAIL_NOT_CONFIGURED',
            );
        }

        try {
            Mail::to($payload['email'])->send(new OtpVerificationMail(
                code: $challenge['code'],
                recipientName: (string) $payload['name'],
                ttlMinutes: (int) config('registration.otp_ttl_minutes', 15),
            ));
        } catch (\Throwable $e) {
            $otp->discard($challenge['token']);

            Log::error('Pendaftaran OTP: gagal mengirim email.', [
                'error' => $e->getMessage(),
            ]);

            return ApiError::fail(
                'Kode verifikasi gagal dikirim. Silakan coba lagi.',
                503,
                'EMAIL_SEND_FAILED',
            );
        }

        return response()->json([
            'success' => true,
            'message' => $successMessage,
            'needs_verification' => true,
            'registration_token' => $challenge['token'],
            'email' => $payload['email'],
        ], 200);
    }

    public function completePhone(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'phone' => ['required', 'string', 'regex:'.PhoneNumber::VALIDATION_REGEX],
        ]);

        $user = $request->user();

        if ($user->role !== 'warga') {
            return response()->json([
                'success' => false,
                'message' => 'Endpoint ini hanya untuk akun warga.',
                'error_code' => 'GOOGLE_WARGA_ONLY',
            ], 403);
        }

        $phone = PhoneNumber::normalize($validated['phone']);

        if (filled($user->phone)) {
            if ($user->phone === $phone) {
                return response()->json([
                    'success' => true,
                    'message' => 'Nomor telepon sudah tersimpan.',
                    'user' => UserPayload::make($user),
                ], 200);
            }

            return response()->json([
                'success' => false,
                'message' => 'Nomor telepon akun sudah terisi. Hubungi administrator untuk mengubahnya.',
                'error_code' => 'PHONE_ALREADY_SET',
            ], 422);
        }

        if (User::where('phone', $phone)->whereKeyNot($user->id)->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'Nomor telepon sudah terdaftar.',
                'error_code' => 'PHONE_TAKEN',
            ], 422);
        }

        $user->forceFill(['phone' => $phone])->save();

        return response()->json([
            'success' => true,
            'message' => 'Nomor telepon berhasil disimpan.',
            'user' => UserPayload::make($user->fresh()),
        ], 200);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'success' => true,
            'message' => 'Logout berhasil.',
        ], 200);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'user' => UserPayload::make($request->user()),
        ], 200);
    }
}
