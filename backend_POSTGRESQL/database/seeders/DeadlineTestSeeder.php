<?php

namespace Database\Seeders;

use App\Models\Report;
use App\Models\User;
use Illuminate\Database\Seeder;

class DeadlineTestSeeder extends Seeder
{
    public function run(): void
    {
        $this->command->info('DeadlineTestSeeder dimulai...');

        // ── Blok 1: Fill missing deadlines ──

        // 1a. deadline_review — for reports pending review
        $reviewFilled = 0;
        Report::whereNull('deadline_review')
            ->whereIn('status', ['Menunggu Review', 'Ditinjau'])
            ->each(function (Report $report) use (&$reviewFilled) {
                $hours = (int) config("deadline.{$report->priority}.review_hours", 72);
                $report->update([
                    'deadline_review' => $report->created_at->copy()->addHours($hours),
                    'terlambat_review' => false,
                ]);
                $reviewFilled++;
            });
        $this->command->info("1a. deadline_review diisi: {$reviewFilled} laporan");

        // 1c. deadline_resolusi — for in-progress/completed reports
        $resolusiFilled = 0;
        Report::whereNull('deadline_resolusi')
            ->whereIn('status', ['Sedang Diperbaiki', 'Selesai'])
            ->each(function (Report $report) use (&$resolusiFilled) {
                $hours = (int) config("deadline.{$report->priority}.resolution_hours", 168);
                $base = $report->perbaikan_dimulai_at ?? $report->created_at;
                $report->update([
                    'deadline_resolusi' => $base->copy()->addHours($hours),
                    'terlambat_resolusi' => false,
                ]);
                $resolusiFilled++;
            });
        $this->command->info("1c. deadline_resolusi diisi: {$resolusiFilled} laporan");

        $totalWithDeadlines = Report::whereNotNull('deadline_review')
            ->orWhereNotNull('deadline_resolusi')
            ->count();
        $this->command->info("Blok 1 selesai. {$totalWithDeadlines} laporan sekarang memiliki deadline.");

        // ── Blok 2: 6 laporan BARU Agus Setiawan untuk tes deadline ──

        $petugas = User::where('name', 'Agus Setiawan')->first();
        $teamId = $petugas?->team_id;

        // Generate nomor urut report_code setelah laporan eksisting
        $lastCode = Report::where('report_code', 'like', 'LP-'.date('Y').'-%')
            ->orderBy('report_code', 'desc')
            ->value('report_code');
        $nextNumber = $lastCode ? ((int) substr($lastCode, -5)) + 1 : 1;

        $now = now();
        $roadNames = [
            'Jalan Raya Utara - Sidoarjo',
            'Jalan Diponegoro - Sidoarjo',
            'Jalan Ahmad Yani - Sidoarjo',
            'Jalan Pahlawan - Sidoarjo',
            'Jalan Majapahit - Sidoarjo',
            'Jalan Gajah Mada - Sidoarjo',
        ];
        $districts = ['Waru', 'Gedangan', 'Sedati', 'Buduran', 'Sidoarjo'];

        // ── Group A: 3 laporan baru, deadline 23j55m (trigger warning 24h) ──
        for ($i = 0; $i < 3; $i++) {
            $mulaiAt = $now->copy()->subDays(rand(3, 7));
            $ditugaskanAt = $mulaiAt->copy()->subDays(rand(1, 3));
            $code = 'LP-'.date('Y').'-'.str_pad($nextNumber++, 5, '0', STR_PAD_LEFT);

            $report = Report::create([
                'report_code' => $code,
                'user_id' => $petugas->id,
                'reporter_name' => 'Agus Setiawan',
                'road_name' => $roadNames[$i],
                'district' => $districts[$i],
                'latitude' => -7.45 + (rand(-50, 50) / 1000),
                'longitude' => 112.71 + (rand(-50, 50) / 1000),
                'koordinat_sumber' => 'browser_gps',
                'status' => 'Sedang Diperbaiki',
                'priority' => 'Sedang',
                'overall_severity' => 'Rusak Sedang',
                'ai_severity' => 'sedang',
                'ai_jenis_kerusakan' => 'Lubang',
                'kerusakan_panjang' => rand(10, 50) / 10,
                'kerusakan_lebar' => rand(5, 30) / 10,
                'catatan_petugas' => 'Laporan test deadline Group A',
                'deadline_review' => $now->copy()->subHours(rand(24, 72)),
                'terlambat_review' => true,
                'assigned_team_id' => $teamId,
                'assigned_at' => $ditugaskanAt,
                'ditugaskan_at' => $ditugaskanAt,
                'perbaikan_dimulai_at' => $mulaiAt,
                'deadline_resolusi' => $now->copy()->addMinutes(2),
                'terlambat_resolusi' => false,
                'pelaksana' => 'Petugas',
            ]);

            $this->command->info("  [A] {$report->report_code}: deadline_resolusi = {$report->deadline_resolusi}");
        }

        // ── Group B: 3 laporan baru, deadline 1 menit (trigger overdue) ──
        for ($i = 3; $i < 6; $i++) {
            $mulaiAt = $now->copy()->subDays(rand(1, 3));
            $ditugaskanAt = $mulaiAt->copy()->subDays(rand(1, 2));
            $code = 'LP-'.date('Y').'-'.str_pad($nextNumber++, 5, '0', STR_PAD_LEFT);

            $report = Report::create([
                'report_code' => $code,
                'user_id' => $petugas->id,
                'reporter_name' => 'Agus Setiawan',
                'road_name' => $roadNames[$i],
                'district' => $districts[$i - 3],
                'latitude' => -7.45 + (rand(-50, 50) / 1000),
                'longitude' => 112.71 + (rand(-50, 50) / 1000),
                'koordinat_sumber' => 'browser_gps',
                'status' => 'Sedang Diperbaiki',
                'priority' => 'Tinggi',
                'overall_severity' => 'Rusak Berat',
                'ai_severity' => 'berat',
                'ai_jenis_kerusakan' => 'Lubang',
                'kerusakan_panjang' => rand(10, 50) / 10,
                'kerusakan_lebar' => rand(5, 30) / 10,
                'catatan_petugas' => 'Laporan test deadline Group B',
                'deadline_review' => $now->copy()->subHours(rand(1, 48)),
                'terlambat_review' => true,
                'assigned_team_id' => $teamId,
                'assigned_at' => $ditugaskanAt,
                'ditugaskan_at' => $ditugaskanAt,
                'perbaikan_dimulai_at' => $mulaiAt,
                'deadline_resolusi' => $now->copy()->addMinutes(2),
                'terlambat_resolusi' => false,
                'pelaksana' => 'Petugas',
            ]);

            $this->command->info("  [B] {$report->report_code}: deadline_resolusi = {$report->deadline_resolusi}");
        }

        // ── Jadwal pengecekan ──
        $t2 = $now->copy()->addMinutes(2);

        $this->command->info('');
        $this->command->warn('═══════════════════════════════════════════════════════');
        $this->command->warn('               JADWAL PENGECEKAN DEADLINE               ');
        $this->command->warn('═══════════════════════════════════════════════════════');
        $this->command->info(" Waktu seed         : {$now->format('Y-m-d H:i:s')}");
        $this->command->warn('───────────────────────────────────────────────────────');
        $this->command->warn(' 1. SEGERA (seed + 0)');
        $this->command->info('    -> php artisan deadline:check');
        $this->command->info('    -> Warnings: 6 (semua dalam window 2 menit)');
        $this->command->info('    -> Notif FCM + database terkirim untuk 6 laporan');
        $this->command->warn('───────────────────────────────────────────────────────');
        $this->command->warn(" 2. {$t2->format('Y-m-d H:i:s')}  (seed + 2 menit)");
        $this->command->info('    -> php artisan deadline:check');
        $this->command->info('    -> Resolusi: 6 (semua overdue)');
        $this->command->info('    -> Buka halaman detail report -> badge Terlambat');
        $this->command->warn('───────────────────────────────────────────────────────');
        $this->command->warn(' Catatan:');
        $this->command->warn(' - Warnings menurun tiap run karena dedup via notifikasi.');
        $this->command->warn(' - Untuk reset, hapus notifikasi PeringatanMendekatiDeadline');
        $this->command->warn('   dari tabel notifications, lalu seed ulang.');
        $this->command->warn('═══════════════════════════════════════════════════════');
    }
}
