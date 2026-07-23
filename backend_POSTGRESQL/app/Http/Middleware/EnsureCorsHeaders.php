<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Fallback CORS middleware — guarantees CORS headers are present on EVERY
 * API response, including preflight OPTIONS.
 *
 * WHY:  When Laravel runs behind ngrok (free tier), the built-in HandleCors
 *       middleware sometimes fails to inject headers because:
 *       1. ngrok may intercept/rewrite the preflight before it reaches PHP
 *       2. Config-cache / path-matching issues can silently skip HandleCors
 *
 *       This middleware is a safety-net that runs first in the global stack.
 *       It only acts on requests whose path starts with "api/".
 */
class EnsureCorsHeaders
{
    /** Origins that are always allowed. */
    private const STATIC_ORIGINS = [
        'http://localhost',
        'http://localhost:5173',
        'http://localhost:8080',
        'capacitor://localhost',
        'https://delta-jalan.vercel.app',
    ];

    /** Regex patterns for dynamic origins. */
    private const ORIGIN_PATTERNS = [
        '#^https?://[a-z0-9-]+\.vercel\.app$#',
        '#^https?://[a-z0-9-]+\.ngrok-free\.(app|dev)$#',
        '#^capacitor://localhost$#',
    ];

    public function handle(Request $request, Closure $next): Response
    {
        // Only act on API paths
        if (! $request->is('api/*')) {
            return $next($request);
        }

        $origin = $request->headers->get('Origin');

        // No Origin header → not a CORS request, skip
        if (! $origin) {
            return $next($request);
        }

        if (! $this->isAllowedOrigin($origin)) {
            return $next($request);
        }

        // ── Preflight (OPTIONS) — respond immediately ──────────────────
        if ($request->isMethod('OPTIONS')) {
            return response('', 204, [
                'Access-Control-Allow-Origin' => $origin,
                'Access-Control-Allow-Methods' => 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
                'Access-Control-Allow-Headers' => 'Content-Type, Authorization, X-Requested-With, X-Device-ID, Accept, Origin, ngrok-skip-browser-warning',
                'Access-Control-Allow-Credentials' => 'true',
                'Access-Control-Max-Age' => '86400',
            ]);
        }

        // ── Normal request — process then add headers ──────────────────
        /** @var Response $response */
        $response = $next($request);

        // Only add if not already present (HandleCors may have already set them)
        if (! $response->headers->has('Access-Control-Allow-Origin')) {
            $response->headers->set('Access-Control-Allow-Origin', $origin);
            $response->headers->set('Access-Control-Allow-Credentials', 'true');
        }

        return $response;
    }

    private function isAllowedOrigin(string $origin): bool
    {
        // Check static list
        if (in_array($origin, self::STATIC_ORIGINS, true)) {
            return true;
        }

        // Check env-based origins
        $envOrigins = array_filter([env('FRONTEND_URL'), env('NGROK_URL')]);
        if (in_array($origin, $envOrigins, true)) {
            return true;
        }

        // Check patterns
        foreach (self::ORIGIN_PATTERNS as $pattern) {
            if (preg_match($pattern, $origin)) {
                return true;
            }
        }

        return false;
    }
}
