<?php

namespace Tests\Feature;

use App\Contracts\FirebaseTokenVerifier;
use App\Models\User;
use App\Support\VerifiedFirebaseUser;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Testing\TestResponse;
use Kreait\Firebase\Exception\Auth\FailedToVerifyToken;
use Laravel\Sanctum\Sanctum;
use Mockery\MockInterface;
use Tests\TestCase;

class GoogleAuthTest extends TestCase
{
    use RefreshDatabase;

    private function fakeGoogle(
        string $uid = 'firebase-uid-1',
        string $email = 'warga.google@example.com',
        string $name = 'Warga Google',
        bool $emailVerified = true,
        string $provider = 'google.com',
    ): void {
        $this->mock(FirebaseTokenVerifier::class, function (MockInterface $mock) use ($uid, $email, $name, $emailVerified, $provider) {
            $mock->shouldReceive('verify')
                ->once()
                ->andReturn(new VerifiedFirebaseUser($uid, $email, $name, $emailVerified, $provider));
        });
    }

    private function googleLogin(): TestResponse
    {
        return $this->postJson('/api/auth/google', [
            'firebase_token' => 'firebase-id-token',
        ]);
    }

    public function test_user_google_baru_mendapat_onboarding_tanpa_dibuat_di_database(): void
    {
        $this->fakeGoogle();

        $response = $this->googleLogin();

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('needs_onboarding', true)
            ->assertJsonPath('is_new_user', true)
            ->assertJsonPath('missing_fields', ['phone', 'password'])
            ->assertJsonPath('profile.name', 'Warga Google')
            ->assertJsonPath('profile.email', 'warga.google@example.com')
            ->assertJsonStructure(['onboarding_token']);

        $this->assertDatabaseMissing('users', [
            'email' => 'warga.google@example.com',
        ]);
    }

    public function test_complete_google_membuat_user_dengan_phone_dan_password(): void
    {
        $this->fakeGoogle();

        $onboardingToken = $this->googleLogin()
            ->assertOk()
            ->json('onboarding_token');

        $response = $this->postJson('/api/auth/google/complete', [
            'onboarding_token' => $onboardingToken,
            'phone' => '+6281234567890',
            'password' => 'rahasia123',
            'password_confirmation' => 'rahasia123',
            // Client tidak boleh bisa mengganti identitas Google.
            'name' => 'Nama Palsu',
            'email' => 'palsu@example.com',
        ]);

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('needs_onboarding', false)
            ->assertJsonPath('user.role', 'warga')
            ->assertJsonPath('user.phone', '081234567890')
            ->assertJsonPath('user.needs_phone', false)
            ->assertJsonStructure(['token', 'user' => ['id', 'name', 'email']]);

        $user = User::where('email', 'warga.google@example.com')->firstOrFail();

        $this->assertSame('081234567890', $user->phone);
        $this->assertSame('firebase-uid-1', $user->firebase_uid);
        $this->assertSame('Warga Google', $user->name);
        $this->assertTrue(Hash::check('rahasia123', $user->password));

        // Akun Google yang punya password tetap bisa login lewat email + password.
        $this->postJson('/api/auth/login', [
            'email' => 'warga.google@example.com',
            'password' => 'rahasia123',
        ])->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('user.role', 'warga')
            ->assertJsonStructure(['token']);
    }

    public function test_complete_google_tanpa_password_ditolak(): void
    {
        $this->fakeGoogle();
        $token = $this->googleLogin()->json('onboarding_token');

        $this->postJson('/api/auth/google/complete', [
            'onboarding_token' => $token,
            'phone' => '081234567890',
        ])->assertStatus(422)
            ->assertJsonValidationErrors('password');

        $this->assertDatabaseMissing('users', ['email' => 'warga.google@example.com']);
    }

    public function test_complete_google_password_tidak_cocok_ditolak(): void
    {
        $this->fakeGoogle();
        $token = $this->googleLogin()->json('onboarding_token');

        $this->postJson('/api/auth/google/complete', [
            'onboarding_token' => $token,
            'phone' => '081234567890',
            'password' => 'rahasia123',
            'password_confirmation' => 'beda12345',
        ])->assertStatus(422)
            ->assertJsonValidationErrors('password');

        $this->assertDatabaseMissing('users', ['email' => 'warga.google@example.com']);
    }

    public function test_phone_duplikat_tidak_menghapus_onboarding_token(): void
    {
        User::factory()->create([
            'role' => 'warga',
            'phone' => '081111111111',
        ]);

        $this->fakeGoogle();
        $token = $this->googleLogin()->json('onboarding_token');

        $this->postJson('/api/auth/google/complete', [
            'onboarding_token' => $token,
            'phone' => '081111111111',
            'password' => 'rahasia123',
            'password_confirmation' => 'rahasia123',
        ])->assertStatus(422)
            ->assertJsonPath('error_code', 'PHONE_TAKEN');

        // Token onboarding masih bisa dipakai setelah user memperbaiki nomor.
        $this->postJson('/api/auth/google/complete', [
            'onboarding_token' => $token,
            'phone' => '082222222222',
            'password' => 'rahasia123',
            'password_confirmation' => 'rahasia123',
        ])->assertOk()
            ->assertJsonPath('user.phone', '082222222222');
    }

    public function test_onboarding_token_kedaluwarsa_ditolak(): void
    {
        $this->fakeGoogle();
        $token = $this->googleLogin()->json('onboarding_token');

        $this->travel(16)->minutes();

        $this->postJson('/api/auth/google/complete', [
            'onboarding_token' => $token,
            'phone' => '081234567890',
            'password' => 'rahasia123',
            'password_confirmation' => 'rahasia123',
        ])->assertStatus(422)
            ->assertJsonPath('error_code', 'ONBOARDING_EXPIRED');
    }

