<?php

use App\Models\WorkerLocation;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schedule;

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
