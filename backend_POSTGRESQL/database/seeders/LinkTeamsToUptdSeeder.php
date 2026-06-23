<?php

namespace Database\Seeders;

use App\Models\Team;
use App\Models\Uptd;
use Illuminate\Database\Seeder;

class LinkTeamsToUptdSeeder extends Seeder
{
    public function run(): void
    {
        $uptds = Uptd::all()->keyBy('nama');

        $mapping = [
            'Tim Satgas Selatan' => 'UPTD Wilayah Selatan',
            'Tim Satgas Utara' => 'UPTD Wilayah Utara',
            'Tim Satgas Pusat' => 'UPTD Wilayah Pusat',
            'Tim Satgas Barat' => 'UPTD Wilayah Barat',
            'Tim Satgas Timur' => 'UPTD Wilayah Timur',
        ];

        foreach ($mapping as $teamName => $uptdName) {
            $team = Team::where('name', $teamName)->first();
            $uptd = $uptds[$uptdName] ?? null;
            if ($team && $uptd) {
                $team->update(['uptd_id' => $uptd->id]);
            }
        }

        $this->command->info('✅ LinkTeamsToUptdSeeder: Teams linked to UPTD.');
    }
}
