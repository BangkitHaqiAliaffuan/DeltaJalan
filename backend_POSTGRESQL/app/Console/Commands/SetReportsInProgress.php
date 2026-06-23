<?php

namespace App\Console\Commands;

use App\Models\Report;
use Illuminate\Console\Command;

class SetReportsInProgress extends Command
{
    protected $signature = 'reports:set-in-progress';

    protected $description = 'Set 50% of existing reports status to Sedang Diperbaiki';

    public function handle(): int
    {
        $total = Report::count();
        $target = (int) ceil($total * 0.5);

        $this->info("Total laporan: {$total}, target: {$target}");

        $reports = Report::whereIn('status', ['Menunggu Review', 'Disetujui', 'Ditinjau'])
            ->inRandomOrder()
            ->limit($target)
            ->get();

        $count = 0;
        foreach ($reports as $report) {
            $report->update([
                'status' => 'Sedang Diperbaiki',
                'perbaikan_dimulai_at' => now(),
            ]);
            $count++;
        }

        $this->info("{$count} laporan diubah ke Sedang Diperbaiki.");

        return Command::SUCCESS;
    }
}
