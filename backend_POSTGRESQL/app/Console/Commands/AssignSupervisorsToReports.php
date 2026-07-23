<?php

namespace App\Console\Commands;

use App\Models\Report;
use App\Services\SupervisorRouterService;
use Illuminate\Console\Command;

class AssignSupervisorsToReports extends Command
{
    protected $signature = 'reports:assign-supervisors
        {--chunk=100 : Jumlah laporan per batch}
        {--source=* : Filter sumber laporan (warga, telegram, petugas). Default: semua}';

    protected $description = 'Backfill assigned_supervisor_id untuk semua report yang belum di-assign';

    public function handle(SupervisorRouterService $router): int
    {
        $sources = $this->option('source');
        $chunkSize = (int) $this->option('chunk');

        $query = Report::whereNull('assigned_supervisor_id');

        if (! empty($sources)) {
            $query->whereIn('source', $sources);
        }

        $total = (clone $query)->count();

        if ($total === 0) {
            $this->info('Tidak ada laporan yang perlu di-assign.');

            return Command::SUCCESS;
        }

        $this->info("Memproses {$total} laporan...");
        $bar = $this->output->createProgressBar($total);
        $bar->start();

        $assigned = 0;
        $skipped = 0;

        $query->chunk($chunkSize, function ($reports) use ($router, &$assigned, &$skipped, $bar) {
            foreach ($reports as $report) {
                if (empty($report->district)) {
                    $skipped++;
                    $bar->advance();

                    continue;
                }

                $router->assignReport($report);

                if ($report->assigned_supervisor_id) {
                    $assigned++;
                } else {
                    $skipped++;
                }

                $bar->advance();
            }
        });

        $bar->finish();
        $this->newLine();
        $this->info("✅ {$assigned} laporan berhasil di-assign, {$skipped} dilewati (tidak ada supervisor untuk kecamatan tersebut).");

        return Command::SUCCESS;
    }
}
