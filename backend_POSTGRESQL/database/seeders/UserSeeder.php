<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        DB::table('users')->delete();

        $password = Hash::make('password123');

        $users = [
            // ── Administrator ──────────────────────────────────────────────
            [
                'name' => 'Admin Utama',
                'email' => 'admin@dispu.binamarga.go.id',
                'role' => 'admin',
                'wilayah' => null,
                'nip' => '197501012005011001',
            ],

            // ── Petugas Lapangan ──────────────────────────────────────────
            [
                'name' => 'Agus Setiawan',
                'email' => 'agus.setiawan@dispu.binamarga.go.id',
                'role' => 'petugas',
                'wilayah' => 'Kec. Sidoarjo',
                'nip' => '198501012010011001',
            ],
            [
                'name' => 'Rizky Firmansyah',
                'email' => 'rizky.firmansyah@dispu.binamarga.go.id',
                'role' => 'petugas',
                'wilayah' => 'Kec. Waru & Gedangan',
                'nip' => '199203152015031002',
            ],
            [
                'name' => 'Dewi Rahayu',
                'email' => 'dewi.rahayu@dispu.binamarga.go.id',
                'role' => 'petugas',
                'wilayah' => 'Kec. Taman & Krian',
                'nip' => '199507202018032003',
            ],
            [
                'name' => 'Bambang Eko',
                'email' => 'bambang.eko@dispu.binamarga.go.id',
                'role' => 'petugas',
                'wilayah' => 'Kec. Porong & Tanggulangin',
                'nip' => '198812102012011004',
            ],
            [
                'name' => 'Dodi Kurniawan',
                'email' => 'dodi.kurniawan@dispu.binamarga.go.id',
                'role' => 'petugas',
                'wilayah' => 'Kec. Candi, Sidoarjo, Tarik, Prambon',
                'nip' => '199203102018061008',
            ],

            // ── Supervisor ────────────────────────────────────────────────
            [
                'name' => 'Budi Santoso',
                'email' => 'budi.santoso@dispu.binamarga.go.id',
                'role' => 'supervisor',
                'wilayah' => 'Wilayah Utara',
                'nip' => '197804052005011005',
            ],
            [
                'name' => 'Siti Marlina',
                'email' => 'siti.marlina@dispu.binamarga.go.id',
                'role' => 'supervisor',
                'wilayah' => 'Wilayah Selatan',
                'nip' => '198006152006022006',
            ],
            [
                'name' => 'Hendra Kusuma',
                'email' => 'hendra.kusuma@dispu.binamarga.go.id',
                'role' => 'supervisor',
                'wilayah' => 'Wilayah Barat',
                'nip' => '197912202004011007',
            ],
            [
                'name' => 'Fajar Nugroho',
                'email' => 'fajar.nugroho@dispu.binamarga.go.id',
                'role' => 'supervisor',
                'wilayah' => 'Wilayah Pusat & Timur',
                'nip' => '198503102008011008',
            ],

            // ── Petugas (tugas ganda: patroli + perbaikan) ───────────────
        ];

        foreach ($users as $data) {
            User::create([...$data, 'password' => $password]);
        }

        $this->command->info('✅ UserSeeder: 10 user berhasil dibuat (1 admin + 4 supervisor + 5 petugas).');
        $this->command->info('   Email: @dispu.binamarga.go.id');
        $this->command->info('   Password semua akun: password123');
    }
}
