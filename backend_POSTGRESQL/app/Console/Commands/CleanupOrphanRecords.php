<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class CleanupOrphanRecords extends Command
{
    protected $signature = 'jalan-kita:cleanup-orphans {--dry-run : Only count, do not delete}';

    protected $description = 'Hapus records orphan (user_id tidak ada di tabel users)';

    public function handle(): int
    {
        $dryRun = $this->option('dry-run');
        $label = $dryRun ? '[DRY-RUN] Akan dihapus' : 'Menghapus';

        // ── 1. Reports ─────────────────────────────────────────────────
        $orphanReports = DB::table('reports')
            ->leftJoin('users', 'reports.user_id', '=', 'users.id')
            ->whereNull('users.id')
            ->select('reports.id', 'reports.report_code', 'reports.user_id')
            ->get();

        $this->info("{$label} {$orphanReports->count()} orphan reports...");
        foreach ($orphanReports as $r) {
            $this->line("  Report #{$r->id} ({$r->report_code}) — user_id={$r->user_id}");
        }

        // ── 2. Report photos ───────────────────────────────────────────
        $orphanPhotos = DB::table('report_photos')
            ->leftJoin('reports', 'report_photos.report_id', '=', 'reports.id')
            ->whereNull('reports.id')
            ->select('report_photos.id', 'report_photos.report_id')
            ->get();

        $this->info("{$label} {$orphanPhotos->count()} orphan report_photos...");
        foreach ($orphanPhotos as $p) {
            $this->line("  Photo #{$p->id} — report_id={$p->report_id}");
        }

        // ── 3. Status logs ─────────────────────────────────────────────
        $orphanLogs = DB::table('status_logs')
            ->leftJoin('reports', 'status_logs.report_id', '=', 'reports.id')
            ->whereNull('reports.id')
            ->select('status_logs.id', 'status_logs.report_id')
            ->get();

        $this->info("{$label} {$orphanLogs->count()} orphan status_logs...");
        foreach ($orphanLogs as $l) {
            $this->line("  StatusLog #{$l->id} — report_id={$l->report_id}");
        }

        // ── 4. Notifications ───────────────────────────────────────────
        $orphanNotifs = DB::table('notifications')
            ->leftJoin('users', 'notifications.notifiable_id', '=', 'users.id')
            ->whereNull('users.id')
            ->select('notifications.id', 'notifications.notifiable_id')
            ->get();

        $this->info("{$label} {$orphanNotifs->count()} orphan notifications...");
        foreach ($orphanNotifs as $n) {
            $this->line("  Notification #{$n->id} — notifiable_id={$n->notifiable_id}");
        }

        $total = $orphanReports->count() + $orphanPhotos->count()
            + $orphanLogs->count() + $orphanNotifs->count();

        if ($total === 0) {
            $this->info('✅ Tidak ada orphan records.');
            return Command::SUCCESS;
        }

        if ($dryRun) {
            $this->warn("⚠️  {$total} orphan records ditemukan. Jalankan tanpa --dry-run untuk menghapus.");
            return Command::SUCCESS;
        }

        if (! $this->confirm("Yakin ingin menghapus {$total} orphan records?")) {
            $this->info('Dibatalkan.');
            return Command::SUCCESS;
        }

        // ── Execute deletes ────────────────────────────────────────────
        $deleted = 0;

        foreach ($orphanReports as $r) {
            DB::table('reports')->where('id', $r->id)->delete();
            $deleted++;
        }
        foreach ($orphanPhotos as $p) {
            DB::table('report_photos')->where('id', $p->id)->delete();
            $deleted++;
        }
        foreach ($orphanLogs as $l) {
            DB::table('status_logs')->where('id', $l->id)->delete();
            $deleted++;
        }
        foreach ($orphanNotifs as $n) {
            DB::table('notifications')->where('id', $n->id)->delete();
            $deleted++;
        }

        $this->info("✅ {$deleted} orphan records berhasil dihapus.");
        return Command::SUCCESS;
    }
}
