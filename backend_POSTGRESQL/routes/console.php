<?php

use App\Models\BatchAnalysis;
use App\Models\WorkerLocation;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schedule;
use Illuminate\Support\Facades\Storage;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Deadline Check — jalankan setiap jam untuk update terlambat flags & kirim notifikasi
Schedule::command('deadline:check')->hourly();

// GPS Reminder — kirim notifikasi FCM ke petugas eksekusi setiap hari jam kerja
Schedule::command('gps:reminder start')->dailyAt('07:15');
Schedule::command('gps:reminder stop')->dailyAt('16:15');

// Hapus data lokasi worker yang lebih dari 30 hari (setiap tengah malam)
Schedule::call(function () {
    $deleted = WorkerLocation::where('tracked_at', '<', now()->subDays(30))->delete();
    Log::info("WorkerLocation: purged {$deleted} old records (>30 days).");
})->dailyAt('00:00');

// Hapus laporan Ditolak yang sudah > N hari (default 3)
Schedule::command('jalan-kita:purge-rejected-reports')->dailyAt('02:00');

// Generate patrol tasks setiap jam 06:00 untuk 3 hari ke depan — petugas selalu punya task H-3
Schedule::command('patrol:generate-tasks --days=3')->dailyAt('06:00');

// Patrol reminder jam 09:00 — beri tahu petugas jadwal patroli hari ini
Schedule::command('patrol:reminder-morning')->dailyAt('09:00');

// Patrol reminder jam 16:00 — ingatkan menyelesaikan laporan patrol hari ini
Schedule::command('patrol:reminder-evening')->dailyAt('16:00');

// Rekalkulasi PCI setiap jam — update laporan yang AI-nya selesai diproses via queue
Schedule::command('pci:recalculate')->hourly();

// Hapus analisis batch sementara yang tidak pernah disimpan menjadi laporan (>24 jam)
Schedule::call(function () {
    $expired = BatchAnalysis::where('created_at', '<', now()->subHours(24))->pluck('batch_id');
    if ($expired->isNotEmpty()) {
        foreach ($expired as $batchId) {
            Storage::disk('local')->deleteDirectory('batch-tmp/'.$batchId);
        }
        $deleted = BatchAnalysis::whereIn('batch_id', $expired)->delete();
        Log::info("BatchAnalysis: purged {$deleted} expired records (>24 jam).");
    }
})->hourly();
