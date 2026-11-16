<?php

namespace Tests\Unit;

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Routing\Route as LaravelRoute;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

/**
 * Penjaga otorisasi endpoint keputusan supervisor.
 *
 * ── Regresi yang dijaga ───────────────────────────────────────────────────
 * `approve`, `approveAndAssign`, `confirmAiResult`, `tolak`, dan `disposisi`
 * semuanya mengubah status laporan dan menugaskan tim. Sebelumnya kelimanya
 * hanya memakai `auth:sanctum`, sehingga PETUGAS dan WARGA yang punya token
 * sah bisa menyetujui atau menolak laporan — termasuk laporan miliknya
 * sendiri. Itu abuse of power yang tidak terhalang apa pun.
 *
 * Penjagaannya sekarang ada di level ROUTE (`role:supervisor,admin`), bukan
 * di dalam controller: satu tempat, dan tidak bisa terlewat saat method baru
 * ditambahkan. Test ini membaca definisi route langsung, tanpa database.
 */
class RouteAuthorizationTest extends TestCase
{
    /**
     * Endpoint yang wajib dijaga. Bila ada endpoint keputusan supervisor baru,
     * tambahkan ke sini agar ikut diperiksa.
     */
    private const GUARDED = [
        'api/reports/{id}/approve',
        'api/reports/{id}/approve-and-assign',
        'api/reports/{id}/confirm-ai',
        'api/reports/{id}/tolak',
        'api/reports/{id}/disposisi',
    ];

    private ?array $cache = null;

    /** @return array<string, LaravelRoute> */
    private function routes(): array
    {
        if ($this->cache !== null) {
            return $this->cache;
        }

        // Laravel memuat routes/api.php saat boot. Tidak ada query database
        // di sini, jadi test tetap berjalan tanpa pdo_sqlite.
        $this->app->make(Kernel::class)->bootstrap();

        $map = [];
        foreach (Route::getRoutes() as $route) {
            $map[$route->uri()] = $route;
        }

        return $this->cache = $map;
    }

    public function test_semua_endpoint_keputusan_supervisor_terdaftar(): void
    {
        $routes = $this->routes();

        foreach (self::GUARDED as $uri) {
            $this->assertArrayHasKey(
                $uri,
                $routes,
                "Route {$uri} tidak ditemukan. Bila rute dipindahkan/di-rename, perbarui test ini.",
            );
        }
    }

    public function test_semua_endpoint_keputusan_supervisor_memakai_role_guard(): void
    {
        $routes = $this->routes();

        foreach (self::GUARDED as $uri) {
            $middleware = $routes[$uri]->gatherMiddleware();

            $this->assertContains(
                'role:supervisor,admin',
                $middleware,
                "Route {$uri} tidak memakai `role:supervisor,admin`. Tanpa ini petugas dan "
                .'warga bisa menyetujui/menolak laporan. Middleware saat ini: '
                .implode(', ', $middleware),
            );
        }
    }

    public function test_role_guard_tetap_butuh_autentikasi(): void
    {
        // `role:` saja tidak cukup: tanpa auth:sanctum, $request->user() null
        // dan CheckRole menolak semua orang — termasuk supervisor sah.
        $routes = $this->routes();

        foreach (self::GUARDED as $uri) {
            $middleware = $routes[$uri]->gatherMiddleware();

            $this->assertTrue(
                (bool) array_filter($middleware, fn ($m) => str_contains($m, 'auth:')),
                "Route {$uri} kehilangan middleware autentikasi.",
            );
        }
    }
}
