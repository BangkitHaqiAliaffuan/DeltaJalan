<?php

namespace App\Console\Commands;

use App\Models\Report;
use App\Models\User;
use App\Notifications\PeringatanMendekatiDeadline;
use App\Notifications\PeringatanTerlambat;
use Illuminate\Console\Command;
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

        // ── 1. Cek deadline Review Terlambat ──────────────────────────────
        $reports = Report::whereNull('deadline_review', 'and', false)
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
        $reports = Report::whereNull('deadline_resolusi', 'and', false)
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

        // ── 3. Kirim Warning untuk deadline mendekat ──────────────────────
        $priorities = ['Tinggi', 'Sedang', 'Rendah'];
        foreach ($priorities as $priority) {
            $warningHours = (int) config("deadline.{$priority}.warning_hours_before", 24);
            $windowStart = $now->copy()->addHours($warningHours - 1);
            $windowEnd = $now->copy()->addHours($warningHours);

            $reports = Report::where('priority', $priority)
                ->where('deadline_review', '>=', $now)
                ->where('deadline_review', '>=', $windowStart)
                ->where('deadline_review', '<=', $windowEnd)
                ->where('terlambat_review', false)
                ->whereNotIn('status', ['Selesai', 'Ditolak', 'Disetujui', 'Sedang Diperbaiki'])
                ->get();

            foreach ($reports as $report) {
                $supervisors = User::where('role', 'supervisor')->get();
                foreach ($supervisors as $supervisor) {
                    $supervisor->notify(new PeringatanMendekatiDeadline($report, 'review'));
                }
                $warningsSent++;
            }
        }

        Log::info('DeltaJalan Deadline Check selesai.', [
            'terlambat_review' => $terlambatReview,
            'terlambat_resolusi' => $terlambatResolusi,
            'warnings_sent' => $warningsSent,
        ]);

        $this->info("Deadline Check selesai. Review terlambat: {$terlambatReview}, Resolusi terlambat: {$terlambatResolusi}, Warnings: {$warningsSent}");
    }
}
