<?php

namespace Database\Seeders;

use App\Models\Report;
use App\Models\ReportPhoto;
use App\Models\Upr;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ReportSeeder extends Seeder
{
    private const DATASET_DIRS = [
        '1007599_RS_386_386RS289112_28920', '1007600_RS_386_386RS289112_28925',
        '1007607_RS_386_386RS289112_28960', '1007608_RS_386_386RS289112_28966',
        '1008367_RS_386_386RS289112_32760', '1008560_RS_386_386RS289112_33725',
        '1014583_RS_386_386RS124739_29840', '1014584_RS_386_386RS124739_29845',
        '1014585_RS_386_386RS124739_29850', '1014586_RS_386_386RS124739_29855',
        '1014587_RS_386_386RS124739_29860', '1014603_RS_386_386RS124739_29940',
        '1014604_RS_386_386RS124739_29945', '1014609_RS_386_386RS124739_29970',
        '1014610_RS_386_386RS124739_29975', '1014611_RS_386_386RS124739_29980',
        '1014612_RS_386_386RS124739_29985', '1014613_RS_386_386RS124739_29990',
        '1014615_RS_386_386RS124739_30000', '1014616_RS_386_386RS124739_30005',
        '1014617_RS_386_386RS124739_30010', '1014618_RS_386_386RS124739_30015',
        '1014619_RS_386_386RS124739_30020', '1014620_RS_386_386RS124739_30025',
        '1014621_RS_386_386RS124739_30030', '1014622_RS_386_386RS124739_30035',
        '1014623_RS_386_386RS124739_30040', '1014624_RS_386_386RS124739_30045',
        '1014625_RS_386_386RS124739_30050', '1014626_RS_386_386RS124739_30055',
    ];

    private const KECAMATAN = [
        'Sidoarjo', 'Buduran', 'Gedangan', 'Sedati', 'Waru',
        'Taman', 'Krian', 'Balongbendo', 'Wonoayu', 'Sukodono',
        'Candi', 'Porong', 'Krembung', 'Tulangan', 'Tanggulangin',
        'Jabon', 'Tarik', 'Prambon',
    ];

    private const ROAD_NAMES = [
        'Jl. Raya Porong', 'Jl. Ahmad Yani', 'Jl. Gajah Mada', 'Jl. Majapahit',
        'Jl. Pahlawan', 'Jl. Diponegoro', 'Jl. Jenggolo', 'Jl. Thamrin',
        'Jl. Sudirman', 'Jl. Raya Buduran', 'Jl. Raya Waru', 'Jl. Raya Taman',
        'Jl. Raya Krian', 'Jl. Raya Candi', 'Jl. Raya Tanggulangin',
        'Jl. Raya Sedati', 'Jl. Raya Sukodono', 'Jl. Raya Wonoayu',
    ];

    private const STATUSES = [
        'Menunggu Review', 'Disetujui', 'Sedang Diperbaiki', 'Selesai', 'Ditinjau', 'Ditolak',
    ];

    private const SEVERITIES = ['Rusak Berat', 'Rusak Sedang', 'Rusak Ringan'];

    private const DAMAGE_TYPES = [
        'Retak Memanjang', 'Retak Melintang', 'Retak Buaya', 'Lubang',
        'Ambles', 'Tambalan', 'Keriting',
    ];

    private const PRIORITIES = ['Rendah', 'Sedang', 'Tinggi'];

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

    public function run(): void
    {
        $uprs = Upr::all()->pluck('id')->toArray();
        $reporters = ['Agus Setiawan', 'Rizky Firmansyah', 'Dewi Rahayu', 'Bambang Eko'];
        $sequence = Report::where('report_code', 'like', 'LP-'.date('Y').'-%')
            ->orderBy('report_code', 'desc')
            ->value('report_code');
        $nextNumber = $sequence ? ((int) substr($sequence, -5)) + 1 : 1;

        Storage::disk('public')->makeDirectory('reports');

        $bar = $this->command->getOutput()->createProgressBar(30);
        $bar->start();

        $dirCount = count(self::DATASET_DIRS);

        for ($i = 0; $i < 30; $i++) {
            $district = self::KECAMATAN[array_rand(self::KECAMATAN)];
            $status = self::STATUSES[array_rand(self::STATUSES)];
            $severity = self::SEVERITIES[array_rand(self::SEVERITIES)];
            $reporter = $reporters[array_rand($reporters)];
            $daysAgo = rand(0, 180);
            $createdAt = now()->subDays($daysAgo)->subHours(rand(0, 23))->subMinutes(rand(0, 59));

            $lat = round(-7.25 - mt_rand() / mt_getrandmax() * 0.4, 8);
            $lng = round(112.50 + mt_rand() / mt_getrandmax() * 0.45, 8);

            $dirName = self::DATASET_DIRS[$i % $dirCount];
            $imagePath = $this->downloadImage($dirName);

            $reportCode = 'LP-'.date('Y').'-'.str_pad($nextNumber++, 5, '0', STR_PAD_LEFT);

            $severityShort = match ($severity) {
                'Rusak Berat' => 'berat',
                'Rusak Sedang' => 'sedang',
                'Rusak Ringan' => 'ringan',
                default => 'ringan',
            };

            $report = Report::create([
                'report_code' => $reportCode,
                'reporter_name' => $reporter,
                'road_name' => self::ROAD_NAMES[array_rand(self::ROAD_NAMES)],
                'district' => $district,
                'latitude' => $lat,
                'longitude' => $lng,
                'koordinat_sumber' => 'browser_gps',
                'image_original_path' => $imagePath,
                'image_hash' => hash('sha256', $reportCode.$i.time()),
                'status' => $status,
                'overall_severity' => $severity,
                'ai_jenis_kerusakan' => self::DAMAGE_TYPES[array_rand(self::DAMAGE_TYPES)],
                'ai_severity' => $severityShort,
                'trust_score' => rand(50, 100),
                'trust_label' => ['merah', 'kuning', 'hijau'][rand(0, 2)],
                'priority' => self::PRIORITIES[array_rand(self::PRIORITIES)],
                'kerusakan_panjang' => rand(5, 50) / 10,
                'kerusakan_lebar' => rand(5, 30) / 10,
                'created_at' => $createdAt,
                'updated_at' => $createdAt,
            ]);

            if (in_array($status, ['Disetujui', 'Sedang Diperbaiki', 'Selesai']) && ! empty($uprs)) {
                $uprId = $uprs[array_rand($uprs)];
                $report->update([
                    'assigned_upr_id' => $uprId,
                    'assigned_at' => $createdAt->copy()->addHours(rand(1, 48)),
                ]);
            }

            if ($status === 'Sedang Diperbaiki') {
                $report->update([
                    'perbaikan_dimulai_at' => $createdAt->copy()->addDays(rand(1, 5)),
                    'pelaksana' => 'Petugas Eksekusi',
                ]);
            } elseif ($status === 'Selesai') {
                $report->update([
                    'perbaikan_dimulai_at' => $createdAt->copy()->addDays(rand(1, 5)),
                    'perbaikan_selesai_at' => $createdAt->copy()->addDays(rand(6, 14)),
                    'pelaksana' => 'Petugas Eksekusi',
                ]);
            }

            // Primary photo
            [$photoLat, $photoLng] = $i < 10
                ? $this->nearbyGps($lat, $lng, 5)
                : [$lat, $lng];
            ReportPhoto::create([
                'report_id' => $report->id,
                'image_original_path' => $imagePath,
                'image_hash' => hash('sha256', $reportCode.$i.time().'_photo'),
                'latitude' => $photoLat,
                'longitude' => $photoLng,
                'koordinat_sumber' => 'exif',
                'ai_jenis_kerusakan' => self::DAMAGE_TYPES[array_rand(self::DAMAGE_TYPES)],
                'ai_severity' => $severityShort,
                'ai_confidence' => round(0.65 + mt_rand() / mt_getrandmax() * 0.34, 3),
                'total_detections' => rand(1, 5),
                'kerusakan_panjang' => round(0.5 + mt_rand() / mt_getrandmax() * 7.5, 2),
                'kerusakan_lebar' => round(0.3 + mt_rand() / mt_getrandmax() * 3.7, 2),
                'sort_order' => 0,
                'original_filename' => "report_{$i}.jpg",
                'created_at' => $createdAt,
                'updated_at' => $createdAt,
            ]);

            // Batch report: add extra photos (reports 0-9 get 2-4 extra = 3-5 total)
            if ($i < 10) {
                $report->update(['batch_id' => (string) Str::uuid(), 'image_original_path' => null]);

                $extraCount = rand(2, 4);
                for ($j = 0; $j < $extraCount; $j++) {
                    $photoDir = self::DATASET_DIRS[($i + $j + 10) % $dirCount];
                    $photoPath = $this->downloadImage($photoDir);
                    [$extraLat, $extraLng] = $this->nearbyGps($lat, $lng, 5);
                    ReportPhoto::create([
                        'report_id' => $report->id,
                        'image_original_path' => $photoPath,
                        'image_hash' => hash('sha256', $reportCode.$i.time().'_extra_'.$j),
                        'latitude' => $extraLat,
                        'longitude' => $extraLng,
                        'koordinat_sumber' => 'exif',
                        'ai_jenis_kerusakan' => self::DAMAGE_TYPES[array_rand(self::DAMAGE_TYPES)],
                        'ai_severity' => $severityShort,
                        'ai_confidence' => round(0.65 + mt_rand() / mt_getrandmax() * 0.34, 3),
                        'total_detections' => rand(1, 5),
                        'kerusakan_panjang' => round(0.5 + mt_rand() / mt_getrandmax() * 7.5, 2),
                        'kerusakan_lebar' => round(0.3 + mt_rand() / mt_getrandmax() * 3.7, 2),
                        'sort_order' => $j + 1,
                        'original_filename' => "report_{$i}_extra_{$j}.jpg",
                        'created_at' => $createdAt,
                        'updated_at' => $createdAt,
                    ]);
                }
            }

            $bar->advance();
        }

        $bar->finish();
        $this->command->info("\n30 laporan berhasil dibuat.");
    }

    private function downloadImage(string $dirName): string
    {
        $filename = Str::uuid().'.jpg';
        $path = 'reports/'.$filename;

        $url = "https://raw.githubusercontent.com/biankatpas/Cracks-and-Potholes-in-Road-Images-Dataset/master/Dataset/{$dirName}/{$dirName}_RAW.jpg";
        $context = stream_context_create([
            'http' => [
                'timeout' => 10,
                'user_agent' => 'DeltaJalan Seeder/1.0',
            ],
            'ssl' => [
                'verify_peer' => false,
                'verify_peer_name' => false,
            ],
        ]);

        $imageData = @file_get_contents($url, false, $context);

        if ($imageData === false) {
            $img = imagecreatetruecolor(400, 300);
            $bg = imagecolorallocate($img, rand(100, 200), rand(100, 200), rand(100, 200));
            imagefill($img, 0, 0, $bg);
            $textColor = imagecolorallocate($img, 255, 255, 255);
            $text = "Road Damage {$dirName}";
            $fontSize = 4;
            $textWidth = imagefontwidth($fontSize) * strlen($text);
            $x = (400 - $textWidth) / 2;
            imagestring($img, $fontSize, (int) $x, 140, $text, $textColor);
            ob_start();
            imagejpeg($img, null, 80);
            $imageData = ob_get_clean();
            imagedestroy($img);
        }

        Storage::disk('public')->put($path, $imageData);

        return $path;
    }
}
