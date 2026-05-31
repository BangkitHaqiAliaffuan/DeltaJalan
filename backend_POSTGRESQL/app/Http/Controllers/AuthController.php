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
 * Menangani autentikasi pengguna JalanKita.
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
     *
     * @param  Request  $request
     * @return JsonResponse
     */
    public function login(Request $request): JsonResponse
    {
        // ── Validasi input ────────────────────────────────────────────────
        try {
            $request->validate([
                'email'    => ['required', 'email'],
                'password' => ['required', 'string', 'min:6'],
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Format email atau password tidak valid.',
                'errors'  => $e->errors(),
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
            'token'   => $token,
            'user'    => [
                'id'         => $user->id,
                'name'       => $user->name,
                'email'      => $user->email,
                'role'       => $user->role,
                'role_label' => $user->role_label,
                'wilayah'    => $user->wilayah,
                'nip'        => $user->nip,
                'upr_id'     => $user->upr_id,
                'upr_name'   => $user->upr?->name,
                'initials'   => $user->initials,
            ],
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
        $user = $request->user()->load('upr');

        return response()->json([
            'success' => true,
            'user'    => [
                'id'         => $user->id,
                'name'       => $user->name,
                'email'      => $user->email,
                'role'       => $user->role,
                'role_label' => $user->role_label,
                'wilayah'    => $user->wilayah,
                'nip'        => $user->nip,
                'upr_id'     => $user->upr_id,
                'upr_name'   => $user->upr?->name,
                'initials'   => $user->initials,
            ],
        ], 200);
    }
}
