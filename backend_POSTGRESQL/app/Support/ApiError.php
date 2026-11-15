<?php

namespace App\Support;

use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\JsonResponse;

/**
 * Bentuk respons error API DeltaJalan.
 *
 * Semua endpoint auth mengembalikan `{success:false, message, error_code}` agar
 * klien (Android native + web) bisa memetakan pesan Bahasa Indonesia tanpa
 * mencocokkan teks. Sebelumnya helper ini privat di GoogleAuthController —
 * dipindah ke sini supaya AuthController::verifyRegistration dan
 * GoogleAuthController memakai kontrak yang sama persis.
 */
final class ApiError
{
    /** Respons error langsung (dipakai saat handler masih bisa `return`). */
    public static function fail(string $message, int $status, string $code): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => $message,
            'error_code' => $code,
        ], $status);
    }

    /**
     * Error untuk dilempar dari dalam DB::transaction (agar rollback terjadi).
     * Laravel mengubahnya menjadi respons HTTP yang sama seperti [fail].
     */
    public static function httpFail(string $message, int $status, string $code): HttpResponseException
    {
        return new HttpResponseException(self::fail($message, $status, $code));
    }
}