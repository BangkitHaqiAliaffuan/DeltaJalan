<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class PurgeReports extends Command
{
    protected $signature = 'jalan-kita:purge-reports';

    protected $description = 'Hapus semua data laporan (reports, photos, status_logs, notifications) dan file storage';

    public function handle(): int
    {
        if (! $this->confirm('⚠️  Yakin ingin menghapus SEMUA data laporan? Tindakan ini TIDAK bisa dibatalkan.')) {
            $this->info('Dibatalkan.');

            return Command::SUCCESS;
        }

        $this->info('🗑️  Purging all report data...');

        // ── 1. Count before ────────────────────────────────────────────────
        $reportCount = DB::table('reports')->count();
        $photoCount = DB::table('report_photos')->count();
        $logCount = DB::table('status_logs')->count();
        $notifCount = DB::table('notifications')
            ->where('data', 'like', '%"report_id":"%')
            ->count();

        $this->info("   Found: {$reportCount} reports, {$photoCount} photos, {$logCount} status_logs, {$notifCount} notifications");

        // ── 2. Collect file paths before deletion ──────────────────────────
        $paths = [];
        $reports = DB::table('reports')->get();
        $photos = DB::table('report_photos')->get();

        foreach ($reports as $r) {
            if ($r->image_original_path) {
                $paths[] = $r->image_original_path;
            }
            if ($r->image_result_path) {
                $paths[] = $r->image_result_path;
            }
            if ($r->after_photo_path) {
                $paths[] = $r->after_photo_path;
            }
        }
        foreach ($photos as $p) {
            if ($p->image_original_path) {
                $paths[] = $p->image_original_path;
            }
            if ($p->image_result_path) {
                $paths[] = $p->image_result_path;
            }
        }
        $paths = array_unique(array_filter($paths));

        // ── 3. Delete notifications ────────────────────────────────────────
        $this->info('   Deleting notifications...');
        DB::table('notifications')
            ->where('data', 'like', '%"report_id":"%')
            ->delete();

        // ── 4. Delete reports (CASCADE ke report_photos & status_logs) ─────
        $this->info('   Deleting reports (CASCADE)...');
        DB::table('reports')->delete();

        // ── 5. Delete files from storage ───────────────────────────────────
        $this->info('   Deleting '.count($paths).' files from storage...');
        $publicDisk = Storage::disk('public');
        $deleted = 0;
        foreach ($paths as $path) {
            if ($publicDisk->exists($path)) {
                $publicDisk->delete($path);
                $deleted++;
            }
        }

        // ── 6. Verify ──────────────────────────────────────────────────────
        $remainingReports = DB::table('reports')->count();
        $remainingPhotos = DB::table('report_photos')->count();
        $remainingLogs = DB::table('status_logs')->count();
        $remainingNotifs = DB::table('notifications')
            ->where('data', 'like', '%"report_id":"%')
            ->count();

        $this->newLine();
        $this->info('✅ Purge complete!');
        $this->info("   Reports:       {$reportCount} → {$remainingReports}");
        $this->info("   Photos:        {$photoCount} → {$remainingPhotos}");
        $this->info("   Status Logs:   {$logCount} → {$remainingLogs}");
        $this->info("   Notifications: {$notifCount} → {$remainingNotifs}");
        $this->info("   Files deleted: {$deleted}/".count($paths));

        return Command::SUCCESS;
    }
}
