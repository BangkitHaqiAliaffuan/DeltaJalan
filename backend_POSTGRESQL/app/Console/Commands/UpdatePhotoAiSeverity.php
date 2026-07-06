<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class UpdatePhotoAiSeverity extends Command
{
    protected $signature = 'photo:update-ai-severity
        {--dry-run : Preview changes without writing to DB}';

    protected $description = 'Fix double-encoded ai_raw_output and inject missing severity in report_photos';

    public function handle(): int
    {
        $dryRun = $this->option('dry-run');
        $label = $dryRun ? '[DRY-RUN]' : '[UPDATE]';

        $this->info("$label Scanning report_photos for ai_raw_output with missing severity...");

        $rows = DB::table('report_photos')
            ->whereNotNull('ai_raw_output')
            ->where('ai_raw_output', '!=', '[]')
            ->whereRaw("ai_raw_output::text != 'null'")
            ->select('id', 'ai_raw_output', 'ai_severity')
            ->get();

        if ($rows->isEmpty()) {
            $this->warn("$label No photos with ai_raw_output found.");

            return 0;
        }

        $this->info("$label Found {$rows->count()} photos to process.");
        $this->newLine();

        $updated = 0;
        $totalDetections = 0;
        $skipped = 0;
        $errors = 0;

        $bar = $this->output->createProgressBar($rows->count());
        $bar->start();

        foreach ($rows as $row) {
            try {
                $decoded = json_decode($row->ai_raw_output, true);

                if (is_string($decoded)) {
                    $decoded = json_decode($decoded, true);
                }

                if (! is_array($decoded)) {
                    $skipped++;
                    $bar->advance();

                    continue;
                }

                $detections = $decoded['detections'] ?? $decoded;
                if (! is_array($detections) || empty($detections)) {
                    $skipped++;
                    $bar->advance();

                    continue;
                }

                $changed = false;
                $photoDetectionsUpdated = 0;

                foreach ($detections as &$det) {
                    if (! is_array($det)) {
                        continue;
                    }
                    if (isset($det['severity']) && $det['severity'] !== null && $det['severity'] !== '') {
                        continue;
                    }
                    $det['severity'] = $this->resolveSeverity($row->ai_severity);
                    $changed = true;
                    $photoDetectionsUpdated++;
                }
                unset($det);

                if (! $changed) {
                    $skipped++;
                    $bar->advance();

                    continue;
                }

                if (isset($decoded['detections'])) {
                    $decoded['detections'] = $detections;
                } else {
                    $decoded = $detections;
                }

                $totalDetections += $photoDetectionsUpdated;

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
        $this->info("  $label Update AI Severity Complete");
        $this->info('───────────────────────────────────────');
        $this->info("  Total photos processed : {$rows->count()}");
        $this->info("  Photos updated         : {$updated}");
        $this->info("  Detections updated     : {$totalDetections}");
        $this->info("  Skipped (already has)  : {$skipped}");
        $this->info("  Errors                 : {$errors}");
        $this->info('═══════════════════════════════════════');

        return 0;
    }

    private function resolveSeverity(?string $photoSeverity): string
    {
        if ($photoSeverity && in_array($photoSeverity, ['ringan', 'sedang', 'berat'], true)) {
            return $photoSeverity;
        }

        $weights = ['ringan' => 5, 'sedang' => 3, 'berat' => 1];
        $rand = random_int(1, array_sum($weights));
        foreach ($weights as $s => $w) {
            $rand -= $w;
            if ($rand <= 0) {
                return $s;
            }
        }

        return 'ringan';
    }
}
