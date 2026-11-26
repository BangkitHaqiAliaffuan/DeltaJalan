<?php

namespace Tests\Unit;

use App\Models\Report;
use App\Models\ReportPhoto;
use Illuminate\Database\Eloquent\Collection;
use PHPUnit\Framework\TestCase;

/**
 * Kontrak payload foto pada detail tugas inspeksi.
 *
 * Latar: `NativeInspectionController::show()` dulu hanya memuat relasi
 * `report` tanpa `report.photos`, sehingga petugas hanya menerima foto utama
 * (1 dari maksimal 3 foto warga). Petugas harus menilai kerusakan dari seluruh
 * bukti, jadi payload wajib memuat semuanya dengan foto utama di depan.
 *
 * Model dibangun dengan `forceFill()` + `setRelation()` supaya tidak menyentuh
 * database (suite Unit berjalan tanpa PostgreSQL).
 */
class InspectionDetailPhotosTest extends TestCase
{
    private function reportDenganFoto(int $jumlahFotoTambahan): Report
    {
        $report = (new Report)->forceFill([
            'id' => '01a1dfa0-c603-70f1-87e1-9a404fa6c49a',
            'report_code' => 'WJR-1',
            'reporter_name' => 'Budi',
            'image_original_path' => 'reports/utama.jpg',
            'image_result_path' => 'reports/utama-ai.jpg',
            'latitude' => -7.4478,
            'longitude' => 112.6987,
            'overall_severity' => 'Rusak Berat',
        ]);

        $tambahan = [];
        for ($i = 1; $i <= $jumlahFotoTambahan; $i++) {
            $tambahan[] = (new ReportPhoto)->forceFill([
                'id' => 'foto-'.$i,
                'report_id' => $report->id,
                'image_original_path' => 'reports/tambahan-'.$i.'.jpg',
                'latitude' => -7.4478,
                'longitude' => 112.6987,
                'sort_order' => $i,
            ]);
        }
        $report->setRelation('photos', new Collection($tambahan));

        return $report;
    }

    /** Bentuk payload yang dipakai controller (lihat NativeInspectionController::show). */
    private function payloadFoto(Report $report): array
    {
        $foto = $report->photos->map(fn ($p) => [
            'id' => $p->id,
            'image_original_url' => $p->image_original_url,
            'latitude' => $p->latitude !== null ? (float) $p->latitude : null,
            'longitude' => $p->longitude !== null ? (float) $p->longitude : null,
        ])->all();

        return Report::ensurePrimaryPhotoInPhotos($foto, $report);
    }

    public function test_semua_foto_warga_ikut_terkirim(): void
    {
        $payload = $this->payloadFoto($this->reportDenganFoto(2));

        $url = array_column($payload, 'image_original_url');
        $this->assertCount(3, $payload);
        $this->assertContains('/storage/reports/utama.jpg', $url);
        $this->assertContains('/storage/reports/tambahan-1.jpg', $url);
        $this->assertContains('/storage/reports/tambahan-2.jpg', $url);
    }

    public function test_foto_utama_selalu_di_urutan_pertama(): void
    {
        $payload = $this->payloadFoto($this->reportDenganFoto(2));

        $this->assertSame('/storage/reports/utama.jpg', $payload[0]['image_original_url']);
    }

    public function test_foto_utama_tidak_digandakan(): void
    {
        // Foto utama sudah ada di report_photos (mis. laporan petugas): tidak
        // boleh muncul dua kali hanya karena helper menambahkan versi utama.
        $report = $this->reportDenganFoto(0);
        $report->setRelation('photos', new Collection([
            (new ReportPhoto)->forceFill([
                'id' => 'utama',
                'image_original_path' => 'reports/utama.jpg',
                'latitude' => -7.4478,
                'longitude' => 112.6987,
                'sort_order' => 0,
            ]),
        ]));

        $payload = $this->payloadFoto($report);

        $this->assertCount(1, $payload);
    }

    public function test_tanpa_foto_utama_payload_tetap_memuat_foto_tambahan(): void
    {
        $report = $this->reportDenganFoto(1);
        $report->forceFill(['image_original_path' => null]);

        $payload = $this->payloadFoto($report);

        $this->assertCount(1, $payload);
        $this->assertSame('/storage/reports/tambahan-1.jpg', $payload[0]['image_original_url']);
    }

    public function test_titik_koordinat_foto_ikut_dikirim(): void
    {
        $payload = $this->payloadFoto($this->reportDenganFoto(1));

        $this->assertSame(-7.4478, $payload[0]['latitude']);
        $this->assertSame(112.6987, $payload[0]['longitude']);
    }
}
