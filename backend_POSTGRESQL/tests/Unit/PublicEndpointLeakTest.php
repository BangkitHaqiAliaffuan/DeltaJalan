<?php

namespace Tests\Unit;

use Illuminate\Routing\Route as LaravelRoute;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

/**
 * Kebocoran data pada endpoint publik.
 *
 * ── Regresi yang dijaga ───────────────────────────────────────────────────
 * `POST /reports/track` dan `GET /v1/public/reports/{reportCode}` tidak
 * memerlukan autentikasi dan menerima `report_code` yang BERURUTAN
 * (`LP-2026-00001`, `00002`, …). Artinya siapa pun bisa menyapu seluruh
 * daftar laporan.
 *
 * Keduanya sebelumnya ikut mengirim `mobileclip_score`, `mobileclip_label`,
 * dan `quality_scores` — padahal tidak satu pun halaman publik memakainya.
 * Nilai itu membocorkan cara kerja penyaringan AI, sehingga penyerang bisa
 * menyetel foto agar lolos sementara tetap terlihat wajar.
 */
class PublicEndpointLeakTest extends TestCase
{
    private function controllerSource(): string
    {
        return file_get_contents(
            app_path('Http/Controllers/WargaReportController.php'),
        );
    }

    /**
     * Ambil potongan kode satu method (dari `public function X` sampai method
     * berikutnya) agar pemeriksaan tidak tertipu oleh method lain.
     */
    private function methodBody(string $name): string
    {
        $src = $this->controllerSource();
        $start = strpos($src, "public function {$name}(");
        $this->assertNotFalse($start, "Method {$name} tidak ditemukan.");

        $next = strpos($src, 'public function ', $start + 10);
        $body = $next === false ? substr($src, $start) : substr($src, $start, $next - $start);

        return $body;
    }

    public function test_track_tidak_mengirim_skor_ai_internal(): void
    {
        $body = $this->methodBody('track');

        // Nilai yang dikirim harus berbentuk `'kunci' => $p->mobileclip_score`.
        // Komentar penjelas boleh menyebut nama kolom, jadi yang dicari adalah
        // pola array literal, bukan sekadar kata.
        foreach (['mobileclip_score', 'mobileclip_label', 'quality_scores'] as $field) {
            $this->assertStringNotContainsString(
                "'{$field}' =>",
                $body,
                "track() masih mengirim `{$field}` ke klien publik.",
            );
        }
    }

    public function test_public_show_tidak_mengirim_skor_ai_internal(): void
    {
        $body = $this->methodBody('publicShow');

        foreach (['mobileclip_score', 'mobileclip_label', 'quality_scores'] as $field) {
            $this->assertStringNotContainsString(
                "'{$field}' =>",
                $body,
                "publicShow() masih mengirim `{$field}` ke klien publik.",
            );
        }
    }

    public function test_field_yang_dipakai_halaman_publik_tetap_ada(): void
    {
        // lacak.tsx memakai: report_code, road_name, district, status,
        //                   description, photos, after_photos
        // laporan.$reportCode.tsx memakai: report + timeline
        $body = $this->methodBody('track');

        foreach (['report_code', 'road_name', 'district', 'status', 'description', 'photos', 'timeline'] as $field) {
            $this->assertStringContainsString(
                "'{$field}' =>",
                $body,
                "track() menghilangkan `{$field}` yang masih dipakai halaman Lacak Laporan.",
            );
        }
    }

    public function test_endpoint_publik_tetap_dibatasi_throttle(): void
    {
        $map = [];
        foreach (Route::getRoutes() as $route) {
            $map[$route->uri()] = $route;
        }

        foreach (['api/reports/track', 'api/v1/public/reports/{reportCode}'] as $uri) {
            $this->assertArrayHasKey($uri, $map, "Route {$uri} tidak ditemukan.");

            /** @var LaravelRoute $route */
            $route = $map[$uri];
            $throttles = array_values(array_filter(
                $route->gatherMiddleware(),
                fn ($m) => str_starts_with($m, 'throttle:'),
            ));

            $this->assertNotEmpty($throttles, "Route publik {$uri} kehilangan throttle.");

            // Batas harus ketat: kode berurutan, jadi batas longgar = penyapuan.
            $limit = (int) explode(',', explode(':', $throttles[0])[1])[0];
            $this->assertLessThanOrEqual(
                10,
                $limit,
                "Throttle {$uri} terlalu longgar ({$limit}/menit). Kode laporan berurutan "
                .'sehingga penyerang bisa menyapu seluruh daftar.',
            );
        }
    }

    public function test_kode_laporan_memang_berurutan_sehingga_perlu_dibatasi(): void
    {
        // Test ini mendokumentasikan MENGAPA throttle ketat diperlukan.
        // Bila suatu saat kode laporan dibuat acak, test ini boleh dihapus.
        $src = $this->controllerSource();

        $this->assertStringContainsString(
            "sprintf('LP-%s-%05d'",
            $src,
            'Kode laporan tampaknya tidak lagi berurutan; tinjau ulang kebutuhan throttle.',
        );
    }
}
