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
                'email' => ['required', 'email'],
                'password' => ['required', 'string', 'min:6'],
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Format email atau password tidak valid.',
                'errors' => $e->errors(),
            ], 422);
        }

        // ── Cari user berdasarkan email ───────────────────────────────────
        $user = User::where('email', $request->email)->first();

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
                'name' => ['required', 'string', 'max:100'],
                'email' => ['required', 'email', 'unique:users,email'],
                'phone' => ['required', 'string', 'regex:/^08[0-9]{8,13}$/'],
                'password' => ['required', 'string', 'min:8', 'confirmed'],
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Validasi gagal.',
                'errors' => $e->errors(),
            ], 422);
        }

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'phone' => $validated['phone'],
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
