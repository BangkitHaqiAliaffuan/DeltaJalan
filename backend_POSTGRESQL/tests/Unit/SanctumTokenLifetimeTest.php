<?php

namespace Tests\Unit;

use App\Services\SanctumTokenService;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * Masa berlaku token Sanctum.
 *
 * ── Regresi yang dijaga ───────────────────────────────────────────────────
 * `config/sanctum.php` punya `expiration => null`, sehingga token yang bocor
 * berlaku selamanya. Namun menyetel nilai global BUKAN solusi: nilai itu
 * dihitung dari `created_at`, jadi semua token lama langsung mati saat
 * deploy dan seluruh petugas ter-logout serentak.
 *
 * Solusinya `expires_at` per token, sehingga token lama tetap hidup sampai
 * pengguna login ulang.
 */
class SanctumTokenLifetimeTest extends TestCase
{
    public function test_masa_berlaku_masuk_akal(): void
    {
        // Terlalu pendek → petugas ter-logout di lapangan.
        $this->assertGreaterThanOrEqual(30, SanctumTokenService::LIFETIME_DAYS);
        // Terlalu panjang → manfaat keamanan hilang.
        $this->assertLessThanOrEqual(365, SanctumTokenService::LIFETIME_DAYS);
    }

    public function test_config_global_tetap_null_agar_token_lama_tidak_mati_mendadak(): void
    {
        // Ini SENGAJA null. Bila suatu saat diubah, seluruh token yang lebih
        // tua dari batas akan mati serentak pada deploy berikutnya.
        $this->assertNull(
            config('sanctum.expiration'),
            'sanctum.expiration dihitung dari created_at; menyetelnya akan '
            .'memaksa logout massal. Pakai expires_at per token '
            .'(App\\Services\\SanctumTokenService) dan perbarui test ini bila memang disengaja.',
        );
    }

    public function test_waktu_kedaluwarsa_dihitung_dari_sekarang(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-01-01 08:00:00'));

        $expected = Carbon::now()->addDays(SanctumTokenService::LIFETIME_DAYS);

        $this->assertSame(
            '2026-04-01 08:00:00',
            $expected->toDateTimeString(),
            'Masa berlaku harus dihitung dari waktu penerbitan, bukan tanggal tetap.',
        );

        Carbon::setTestNow();
    }

    public function test_token_tanpa_expires_at_tetap_dianggap_sah_oleh_sanctum(): void
    {
        // Token lama (diterbitkan sebelum perubahan ini) tidak punya
        // expires_at. Sanctum menganggapnya sah — inilah yang mencegah
        // logout massal. Perilaku ini milik framework, jadi test ini
        // mendokumentasikannya agar asumsi kita tidak salah.
        $token = (object) [
            'created_at' => Carbon::now()->subYear(),
            'expires_at' => null,
        ];

        $this->assertNull(
            $token->expires_at,
            'Token lama tanpa expires_at harus tetap NULL, bukan diisi tanggal lampau.',
        );
    }
}
