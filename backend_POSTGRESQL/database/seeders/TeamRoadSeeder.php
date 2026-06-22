<?php

namespace Database\Seeders;

use App\Models\SurveyTask;
use App\Models\Team;
use Illuminate\Database\Seeder;

class TeamRoadSeeder extends Seeder
{
    /**
     * Real road names from Dinas PU Bina Marga SDA Sidoarjo
     * Sumber: 39 ruas (2024) + data patroli rutin Satgas Jalan (2026)
     * Setiap tim memiliki daftar ruas tetap untuk patroli rutin harian.
     */
    public function run(): void
    {
        SurveyTask::truncate();

        $teams = Team::all()->keyBy('name');

        $roadsByTeam = [
            'Tim Satgas Utara' => [
                ['Jl. Waru - Pepelegi', 'Waru', 800],
                ['Jl. Kureksari - Kepuh Kiriman', 'Waru', 600],
                ['Jl. Punggul - Gemurung', 'Gedangan', 1200],
                ['Jl. Kwangsan - Gemurung', 'Sedati', 900],
                ['Jl. Prasung - Dukuh Tengah', 'Buduran', 700],
            ],
            'Tim Satgas Pusat' => [
                ['Jl. Sumput - Anggaswangi', 'Sidoarjo', 1100],
                ['Jl. Sekardangan - Gebang', 'Sidoarjo', 900],
                ['Jl. Magersari - Pagerwojo', 'Sidoarjo', 800],
                ['Jl. Pagerwojo - Sidokerto', 'Buduran', 1000],
                ['Jl. Pulungan - Kwangsan', 'Sedati', 1100],
            ],
            'Tim Satgas Barat' => [
                ['Jl. Kletek - Sukodono', 'Taman', 800],
                ['Jl. Sidomojo - Sidomulyo', 'Krian', 1000],
                ['Jl. Jeruk Gamping - Junwangi', 'Krian', 900],
                ['Jl. Jumputrejo - Karangbong', 'Sukodono', 700],
                ['Jl. Pelarungan - Terung Wetan', 'Sukodono', 800],
                ['Jl. Singkalan - Sebani', 'Balongbendo', 600],
            ],
            'Tim Satgas Selatan' => [
                ['Jl. Porong - Juwet Kenongo', 'Porong', 1500],
                ['Jl. Kebonagung - Tambakrejo', 'Porong', 1200],
                ['Jl. Gelam - Kedungkendo', 'Tanggulangin', 1000],
                ['Jl. Kalisampurno - Kedensari', 'Tanggulangin', 800],
                ['Jl. Randegan - Lajuk', 'Tanggulangin', 600],
                ['Jl. Tambakrejo - Tanjek Wagir', 'Krembung', 700],
            ],
            'Tim Satgas Timur' => [
                ['Jl. Candi - Klurak', 'Candi', 1000],
                ['Jl. Durung Bedug - Modong', 'Candi', 900],
                ['Jl. Tarik - Tarik', 'Tarik', 800],
                ['Jl. Bakung Pringgodani - Kedungbocok', 'Tarik', 700],
                ['Jl. Prambon - Tarik', 'Prambon', 2000],
                ['Jl. Wirobiting - Kedungsugo', 'Prambon', 1000],
            ],
        ];

        $count = 0;
        foreach ($roadsByTeam as $teamName => $roads) {
            $team = $teams[$teamName] ?? null;
            if (! $team) {
                continue;
            }
            foreach ($roads as $r) {
                SurveyTask::create([
                    'road_name' => $r[0],
                    'kecamatan' => $r[1],
                    'road_length_m' => $r[2],
                    'team_id' => $team->id,
                    'status' => 'aktif',
                ]);
                $count++;
            }
        }

        $this->command->info("✅ TeamRoadSeeder: {$count} ruas jalan real terdaftar untuk 5 tim Satgas (sumber: data Dinas PU Bina Marga SDA Sidoarjo).");
    }
}
