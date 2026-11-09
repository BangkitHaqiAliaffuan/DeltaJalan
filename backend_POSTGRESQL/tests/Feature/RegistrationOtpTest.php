<?php

namespace Tests\Feature;

use App\Mail\OtpVerificationMail;
use App\Models\User;
use App\Services\RegistrationOtpService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * Verifikasi OTP email pada pendaftaran warga (jalur daftar manual).
 *
 * Kunci perilaku yang dijaga di sini: `POST /auth/register` TIDAK lagi membuat
 * baris users — akun baru lahir di `POST /auth/register/verify`.
 */
class RegistrationOtpTest extends TestCase
{
    use RefreshDatabase;

    private const EMAIL = 'warga.otp@example.com';

    private function payload(array $overrides = []): array
    {
        return array_merge([
            'name' => 'Warga OTP',
            'email' => self::EMAIL,
            'phone' => '081234567890',
            'password' => 'rahasia123',
            'password_confirmation' => 'rahasia123',
        ], $overrides);
    }

    /** Daftar + kembalikan registration_token. */
    private function startRegistration(array $overrides = []): string
    {
        return $this->postJson('/api/auth/register', $this->payload($overrides))
            ->assertOk()
            ->json('registration_token');
    }

    /** Ambil kode OTP dari email terakhir yang "terkirim" (mailer array). */
    private function lastCode(): string
    {
        $code = null;

        Mail::assertSent(OtpVerificationMail::class, function (OtpVerificationMail $mail) use (&$code) {
            $code = $mail->code;

            return true;
        });

        $this->assertNotNull($code, 'Email OTP tidak terkirim.');

        return $code;
    }

    private function verify(string $token, string $code): TestResponse
    {
        return $this->postJson('/api/auth/register/verify', [
            'registration_token' => $token,
            'code' => $code,
        ]);
    }

    // ── Langkah 1: kirim OTP ─────────────────────────────────────────────

    public function test_register_mengirim_otp_tanpa_membuat_user(): void
    {
        Mail::fake();

        $response = $this->postJson('/api/auth/register', $this->payload());

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('needs_verification', true)
            ->assertJsonPath('email', self::EMAIL)
            ->assertJsonStructure(['registration_token', 'message']);

        Mail::assertSent(OtpVerificationMail::class, function (OtpVerificationMail $mail) {
            return $mail->hasTo(self::EMAIL) && $mail->recipientName === 'Warga OTP';
        });

        $this->assertDatabaseMissing('users', ['email' => self::EMAIL]);
    }

    public function test_kode_otp_berupa_digit_sesuai_konfigurasi(): void
    {
        Mail::fake();

        $this->startRegistration();

        $this->assertMatchesRegularExpression('/^[0-9]{6}$/', $this->lastCode());
    }

    public function test_password_disimpan_sebagai_hash_di_cache(): void
    {
        Mail::fake();

        $token = $this->startRegistration();

        $state = Cache::get('registration:'.hash('sha256', $token));

        $this->assertIsArray($state);
        // Plaintext tidak boleh ada di mana pun di dalam state cache.
        $this->assertStringNotContainsString('rahasia123', json_encode($state));
        $this->assertTrue(Hash::isHashed($state['payload']['password_hash']));
    }

    public function test_kode_otp_tidak_tersimpan_plaintext_di_cache(): void
    {
        Mail::fake();

        $token = $this->startRegistration();
        $code = $this->lastCode();

        $state = Cache::get('registration:'.hash('sha256', $token));

        $this->assertArrayNotHasKey('code', $state);
        $this->assertNotSame($code, $state['code_hash']);
    }

    // ── Langkah 2: verifikasi ────────────────────────────────────────────

    public function test_verifikasi_kode_benar_membuat_user_dan_langsung_login(): void
    {
        Mail::fake();

        $token = $this->startRegistration();
        $code = $this->lastCode();

        $response = $this->verify($token, $code);

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('user.email', self::EMAIL)
            ->assertJsonPath('user.role', 'warga')
            ->assertJsonPath('user.email_verified', true)
            ->assertJsonStructure(['token', 'user' => ['id', 'name', 'phone']]);

        $user = User::where('email', self::EMAIL)->first();

        $this->assertNotNull($user);
        $this->assertNotNull($user->email_verified_at, 'email_verified_at harus terisi setelah OTP benar.');
        $this->assertTrue(Hash::check('rahasia123', $user->password), 'Password harus cocok dengan yang didaftarkan.');
    }

    public function test_verifikasi_mengunci_state_challenge_secara_atomik(): void
    {
        Mail::fake();

        $token = $this->startRegistration();
        $code = $this->lastCode();
        $state = Cache::get('registration:'.hash('sha256', $token));

        $lock = new class
        {
            public function block(int $seconds, callable $callback): mixed
            {
                return $callback();
            }
        };

        Cache::shouldReceive('lock')
            ->twice()
            ->with('registration-lock:'.hash('sha256', $token), 10)
            ->andReturn($lock);
        Cache::shouldReceive('get')
            ->once()
            ->with('registration:'.hash('sha256', $token))
            ->andReturn($state);
        Cache::shouldReceive('forget')
            ->once()
            ->with('registration:'.hash('sha256', $token));

        $this->verify($token, $code)->assertOk();
    }

