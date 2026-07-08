<?php

namespace App\Console\Commands;

use App\Models\Report;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class BackfillReportAddress extends Command
{
    protected $signature = 'reports:backfill-address
        {--chunk=50 : Number of records to process per chunk}
        {--delay=1 : Delay in seconds between chunks to respect rate limit}';

    protected $description = 'Backfill full_address for reports where it is null, using LocationIQ reverse geocode';

    public function handle(): int
    {
        $chunkSize = (int) $this->option('chunk');
        $delay = (int) $this->option('delay');

        $total = Report::whereNull('full_address')->count();

        if ($total === 0) {
            $this->info('Semua laporan sudah memiliki full_address.');

            return Command::SUCCESS;
        }

        $this->info("Ditemukan {$total} laporan tanpa full_address. Mulai backfill...");
        $bar = $this->output->createProgressBar($total);
        $bar->start();

        $processed = 0;
        $failed = 0;
        $count = 0;

        Report::whereNull('full_address')
            ->lazyById($chunkSize)
            ->each(function (Report $report) use ($bar, $delay, $chunkSize, &$count, &$processed, &$failed) {
                $count++;

                $address = $this->reverseGeocode(
                    (float) $report->latitude,
                    (float) $report->longitude
                );

                if ($address !== null) {
                    $report->updateQuietly(['full_address' => $address]);
                    $processed++;
                } else {
                    $failed++;
                    Log::warning('BackfillReportAddress: Gagal reverse geocode.', [
                        'report_id' => $report->id,
                        'report_code' => $report->report_code,
                        'lat' => $report->latitude,
                        'lng' => $report->longitude,
                    ]);
                }

                $bar->advance();

                if ($delay > 0 && $count % $chunkSize === 0) {
                    sleep($delay);
                }
            });

        $bar->finish();
        $this->newLine();
        $this->info("Selesai. Berhasil: {$processed}, Gagal: {$failed}.");

        return Command::SUCCESS;
    }

    private function reverseGeocode(float $lat, float $lng): ?string
    {
        $cacheKey = 'addr_'.md5("{$lat},{$lng}");

        return Cache::remember($cacheKey, 3600, function () use ($lat, $lng) {
            $address = $this->reverseGeocodeWilayahId($lat, $lng);

            if ($address !== null) {
                return $address;
            }

            return $this->reverseGeocodeLocationIq($lat, $lng);
        });
    }

    private function reverseGeocodeWilayahId(float $lat, float $lng): ?string
    {
        try {
            $response = Http::timeout(3)->get('https://wilayah-id-restapi.vercel.app/api/v1/boundaries/reverse', [
                'lat' => $lat,
                'lng' => $lng,
            ]);

            if (! $response->ok()) {
                return null;
            }

            $data = $response->json();

            if (! isset($data['subdistrict']['name'])) {
                return null;
            }

            $parts = [];

            if (isset($data['subdistrict']['name'])) {
                $parts[] = $data['subdistrict']['name'];
            }

            if (isset($data['district']['name'])) {
                $parts[] = 'Kec. '.$data['district']['name'];
            }

            if (isset($data['regency']['name'])) {
                $type = ($data['regency']['type'] ?? 'KABUPATEN') === 'KOTA' ? 'Kota' : 'Kabupaten';
                $parts[] = $type.' '.$data['regency']['name'];
            }

            if (isset($data['province']['name'])) {
                $parts[] = $data['province']['name'];
            }

            if (isset($data['subdistrict']['postal_code'])) {
                $parts[] = $data['subdistrict']['postal_code'];
            }

            return implode(', ', $parts);
        } catch (\Exception $e) {
            Log::warning('BackfillReportAddress: Wilayah-id exception.', [
                'lat' => $lat,
                'lng' => $lng,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    private function reverseGeocodeLocationIq(float $lat, float $lng): ?string
    {
        try {
            $response = Http::timeout(2)->get('https://us1.locationiq.com/v1/reverse', [
                'key' => config('services.locationiq.key'),
                'lat' => $lat,
                'lon' => $lng,
                'format' => 'json',
            ]);

            if (! $response->ok()) {
                return null;
            }

            $data = $response->json();

            return $data['display_name'] ?? null;
        } catch (\Exception $e) {
            Log::warning('BackfillReportAddress: LocationIQ exception.', [
                'lat' => $lat,
                'lng' => $lng,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }
}
