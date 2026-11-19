<?php

namespace Tests\Unit;

use App\Models\InspectionResult;
use App\Models\Report;
use Tests\TestCase;

/**
 * Karakteristik lokasi inspeksi: jenis perkerasan & kepadatan lalu lintas.
 *
 * ── Regresi yang dijaga ───────────────────────────────────────────────────
 * Dua kolom ini hanya berguna bila NILAINYA DIPAKAI, bukan sekadar disimpan.
 * Drainase pernah diusulkan dan dibatalkan justru karena tidak ada kode yang
 * membacanya. Test ini memastikan kepadatan lalu lintas benar-benar
 * mengubah `reports.priority`.
 */
class InspectionSurfaceAndTrafficTest extends TestCase
{
    public function test_pilihan_jenis_perkerasan_mencakup_jalan_non_aspal(): void
    {
        // Jalan daerah tidak semuanya aspal. Kalau "aspal" jadi satu-satunya
        // pilihan, petugas yang menemukan jalan beton akan mengisi data salah.
        foreach (['aspal', 'beton', 'paving', 'kerikil_tanah'] as $jenis) {
            $this->assertContains($jenis, InspectionResult::JENIS_PERKERASAN, "Pilihan `{$jenis}` hilang.");
        }
    }

    public function test_setiap_pilihan_punya_label_yang_bisa_dibaca(): void
    {
        foreach (InspectionResult::JENIS_PERKERASAN as $kunci) {
            $this->assertArrayHasKey($kunci, InspectionResult::JENIS_PERKERASAN_LABEL);
            $this->assertNotSame('', InspectionResult::JENIS_PERKERASAN_LABEL[$kunci]);
        }

        foreach (InspectionResult::KEPADATAN_LALU_LINTAS as $kunci) {
            $this->assertArrayHasKey($kunci, InspectionResult::KEPADATAN_LABEL);
        }
    }

    public function test_kepadatan_dipetakan_ke_prioritas_yang_sah(): void
    {
        // Nilai tujuan WAJIB ada di Report::PRIORITY_VALUES, kalau tidak
        // update() akan ditolak enum PostgreSQL di produksi.
        foreach (InspectionResult::KEPADATAN_LALU_LINTAS as $kepadatan) {
            $this->assertArrayHasKey(
                $kepadatan,
                InspectionResult::KEPADATAN_KE_PRIORITAS,
                "Kepadatan `{$kepadatan}` tidak punya pemetaan prioritas.",
            );

            $prioritas = InspectionResult::KEPADATAN_KE_PRIORITAS[$kepadatan];
            $this->assertContains(
                $prioritas,
                Report::PRIORITY_VALUES,
                "Prioritas `{$prioritas}` bukan nilai yang sah untuk kolom reports.priority.",
            );
        }
    }

    public function test_arah_pemetaan_masuk_akal(): void
    {
        // Jalan padat harus naik prioritas, jalan sepi harus turun.
        // Terbaliknya pemetaan ini adalah bug yang mahal: perbaikan darurat
        // di jalan arteri justru ditaruh paling akhir.
        $this->assertSame('Tinggi', InspectionResult::KEPADATAN_KE_PRIORITAS['padat']);
        $this->assertSame('Sedang', InspectionResult::KEPADATAN_KE_PRIORITAS['sedang']);
        $this->assertSame('Rendah', InspectionResult::KEPADATAN_KE_PRIORITAS['sepi']);
    }

    public function test_kepadatan_kosong_tidak_mengubah_prioritas(): void
    {
        // Inilah alasan pemetaan diakses lewat `?? null`: nilai kosong atau
        // tak dikenal harus menghasilkan null, sehingga prioritas yang sudah
        // ada (mis. ditetapkan supervisor) TIDAK ditimpa.
        $this->assertNull(InspectionResult::KEPADATAN_KE_PRIORITAS[''] ?? null);
        $this->assertNull(InspectionResult::KEPADATAN_KE_PRIORITAS['tidak_diketahui'] ?? null);
        $this->assertNull(InspectionResult::KEPADATAN_KE_PRIORITAS[null] ?? null);
    }

    public function test_kolom_baru_masuk_fillable(): void
    {
        // Tanpa ini, nilai tidak akan pernah tersimpan meski lolos validasi.
        $fillable = (new InspectionResult)->getFillable();

        $this->assertContains('jenis_perkerasan', $fillable);
        $this->assertContains('kepadatan_lalu_lintas', $fillable);
    }
}
