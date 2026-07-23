<?php

namespace App\Console\Commands;

use App\Models\Report;
use App\Services\PciService;
use Illuminate\Console\Command;

class RecalculatePci extends Command
{
    protected $signature = 'pci:recalculate
                           {--force : Hitung ulang semua laporan, termasuk yang sudah punya PCI}
                           {--report= : Hitung ulang untuk satu report_id tertentu}';

    protected $description = 'Hitung atau hitung ulang PCI score untuk laporan yang sudah ada';

    public function handle(): int
    {
        $pciService = app(PciService::class);
        $updated = 0;
        $skipped = 0;

        $query = Report::whereNotNull('ai_raw_output')
            ->where('total_detections', '>', 0);

        if ($reportId = $this->option('report')) {
            $query->where('id', $reportId);
        } elseif (! $this->option('force')) {
            $query->whereNull('pci_score');
        }

        $total = $query->count();
        if ($total === 0) {
            $this->info('Tidak ada laporan yang perlu dihitung ulang.');

            return 0;
        }

        $bar = $this->output->createProgressBar($total);
        $bar->start();

        $query->chunk(100, function ($reports) use ($pciService, &$updated, &$skipped, $bar) {
            foreach ($reports as $report) {
                $pciScore = $pciService->calculateFromReport($report);
                if ($pciScore !== null) {
                    $report->updateQuietly([
                        'pci_score' => $pciScore,
                        'pci_calculated_at' => now(),
                    ]);
                    $updated++;
                } else {
                    $skipped++;
                }
                $bar->advance();
            }
        });

        $bar->finish();
        $this->newLine();
        $this->info("Selesai: {$updated} laporan diperbarui, {$skipped} dilewati.");

        return 0;
    }
}
