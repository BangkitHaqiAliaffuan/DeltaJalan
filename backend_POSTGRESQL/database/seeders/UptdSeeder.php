<?php

namespace Database\Seeders;

use App\Models\Uptd;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class UptdSeeder extends Seeder
{
    public function run(): void
    {
        DB::table('uptd')->delete();

        Uptd::create([
            'nama' => 'UPTD Wilayah Selatan',
            'kecamatan_wilayah' => ['Porong', 'Tanggulangin', 'Krembung', 'Jabon', 'Tulangan'],
        ]);
        Uptd::create([
            'nama' => 'UPTD Wilayah Utara',
            'kecamatan_wilayah' => ['Waru', 'Gedangan', 'Sedati', 'Buduran'],
        ]);
        Uptd::create([
            'nama' => 'UPTD Wilayah Pusat',
            'kecamatan_wilayah' => ['Sidoarjo', 'Buduran', 'Sedati'],
        ]);
        Uptd::create([
            'nama' => 'UPTD Wilayah Barat',
            'kecamatan_wilayah' => ['Taman', 'Krian', 'Balongbendo', 'Wonoayu', 'Sukodono'],
        ]);
        Uptd::create([
            'nama' => 'UPTD Wilayah Timur',
            'kecamatan_wilayah' => ['Candi', 'Tarik', 'Prambon'],
        ]);

        $this->command->info('✅ UptdSeeder: 5 UPTD terdaftar.');
    }
}
