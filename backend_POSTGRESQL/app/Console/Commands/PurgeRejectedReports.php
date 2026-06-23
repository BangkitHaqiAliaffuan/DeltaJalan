<?php

namespace App\Console\Commands;

use App\Models\Report;
use App\Models\ReportPhoto;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class PurgeRejectedReports extends Command
{
    protected $signature = 'jalan-kita:purge-rejected-reports
                            {--dry-run : Lihat laporan yang akan dihapus tanpa benar-benar menghapus}
                            {--days=3 : Batas hari sejak ditolak sebelum dihapus}';

    protected $description = 'Hapus laporan dengan status Ditolak yang sudah melebihi batas hari tertentu (default: 3 hari)';

    public function handle(): int
    {
        $days = (int) $this->option('days');
        $dryRun = (bool) $this->option('dry-run');
        $cutoff = Carbon::now()->subDays($days);

        $this->info("🔍 Mencari laporan Ditolak sebelum {$cutoff->toISOString()}...");

        $reports = Report::where('status', 'Ditolak')
            ->where('updated_at', '<', $cutoff)
            ->get();

        if ($reports->isEmpty()) {
            $this->info('✅ Tidak ada laporan Ditolak yang perlu dihapus.');

            return Command::SUCCESS;
        }

        $this->line("   Ditemukan {$reports->count()} laporan.");

        if ($dryRun) {
            $this->warn('── Dry-run mode ──');
            foreach ($reports as $r) {
                $this->line("   [{$r->report_code}] {$r->road_name} — {$r->district} (ditolak {$r->updated_at->diffForHumans()})");
            }
            $this->warn('── Tidak ada data yang dihapus (dry-run) ──');

            return Command::SUCCESS;
        }

        // ── 1. Kumpulkan file paths ────────────────────────────────────────────
        $paths = [];
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

        $reportIds = $reports->pluck('id')->toArray();
        $reportPhotos = ReportPhoto::whereIn('report_id', $reportIds)->get();

        foreach ($reportPhotos as $p) {
            if ($p->image_original_path) {
                $paths[] = $p->image_original_path;
            }
            if ($p->image_result_path) {
                $paths[] = $p->image_result_path;
            }
        }

        $paths = array_unique(array_filter($paths));
        $this->info('   File to delete: '.count($paths));

        // ── 2. Hapus file dari storage ─────────────────────────────────────────
        $publicDisk = Storage::disk('public');
        $deleted = 0;
        foreach ($paths as $path) {
            if ($publicDisk->exists($path)) {
                $publicDisk->delete($path);
                $deleted++;
            }
        }
        $this->info("   Files deleted: {$deleted}/".count($paths));

        // ── 3. Hapus notifikasi terkait ────────────────────────────────────────
        $notifCount = 0;
        foreach ($reportIds as $id) {
            $count = DB::table('notifications')
                ->where('data', 'like', '%"report_id":"'.$id.'"%')
                ->delete();
            $notifCount += $count;
        }
        $this->info("   Notifications deleted: {$notifCount}");

        // ── 4. Hapus report photos manually (pastikan data terhapus sebelum cascade) ──
        ReportPhoto::whereIn('report_id', $reportIds)->delete();

        // ── 5. Hapus reports (CASCADE ke status_logs, after_photos) ────────────
        Report::whereIn('id', $reportIds)->delete();

        // ── 6. Log ─────────────────────────────────────────────────────────────
        Log::info('DeltaJalan: Purged rejected reports.', [
            'count' => $reports->count(),
            'cutoff' => $cutoff->toISOString(),
            'files_deleted' => $deleted,
            'notifications_deleted' => $notifCount,
            'report_ids' => $reportIds,
        ]);

        $this->newLine();
        $this->info("✅ Selesai! {$reports->count()} laporan Ditolak telah dihapus.");

        return Command::SUCCESS;
    }
}
