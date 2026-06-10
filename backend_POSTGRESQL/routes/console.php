<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Deadline Check — jalankan setiap jam untuk update terlambat flags & kirim notifikasi
Schedule::command('deadline:check')->hourly();
