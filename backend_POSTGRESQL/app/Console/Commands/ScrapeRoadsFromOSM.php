<?php

namespace App\Console\Commands;

use App\Models\Road;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

class ScrapeRoadsFromOSM extends Command
{
    protected $signature = 'roads:scrape-osm
        {--dry-run : Preview without saving to database}
        {--kecamatan= : Only process specific kecamatan}
        {--retry-skips : Re-attempt previously skipped (429/504) kecamatan only}';

    protected $description = 'Scrape named highways from OpenStreetMap for all Sidoarjo kecamatan';

    private const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

    private const MAX_RETRIES = 3;

    private const BASE_DELAY = 10;

    private const KECAMATAN_BBOX = [
        'Porong' => '-7.559,112.659,-7.503,112.808',
        'Tanggulangin' => '-7.535,112.662,-7.476,112.782',
        'Waru' => '-7.370,112.708,-7.337,112.828',
        'Gedangan' => '-7.415,112.697,-7.364,112.758',
        'Sidoarjo' => '-7.526,112.660,-7.422,112.824',
        'Candi' => '-7.519,112.660,-7.452,112.804',
        'Buduran' => '-7.480,112.693,-7.406,112.819',
        'Sedati' => '-7.485,112.745,-7.330,112.842',
        'Taman' => '-7.390,112.615,-7.336,112.720',
        'Krian' => '-7.438,112.558,-7.368,112.632',
        'Balongbendo' => '-7.439,112.472,-7.397,112.577',
        'Wonoayu' => '-7.455,112.588,-7.401,112.671',
        'Sukodono' => '-7.430,112.625,-7.367,112.706',
        'Krembung' => '-7.556,112.605,-7.477,112.672',
        'Tulangan' => '-7.510,112.611,-7.442,112.684',
        'Tarik' => '-7.471,112.457,-7.425,112.565',
        'Prambon' => '-7.504,112.540,-7.432,112.622',
        'Jabon' => '-7.577,112.704,-7.493,112.880',
    ];

    public function handle(): int
    {
        $dryRun = $this->option('dry-run');
        $filterKecamatan = $this->option('kecamatan');
        $totalSaved = 0;
        $totalSkipped = 0;

        $bboxes = $filterKecamatan
            ? array_intersect_key(self::KECAMATAN_BBOX, array_flip([$filterKecamatan]))
            : self::KECAMATAN_BBOX;

        if (empty($bboxes)) {
            $this->error("Kecamatan '{$filterKecamatan}' tidak ditemukan.");

            return Command::FAILURE;
        }

        foreach ($bboxes as $kecamatan => $bbox) {
            $this->info("{$kecamatan}...");

            [$south, $west, $north, $east] = explode(',', $bbox);

            $query = sprintf(
                '[out:json][timeout:60];
                way["highway"~"^(primary|secondary|tertiary|unclassified|residential|service)$"]["name"](%s,%s,%s,%s);
                out geom;',
                $south, $west, $north, $east
            );

            $response = $this->overpassQuery($query);
            if ($response === null) {
                $totalSkipped++;
                if ($kecamatan !== array_key_last($bboxes)) {
                    sleep(5);
                }

                continue;
            }

            $elements = $response['elements'] ?? [];

            if (empty($elements)) {
                $this->warn('  0 roads found');
                if ($kecamatan !== array_key_last($bboxes)) {
                    sleep(8);
                }

                continue;
            }

            $saved = 0;
            $skipped = 0;

            foreach ($elements as $element) {
                if (($element['type'] ?? '') !== 'way') {
                    continue;
                }

                $roadName = trim($element['tags']['name'] ?? '');
                if ($roadName === '') {
                    continue;
                }

                $roadName = preg_replace('/\s+/', ' ', $roadName);

                $geometry = null;
                if (! empty($element['geometry']) && count($element['geometry']) >= 2) {
                    $geometry = array_map(
                        fn ($g) => [round($g['lat'], 6), round($g['lon'], 6)],
                        $element['geometry']
                    );
                }

                if ($dryRun) {
                    $this->line("  [DRY-RUN] {$roadName}".($geometry ? ' (with polyline)' : ''));
                    $saved++;

                    continue;
                }

                try {
                    Road::firstOrCreate(
                        ['nama_ruas' => $roadName, 'kecamatan' => $kecamatan],
                        [
                            'polyline' => $geometry,
                            'sumber_polyline' => 'osm',
                        ]
                    );
                    $saved++;
                } catch (\Exception $e) {
                    $this->warn("  ✗ {$roadName}: {$e->getMessage()}");
                    $skipped++;
                }
            }

            $this->info("  {$kecamatan}: {$saved} saved, {$skipped} skipped");
            $totalSaved += $saved;
            $totalSkipped += $skipped;

            if ($kecamatan !== array_key_last($bboxes)) {
                $this->line('  Delay 8s...');
                sleep(8);
            }
        }

        $this->newLine();
        if ($dryRun) {
            $this->info("[DRY-RUN] {$totalSaved} roads would be saved.");
        } else {
            $this->info("Selesai. {$totalSaved} roads saved, {$totalSkipped} skipped.");
        }

        return Command::SUCCESS;
    }

    private function overpassQuery(string $query): ?array
    {
        for ($attempt = 1; $attempt <= self::MAX_RETRIES; $attempt++) {
            try {
                $response = Http::timeout(120)
                    ->withHeaders([
                        'User-Agent' => 'DeltaJalan/1.0',
                        'Accept' => 'application/json, text/plain;q=0.9',
                    ])
                    ->asForm()
                    ->post(self::OVERPASS_URL, ['data' => $query]);

                if ($response->successful()) {
                    return $response->json();
                }

                $status = $response->status();
                $body = $response->body();

                if (in_array($status, [429, 502, 503, 504])) {
                    $delay = self::BASE_DELAY * $attempt;
                    $this->warn("  HTTP {$status} (attempt {$attempt}/".self::MAX_RETRIES.") — retry in {$delay}s");
                    sleep($delay);

                    continue;
                }

                $this->warn("  HTTP {$status} — ".substr($body, 0, 200));

                return null;

            } catch (\Exception $e) {
                $delay = self::BASE_DELAY * $attempt;
                $this->warn("  Error: {$e->getMessage()} (attempt {$attempt}/".self::MAX_RETRIES.") — retry in {$delay}s");
                sleep($delay);
            }
        }

        $this->warn('  Failed after '.self::MAX_RETRIES.' attempts.');

        return null;
    }
}
