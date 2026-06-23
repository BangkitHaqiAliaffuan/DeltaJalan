<?php

namespace Database\Seeders;

use App\Models\Team;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class TeamSeeder extends Seeder
{
    public function run(): void
    {
        DB::table('teams')->delete();

        $teams = [
            ['name' => 'Tim Satgas Utara', 'description' => 'Wilayah Utara: Waru, Gedangan, Sedati, Buduran'],
            ['name' => 'Tim Satgas Selatan', 'description' => 'Wilayah Selatan: Porong, Krembung, Tulangan, Tanggulangin, Jabon'],
            ['name' => 'Tim Satgas Barat', 'description' => 'Wilayah Barat: Taman, Krian, Balongbendo, Wonoayu, Sukodono'],
            ['name' => 'Tim Satgas Timur', 'description' => 'Wilayah Timur: Candi, Sidoarjo, Tarik, Prambon'],
            ['name' => 'Tim Satgas Pusat', 'description' => 'Wilayah Pusat: Sidoarjo Kota, Buduran, Sedati'],
        ];

        foreach ($teams as $data) {
            Team::create($data);
        }

        $utara = Team::where('name', 'Tim Satgas Utara')->first();
        $selatan = Team::where('name', 'Tim Satgas Selatan')->first();
        $barat = Team::where('name', 'Tim Satgas Barat')->first();
        $timur = Team::where('name', 'Tim Satgas Timur')->first();
        $pusat = Team::where('name', 'Tim Satgas Pusat')->first();

        User::where('email', 'agus.setiawan@dispu.binamarga.go.id')->update(['team_id' => $utara->id]);
        User::where('email', 'ahmad.hidayat@dispu.binamarga.go.id')->update(['team_id' => $utara->id]);
        User::where('email', 'rizky.firmansyah@dispu.binamarga.go.id')->update(['team_id' => $pusat->id]);
        User::where('email', 'dewi.rahayu@dispu.binamarga.go.id')->update(['team_id' => $barat->id]);
        User::where('email', 'slamet.riyadi@dispu.binamarga.go.id')->update(['team_id' => $barat->id]);
        User::where('email', 'bambang.eko@dispu.binamarga.go.id')->update(['team_id' => $selatan->id]);
        User::where('email', 'rudi.hartono@dispu.binamarga.go.id')->update(['team_id' => $selatan->id]);
        User::where('email', 'dodi.kurniawan@dispu.binamarga.go.id')->update(['team_id' => $timur->id]);

        $this->command->info('✅ TeamSeeder: 5 tim Satgas berhasil dibuat + 8 petugas ditugaskan.');
    }
}
