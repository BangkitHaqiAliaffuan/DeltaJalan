<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        /*
        |----------------------------------------------------------------------
        | CORS — Cross-Origin Resource Sharing
        |----------------------------------------------------------------------
        |
        | Mengizinkan frontend React (yang berjalan di port berbeda, misal 5173)
        | untuk mengakses API Laravel.
        |
        | Di production, ganti '*' dengan domain frontend yang spesifik.
        |
        */
        $middleware->api(prepend: [
            \Illuminate\Http\Middleware\HandleCors::class,
            \App\Http\Middleware\ForceJsonResponse::class,
        ]);

        /*
        |----------------------------------------------------------------------
        | Trusted Proxies
        |----------------------------------------------------------------------
        |
        | Jika Laravel berjalan di belakang reverse proxy (Nginx, dll),
        | uncomment baris di bawah agar IP dan URL terdeteksi dengan benar.
        |
        */
        $middleware->trustProxies(at: '*');
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        /*
        |----------------------------------------------------------------------
        | JSON Exception Handler untuk API Routes
        |----------------------------------------------------------------------
        |
        | Memastikan semua error di route /api/* dikembalikan sebagai JSON,
        | bukan sebagai halaman HTML (yang tidak bisa dibaca oleh frontend React).
        |
        */
        $exceptions->shouldRenderJsonWhen(function (Request $request, \Throwable $e) {
            return $request->is('api/*') || $request->expectsJson();
        });
    })->create();
