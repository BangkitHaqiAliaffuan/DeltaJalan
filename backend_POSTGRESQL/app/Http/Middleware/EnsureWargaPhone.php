<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class EnsureWargaPhone
{
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();

        if ($user && $user->role === 'warga' && blank($user->phone)) {
            return response()->json([
                'success' => false,
                'message' => 'Lengkapi nomor telepon terlebih dahulu.',
                'error_code' => 'PHONE_REQUIRED',
            ], 403);
        }

        return $next($request);
    }
}
