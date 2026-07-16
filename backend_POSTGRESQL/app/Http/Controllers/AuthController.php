<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
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
        if (str_starts_with($phone, '+62')) $phone = '0'.substr($phone, 3);
        elseif (str_starts_with($phone, '62')) $phone = '0'.substr($phone, 2);
        elseif (!str_starts_with($phone, '0')) $phone = null;

        // ── Cari user berdasarkan email atau nomor telepon ─────────────────
        $user = User::where('email', $login)
            ->when($phone, fn($q) => $q->orWhere('phone', $phone))
            ->first();

        // ── Verifikasi password ───────────────────────────────────────────
        // Gunakan Hash::check() untuk membandingkan password plain dengan hash bcrypt
        if (! $user || ! Hash::check($request->password, $user->password)) {
            return response()->json([
                'success' => false,
                'message' => 'Email atau kata sandi salah.',
            ], 401);
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
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'role' => $user->role,
                'role_label' => $user->role_label,
                'wilayah' => $user->wilayah,
                'nip' => $user->nip,
                'initials' => $user->initials,
                'team_id' => $user->team_id,
                'team_name' => $user->team?->name,
            ],
        ], 200);
    }

    /**
     * Register warga.
     */
    public function register(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'name' => ['required', 'string', 'min:2', 'max:100', 'regex:/^[A-Za-zÀ-ÖØ-öø-ÿ \'.-]+$/'],
                'email' => ['required', 'email', 'unique:users,email'],
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

        $phone = $validated['phone'];
        if (str_starts_with($phone, '+62')) $phone = '0'.substr($phone, 3);
        elseif (str_starts_with($phone, '62')) $phone = '0'.substr($phone, 2);

        // ── Cek unique nomor telepon (setelah normalisasi) ─────────────────
        if (User::where('phone', $phone)->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'Validasi gagal.',
                'errors' => ['phone' => ['Nomor telepon sudah terdaftar.']],
            ], 422);
        }

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'phone' => $phone,
            'password' => Hash::make($validated['password']),
            'role' => 'warga',
            'registration_ip' => $request->ip(),
            'email_verified_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Registrasi berhasil. Silakan login.',
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'role' => $user->role,
            ],
        ], 201);
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
        $user = $request->user()->load('team');

        return response()->json([
            'success' => true,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'role' => $user->role,
                'role_label' => $user->role_label,
                'wilayah' => $user->wilayah,
                'nip' => $user->nip,
                'initials' => $user->initials,
                'team_id' => $user->team_id,
                'team_name' => $user->team?->name,
            ],
        ], 200);
    }
}
