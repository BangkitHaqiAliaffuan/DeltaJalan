<?php

use App\Http\Middleware\CheckRole;
use App\Http\Middleware\ForceJsonResponse;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use App\Http\Middleware\EnsureCorsHeaders;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

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
        // EnsureCorsHeaders MUST be global — not just api group — so preflight
        // OPTIONS requests always get CORS headers even when no route matches.
        $middleware->prepend(EnsureCorsHeaders::class);

        $middleware->api(prepend: [
            ForceJsonResponse::class,
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

        $middleware->alias([
            'role' => CheckRole::class,
        ]);
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
        $exceptions->shouldRenderJsonWhen(function (Request $request, Throwable $e) {
            return $request->is('api/*') || $request->expectsJson();
        });

        /*
        |----------------------------------------------------------------------
        | CORS Headers di Exception Responses
        |----------------------------------------------------------------------
        |
        | HandleCors middleware tidak menjangkau error responses dari exception
        | handler. Tambahkan CORS header manual agar browser tidak memblokir.
        |
        */
        $exceptions->respond(function (Response $response, Throwable $e, Request $request) {
            if ($request->is('api/*') && !$response->headers->has('Access-Control-Allow-Origin')) {
                $response->headers->set('Access-Control-Allow-Origin', $request->headers->get('Origin', '*'));
            }
            return $response;
        });
    })->create();
