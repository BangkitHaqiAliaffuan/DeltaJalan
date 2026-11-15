<?php

namespace Tests\Unit;

use App\Models\Report;
use App\Services\TriageService;
use PHPUnit\Framework\TestCase;

/**
 * Penjaga aturan normalisasi dimensi pada `submit()`.
 *
 * Alasan test ini ada: `dim()` dipakai untuk MENYIMPAN nilai DAN menghitung
 * fingerprint idempotensi. Bila normalisasinya tidak konsisten, petugas yang
 * mengirim ulang hasil ukur akan ditolak 409 atau datanya hilang diam-diam.
 *
 * Catatan: helper `dim()` private di controller, jadi perilakunya dikunci di
 * sini lewat kelas pembungkus tipis yang meniru kontraknya — sekaligus
 * mendokumentasikan aturan yang harus dijaga bila logika dipindah.
 */
class TriageRulesTest extends TestCase
{
    /** Cermin dari NativeInspectionController::dim(). */
    private function dim(mixed $value): ?float
    {
        if ($value === null || $value === '' || ! is_numeric($value)) {
            return null;
        }

        $float = round((float) $value, 2);

        return $float > 0 ? $float : null;
    }

    public function test_kosong_menjadi_null_bukan_nol(): void
    {
        // Dimensi 0 berarti "tidak diukur", bukan "tidak ada kerusakan".
        $this->assertNull($this->dim(null));
        $this->assertNull($this->dim(''));
        $this->assertNull($this->dim(0));
        $this->assertNull($this->dim('0'));
        $this->assertNull($this->dim(0.0));
    }

    public function test_angka_valid_dinormalisasi_dua_desimal(): void
    {
        $this->assertSame(1.5, $this->dim('1.5'));
        $this->assertSame(1.5, $this->dim('1.50'));
        $this->assertSame(1.5, $this->dim(1.5));
        $this->assertSame(1.5, $this->dim('1.499'));
        $this->assertSame(12.0, $this->dim('12'));
    }

    /**
     * REGRESI: bentuk berbeda untuk angka yang sama harus menghasilkan nilai
     * identik, karena nilai ini masuk ke hash fingerprint. Bila berbeda,
     * submit ulang dengan isi sama akan salah ditolak 409.
     */
    public function test_bentuk_berbeda_untuk_angka_sama_menghasilkan_nilai_sama(): void
    {
        $bentuk = ['1.5', '1.50', 1.5, '1.500', 1.5000];
        $hasil = array_map(fn ($v) => $this->dim($v), $bentuk);

        $this->assertCount(1, array_unique($hasil), 'Semua bentuk harus bernilai sama');
    }

    public function test_nilai_negatif_dan_tidak_numerik_menjadi_null(): void
    {
        $this->assertNull($this->dim(-1));
        $this->assertNull($this->dim('bukan-angka'));
        $this->assertNull($this->dim([]));
    }

    // ── Kontrak TriageService yang dipakai hook ─────────────────────────────

    public function test_triage_reason_tidak_pernah_kosong(): void
    {
        $triage = new TriageService;
        $report = (new Report)->forceFill([
            'source' => 'warga',
            'overall_severity' => 'Rusak Sedang',
            'pci_score' => '70.00',
        ]);

        $this->assertNotSame('', trim($triage->reason($report)));
        $this->assertSame('langsung', $triage->track($report));
    }
}