    public function test_token_sanctum_hasil_verifikasi_langsung_dapat_dipakai(): void
    {
        Mail::fake();

        $token = $this->startRegistration();
        $sanctum = $this->verify($token, $this->lastCode())->json('token');

        $this->withHeader('Authorization', 'Bearer '.$sanctum)
            ->getJson('/api/auth/me')
            ->assertOk()
            ->assertJsonPath('user.email', self::EMAIL);
    }

    public function test_challenge_dibuang_setelah_verifikasi_berhasil(): void
    {
        Mail::fake();

        $token = $this->startRegistration();
        $code = $this->lastCode();

        $this->verify($token, $code)->assertOk();

        // Kode sama tidak bisa dipakai dua kali.
        $this->verify($token, $code)->assertStatus(422)
            ->assertJsonPath('error_code', 'OTP_EXPIRED');
    }

    public function test_kode_salah_ditolak_dan_user_tidak_dibuat(): void
    {
        Mail::fake();

        $token = $this->startRegistration();

        $this->verify($token, '000000')->assertStatus(422)
            ->assertJsonPath('error_code', 'OTP_INVALID');

        $this->assertDatabaseMissing('users', ['email' => self::EMAIL]);
    }

    public function test_percobaan_berlebih_membuang_challenge(): void
    {
        Mail::fake();

        $token = $this->startRegistration();
        $max = (int) config('registration.otp_max_attempts', 5);

        // Percobaan salah ke-(max-1) masih sekadar OTP_INVALID.
        for ($i = 1; $i < $max; $i++) {
            $this->verify($token, '000000')->assertStatus(422)
                ->assertJsonPath('error_code', 'OTP_INVALID');
        }

        // Percobaan salah ke-max menandai habis sekaligus membuang challenge.
        $this->verify($token, '000000')->assertStatus(429)
            ->assertJsonPath('error_code', 'OTP_ATTEMPTS_EXCEEDED');

        // Challenge sudah hilang — kode yang benar pun tidak lagi berlaku.
        $this->verify($token, $this->lastCode())->assertStatus(422)
            ->assertJsonPath('error_code', 'OTP_EXPIRED');

        $this->assertDatabaseMissing('users', ['email' => self::EMAIL]);
    }

    public function test_token_tidak_dikenal_ditolak(): void
    {
        $this->verify('token-yang-tidak-pernah-dibuat', '123456')->assertStatus(422)
            ->assertJsonPath('error_code', 'OTP_EXPIRED');
    }

    public function test_kode_harus_enam_digit(): void
    {
        Mail::fake();

        $token = $this->startRegistration();

        $this->verify($token, '12345')->assertStatus(422)
            ->assertJsonValidationErrors('code');
    }

    // ── Kirim ulang ──────────────────────────────────────────────────────

    public function test_resend_dalam_cooldown_ditolak(): void
    {
        Mail::fake();

        $token = $this->startRegistration();

        $this->postJson('/api/auth/register/resend', ['registration_token' => $token])
            ->assertStatus(429)
            ->assertJsonPath('error_code', 'OTP_RESEND_COOLDOWN');
    }

    public function test_resend_setelah_cooldown_mengirim_kode_baru(): void
    {
        Mail::fake();

        $token = $this->startRegistration();

        // Majukan waktu melewati cooldown.
        $this->travel((int) config('registration.otp_resend_cooldown_seconds', 60) + 5)->seconds();

        $response = $this->postJson('/api/auth/register/resend', ['registration_token' => $token]);

        $response->assertOk()
            ->assertJsonPath('needs_verification', true)
            ->assertJsonPath('registration_token', $token);

        // Kode baru tetap bisa dipakai untuk menyelesaikan pendaftaran.
        $this->verify($token, $this->lastCode())->assertOk();
        $this->assertDatabaseHas('users', ['email' => self::EMAIL]);
    }

    public function test_resend_melebihi_batas_pengiriman_ditolak(): void
    {
        Mail::fake();

        $token = $this->startRegistration();
        $maxSends = (int) config('registration.otp_max_sends', 3);

        for ($i = 1; $i < $maxSends; $i++) {
            $this->travel(120)->seconds();
            $this->postJson('/api/auth/register/resend', ['registration_token' => $token])->assertOk();
        }

        $this->travel(120)->seconds();

        $this->postJson('/api/auth/register/resend', ['registration_token' => $token])
            ->assertStatus(429)
            ->assertJsonPath('error_code', 'OTP_SEND_LIMIT');
    }

