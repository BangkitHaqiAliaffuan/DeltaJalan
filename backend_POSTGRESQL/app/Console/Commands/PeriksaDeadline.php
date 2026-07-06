<?php

namespace App\Console\Commands;

use App\Models\Report;
use App\Models\User;
use App\Notifications\PeringatanMendekatiDeadline;
use App\Notifications\PeringatanTerlambat;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class PeriksaDeadline extends Command
{
    protected $signature = 'deadline:check';

    protected $description = 'Check deadlines and mark terlambat flags, send notifications';

    public function handle(): void
    {
        $this->info('Checking deadlines...');
        $now = now();
        $terlambatReview = 0;
        $terlambatResolusi = 0;
        $warningsSent = 0;
        $newlyFlaggedReviewIds = [];
        $newlyFlaggedResolusiIds = [];

        // ── 1. Cek deadline Review Terlambat ──────────────────────────────
        $reports = Report::whereNotNull('deadline_review')
            ->where('deadline_review', '<', $now)
            ->where('terlambat_review', false)
            ->whereNotIn('status', ['Selesai', 'Ditolak'])
            ->get();

        foreach ($reports as $report) {
            $report->update(['terlambat_review' => true]);
            $newlyFlaggedReviewIds[] = $report->id;

            // Notifikasi ke semua supervisor
            $supervisors = User::where('role', 'supervisor')->get();
            foreach ($supervisors as $supervisor) {
                $supervisor->notify(new PeringatanTerlambat($report, 'review'));
            }

            $terlambatReview++;
        }

        // ── 1b. Kirim ulang notifikasi terlambat review (setiap jam) ──────
        $reports = Report::whereNotNull('deadline_review')
            ->where('deadline_review', '<', $now)
            ->where('terlambat_review', true)
            ->whereNotIn('id', $newlyFlaggedReviewIds)
            ->whereNotIn('status', ['Selesai', 'Ditolak'])
            ->get();

        foreach ($reports as $report) {
            User::where('role', 'supervisor')->get()->each->notify(
                new PeringatanTerlambat($report, 'review')
            );
            $terlambatReview++;
        }

        // ── 2. Cek deadline Resolusi Terlambat ────────────────────────────
        $reports = Report::whereNotNull('deadline_resolusi')
            ->where('deadline_resolusi', '<', $now)
            ->where('terlambat_resolusi', false)
            ->where('status', 'Sedang Diperbaiki')
            ->get();

        foreach ($reports as $report) {
            $report->update(['terlambat_resolusi' => true]);
            $newlyFlaggedResolusiIds[] = $report->id;

            // Notifikasi ke supervisor + petugas eksekusi yang ditugaskan
            $supervisors = User::where('role', 'supervisor')->get();
            foreach ($supervisors as $supervisor) {
                $supervisor->notify(new PeringatanTerlambat($report, 'resolution'));
            }
            if ($report->assigned_team_id) {
                $eksekusi = User::where('role', 'petugas')
                    ->where('team_id', $report->assigned_team_id)
                    ->get();
                foreach ($eksekusi as $user) {
                    $user->notify(new PeringatanTerlambat($report, 'resolution'));
                }
            }

            $terlambatResolusi++;
        }

        // ── 2b. Kirim ulang notifikasi terlambat resolusi (setiap jam) ────
        $reports = Report::whereNotNull('deadline_resolusi')
            ->where('deadline_resolusi', '<', $now)
            ->where('terlambat_resolusi', true)
            ->whereNotIn('id', $newlyFlaggedResolusiIds)
            ->where('status', 'Sedang Diperbaiki')
            ->get();

        foreach ($reports as $report) {
            User::where('role', 'supervisor')->get()->each->notify(
                new PeringatanTerlambat($report, 'resolution')
            );
            if ($report->assigned_team_id) {
                User::where('role', 'petugas')
                    ->where('team_id', $report->assigned_team_id)
                    ->get()
                    ->each->notify(new PeringatanTerlambat($report, 'resolution'));
            }
            $terlambatResolusi++;
        }

        // ── 4. Kirim Warning untuk deadline mendekat ──────────────────────

        // Kumpulkan warning yg sudah dikirim untuk dedup (tanpa kolom baru)
        $sent = DB::table('notifications')
            ->where('type', PeringatanMendekatiDeadline::class)
            ->get(['data'])
            ->mapWithKeys(function ($n) {
                $d = json_decode($n->data, true);
                $key = ($d['report_id'] ?? '').'_'.($d['deadline_type'] ?? '');

                return [$key => true];
            });

        $priorities = ['Tinggi', 'Sedang', 'Rendah'];
        foreach ($priorities as $priority) {
            $warningHours = (int) config("deadline.{$priority}.warning_hours_before", 24);
            $windowEnd = $now->copy()->addHours($warningHours);

            // ── Warning deadline_review (kirim ke supervisor) ──
            $reports = Report::where('priority', $priority)
                ->whereNotNull('deadline_review')
                ->where('deadline_review', '>', $now)
                ->where('deadline_review', '<=', $windowEnd)
                ->where('terlambat_review', false)
                ->whereNotIn('status', ['Selesai', 'Ditolak', 'Disetujui', 'Ditugaskan', 'Sedang Diperbaiki'])
                ->get();

            foreach ($reports as $report) {
                if ($sent->has($report->id.'_review')) {
                    continue;
                }
                User::where('role', 'supervisor')->get()->each->notify(
                    new PeringatanMendekatiDeadline($report, 'review')
                );
                $warningsSent++;
            }

            // ── Warning deadline_resolusi (kirim ke supervisor + petugas) ──
            $reports = Report::where('priority', $priority)
                ->where('status', 'Sedang Diperbaiki')
                ->whereNotNull('deadline_resolusi')
                ->where('deadline_resolusi', '>', $now)
                ->where('deadline_resolusi', '<=', $windowEnd)
                ->where('terlambat_resolusi', false)
                ->get();

            foreach ($reports as $report) {
                if ($sent->has($report->id.'_resolution')) {
                    continue;
                }
                User::where('role', 'supervisor')->get()->each->notify(
                    new PeringatanMendekatiDeadline($report, 'resolution')
                );
                if ($report->assigned_team_id) {
                    User::where('role', 'petugas')
                        ->where('team_id', $report->assigned_team_id)
                        ->get()
                        ->each->notify(new PeringatanMendekatiDeadline($report, 'resolution'));
                }
                $warningsSent++;
            }
        }

        Log::info('DeltaJalan Deadline Check selesai.', [
            'terlambat_review' => $terlambatReview,
            'terlambat_resolusi' => $terlambatResolusi,
            'warnings_sent' => $warningsSent,
        ]);

        $this->info("Deadline Check selesai. Review: {$terlambatReview}, Resolusi: {$terlambatResolusi}, Warnings: {$warningsSent}");

        $this->tampilkanJadwalWarning($now);
    }

    private function tampilkanJadwalWarning(Carbon $now): void
    {
        $priorities = ['Tinggi', 'Sedang', 'Rendah'];
        $rows = [];
        $earliestDeadline = null;

        foreach ($priorities as $priority) {
            $warningHours = (int) config("deadline.{$priority}.warning_hours_before", 24);

            // deadline_review
            $reports = Report::where('priority', $priority)
                ->whereNotNull('deadline_review')
                ->where('deadline_review', '>', $now)
                ->where('deadline_review', '<=', $now->copy()->addHours($warningHours))
                ->where('terlambat_review', false)
                ->whereNotIn('status', ['Selesai', 'Ditolak', 'Disetujui', 'Ditugaskan', 'Sedang Diperbaiki'])
                ->get(['report_code', 'deadline_review']);

            foreach ($reports as $r) {
                $sisa = $now->diffInHours($r->deadline_review, true);
                $menit = $now->diffInMinutes($r->deadline_review, true) % 60;
                $rows[] = [$r->report_code, 'Review', $priority, $r->deadline_review->format('H:i:s'), round($sisa).'j '.round($menit).'m'];
                if (! $earliestDeadline || $r->deadline_review < $earliestDeadline) {
                    $earliestDeadline = $r->deadline_review;
                }
            }

            // deadline_resolusi
            $reports = Report::where('priority', $priority)
                ->where('status', 'Sedang Diperbaiki')
                ->whereNotNull('deadline_resolusi')
                ->where('deadline_resolusi', '>', $now)
                ->where('deadline_resolusi', '<=', $now->copy()->addHours($warningHours))
                ->where('terlambat_resolusi', false)
                ->get(['report_code', 'deadline_resolusi']);

            foreach ($reports as $r) {
                $sisa = $now->diffInHours($r->deadline_resolusi, true);
                $menit = $now->diffInMinutes($r->deadline_resolusi, true) % 60;
                $rows[] = [$r->report_code, 'Resolusi', $priority, $r->deadline_resolusi->format('H:i:s'), round($sisa).'j '.round($menit).'m'];
                if (! $earliestDeadline || $r->deadline_resolusi < $earliestDeadline) {
                    $earliestDeadline = $r->deadline_resolusi;
                }
            }
        }

        $this->line('');
        $this->warn('=== JADWAL NOTIFIKASI WARNING (PeringatanMendekatiDeadline) ===');

        if (empty($rows)) {
            $this->info('Tidak ada laporan dalam window warning saat ini.');
            $this->info('Window warning per prioritas: Tinggi H-8, Sedang H-24, Rendah H-48.');
            $this->info('Jalankan php artisan deadline:check saat ada deadline mendekat untuk mendapat notifikasi.');
        } else {
            $this->table(['Laporan', 'Tipe', 'Prioritas', 'Deadline', 'Sisa Waktu'], $rows);
            $this->info("Notifikasi warning akan terkirim jika php artisan deadline:check dijalankan SEBELUM {$earliestDeadline->format('H:i:s')}.");
            $this->info('Command ini sudah terjadwal otomatis setiap jam melalui scheduler.');
        }

        $this->line('');
    }
}
