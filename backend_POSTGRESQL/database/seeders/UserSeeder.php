<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        User::truncate();

        $password = Hash::make('password123');

        $users = [
            // ── Administrator ──────────────────────────────────────────────
            [
                'name'    => 'Admin Utama',
                'email'   => 'admin@dispu.binamarga.go.id',
                'role'    => 'admin',
                'wilayah' => null,
                'nip'     => '197501012005011001',
                'upr_id'  => null,
            ],

            // ── Petugas Lapangan ──────────────────────────────────────────
            [
                'name'    => 'Agus Setiawan',
                'email'   => 'agus.setiawan@dispu.binamarga.go.id',
                'role'    => 'petugas',
                'wilayah' => 'Kec. Sidoarjo',
                'nip'     => '198501012010011001',
                'upr_id'  => null,
            ],
            [
                'name'    => 'Rizky Firmansyah',
                'email'   => 'rizky.firmansyah@dispu.binamarga.go.id',
                'role'    => 'petugas',
                'wilayah' => 'Kec. Waru & Gedangan',
                'nip'     => '199203152015031002',
                'upr_id'  => null,
            ],
            [
                'name'    => 'Dewi Rahayu',
                'email'   => 'dewi.rahayu@dispu.binamarga.go.id',
                'role'    => 'petugas',
                'wilayah' => 'Kec. Taman & Krian',
                'nip'     => '199507202018032003',
                'upr_id'  => null,
            ],
            [
                'name'    => 'Bambang Eko',
                'email'   => 'bambang.eko@dispu.binamarga.go.id',
                'role'    => 'petugas',
                'wilayah' => 'Kec. Porong & Tanggulangin',
                'nip'     => '198812102012011004',
                'upr_id'  => null,
            ],

            // ── Supervisor ────────────────────────────────────────────────
            [
                'name'    => 'Budi Santoso',
                'email'   => 'budi.santoso@dispu.binamarga.go.id',
                'role'    => 'supervisor',
                'wilayah' => 'Wilayah Utara',
                'nip'     => '197804052005011005',
                'upr_id'  => null,
            ],
            [
                'name'    => 'Siti Marlina',
                'email'   => 'siti.marlina@dispu.binamarga.go.id',
                'role'    => 'supervisor',
                'wilayah' => 'Wilayah Selatan',
                'nip'     => '198006152006022006',
                'upr_id'  => null,
            ],
            [
                'name'    => 'Hendra Kusuma',
                'email'   => 'hendra.kusuma@dispu.binamarga.go.id',
                'role'    => 'supervisor',
                'wilayah' => 'Wilayah Barat',
                'nip'     => '197912202004011007',
                'upr_id'  => null,
            ],
            [
                'name'    => 'Fajar Nugroho',
                'email'   => 'fajar.nugroho@dispu.binamarga.go.id',
                'role'    => 'supervisor',
                'wilayah' => 'Wilayah Pusat & Timur',
                'nip'     => '198503102008011008',
                'upr_id'  => null,
            ],

            // ── Petugas Eksekusi ──────────────────────────────────────────
            [
                'name'    => 'Ahmad Hidayat',
                'email'   => 'ahmad.hidayat@dispu.binamarga.go.id',
                'role'    => 'petugas_eksekusi',
                'wilayah' => 'Waru, Sedati, Buduran, Gedangan',
                'nip'     => '199001012015031005',
                'upr_id'  => 1, // Satgas Wilayah Utara
            ],
            [
                'name'    => 'Rudi Hartono',
                'email'   => 'rudi.hartono@dispu.binamarga.go.id',
                'role'    => 'petugas_eksekusi',
                'wilayah' => 'Porong, Krembung, Tulangan, Tanggulangin, Jabon',
                'nip'     => '199102152016041006',
                'upr_id'  => 2, // Satgas Wilayah Selatan
            ],
            [
                'name'    => 'Slamet Riyadi',
                'email'   => 'slamet.riyadi@dispu.binamarga.go.id',
                'role'    => 'petugas_eksekusi',
                'wilayah' => 'Taman, Krian, Balongbendo, Wonoayu, Sukodono',
                'nip'     => '198807202017051007',
                'upr_id'  => 3, // Satgas Wilayah Barat
            ],
            [
                'name'    => 'Dodi Kurniawan',
                'email'   => 'dodi.kurniawan@dispu.binamarga.go.id',
                'role'    => 'petugas_eksekusi',
                'wilayah' => 'Candi, Sidoarjo, Tarik, Prambon',
                'nip'     => '199203102018061008',
                'upr_id'  => 4, // Satgas Wilayah Timur
            ],
        ];

        foreach ($users as $data) {
            User::create([...$data, 'password' => $password]);
        }

        $this->command->info('✅ UserSeeder: 13 user berhasil dibuat (1 admin + 4 petugas + 4 supervisor + 4 petugas eksekusi).');
        $this->command->info('   Email: @dispu.binamarga.go.id');
        $this->command->info('   Password semua akun: password123');
    }
}
