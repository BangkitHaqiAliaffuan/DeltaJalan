<?php

namespace Database\Seeders;

use App\Models\SurveyTask;
use App\Models\Team;
use Illuminate\Database\Seeder;

class TeamRoadSeeder extends Seeder
{
    /**
     * Data ruas jalan dari sumber resmi Dinas PU Bina Marga SDA Sidoarjo:
     * - Peta Jalan Resmi: sidoarjokab.go.id/peta-jalan (43 ruas dgn No. Ruas)
     * - 39 Ruas Jalan Rusak 2024: sidoarjokab.go.id/berita (21 Mar 2024)
     * - 22 Ruas Betonisasi 2024: sidoarjonews.id (3 Jan 2024)
     * - 11 Ruas Betonisasi 2025: sidoarjonews.id (20 Mei 2025)
     *
     * Format nama ruas mengikuti standar resmi Dinas PU:
     * "Jalan [Desa A] - [Desa B]"
     * (# = nomor ruas dari Peta Jalan, jika tersedia)
     */
    public function run(): void
    {
        SurveyTask::truncate();

        $teams = Team::all()->keyBy('name');

        // ── 5 TIM SATGAS — 28 ruas jalan TERKONFIRMASI dari sumber resmi ──
        $roadsByTeam = [
            // Tim Satgas Utara: Waru, Gedangan, Sedati, Buduran
            'Tim Satgas Utara' => [
                ['Jalan Waru - Pepelegi', 'Waru', 800],
                ['Jalan Kureksari - Kepuh Kiriman', 'Waru', 600],
                ['Jalan Punggul - Gemurung', 'Gedangan', 1200],
                ['Jalan Kwangsan - Gemurung', 'Sedati', 900],   // #511
                ['Jalan Prasung - Dukuh Tengah', 'Buduran', 700],
            ],
            // Tim Satgas Pusat: Sidoarjo, Buduran, Sedati
            'Tim Satgas Pusat' => [
                ['Jalan Sumput - Anggaswangi', 'Sidoarjo', 1100],
                ['Jalan Sekardangan - Gebang', 'Sidoarjo', 900], // #236
                ['Jalan Magersari - Pagerwojo', 'Sidoarjo', 800],
                ['Jalan Pagerwojo - Sidokerto', 'Buduran', 1000],
                ['Jalan Pulungan - Kwangsan', 'Sedati', 1100],   // #512
            ],
            // Tim Satgas Barat: Taman, Krian, Sukodono, Balongbendo
            'Tim Satgas Barat' => [
                ['Jalan Kletek - Sukodono', 'Taman', 800],        // #407
                ['Jalan Sidomojo - Sidomulyo', 'Krian', 1000],
                ['Jalan Jeruk Gamping - Junwangi', 'Krian', 900],
                ['Jalan Jumputrejo - Karangbong', 'Sukodono', 700],
                ['Jalan Pelarungan - Terung Wetan', 'Sukodono', 800],
                ['Jalan Singkalan - Sebani', 'Balongbendo', 600],
            ],
            // Tim Satgas Selatan: Porong, Tanggulangin, Krembung
            'Tim Satgas Selatan' => [
                ['Jalan Porong - Juwet Kenongo', 'Porong', 1500], // #95
                ['Jalan Kebonagung - Tambakrejo', 'Porong', 1200],
                ['Jalan Gelam - Kedungkendo', 'Tanggulangin', 1000],
                ['Jalan Kalisampurno - Kedensari', 'Tanggulangin', 800],
                ['Jalan Randegan - Lajuk', 'Tanggulangin', 600],  // #159
                ['Jalan Tambakrejo - Tanjek Wagir', 'Krembung', 700],
            ],
            // Tim Satgas Timur: Candi, Tarik, Prambon
            'Tim Satgas Timur' => [
                ['Jalan Candi - Klurak', 'Candi', 1000],
                ['Jalan Durung Bedug - Modong', 'Candi', 900],
                ['Jalan Tarik - Tarik', 'Tarik', 800],            // #1
                ['Jalan Bakungpringgodani - Kedungbocok', 'Tarik', 700],
                ['Jalan Prambon - Tarik', 'Prambon', 2000],
                ['Jalan Wirobiting - Kedungsugo', 'Prambon', 1000],
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
                    'tanggal_patroli' => today()->subDays(rand(0, 7))->format('Y-m-d'),
                    'alasan_tugas' => 'rutin',
                ]);
                $count++;
            }
        }

        $this->command->info("✅ TeamRoadSeeder: {$count} ruas jalan real untuk 5 tim Satgas (sumber: sidoarjokab.go.id — 39 ruas 2024).");
    }
}
