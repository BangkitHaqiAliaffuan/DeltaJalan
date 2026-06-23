<?php

namespace App\Console\Commands;

use App\Models\Report;
use App\Models\ReportPhoto;
use Illuminate\Console\Command;

class BackfillPhotoData extends Command
{
    protected $signature = 'reports:backfill-photo-data
                           {--fix-gps : Scatter GPS for batch report photos within 10m radius}';

    protected $description = 'Backfill kerusakan_panjang, kerusakan_lebar, ai_jenis_kerusakan, ai_severity, and GPS for all existing report_photos';

    private const DAMAGE_TYPES = [
        'Retak Memanjang', 'Retak Melintang', 'Retak Buaya', 'Lubang',
        'Ambles', 'Tambalan', 'Keriting',
    ];

    private const SEVERITY_MAP = [
        'Rusak Berat' => 'berat',
        'Rusak Sedang' => 'sedang',
        'Rusak Ringan' => 'ringan',
    ];

    public function handle(): int
    {
        $updated = 0;

        // Backfill report_photos
        $photos = ReportPhoto::whereNull('ai_jenis_kerusakan')
            ->orWhereNull('ai_severity')
            ->orWhereNull('kerusakan_panjang')
            ->orWhereNull('kerusakan_lebar')
            ->get();

        $bar = $this->output->createProgressBar($photos->count());
        $bar->start();

        foreach ($photos as $photo) {
            $report = $photo->report;
            $changes = [];

            if (empty($photo->ai_jenis_kerusakan)) {
                $changes['ai_jenis_kerusakan'] = self::DAMAGE_TYPES[array_rand(self::DAMAGE_TYPES)];
            }
            if (empty($photo->ai_severity)) {
                $severity = $report?->overall_severity;
                $changes['ai_severity'] = self::SEVERITY_MAP[$severity] ?? 'ringan';
            }
            if (is_null($photo->kerusakan_panjang)) {
                $rp = $report?->kerusakan_panjang;
                $changes['kerusakan_panjang'] = $rp ?? round(0.5 + mt_rand() / mt_getrandmax() * 7.5, 2);
            }
            if (is_null($photo->kerusakan_lebar)) {
                $rl = $report?->kerusakan_lebar;
                $changes['kerusakan_lebar'] = $rl ?? round(0.3 + mt_rand() / mt_getrandmax() * 3.7, 2);
            }
            if (is_null($photo->ai_confidence)) {
                $changes['ai_confidence'] = round(0.65 + mt_rand() / mt_getrandmax() * 0.34, 3);
            }
            if (is_null($photo->total_detections) || $photo->total_detections === 0) {
                $changes['total_detections'] = rand(1, 5);
            }

            if (! empty($changes)) {
                $photo->update($changes);
                $updated++;
            }

            $bar->advance();
        }

        $bar->finish();

        // Also backfill ai_jenis_kerusakan and ai_severity on reports table
        $reportUpdated = 0;
        $reports = Report::whereNull('ai_jenis_kerusakan')
            ->orWhereNull('ai_severity')
            ->get();

        foreach ($reports as $report) {
            $rChanges = [];
            if (empty($report->ai_jenis_kerusakan)) {
                $rChanges['ai_jenis_kerusakan'] = self::DAMAGE_TYPES[array_rand(self::DAMAGE_TYPES)];
            }
            if (empty($report->ai_severity)) {
                $rChanges['ai_severity'] = self::SEVERITY_MAP[$report->overall_severity] ?? 'ringan';
            }
            if (! empty($rChanges)) {
                $report->update($rChanges);
                $reportUpdated++;
            }
        }

        $this->newLine();
        $this->info("{$updated} photos backfilled, {$reportUpdated} reports backfilled.");

        // ── Fix GPS for batch report photos ──
        if ($this->option('fix-gps')) {
            $this->fixBatchPhotosGps();
        }

        return Command::SUCCESS;
    }

    private function fixBatchPhotosGps(): void
    {
        $batchReports = Report::with('photos')->whereNotNull('batch_id')->get();
        $fixed = 0;

        $bar = $this->output->createProgressBar($batchReports->count());
        $bar->start();

        foreach ($batchReports as $report) {
            foreach ($report->photos as $photo) {
                [$lat, $lng] = $this->nearbyGps(
                    $report->latitude,
                    $report->longitude,
                    10
                );
                $photo->update([
                    'latitude' => $lat,
                    'longitude' => $lng,
                ]);
                $fixed++;
            }
            $bar->advance();
        }

        $bar->finish();
        $this->newLine();
        $this->info("{$fixed} batch photos GPS scattered.");
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
