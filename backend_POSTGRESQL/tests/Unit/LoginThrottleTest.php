<?php

namespace Tests\Unit;

use App\Services\LoginThrottleService;
use Illuminate\Support\Facades\RateLimiter;
use Tests\TestCase;

/**
 * Pembatas percobaan login per akun.
 *
 * ── Regresi yang dijaga ───────────────────────────────────────────────────
 * Tanpa pembatas ini, `throttle:10,1` di route hanya membatasi per IP.
 * Penyerang dengan banyak IP bisa menebak password satu akun tanpa batas,
 * dan password minimum aplikasi hanya 6 karakter.
 */
class LoginThrottleTest extends TestCase
{
    private LoginThrottleService $throttle;

    protected function setUp(): void
    {
        parent::setUp();
        $this->throttle = new LoginThrottleService;
        RateLimiter::clear($this->throttle->key('budi@deltajalan.id'));
    }

    public function test_akun_belum_terkunci_sebelum_batas(): void
    {
        for ($i = 0; $i < LoginThrottleService::MAX_ATTEMPTS; $i++) {
            $this->assertFalse(
                $this->throttle->isLocked('budi@deltajalan.id'),
                'Akun terkunci terlalu cepat pada percobaan ke-'.($i + 1),
            );
            $this->throttle->recordFailure('budi@deltajalan.id');
        }
    }

    public function test_akun_terkunci_setelah_melewati_batas(): void
    {
        for ($i = 0; $i < LoginThrottleService::MAX_ATTEMPTS; $i++) {
            $this->throttle->recordFailure('budi@deltajalan.id');
        }

        $this->assertTrue($this->throttle->isLocked('budi@deltajalan.id'));
    }

    public function test_login_berhasil_mengosongkan_hitungan(): void
    {
        for ($i = 0; $i < LoginThrottleService::MAX_ATTEMPTS - 1; $i++) {
            $this->throttle->recordFailure('budi@deltajalan.id');
        }
        $this->assertFalse($this->throttle->isLocked('budi@deltajalan.id'));

        // Login berhasil → jatah pulih sepenuhnya.
        $this->throttle->clear('budi@deltajalan.id');

        for ($i = 0; $i < LoginThrottleService::MAX_ATTEMPTS - 1; $i++) {
            $this->throttle->recordFailure('budi@deltajalan.id');
        }
        $this->assertFalse(
            $this->throttle->isLocked('budi@deltajalan.id'),
            'Setelah login berhasil, hitungan kegagalan harus kembali dari nol.',
        );
    }

    public function test_kapitalisasi_email_tidak_mengakali_batas(): void
    {
        // Penyerang tidak boleh lolos hanya dengan mengganti huruf besar/kecil.
        for ($i = 0; $i < LoginThrottleService::MAX_ATTEMPTS; $i++) {
            $this->throttle->recordFailure('Budi@DeltaJalan.id');
        }

        $this->assertTrue($this->throttle->isLocked('budi@deltajalan.id'));
        $this->assertTrue($this->throttle->isLocked('BUDI@DELTAJALAN.ID'));
        $this->assertTrue($this->throttle->isLocked('  budi@deltajalan.id  '));
    }

    public function test_akun_lain_tidak_ikut_terkunci(): void
    {
        // Penguncian harus per akun, bukan global — kalau global, satu
        // penyerang bisa mengunci seluruh pengguna.
        for ($i = 0; $i < LoginThrottleService::MAX_ATTEMPTS; $i++) {
            $this->throttle->recordFailure('budi@deltajalan.id');
        }

        $this->assertTrue($this->throttle->isLocked('budi@deltajalan.id'));
        $this->assertFalse($this->throttle->isLocked('siti@deltajalan.id'));
    }

    public function test_email_tidak_tersimpan_mentah_di_kunci_cache(): void
    {
        // Privasi: email tidak boleh muncul apa adanya di nama kunci cache.
        $key = $this->throttle->key('rahasia@deltajalan.id');

        $this->assertStringNotContainsString('rahasia', $key);
        $this->assertStringNotContainsString('@', $key);
        $this->assertStringStartsWith('login-fail:', $key);
    }

    public function test_pesan_tidak_membocorkan_status_pendaftaran_email(): void
    {
        $this->throttle->recordFailure('tidak-terdaftar@example.com');

        $pesan = $this->throttle->message('tidak-terdaftar@example.com');

        $this->assertStringNotContainsString('tidak terdaftar', strtolower($pesan));
        $this->assertStringNotContainsString('belum terdaftar', strtolower($pesan));
        $this->assertStringContainsString('Coba lagi', $pesan);
    }

    public function test_sisa_waktu_kunci_masuk_akal(): void
    {
        for ($i = 0; $i < LoginThrottleService::MAX_ATTEMPTS; $i++) {
            $this->throttle->recordFailure('budi@deltajalan.id');
        }

        $sisa = $this->throttle->availableIn('budi@deltajalan.id');

        $this->assertGreaterThan(0, $sisa);
        $this->assertLessThanOrEqual(LoginThrottleService::DECAY_MINUTES * 60, $sisa);
    }
}
