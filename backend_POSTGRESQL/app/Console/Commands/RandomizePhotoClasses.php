<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class RandomizePhotoClasses extends Command
{
    protected $signature = 'photo:randomize-classes
        {--dry-run : Preview changes without writing to DB}';

    protected $description = 'Randomize damage classes per photo so each photo has mixed damage types';

    private const CLASSES = ['Lubang', 'Retak Kulit Buaya', 'Retak Memanjang', 'Retak Melintang'];

    public function handle(): int
    {
        $dryRun = $this->option('dry-run');
        $label = $dryRun ? '[DRY-RUN]' : '[UPDATE]';

        $this->info("$label Randomizing detection classes in report_photos...");

        $rows = DB::table('report_photos')
            ->whereNotNull('ai_raw_output')
            ->where('ai_raw_output', '!=', '[]')
            ->whereRaw("ai_raw_output::text != 'null'")
            ->orderBy('id')
            ->select('id', 'ai_raw_output', 'ai_severity')
            ->get();

        if ($rows->isEmpty()) {
            $this->warn("$label No photos with ai_raw_output found.");

            return 0;
        }

        $this->info("$label Found {$rows->count()} photos to process.");
        $this->newLine();

        $updated = 0;
        $errors = 0;
        $totalDetections = 0;

        $bar = $this->output->createProgressBar($rows->count());
        $bar->start();

        foreach ($rows as $row) {
            try {
                $decoded = json_decode($row->ai_raw_output, true);
                if (is_string($decoded)) {
                    $decoded = json_decode($decoded, true);
                }
                if (! is_array($decoded)) {
                    $errors++;
                    $bar->advance();

                    continue;
                }

                $detections = $decoded['detections'] ?? $decoded;
                if (! is_array($detections) || empty($detections)) {
                    $errors++;
                    $bar->advance();

                    continue;
                }

                $count = count($detections);
                $shuffled = self::CLASSES;
                shuffle($shuffled);

                foreach ($detections as $i => &$det) {
                    if (! is_array($det)) {
                        continue;
                    }
                    $det['class'] = $shuffled[$i % count($shuffled)];
                }
                unset($det);

                if (isset($decoded['detections'])) {
                    $decoded['detections'] = $detections;
                } else {
                    $decoded = $detections;
                }

                $totalDetections += $count;

                if (! $dryRun) {
                    DB::table('report_photos')
                        ->where('id', $row->id)
                        ->update(['ai_raw_output' => json_encode($decoded)]);
                }

                $updated++;
            } catch (\Throwable $e) {
                $errors++;
                $this->warn("\n$label Error on photo {$row->id}: {$e->getMessage()}");
            }

            $bar->advance();
        }

        $bar->finish();
        $this->newLine(2);

        $this->info('═══════════════════════════════════════');
        $this->info("  $label Randomize Classes Complete");
        $this->info('───────────────────────────────────────');
        $this->info("  Photos processed : {$rows->count()}");
        $this->info("  Photos updated   : {$updated}");
        $this->info("  Detections mixed : {$totalDetections}");
        $this->info("  Errors           : {$errors}");
        $this->info('═══════════════════════════════════════');

        return 0;
    }
}
