<?php

namespace Tests\Unit;

use App\Models\Report;
use App\Services\TriageService;
use PHPUnit\Framework\TestCase;

/**
 * Penjaga keputusan "perlu inspeksi?" — gerbang utama tiga jalur laporan.
 *
 * Sengaja memakai PHPUnit polos (bukan Tests\TestCase) karena TriageService
 * murni: tidak menyentuh DB, tidak memakai config, tidak memakai container.
 * Test jadi berjalan dalam milidetik dan tidak bergantung pada migrasi.
 *
 * Objek Report dibuat lewat forceFill() — mengisi atribut pada model tanpa
 * menyentuh koneksi database sama sekali.
 */
class TriageServiceTest extends TestCase
{
    private TriageService $triage;

    protected function setUp(): void
    {
        parent::setUp();
        $this->triage = new TriageService;
    }

    /** Report dengan atribut tertentu, tanpa menyentuh DB. */
    private function report(array $attributes): Report
    {
        return (new Report)->forceFill($attributes);
    }

    // ── Aturan 1: laporan petugas ──────────────────────────────────────────

    public function test_laporan_petugas_tidak_pernah_diinspeksi(): void
    {
        $report = $this->report([
            'source' => 'petugas',
            'overall_severity' => 'Rusak Berat',
            'pci_score' => 10,
        ]);

        $this->assertFalse($this->triage->needsInspection($report));
        $this->assertSame('langsung', $this->triage->track($report));
    }

    public function test_laporan_petugas_dikenali_meski_ada_spasi_dan_huruf_besar(): void
    {
        $report = $this->report([
            'source' => '  PETUGAS ',
            'overall_severity' => 'Rusak Berat',
        ]);

        $this->assertFalse($this->triage->needsInspection($report));
    }

    public function test_laporan_warga_tetap_diperlakukan_sebagai_warga(): void
    {
        $report = $this->report([
            'source' => 'warga',
            'overall_severity' => 'Rusak Berat',
        ]);

        $this->assertTrue($this->triage->needsInspection($report));
    }

    // ── Aturan 2: severity berat selalu menang ─────────────────────────────

    public function test_severity_berat_diinspeksi_walau_pci_tinggi(): void
    {
        $report = $this->report([
            'source' => 'warga',
            'overall_severity' => 'Rusak Berat',
            'pci_score' => 95,
        ]);

        $this->assertTrue($this->triage->needsInspection($report));
    }

    // ── Aturan 3 & 4: ambang PCI ───────────────────────────────────────────

    public function test_pci_null_diarahkan_ke_inspeksi(): void
    {
        $report = $this->report([
            'source' => 'warga',
            'overall_severity' => 'Rusak Sedang',
            'pci_score' => null,
        ]);

        $this->assertTrue($this->triage->needsInspection($report));
    }

    public function test_pci_di_bawah_ambang_diinspeksi(): void
    {
        $report = $this->report([
            'source' => 'warga',
            'overall_severity' => 'Rusak Sedang',
            'pci_score' => 45,
        ]);

        $this->assertTrue($this->triage->needsInspection($report));
    }

    public function test_pci_di_atas_ambang_langsung_review(): void
    {
        $report = $this->report([
            'source' => 'warga',
            'overall_severity' => 'Rusak Ringan',
            'pci_score' => 85,
        ]);

        $this->assertFalse($this->triage->needsInspection($report));
        $this->assertSame('langsung', $this->triage->track($report));
    }

    /**
     * Batas tepat 56 memakai perbandingan `<`, bukan `<=`.
     * Dikunci sebagai test agar tidak ada yang "merapikan" jadi <= nanti.
     */
    public function test_pci_tepat_pada_ambang_tidak_diinspeksi(): void
    {
        $report = $this->report([
            'source' => 'warga',
            'overall_severity' => 'Rusak Sedang',
            'pci_score' => 56.0,
        ]);

        $this->assertFalse($this->triage->needsInspection($report));
    }

    public function test_pci_sedikit_di_bawah_ambang_diinspeksi(): void
    {
        $report = $this->report([
            'source' => 'warga',
            'overall_severity' => 'Rusak Sedang',
            'pci_score' => 55.99,
        ]);

        $this->assertTrue($this->triage->needsInspection($report));
    }

    /**
     * REGRESI PENTING: `pci_score` ber-cast `decimal:2` di model Report,
     * sehingga Eloquent mengembalikan STRING "55.50" — bukan float.
     * Bila perbandingan tidak dikonversi, hasilnya bisa salah tanpa error.
     */
    public function test_pci_berupa_string_tetap_dibandingkan_dengan_benar(): void
    {
        $rendah = $this->report([
            'source' => 'warga',
            'overall_severity' => 'Rusak Sedang',
            'pci_score' => '55.50',
        ]);
        $tinggi = $this->report([
            'source' => 'warga',
            'overall_severity' => 'Rusak Sedang',
            'pci_score' => '80.00',
        ]);

        $this->assertTrue($this->triage->needsInspection($rendah));
        $this->assertFalse($this->triage->needsInspection($tinggi));
    }

    public function test_severity_null_dengan_pci_tinggi_langsung_review(): void
    {
        // Data lama sering tanpa overall_severity; PCI tetap penentu.
        $report = $this->report([
            'source' => 'warga',
            'overall_severity' => null,
            'pci_score' => 90,
        ]);

        $this->assertFalse($this->triage->needsInspection($report));
    }

    public function test_severity_null_dan_pci_null_diinspeksi(): void
    {
        $report = $this->report([
            'source' => 'warga',
            'overall_severity' => null,
            'pci_score' => null,
        ]);

        $this->assertTrue($this->triage->needsInspection($report));
    }

    // ── Alasan (dipakai UI & log) ──────────────────────────────────────────

    public function test_alasan_selalu_terisi_untuk_semua_kondisi(): void
    {
        $kasus = [
            ['source' => 'petugas', 'overall_severity' => 'Rusak Berat', 'pci_score' => 10],
            ['source' => 'warga', 'overall_severity' => 'Rusak Berat', 'pci_score' => 95],
            ['source' => 'warga', 'overall_severity' => 'Rusak Sedang', 'pci_score' => null],
            ['source' => 'warga', 'overall_severity' => 'Rusak Sedang', 'pci_score' => 40],
            ['source' => 'warga', 'overall_severity' => 'Rusak Ringan', 'pci_score' => 88],
        ];

        foreach ($kasus as $attrs) {
            $alasan = $this->triage->reason($this->report($attrs));
            $this->assertNotSame('', trim($alasan), 'Alasan tidak boleh kosong: '.json_encode($attrs));
        }
    }

    public function test_track_hanya_bernilai_dua_macam(): void
    {
        $report = $this->report([
            'source' => 'warga',
            'overall_severity' => 'Rusak Berat',
        ]);

        $this->assertContains($this->triage->track($report), ['inspeksi', 'langsung']);
    }
}
