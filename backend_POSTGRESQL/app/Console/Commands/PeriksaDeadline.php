<?php

namespace App\Console\Commands;

use App\Models\Report;
use App\Models\User;
use App\Notifications\PeringatanMendekatiDeadline;
use App\Notifications\PeringatanTerlambat;
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
        $terlambatMulai = 0;
        $warningsSent = 0;

        // ── 1. Cek deadline Review Terlambat ──────────────────────────────
        $reports = Report::whereNotNull('deadline_review')
            ->where('deadline_review', '<', $now)
            ->where('terlambat_review', false)
            ->whereNotIn('status', ['Selesai', 'Ditolak'])
            ->get();

        foreach ($reports as $report) {
            $report->update(['terlambat_review' => true]);

            // Notifikasi ke semua supervisor
            $supervisors = User::where('role', 'supervisor')->get();
            foreach ($supervisors as $supervisor) {
                $supervisor->notify(new PeringatanTerlambat($report, 'review'));
            }

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

        // ── 3. Cek deadline Mulai Terlambat (Ditugaskan tapi belum Mulai) ─
        $reports = Report::where('status', 'Ditugaskan')
            ->whereNotNull('deadline_mulai')
            ->where('deadline_mulai', '<', $now)
            ->where('terlambat_mulai', false)
            ->get();

        foreach ($reports as $report) {
            $report->update(['terlambat_mulai' => true]);

            $supervisors = User::where('role', 'supervisor')->get();
            foreach ($supervisors as $supervisor) {
                $supervisor->notify(new PeringatanTerlambat($report, 'mulai'));
            }
            if ($report->assigned_team_id) {
                $tim = User::where('role', 'petugas')
                    ->where('team_id', $report->assigned_team_id)
                    ->get();
                foreach ($tim as $user) {
                    $user->notify(new PeringatanTerlambat($report, 'mulai'));
                }
            }

            $terlambatMulai++;
        }

        // ── 4. Kirim Warning untuk deadline mendekat ──────────────────────

        // Kumpulkan warning yg sudah dikirim untuk dedup (tanpa kolom baru)
        $sent = DB::table('notifications')
            ->where('type', PeringatanMendekatiDeadline::class)
            ->get(['data'])
            ->mapWithKeys(function ($n) {
                $d = json_decode($n->data, true);
                $key = ($d['report_id'] ?? '') . '_' . ($d['deadline_type'] ?? '');
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
                if ($sent->has($report->id . '_review')) continue;
                User::where('role', 'supervisor')->get()->each->notify(
                    new PeringatanMendekatiDeadline($report, 'review')
                );
                $warningsSent++;
            }

            // ── Warning deadline_mulai (kirim ke supervisor + petugas) ──
            $reports = Report::where('priority', $priority)
                ->where('status', 'Ditugaskan')
                ->whereNotNull('deadline_mulai')
                ->where('deadline_mulai', '>', $now)
                ->where('deadline_mulai', '<=', $windowEnd)
                ->where('terlambat_mulai', false)
                ->get();

            foreach ($reports as $report) {
                if ($sent->has($report->id . '_mulai')) continue;
                User::where('role', 'supervisor')->get()->each->notify(
                    new PeringatanMendekatiDeadline($report, 'mulai')
                );
                if ($report->assigned_team_id) {
                    User::where('role', 'petugas')
                        ->where('team_id', $report->assigned_team_id)
                        ->get()
                        ->each->notify(new PeringatanMendekatiDeadline($report, 'mulai'));
                }
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
                if ($sent->has($report->id . '_resolution')) continue;
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
            'terlambat_mulai' => $terlambatMulai,
            'warnings_sent' => $warningsSent,
        ]);

        $this->info("Deadline Check selesai. Review: {$terlambatReview}, Resolusi: {$terlambatResolusi}, Mulai: {$terlambatMulai}, Warnings: {$warningsSent}");
    }
}