    // ── Validasi & konflik ───────────────────────────────────────────────

    public function test_email_sudah_terdaftar_ditolak_sejak_langkah_pertama(): void
    {
        Mail::fake();

        User::factory()->create(['email' => self::EMAIL]);

        $this->postJson('/api/auth/register', $this->payload())
            ->assertStatus(422)
            ->assertJsonValidationErrors('email');

        Mail::assertNothingSent();
    }

    public function test_email_sudah_terdaftar_dengan_kapital_berbeda_ditolak(): void
    {
        Mail::fake();

        // Kolom email unique bersifat case-sensitive di PostgreSQL, sedangkan
        // login memakai LOWER(email). Tanpa cek manual, "Warga.OTP@…" lolos
        // langkah 1 lalu ditolak di langkah 2 setelah OTP terlanjur dikirim.
        User::factory()->create(['email' => 'Warga.OTP@Example.com']);

        $this->postJson('/api/auth/register', $this->payload())
            ->assertStatus(422)
            ->assertJsonValidationErrors('email');

        Mail::assertNothingSent();
    }

    public function test_phone_sudah_terdaftar_ditolak_sejak_langkah_pertama(): void
    {
        Mail::fake();

        User::factory()->create(['phone' => '081234567890']);

        $this->postJson('/api/auth/register', $this->payload())
            ->assertStatus(422)
            ->assertJsonValidationErrors('phone');

        Mail::assertNothingSent();
    }

    public function test_gagal_kirim_email_membuang_challenge(): void
    {
        // Transport nyata (log/smtp) yang melempar — bukan Mail::fake().
        Mail::shouldReceive('to')->once()->andThrow(new \RuntimeException('SMTP down'));

        $real = new RegistrationOtpService;
        $token = null;
        $discarded = null;

        $otp = \Mockery::mock(RegistrationOtpService::class)->makePartial();
        $otp->shouldReceive('start')->andReturnUsing(function (array $payload) use ($real, &$token) {
            $challenge = $real->start($payload);
            $token = $challenge['token'];

            return $challenge;
        });
        $otp->shouldReceive('discard')->once()->andReturnUsing(function (string $value) use (&$discarded) {
            $discarded = $value;
        });

        $this->app->instance(RegistrationOtpService::class, $otp);

        $this->postJson('/api/auth/register', $this->payload())
            ->assertStatus(503)
            ->assertJsonPath('success', false)
            ->assertJsonPath('error_code', 'EMAIL_SEND_FAILED');

        // Token hidup yang kodenya tidak pernah sampai ke pendaftar harus mati.
        $this->assertNotNull($token);
        $this->assertSame($token, $discarded);
        $this->assertDatabaseMissing('users', ['email' => self::EMAIL]);
    }

    public function test_produksi_dengan_mail_mailer_log_ditolak_503(): void
    {
        Mail::fake();

        $this->app['env'] = 'production';
        config(['mail.default' => 'log']);

        $this->postJson('/api/auth/register', $this->payload())
            ->assertStatus(503)
            ->assertJsonPath('success', false)
            ->assertJsonPath('error_code', 'MAIL_NOT_CONFIGURED');

        // Tidak ada OTP yang dikirim, tidak ada user yang dibuat.
        Mail::assertNothingSent();
        $this->assertDatabaseMissing('users', ['email' => self::EMAIL]);
    }

    public function test_email_diklaim_setelah_otp_terkirim_menghasilkan_konflik(): void
    {
        Mail::fake();

        $token = $this->startRegistration();
        $code = $this->lastCode();

        // Pendaftar lain menyelesaikan lebih dulu dengan email yang sama.
        User::factory()->create(['email' => self::EMAIL]);

        $this->verify($token, $code)->assertStatus(422)
            ->assertJsonPath('error_code', 'REGISTRATION_CONFLICT');
    }

    public function test_phone_diklaim_setelah_otp_terkirim_menghasilkan_konflik(): void
    {
        Mail::fake();

        $token = $this->startRegistration();
        $code = $this->lastCode();

        User::factory()->create(['phone' => '081234567890']);

        $this->verify($token, $code)->assertStatus(422)
            ->assertJsonPath('error_code', 'REGISTRATION_CONFLICT');
    }

    public function test_password_lemah_ditolak(): void
    {
        Mail::fake();

        $this->postJson('/api/auth/register', $this->payload([
            'password' => 'pendek',
            'password_confirmation' => 'pendek',
        ]))->assertStatus(422)->assertJsonValidationErrors('password');

        Mail::assertNothingSent();
    }

    public function test_konfirmasi_password_tidak_cocok_ditolak(): void
    {
        Mail::fake();

        $this->postJson('/api/auth/register', $this->payload([
            'password_confirmation' => 'beda12345',
        ]))->assertStatus(422)->assertJsonValidationErrors('password');

        Mail::assertNothingSent();
    }
}
