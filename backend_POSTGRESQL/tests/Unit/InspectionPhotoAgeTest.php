<?php

namespace Tests\Unit;

use App\Services\PhotoMetadataService;
use Tests\Support\ExifImageFactory;
use Tests\TestCase;

/**
 * Batas umur foto bukti inspeksi.
 *
 * ── Mengapa 2 hari, bukan 7 ───────────────────────────────────────────────
 * Inspeksi menghasilkan bukti pengukuran yang dipakai supervisor untuk
 * menyetujui perbaikan. Foto lama berbulan-bulan tidak membuktikan kondisi
 * jalan saat ini. Karena itu foto inspeksi mengikuti aturan petugas
 * (maksimal 2 hari), lebih ketat daripada laporan warga (7 hari) — laporan
 * warga memang sering dibuat beberapa hari setelah kejadian, sedangkan
 * petugas mengukur saat itu juga.
 *
 * Test ini mengunci batas tersebut. Sebelumnya tidak ada test yang menjaganya,
 * sehingga nilainya bisa berubah tanpa ada yang sadar.
 */
class InspectionPhotoAgeTest extends TestCase
{
    private string $tmp;

    protected function setUp(): void
    {
        parent::setUp();
        $this->tmp = tempnam(sys_get_temp_dir(), 'inspeksi').'.jpg';
    }

    protected function tearDown(): void
    {
        if (is_file($this->tmp)) {
            unlink($this->tmp);
        }
        parent::tearDown();
    }

    private function validate(string $dateTime): array
    {
        file_put_contents($this->tmp, ExifImageFactory::make($dateTime));

        return (new PhotoMetadataService)->validateCaptureDate($this->tmp);
    }

    public function test_batas_umur_foto_inspeksi_adalah_dua_hari(): void
    {
        $this->assertSame(
            2,
            PhotoMetadataService::MAX_PHOTO_AGE_DAYS,
            'Foto inspeksi harus maksimal 2 hari. Menaikkannya ke 7 berarti foto '
            .'berumur 3-7 hari ikut diterima sebagai bukti kondisi jalan saat ini.',
        );
    }

    public function test_foto_hari_ini_diterima(): void
    {
        $hasil = $this->validate(now()->format('Y:m:d H:i:s'));

        $this->assertSame('valid', $hasil['status'], $hasil['message']);
    }

    public function test_foto_kemarin_diterima(): void
    {
        $hasil = $this->validate(now()->subDay()->format('Y:m:d H:i:s'));

        $this->assertSame('valid', $hasil['status'], $hasil['message']);
    }

    public function test_foto_dua_hari_lalu_masih_diterima(): void
    {
        // Tepat di batas: masih boleh.
        $hasil = $this->validate(now()->subDays(2)->format('Y:m:d H:i:s'));

        $this->assertSame('valid', $hasil['status'], $hasil['message']);
    }

    public function test_foto_tiga_hari_lalu_ditolak(): void
    {
        // Inilah yang berubah bila batas dinaikkan ke 7 hari.
        $hasil = $this->validate(now()->subDays(3)->format('Y:m:d H:i:s'));

        $this->assertSame('too_old', $hasil['status']);
        $this->assertStringContainsString('2 hari', $hasil['message']);
    }

    public function test_foto_tujuh_hari_lalu_ditolak(): void
    {
        $hasil = $this->validate(now()->subDays(7)->format('Y:m:d H:i:s'));

        $this->assertSame('too_old', $hasil['status']);
    }

    public function test_foto_berbulan_bulan_ditolak(): void
    {
        $hasil = $this->validate(now()->subMonths(6)->format('Y:m:d H:i:s'));

        $this->assertSame('too_old', $hasil['status']);
    }

    public function test_foto_bertanggal_masa_depan_ditolak(): void
    {
        $hasil = $this->validate(now()->addDay()->format('Y:m:d H:i:s'));

        $this->assertSame('future_date', $hasil['status']);
    }

    public function test_kegagalan_tidak_pernah_lolos_secara_diam_diam(): void
    {
        // Setiap status selain 'valid' harus membawa pesan yang bisa dibaca
        // operator, dan pemanggil (validateFiles / discovered) membatalkan
        // unggahan untuk status apa pun selain 'valid'.
        foreach ([now()->subDays(30), now()->addDays(2)] as $waktu) {
            $hasil = $this->validate($waktu->format('Y:m:d H:i:s'));

            $this->assertNotSame('valid', $hasil['status']);
            $this->assertNotEmpty($hasil['message']);
        }
    }
}
