<?php

namespace Tests\Unit;

use App\Services\InspectionPhotoGuard;
use PHPUnit\Framework\TestCase;

/**
 * Kontrak penjaga lokasi foto inspeksi.
 *
 * Kasus yang dijaga: petugas mengirim satu foto asli di lokasi kerusakan lalu
 * menambahkan foto dari tempat lain. Sebelum ini server hanya memeriksa
 * "masih di dalam Sidoarjo", yang luasnya ~714 km² sehingga tidak membatasi.
 *
 * Ambangnya sengaja longgar: galat GPS foto bisa mencapai ~50 m, jadi
 * penolakan baru terjadi pada kasus kasar (di atas 1 km).
 */
class InspectionPhotoGuardTest extends TestCase
{
    /** Titik acuan di Sidoarjo (sekitar alun-alun). */
    private const LAT = -7.4478;

    private const LNG = 112.6986;

    private InspectionPhotoGuard $guard;

    protected function setUp(): void
    {
        parent::setUp();
        $this->guard = new InspectionPhotoGuard;
    }

    /** Geser lintang sejauh $meter (1 derajat ≈ 111.320 m). */
    private function offset(float $meter): float
    {
        return self::LAT + ($meter / 111320.0);
    }

    private function foto(float $meter): array
    {
        return ['lat' => $this->offset($meter), 'lng' => self::LNG];
    }

    public function test_foto_di_lokasi_yang_sama_lolos_tanpa_peringatan(): void
    {
        $h = $this->guard->review(self::LAT, self::LNG, [$this->foto(0), $this->foto(30), $this->foto(80)]);

        $this->assertNull($h['reject']);
        $this->assertSame([], $h['warnings']);
    }

    public function test_foto_350_m_menjadi_peringatan_bukan_penolakan(): void
    {
        $h = $this->guard->review(self::LAT, self::LNG, [$this->foto(350)]);

        $this->assertNull($h['reject']);
        $this->assertCount(1, $h['warnings']);
        $this->assertStringContainsString('[PERINGATAN]', $h['warnings'][0]);
        $this->assertStringContainsString('350 m', $h['warnings'][0]);
    }

    public function test_foto_lebih_dari_1_km_ditolak(): void
    {
        $h = $this->guard->review(self::LAT, self::LNG, [$this->foto(1200)]);

        $this->assertNotNull($h['reject']);
        $this->assertStringContainsString('dari lokasi kerusakan', $h['reject']);
        $this->assertStringContainsString('batas 1000 m', $h['reject']);
    }

    public function test_foto_tanpa_gps_dicatat_tidak_ditolak(): void
    {
        $h = $this->guard->review(self::LAT, self::LNG, [
            $this->foto(0),
            ['lat' => null, 'lng' => null],
        ]);

        $this->assertNull($h['reject']);
        $this->assertStringContainsString('tidak memuat GPS EXIF', implode(' ', $h['warnings']));
    }

    /**
     * Tanpa titik laporan, jarak ke lokasi tidak bisa diuji — tapi sebaran
     * antar foto MASIH bisa. Pekerjaan sah tidak boleh ditolak.
     */
    public function test_laporan_tanpa_koordinat_tidak_menolak_pekerjaan_sah(): void
    {
        $h = $this->guard->review(null, null, [$this->foto(0), $this->foto(120)]);

        $this->assertNull($h['reject']);
        $this->assertStringContainsString('Titik laporan tidak tersedia', $h['warnings'][0]);
    }

    /**
     * Inti celah yang ditutup: foto ke-2 masih dekat titik laporan, tapi jauh
     * dari foto pertama — artinya bukan dari kunjungan yang sama.
     */
    public function test_foto_yang_tersebar_jauh_dari_foto_pertama_ditolak(): void
    {
        $h = $this->guard->review(self::LAT, self::LNG, [$this->foto(0), $this->foto(450)]);

        $this->assertNotNull($h['reject']);
        $this->assertStringContainsString('dari foto pertama', $h['reject']);
        $this->assertStringContainsString('200 m', $h['reject']);
    }

    public function test_sebaran_dalam_batas_200_m_lolos(): void
    {
        $h = $this->guard->review(self::LAT, self::LNG, [$this->foto(0), $this->foto(150)]);

        $this->assertNull($h['reject']);
    }

    public function test_penolakan_jarak_laporan_lebih_diutamakan(): void
    {
        // Foto pertama 1200 m dari laporan: harus ditolak dari sumbu 1,
        // bukan dilaporkan sebagai masalah sebaran.
        $h = $this->guard->review(self::LAT, self::LNG, [$this->foto(1200), $this->foto(1250)]);

        $this->assertNotNull($h['reject']);
        $this->assertStringContainsString('dari lokasi kerusakan', $h['reject']);
    }
}
