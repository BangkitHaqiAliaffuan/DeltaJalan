<?php

namespace App\Console\Commands;

use App\Models\Report;
use App\Models\StatusLog;
use Illuminate\Console\Command;

class BackfillStatusLogs extends Command
{
    protected $signature = 'jalan-kita:backfill-status-logs';

    protected $description = 'Backfill status_logs from existing system_notes and timestamps';

    private const MARKER_MAP = [
        '[APPROVED]' => ['new_status' => 'Disetujui'],
        '[BULK APPROVE]' => ['new_status' => 'Disetujui'],
        '[REJECTED]' => ['new_status' => 'Ditolak'],
        '[BULK TOLAK]' => ['new_status' => 'Ditolak'],
        '[DISPOSISI]' => ['new_status' => 'Sedang Diperbaiki'],
        '[MULAI]' => ['new_status' => 'Sedang Diperbaiki'],
        '[SELESAI]' => ['new_status' => 'Selesai'],
        '[REOPEN]' => ['new_status' => 'Menunggu Review'],
        '[ASSIGN]' => ['new_status' => null],
        '[TRIAGE]' => ['new_status' => null],
    ];

    public function handle(): int
    {
        $reports = Report::whereDoesntHave('statusLogs')->get();
        $bar = $this->output->createProgressBar($reports->count());
        $bar->start();

        $created = 0;

        foreach ($reports as $report) {
            // 1. Event awal: laporan dibuat
            StatusLog::create([
                'report_id' => $report->id,
                'old_status' => null,
                'new_status' => $report->getOriginal('status') ?? 'Menunggu Review',
                'actor_name' => $report->reporter_name,
                'actor_role' => 'petugas',
                'notes' => 'Laporan dibuat',
                'created_at' => $report->created_at,
            ]);
            $created++;

            // 2. Parse system_notes
            $notes = $report->system_notes;
            if ($notes) {
                $segments = explode('|', $notes);
                foreach ($segments as $segment) {
                    $segment = trim($segment);
                    if ($segment === '') {
                        continue;
                    }

                    $matchedKey = null;
                    foreach (self::MARKER_MAP as $marker => $_) {
                        if (str_starts_with($segment, $marker)) {
                            $matchedKey = $marker;
                            break;
                        }
                    }

                    if (! $matchedKey) {
                        continue;
                    }

                    $map = self::MARKER_MAP[$matchedKey];
                    $newStatus = $map['new_status'];
                    $content = trim(substr($segment, strlen($matchedKey)));

                    // Extract actor name from "oleh {name}" pattern
                    $actorName = null;
                    $cleanNotes = $content;
                    if (preg_match('/oleh\s+(.+)$/', $content, $m)) {
                        $actorName = trim($m[1]);
                        $cleanNotes = trim(substr($content, 0, -(strlen($m[0]))));
                    }

                    // If new_status is null, this is a non-status event (ASSIGN, TRIAGE)
                    // We still log it for reference
                    StatusLog::create([
                        'report_id' => $report->id,
                        'old_status' => null,
                        'new_status' => $newStatus ?? $report->status,
                        'actor_name' => $actorName,
                        'actor_role' => null,
                        'notes' => $cleanNotes ?: $segment,
                        'created_at' => $report->updated_at,
                    ]);
                    $created++;
                }
            }

            // 3. Event perbaikan dimulai
            if ($report->perbaikan_dimulai_at) {
                StatusLog::create([
                    'report_id' => $report->id,
                    'old_status' => null,
                    'new_status' => 'Sedang Diperbaiki',
                    'actor_name' => $report->pelaksana,
                    'actor_role' => 'petugas',
                    'notes' => 'Perbaikan dimulai',
                    'created_at' => $report->perbaikan_dimulai_at,
                ]);
                $created++;
            }

            // 4. Event perbaikan selesai
            if ($report->perbaikan_selesai_at) {
                StatusLog::create([
                    'report_id' => $report->id,
                    'old_status' => null,
                    'new_status' => 'Selesai',
                    'actor_name' => $report->pelaksana,
                    'actor_role' => 'petugas',
                    'notes' => $report->catatan_petugas ? "Perbaikan selesai. Catatan: {$report->catatan_petugas}" : 'Perbaikan selesai',
                    'created_at' => $report->perbaikan_selesai_at,
                ]);
                $created++;
            }

            $bar->advance();
        }

        $bar->finish();
        $this->newLine();
        $this->info("Backfill selesai. {$created} log entries created for {$reports->count()} reports.");

        return Command::SUCCESS;
    }
}
