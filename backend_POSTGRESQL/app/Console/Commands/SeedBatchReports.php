<?php

namespace App\Console\Commands;

use App\Models\Report;
use App\Models\ReportPhoto;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class SeedBatchReports extends Command
{
    protected $signature = 'reports:seed-batch
                           {--fix-gps : Recalculate GPS for existing batch photos within 10m radius}';

    protected $description = 'Convert 50% of single reports to batch reports with extra photos';

    public function handle(): int
    {
        if ($this->option('fix-gps')) {
            return $this->fixGps();
        }

        $reports = Report::withCount('photos')->orderBy('report_code')->get();

        $multiPhoto = $reports->filter(fn($r) => $r->photos_count > 1 && !$r->batch_id);
        $single = $reports->filter(fn($r) => $r->photos_count == 1);

        $targetTotal = (int) ceil($reports->count() * 0.5);
        $this->info("Total reports: {$reports->count()}, target batch: {$targetTotal}");

        $processed = 0;

        foreach ($multiPhoto as $report) {
            $report->update([
                'batch_id' => (string) Str::uuid(),
                'image_original_path' => null,
            ]);
            $this->fixPhotosGps($report);
            $this->line("  [BATCH] {$report->report_code}: batch_id set (was multi-photo)");
            $processed++;
        }
        $this->info("Phase 1: {$multiPhoto->count()} multi-photo reports flagged as batch.");

        $needed = $targetTotal - $processed;
        if ($needed <= 0) {
            $this->info("Target already reached. No single reports need conversion.");
            return Command::SUCCESS;
        }

        $toConvert = $single->shuffle()->take($needed);
        $disk = Storage::disk('public');
        $existingFiles = collect($disk->files('reports'))->filter(fn($f) => str_ends_with($f, '.jpg'));

        if ($existingFiles->isEmpty()) {
            $this->error("No existing images found in storage/app/public/reports/");
            return Command::FAILURE;
        }

        $bar = $this->output->createProgressBar($toConvert->count());
        $bar->start();

        foreach ($toConvert as $report) {
            $batchId = (string) Str::uuid();

            $report->update([
                'batch_id' => $batchId,
                'image_original_path' => null,
            ]);

            $this->fixPhotosGps($report);

            $extraCount = rand(2, 4);
            $currentOrder = $report->photos()->max('sort_order') ?? 0;

            for ($j = 0; $j < $extraCount; $j++) {
                $sourceFile = $existingFiles->random();
                $sourcePath = $disk->path($sourceFile);
                $newFilename = Str::uuid() . '.jpg';
                $newPath = 'reports/' . $newFilename;

                if (file_exists($sourcePath)) {
                    $disk->put($newPath, file_get_contents($sourcePath));
                } else {
                    $img = imagecreatetruecolor(400, 300);
                    $bg = imagecolorallocate($img, rand(100, 200), rand(100, 200), rand(100, 200));
                    imagefill($img, 0, 0, $bg);
                    ob_start();
                    imagejpeg($img, null, 80);
                    $disk->put($newPath, ob_get_clean());
                    imagedestroy($img);
                }

                [$photoLat, $photoLng] = $this->nearbyGps(
                    $report->latitude,
                    $report->longitude,
                    5
                );

                ReportPhoto::create([
                    'report_id' => $report->id,
                    'image_original_path' => $newPath,
                    'image_hash' => hash('sha256', $batchId . $j . Str::random(8)),
                    'latitude' => $photoLat,
                    'longitude' => $photoLng,
                    'koordinat_sumber' => 'exif',
                    'sort_order' => $currentOrder + $j + 1,
                    'original_filename' => "batch_{$j}.jpg",
                    'created_at' => $report->created_at,
                    'updated_at' => $report->created_at,
                ]);
            }

            $bar->advance();
        }

        $bar->finish();
        $this->newLine();

        $finalBatchCount = Report::whereNotNull('batch_id')->count();
        $this->info("Done! {$processed} multi-photo + {$toConvert->count()} single = {$finalBatchCount} batch reports now.");

        return Command::SUCCESS;
    }

    private function fixGps(): int
    {
        $batchReports = Report::with('photos')->whereNotNull('batch_id')->get();
        $bar = $this->output->createProgressBar($batchReports->count());
        $bar->start();

        foreach ($batchReports as $report) {
            $this->fixPhotosGps($report);
            $bar->advance();
        }

        $bar->finish();
        $this->newLine();
        $this->info("GPS fixed for {$batchReports->count()} batch reports.");

        return Command::SUCCESS;
    }

    private function fixPhotosGps(Report $report): void
    {
        foreach ($report->photos as $photo) {
            [$lat, $lng] = $this->nearbyGps(
                $report->latitude,
                $report->longitude,
                5
            );
            $photo->update([
                'latitude' => $lat,
                'longitude' => $lng,
            ]);
        }
    }

    private function nearbyGps(float $centerLat, float $centerLng, float $maxMeters): array
    {
        $latPerMeter = 1.0 / 111320.0;
        $lngPerMeter = 1.0 / (111320.0 * cos(deg2rad($centerLat)));

        $angle = deg2rad(rand(0, 360));
        $dist = mt_rand() / mt_getrandmax() * $maxMeters;

        $dLat = cos($angle) * $dist * $latPerMeter;
        $dLng = sin($angle) * $dist * $lngPerMeter;

        return [
            round($centerLat + $dLat, 8),
            round($centerLng + $dLng, 8),
        ];
    }
}
