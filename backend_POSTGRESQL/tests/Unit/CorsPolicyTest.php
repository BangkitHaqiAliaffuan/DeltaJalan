<?php

namespace Tests\Unit;

use App\Http\Middleware\EnsureCorsHeaders;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

/**
 * Penjaga kebijakan CORS.
 *
 * ── Regresi yang dijaga ───────────────────────────────────────────────────
 * Sebelumnya kedua lapisan CORS memakai wildcard `*.vercel.app`. Karena
 * origin-nya memang benar `*.vercel.app`, siapa pun yang bisa membuat
 * deployment di Vercel — gratis dan tanpa verifikasi domain — otomatis
 * diizinkan memanggil API ini dari browser. Digabung dengan
 * `supports_credentials: true` dan header `Authorization` yang diizinkan,
 * respons ber-token bisa dibaca dari origin penyerang.
 *
 * Domain resmi sekarang dicantumkan eksplisit; wildcard dihapus.
 */
class CorsPolicyTest extends TestCase
{
    private function allowed(string $origin): bool
    {
        $middleware = new EnsureCorsHeaders;
        $request = Request::create('/api/reports', 'GET', [], [], [], ['HTTP_ORIGIN' => $origin]);
        $response = $middleware->handle($request, fn () => response()->json(['ok' => true]));

        return $response->headers->has('Access-Control-Allow-Origin');
    }

    public function test_domain_resmi_diizinkan(): void
    {
        $this->assertTrue($this->allowed('https://delta-jalan.vercel.app'));
    }

    public function test_deploy_vercel_orang_lain_ditolak(): void
    {
        // Inti perbaikan: wildcard dihapus.
        $this->assertFalse($this->allowed('https://evil-attacker.vercel.app'));
        $this->assertFalse($this->allowed('https://delta-jalan-git-main.vercel.app'));
        $this->assertFalse($this->allowed('https://apapun-bisa-dibuat.vercel.app'));
    }

    public function test_capacitor_tetap_diizinkan(): void
    {
        // Aplikasi Android lama memakai `capacitor://localhost`.
        $this->assertTrue($this->allowed('capacitor://localhost'));
        // Build native sekarang `androidScheme: http` → origin http.
        $this->assertTrue($this->allowed('http://localhost'));
        $this->assertTrue($this->allowed('http://localhost:5173'));
    }

    public function test_ngrok_dev_tetap_diizinkan(): void
    {
        $this->assertTrue($this->allowed('https://abc123.ngrok-free.app'));
    }

    public function test_origin_asing_ditolak(): void
    {
        $this->assertFalse($this->allowed('https://situs-jahat.com'));
        $this->assertFalse($this->allowed('https://evil.example.org'));
    }

    public function test_config_cors_tidak_memuat_wildcard_vercel(): void
    {
        // Dua lapisan CORS harus sepakat; config/cors.php juga tidak boleh
        // memuat pola vercel apa pun.
        foreach (config('cors.allowed_origins_patterns') as $pattern) {
            $this->assertStringNotContainsString(
                'vercel',
                $pattern,
                "Pola CORS `{$pattern}` memuat 'vercel'. Wildcard *.vercel.app harus dihapus.",
            );
        }
    }

    public function test_route_publik_kritis_tetap_butuh_throttle(): void
    {
        // Enumerasi laporan publik dibatasi throttle; jangan sampai hilang.
        $this->app->make(Kernel::class)->bootstrap();

        $map = [];
        foreach (Route::getRoutes() as $route) {
            $map[$route->uri()] = $route;
        }

        foreach (['api/reports/track', 'api/v1/public/reports/{reportCode}'] as $uri) {
            $this->assertArrayHasKey($uri, $map, "Route {$uri} tidak ditemukan.");
            $this->assertTrue(
                (bool) array_filter($map[$uri]->gatherMiddleware(), fn ($m) => str_contains($m, 'throttle')),
                "Route publik {$uri} kehilangan throttle.",
            );
        }
    }
}
