<?php

namespace Tests\Unit;

use Tests\TestCase;

/**
 * Penjaga idempotensi laporan warga.
 *
 * ── Mengapa ini perlu ────────────────────────────────────────────────────
 * Aplikasi Android menyimpan laporan ke antrean ketika sinyal hilang. Masalah:
 * permintaan sebelumnya bisa saja **sudah tersimpan** di server dan hanya
 * responsnya yang hilang. Tanpa kunci idempotensi, percobaan ulang membuat
 * laporan kedua — atau ditolak `422 DUPLICATE_IMAGE` oleh pemindai hash foto,
 * sehingga pengguna diberi tahu "gagal" padahal laporannya ada dan sudah
 * masuk antrean petugas.
 *
 * Test ini membaca kode sumber (pola yang sama dengan `RouteAuthorizationTest`)
 * karena perilakunya bergantung pada urutan pemeriksaan di controller, bukan
 * pada satu fungsi yang bisa dipanggil langsung. Test ini tidak butuh database.
 */
class WargaIdempotencyTest extends TestCase
{
    private function sumber(string $relatif): string
    {
        return file_get_contents(base_path($relatif));
    }

    public function test_kolom_idempotency_key_ditambahkan_sebagai_nullable(): void
    {
        $migrasi = $this->sumber('database/migrations/2026_11_23_000001_add_idempotency_key_to_reports.php');

        $this->assertStringContainsString(
            "string('idempotency_key', 120)->nullable()",
            $migrasi,
            'Kolom harus nullable: laporan Telegram/batch/data lama tidak mengirim kunci ini.'
        );
        $this->assertStringContainsString(
            'CREATE UNIQUE INDEX reports_user_idempotency_unique',
            $migrasi,
            'Tanpa indeks unik, dua percobaan bersamaan tetap membuat dua laporan.'
        );
        $this->assertStringContainsString(
            'WHERE idempotency_key IS NOT NULL',
            $migrasi,
            'Indeks unik harus parsial agar baris tanpa kunci tidak saling bentrok.'
        );
    }

    public function test_kolom_boleh_diisi_massal(): void
    {
        $model = $this->sumber('app/Models/Report.php');

        $this->assertMatchesRegularExpression(
            "/\\\$fillable\\s*=\\s*\\[[^\\]]*'idempotency_key'/s",
            $model,
            'Tanpa idempotency_key di $fillable, kunci tidak pernah tersimpan.'
        );
    }

    public function test_controller_menerima_dan_menyimpan_kunci(): void
    {
        $controller = $this->sumber('app/Http/Controllers/WargaReportController.php');

        $this->assertStringContainsString(
            "'idempotency_key' => ['nullable', 'string', 'max:120'],",
            $controller,
            'Kunci harus divalidasi; tanpa ini Laravel membuangnya diam-diam.'
        );
        $this->assertStringContainsString(
            "'idempotency_key' => \$validated['idempotency_key'] ?? null,",
            $controller,
            'Kunci harus ikut tersimpan saat laporan dibuat.'
        );
    }

    public function test_pemeriksaan_kunci_berjalan_sebelum_batas_harian(): void
    {
        $controller = $this->sumber('app/Http/Controllers/WargaReportController.php');

        $posisiReplay = strpos($controller, '$this->replayIfStored(');
        $posisiKuota = strpos($controller, '$this->checkDailyLimit($userId);');

        $this->assertNotFalse($posisiReplay, 'Controller harus memanggil replayIfStored().');
        $this->assertNotFalse($posisiKuota);
        $this->assertLessThan(
            $posisiKuota,
            $posisiReplay,
            'Kunci harus diperiksa SEBELUM batas harian: laporan yang sudah tersimpan '
            .'ikut dihitung kuota, jadi percobaan ulang akan ditolak "batas harian" '
            .'padahal laporannya sudah ada.'
        );
    }

    public function test_percobaan_ulang_mengembalikan_laporan_yang_sama(): void
    {
        $controller = $this->sumber('app/Http/Controllers/WargaReportController.php');

        $this->assertMatchesRegularExpression(
            '/private function replayIfStored\(\?string \$key, int \$userId\): \?JsonResponse/',
            $controller,
        );
        $this->assertStringContainsString(
            "->where('idempotency_key', \$key)",
            $controller,
            'Pencarian harus memakai kunci, bukan teks laporan.'
        );
        $this->assertStringContainsString(
            "'replayed' => true,",
            $controller,
            'Respons replay harus bisa dibedakan dari pembuatan baru.'
        );
        $this->assertStringContainsString(
            '], 200);',
            $controller,
            'Replay bukan pembuatan baris baru: status 200, bukan 201.'
        );
    }

    public function test_balapan_dua_permintaan_ditangani(): void
    {
        $controller = $this->sumber('app/Http/Controllers/WargaReportController.php');

        $this->assertStringContainsString(
            'catch (QueryException $e)',
            $controller,
            'Dua permintaan dengan kunci sama bisa menabrak indeks unik; yang kalah '
            .'harus mengembalikan laporan yang menang, bukan 500.'
        );
        $this->assertStringContainsString(
            "str_contains(\$e->getMessage(), 'reports_user_idempotency_unique')",
            $controller,
        );
    }
}
