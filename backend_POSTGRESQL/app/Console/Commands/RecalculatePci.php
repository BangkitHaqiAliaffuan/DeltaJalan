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

        // Laporan yang punya ai_raw_output di reports (single & batch baru)
        // ATAU laporan batch lama yang deteksi AI-nya hanya ada di report_photos.
        $query = Report::query()
            ->where(function ($q) {
                $q->whereNotNull('ai_raw_output')
                    ->where('total_detections', '>', 0);
            })
            ->orWhereHas('photos', function ($q) {
                $q->whereNotNull('ai_raw_output');
            });

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

        $query->with('photos')->chunk(100, function ($reports) use ($pciService, &$updated, &$skipped, $bar) {
            foreach ($reports as $report) {
                // Backfill: laporan batch lama tidak punya ai_raw_output di
                // reports — agregasi dari report_photos dulu.
                if (empty($report->ai_raw_output)) {
                    $aggregated = $report->aggregateAiRawFromPhotos();
                    if ($aggregated === null) {
                        $skipped++;
                        $bar->advance();

                        continue;
                    }
                    $report->ai_raw_output = $aggregated;
                    $report->total_detections = count($aggregated);
                }

                $pciScore = $pciService->calculateFromReport($report);
                if ($pciScore !== null) {
                    $report->updateQuietly([
                        'ai_raw_output' => $report->ai_raw_output,
                        'total_detections' => $report->total_detections,
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
