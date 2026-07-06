<?php

namespace Database\Seeders;

use App\Models\Report;
use App\Models\ReportPhoto;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class CreateDeadlineTestReports extends Seeder
{
    public function run(): void
    {
        $petugas = User::where('name', 'Agus Setiawan')->first();
        if (! $petugas) {
            $this->command->error('Tidak ada user Agus Setiawan. Jalankan UserSeeder dulu.');

            return;
        }

        $teamId = $petugas->team_id;
        $now = now();

        $lastCode = Report::max('report_code');
        $nextNum = $lastCode ? ((int) substr($lastCode, -5)) + 1 : 1;

        $configs = [
            [
                'road_name' => 'Jalan Raya Panglima Sudirman - Sidoarjo',
                'district' => 'Sidoarjo',
                'lat' => -7.4545, 'lng' => 112.7111,
                'severity' => 'Rusak Berat',
                'ai_jenis' => 'Lubang',
                'priority' => 'Tinggi',
                'panjang' => 2.5, 'lebar' => 1.8,
            ],
            [
                'road_name' => 'Jalan Diponegoro - Sidoarjo',
                'district' => 'Waru',
                'lat' => -7.4632, 'lng' => 112.7205,
                'severity' => 'Rusak Sedang',
                'ai_jenis' => 'Retak Memanjang',
                'priority' => 'Sedang',
                'panjang' => 3.0, 'lebar' => 0.5,
            ],
        ];

        foreach ($configs as $cfg) {
            $code = 'LP-'.date('Y').'-'.str_pad($nextNum++, 5, '0', STR_PAD_LEFT);

            $photoPath = "reports/{$code}_original.jpg";
            $t = now();

            $report = Report::create([
                'report_code' => $code,
                'user_id' => $petugas->id,
                'reporter_name' => $petugas->name,
                'road_name' => $cfg['road_name'],
                'district' => $cfg['district'],
                'latitude' => $cfg['lat'],
                'longitude' => $cfg['lng'],
                'koordinat_sumber' => 'browser_gps',
                'total_detections' => 1,
                'overall_severity' => $cfg['severity'],
                'ai_severity' => strtolower(explode(' ', $cfg['severity'])[1]),
                'ai_jenis_kerusakan' => $cfg['ai_jenis'],
                'ai_confidence' => 0.85,
                'ai_raw_output' => json_encode([
                    ['class' => $cfg['ai_jenis'], 'confidence' => round(0.75 + mt_rand() / mt_getrandmax() * 0.24, 3)],
                ]),
                'kerusakan_panjang' => $cfg['panjang'],
                'kerusakan_lebar' => $cfg['lebar'],
                'status' => 'Sedang Diperbaiki',
                'priority' => $cfg['priority'],
                'system_notes' => 'Laporan test deadline resolusi 3 menit',
                'catatan_petugas' => 'Kerusakan perlu penanganan segera',
                'deadline_review' => (clone $t)->subDays(1),
                'deadline_resolusi' => (clone $t)->addMinutes(3),
                'terlambat_review' => true,
                'terlambat_resolusi' => false,
                'perbaikan_dimulai_at' => (clone $t)->subHours(2),
                'assigned_team_id' => $teamId,
                'assigned_at' => (clone $t)->subDays(1),
                'ditugaskan_at' => (clone $t)->subDays(1),
                'pelaksana' => $petugas->name,
                'assignor_name' => 'Budi Santoso',
                'image_original_path' => $photoPath,
                'created_at' => (clone $t)->subDays(2),
                'updated_at' => $t,
            ]);

            ReportPhoto::create([
                'report_id' => $report->id,
                'reporter_name' => $petugas->name,
                'ai_jenis_kerusakan' => $cfg['ai_jenis'],
                'ai_severity' => strtolower(explode(' ', $cfg['severity'])[1]),
                'ai_confidence' => 0.85,
                'total_detections' => 1,
                'latitude' => $cfg['lat'],
                'longitude' => $cfg['lng'],
                'image_original_path' => $photoPath,
                'image_hash' => hash('sha256', $code.Str::random(8)),
                'sort_order' => 0,
                'created_at' => (clone $t)->subDays(2),
            ]);

            $this->command->info("  [OK] {$code}: deadline_resolusi = {$report->deadline_resolusi}");
        }

        $this->command->info('2 laporan test deadline berhasil ditambahkan.');
    }
}
