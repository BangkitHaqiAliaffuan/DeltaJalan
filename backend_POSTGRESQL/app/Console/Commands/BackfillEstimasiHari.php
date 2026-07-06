<?php

namespace App\Console\Commands;

use App\Models\Report;
use Illuminate\Console\Command;

class BackfillEstimasiHari extends Command
{
    protected $signature = 'laporan:backfill-estimasi';

    protected $description = 'Backfill estimasi_hari untuk laporan existing berdasarkan status dan durasi aktual';

    public function handle(): int
    {
        $reports = Report::whereNull('estimasi_hari')->get();
        $bar = $this->output->createProgressBar($reports->count());
        $bar->start();

        $updated = 0;
        $skipped = 0;

        foreach ($reports as $report) {
            $estimasi = match (true) {
                // Selesai dengan timestamp → hitung durasi aktual
                $report->status === 'Selesai'
                    && $report->perbaikan_dimulai_at
                    && $report->perbaikan_selesai_at => max(1, (int) ceil(
                        $report->perbaikan_dimulai_at->diffInHours($report->perbaikan_selesai_at) / 24
                    )),

                // Sedang Diperbaiki → default konservatif
                $report->status === 'Sedang Diperbaiki' => 3,

                // Sisanya → null (belum mulai / tidak relevan)
                default => null,
            };

            if ($estimasi !== null) {
                $report->estimasi_hari = $estimasi;
                $report->save();
                $updated++;
            } else {
                $skipped++;
            }

            $bar->advance();
        }

        $bar->finish();
        $this->newLine();
        $this->info("✅ {$updated} laporan diperbarui, {$skipped} laporan dilewati (null).");

        return Command::SUCCESS;
    }
}
