<?php

namespace Tests\Feature;

use Tests\TestCase;

class AppVersionTest extends TestCase
{
    public function test_version_returns_metadata_untuk_android(): void
    {
        $response = $this->getJson('/api/app/version?platform=android&version_code=1');

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonStructure([
                'data' => [
                    'min_version_code',
                    'latest_version_code',
                    'apk_url',
                    'force_update',
                ],
            ]);
    }

    public function test_version_force_update_true_jika_dibawah_minimum(): void
    {
        $min = (int) config('mobile.android_min_version_code');

        $response = $this->getJson("/api/app/version?platform=android&version_code={$min}");

        // Sama dengan minimum → tidak force; satu di bawah minimum → force.
        $response->assertJsonPath('data.force_update', false);

        $this->getJson('/api/app/version?platform=android&version_code='.($min - 1))
            ->assertJsonPath('data.force_update', true);
    }

    public function test_version_menolak_platform_tak_dikenal(): void
    {
        $this->getJson('/api/app/version?platform=windows-phone')
            ->assertStatus(422)
            ->assertJsonPath('success', false);
    }
}