    public function test_warga_lama_dengan_phone_langsung_login_tanpa_password(): void
    {
        $user = User::factory()->create([
            'role' => 'warga',
            'email' => 'warga.lama@example.com',
            'phone' => '081234567890',
        ]);
        $originalPassword = $user->password;
        $originalName = $user->name;

        $this->fakeGoogle(
            uid: 'firebase-uid-lama',
            email: 'warga.lama@example.com',
            name: 'Nama Google Baru',
        );

        $this->googleLogin()
            ->assertOk()
            ->assertJsonPath('needs_onboarding', false)
            ->assertJsonPath('user.id', $user->id)
            ->assertJsonStructure(['token']);

        $user->refresh();
        $this->assertSame('firebase-uid-lama', $user->firebase_uid);
        $this->assertSame($originalName, $user->name);
        $this->assertSame($originalPassword, $user->password);
    }

    public function test_warga_lama_tanpa_phone_hanya_diminta_phone_dan_password_tidak_berubah(): void
    {
        $user = User::factory()->create([
            'role' => 'warga',
            'email' => 'warga.tanpa.phone@example.com',
            'phone' => null,
            'password' => Hash::make('passwordlama'),
        ]);

        $this->fakeGoogle(
            uid: 'firebase-uid-tanpa-phone',
            email: 'warga.tanpa.phone@example.com',
            name: 'Nama Google',
        );

        $response = $this->googleLogin()
            ->assertOk()
            ->assertJsonPath('needs_onboarding', true)
            ->assertJsonPath('is_new_user', false)
            ->assertJsonPath('missing_fields', ['phone']);

        $this->postJson('/api/auth/google/complete', [
            'onboarding_token' => $response->json('onboarding_token'),
            'phone' => '081234567891',
        ])->assertOk()
            ->assertJsonPath('user.phone', '081234567891');

        $user->refresh();
        $this->assertTrue(Hash::check('passwordlama', $user->password));
    }

    public function test_akun_staff_ditolak(): void
    {
        User::factory()->create([
            'role' => 'supervisor',
            'email' => 'supervisor@example.com',
            'phone' => '081234567890',
        ]);

        $this->fakeGoogle(email: 'supervisor@example.com');

        $this->googleLogin()
            ->assertStatus(403)
            ->assertJsonPath('error_code', 'GOOGLE_WARGA_ONLY');
    }

    public function test_akun_banned_ditolak(): void
    {
        User::factory()->create([
            'role' => 'warga',
            'email' => 'banned@example.com',
            'phone' => '081234567890',
            'banned_at' => now(),
        ]);

        $this->fakeGoogle(email: 'banned@example.com');

        $this->googleLogin()
            ->assertStatus(403)
            ->assertJsonPath('error_code', 'ACCOUNT_BANNED');
    }

    public function test_provider_selain_google_ditolak(): void
    {
        $this->fakeGoogle(provider: 'password');

        $this->googleLogin()
            ->assertStatus(401)
            ->assertJsonPath('error_code', 'FIREBASE_TOKEN_INVALID');
    }

    public function test_email_belum_verified_ditolak(): void
    {
        $this->fakeGoogle(emailVerified: false);

        $this->googleLogin()
            ->assertStatus(401)
            ->assertJsonPath('error_code', 'FIREBASE_TOKEN_INVALID');
    }

    public function test_token_firebase_invalid_ditolak(): void
    {
        $this->mock(FirebaseTokenVerifier::class, function (MockInterface $mock) {
            $mock->shouldReceive('verify')
                ->once()
                ->andThrow(new FailedToVerifyToken('invalid token'));
        });

        $this->googleLogin()
            ->assertStatus(401)
            ->assertJsonPath('error_code', 'FIREBASE_TOKEN_INVALID');
    }

    public function test_akun_dengan_firebase_uid_berbeda_ditolak(): void
    {
        User::factory()->create([
            'role' => 'warga',
            'email' => 'konflik@example.com',
            'phone' => '081234567890',
            'firebase_uid' => 'firebase-uid-lain',
        ]);

        $this->fakeGoogle(uid: 'firebase-uid-baru', email: 'konflik@example.com');

        $this->googleLogin()
            ->assertStatus(409)
            ->assertJsonPath('error_code', 'FIREBASE_UID_CONFLICT');
    }

    public function test_warga_tanpa_phone_tidak_bisa_akses_endpoint_warga(): void
    {
        $user = User::factory()->create([
            'role' => 'warga',
            'phone' => null,
        ]);

        Sanctum::actingAs($user);

        $this->getJson('/api/warga/reports')
            ->assertStatus(403)
            ->assertJsonPath('error_code', 'PHONE_REQUIRED');
    }

    public function test_me_mengirim_needs_phone(): void
    {
        $user = User::factory()->create([
            'role' => 'warga',
            'phone' => null,
        ]);

        Sanctum::actingAs($user);

        $this->getJson('/api/auth/me')
            ->assertOk()
            ->assertJsonPath('user.needs_phone', true);
    }

    public function test_auth_phone_melengkapi_sesi_lama(): void
    {
        $user = User::factory()->create([
            'role' => 'warga',
            'phone' => null,
        ]);

        Sanctum::actingAs($user);

        $this->postJson('/api/auth/phone', [
            'phone' => '+6281234567890',
        ])->assertOk()
            ->assertJsonPath('user.phone', '081234567890')
            ->assertJsonPath('user.needs_phone', false);
    }
}
