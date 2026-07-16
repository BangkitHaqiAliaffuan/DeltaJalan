<?php

namespace Database\Seeders;

use App\Models\Uptd;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class SupervisorUptdSeeder extends Seeder
{
    public function run(): void
    {
        DB::table('supervisor_uptd')->delete();

        $uptdUtara = Uptd::where('nama', 'UPTD Wilayah Utara')->first();
        $uptdSelatan = Uptd::where('nama', 'UPTD Wilayah Selatan')->first();
        $uptdBarat = Uptd::where('nama', 'UPTD Wilayah Barat')->first();
        $uptdPusat = Uptd::where('nama', 'UPTD Wilayah Pusat')->first();
        $uptdTimur = Uptd::where('nama', 'UPTD Wilayah Timur')->first();

        $budi = User::where('email', 'budi.santoso@dispu.binamarga.go.id')->first();
        $siti = User::where('email', 'siti.marlina@dispu.binamarga.go.id')->first();
        $hendra = User::where('email', 'hendra.kusuma@dispu.binamarga.go.id')->first();
        $fajar = User::where('email', 'fajar.nugroho@dispu.binamarga.go.id')->first();

        $pairs = [];

        // Budi Santoso → Wilayah Utara (priority 0)
        if ($budi && $uptdUtara) {
            $pairs[] = [
                'user_id' => $budi->id,
                'uptd_id' => $uptdUtara->id,
                'priority' => 0,
            ];
        }

        // Siti Marlina → Wilayah Selatan (priority 0)
        if ($siti && $uptdSelatan) {
            $pairs[] = [
                'user_id' => $siti->id,
                'uptd_id' => $uptdSelatan->id,
                'priority' => 0,
            ];
        }

        // Hendra Kusuma → Wilayah Barat (priority 0)
        if ($hendra && $uptdBarat) {
            $pairs[] = [
                'user_id' => $hendra->id,
                'uptd_id' => $uptdBarat->id,
                'priority' => 0,
            ];
        }

        // Fajar Nugroho → Wilayah Pusat (priority 1, dikalahkan Utara untuk overlap Buduran/Sedati)
        if ($fajar && $uptdPusat) {
            $pairs[] = [
                'user_id' => $fajar->id,
                'uptd_id' => $uptdPusat->id,
                'priority' => 1,
            ];
        }

        // Fajar Nugroho → Wilayah Timur (priority 0)
        if ($fajar && $uptdTimur) {
            $pairs[] = [
                'user_id' => $fajar->id,
                'uptd_id' => $uptdTimur->id,
                'priority' => 0,
            ];
        }

        DB::table('supervisor_uptd')->insert($pairs);

        $this->command->info('✅ SupervisorUptdSeeder: '.count($pairs).' mapping supervisor → UPTD berhasil dibuat.');
    }
}
