<?php

namespace Database\Seeders;

use App\Models\Report;
use App\Models\ReportPhoto;
use App\Models\ReportAfterPhoto;
use App\Models\ReportProgressUpdate;
use App\Models\Team;
use App\Models\User;
use App\Models\SurveyTask;
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

    private const KECAMATAN_GPS = [
        'Sidoarjo' => [-7.4521, 112.7188],
        'Buduran' => [-7.4207, 112.7240],
        'Gedangan' => [-7.3967, 112.6926],
        'Sedati' => [-7.3690, 112.7805],
        'Waru' => [-7.3511, 112.7688],
        'Taman' => [-7.3727, 112.6695],
        'Krian' => [-7.4086, 112.5733],
        'Balongbendo' => [-7.4418, 112.5295],
        'Wonoayu' => [-7.4690, 112.6238],
        'Sukodono' => [-7.3892, 112.6461],
        'Candi' => [-7.4946, 112.7340],
        'Porong' => [-7.5398, 112.6869],
        'Krembung' => [-7.5213, 112.6272],
        'Tulangan' => [-7.5060, 112.6538],
        'Tanggulangin' => [-7.5128, 112.7094],
        'Jabon' => [-7.5734, 112.7509],
        'Tarik' => [-7.4517, 112.5549],
        'Prambon' => [-7.5425, 112.6060],
    ];

    private const ROAD_NAMES = [
        'Jl. Raya Porong', 'Jl. Ahmad Yani', 'Jl. Gajah Mada', 'Jl. Majapahit',
        'Jl. Pahlawan', 'Jl. Diponegoro', 'Jl. Jenggolo', 'Jl. Thamrin',
        'Jl. Sudirman', 'Jl. Raya Buduran', 'Jl. Raya Waru', 'Jl. Raya Taman',
        'Jl. Raya Krian', 'Jl. Raya Candi', 'Jl. Raya Tanggulangin',
        'Jl. Raya Sedati', 'Jl. Raya Sukodono', 'Jl. Raya Wonoayu',
    ];

    private const DAMAGE_TYPES = ['Lubang', 'Retak Kulit Buaya', 'Retak Memanjang', 'Retak Melintang'];

    private const PRIORITIES = ['Rendah', 'Sedang', 'Tinggi'];

    private const STATUS_POOL = [
        'Menunggu Review', 'Menunggu Review', 'Menunggu Review', 'Menunggu Review',
        'Menunggu Review', 'Menunggu Review', 'Menunggu Review', 'Menunggu Review',
        'Menunggu Review', 'Menunggu Review', 'Menunggu Review', 'Menunggu Review',
        'Ditinjau', 'Ditinjau', 'Ditinjau', 'Ditinjau', 'Ditinjau', 'Ditinjau',
        'Disetujui', 'Disetujui', 'Disetujui', 'Disetujui', 'Disetujui', 'Disetujui', 'Disetujui', 'Disetujui',
        'Ditugaskan', 'Ditugaskan', 'Ditugaskan', 'Ditugaskan', 'Ditugaskan', 'Ditugaskan',
        'Sedang Diperbaiki', 'Sedang Diperbaiki', 'Sedang Diperbaiki', 'Sedang Diperbaiki',
        'Sedang Diperbaiki', 'Sedang Diperbaiki', 'Sedang Diperbaiki', 'Sedang Diperbaiki',
        'Sedang Diperbaiki', 'Sedang Diperbaiki', 'Sedang Diperbaiki', 'Sedang Diperbaiki',
        'Selesai', 'Selesai', 'Selesai', 'Selesai', 'Selesai', 'Selesai',
        'Selesai', 'Selesai', 'Selesai', 'Selesai',
        'Ditolak', 'Ditolak', 'Ditolak', 'Ditolak', 'Ditolak', 'Ditolak',
    ];

    private const SEVERITY_POOL = [
        'Rusak Berat', 'Rusak Berat', 'Rusak Berat', 'Rusak Berat',
        'Rusak Berat', 'Rusak Berat', 'Rusak Berat', 'Rusak Berat',
        'Rusak Berat', 'Rusak Berat', 'Rusak Berat', 'Rusak Berat',
        'Rusak Sedang', 'Rusak Sedang', 'Rusak Sedang', 'Rusak Sedang',
        'Rusak Sedang', 'Rusak Sedang', 'Rusak Sedang', 'Rusak Sedang',
        'Rusak Sedang', 'Rusak Sedang', 'Rusak Sedang', 'Rusak Sedang',
        'Rusak Sedang', 'Rusak Sedang', 'Rusak Sedang', 'Rusak Sedang',
        'Rusak Sedang', 'Rusak Sedang', 'Rusak Sedang', 'Rusak Sedang',
        'Rusak Ringan', 'Rusak Ringan', 'Rusak Ringan', 'Rusak Ringan',
        'Rusak Ringan', 'Rusak Ringan', 'Rusak Ringan', 'Rusak Ringan',
        'Rusak Ringan', 'Rusak Ringan', 'Rusak Ringan', 'Rusak Ringan',
        'Rusak Ringan', 'Rusak Ringan', 'Rusak Ringan', 'Rusak Ringan',
        'Rusak Ringan', 'Rusak Ringan', 'Rusak Ringan', 'Rusak Ringan',
        'Rusak Ringan', 'Rusak Ringan', 'Rusak Ringan',
        'Baik', 'Baik', 'Baik', 'Baik', 'Baik',
    ];

    private const PRIORITY_POOL = [
        'Tinggi', 'Tinggi', 'Tinggi', 'Tinggi', 'Tinggi',
        'Tinggi', 'Tinggi', 'Tinggi', 'Tinggi', 'Tinggi',
        'Tinggi', 'Tinggi', 'Tinggi', 'Tinggi', 'Tinggi',
        'Sedang', 'Sedang', 'Sedang', 'Sedang', 'Sedang',
        'Sedang', 'Sedang', 'Sedang', 'Sedang', 'Sedang',
        'Sedang', 'Sedang', 'Sedang', 'Sedang', 'Sedang',
        'Sedang', 'Sedang', 'Sedang', 'Sedang', 'Sedang',
        'Sedang', 'Sedang', 'Sedang', 'Sedang', 'Sedang',
        'Sedang', 'Sedang', 'Sedang', 'Sedang', 'Sedang',
        'Rendah', 'Rendah', 'Rendah', 'Rendah', 'Rendah',
        'Rendah', 'Rendah', 'Rendah', 'Rendah', 'Rendah',
        'Rendah', 'Rendah', 'Rendah', 'Rendah', 'Rendah',
    ];

    private array $downloaded = [];

    private function nearbyGps(float $centerLat, float $centerLng, float $maxMeters): array
    {
        $latPerMeter = 1.0 / 111320.0;
        $lngPerMeter = 1.0 / (111320.0 * cos(deg2rad($centerLat)));
        $angle = deg2rad(mt_rand(0, 360));
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
        $this->command->warn('Menghapus data laporan lama...');
        Storage::disk('public')->deleteDirectory('reports');
        Report::query()->delete();
        $this->command->info('Data lama dihapus, memulai seeding ulang...');

        $this->command->warn('Memulai seeding 66 laporan lengkap...');

        $petugas = User::where('role', 'petugas')->orderBy('id')->get();
        $petugasCount = $petugas->count();
        $petugasAgus = $petugas->firstWhere('name', 'Agus Setiawan');

        if ($petugasCount === 0) {
            $this->command->error('Tidak ada user petugas ditemukan. Jalankan UserSeeder dulu.');
            return;
        }

        $teamsByUser = [];
        foreach ($petugas as $p) {
            $teamsByUser[$p->id] = $p->team_id;
        }

        $surveyTasks = SurveyTask::where('status', 'aktif')->get();
        $surveyByTeam = [];
        foreach ($surveyTasks as $st) {
            $surveyByTeam[$st->team_id][] = $st;
        }

        $statuses = self::STATUS_POOL;
        $severities = self::SEVERITY_POOL;
        $priorities = self::PRIORITY_POOL;

        shuffle($statuses);
        shuffle($severities);
        shuffle($priorities);

        $dirCount = count(self::DATASET_DIRS);

        Storage::disk('public')->makeDirectory('reports');
        Storage::disk('public')->makeDirectory('reports/after');
        Storage::disk('public')->makeDirectory('reports/progress');

        $sequence = Report::where('report_code', 'like', 'LP-' . date('Y') . '-%')
            ->orderBy('report_code', 'desc')
            ->value('report_code');
        $nextNumber = $sequence ? ((int) substr($sequence, -5)) + 1 : 1;

        $this->command->getOutput()->progressStart(60);

        for ($i = 0; $i < 60; $i++) {
            $reportCode = 'LP-' . date('Y') . '-' . str_pad($nextNumber++, 5, '0', STR_PAD_LEFT);
            $user = $petugas[$i % $petugasCount];
            $teamId = $teamsByUser[$user->id];
            $district = self::KECAMATAN[array_rand(self::KECAMATAN)];
            $status = $statuses[$i];
            $severity = $severities[$i];
            $priority = $priorities[$i];

            $daysAgo = $status === 'Selesai'
                ? mt_rand(10, 180)
                : mt_rand(0, 2);
            $createdAt = now()->subDays($daysAgo)->subHours(mt_rand(0, 23))->subMinutes(mt_rand(0, 59));

            [$centerLat, $centerLng] = self::KECAMATAN_GPS[$district];
            [$lat, $lng] = $this->nearbyGps($centerLat, $centerLng, 1500);

            $isBatch = $i < 20;
            $dirName = self::DATASET_DIRS[$i % $dirCount];
            $imagePath = $this->downloadImage($dirName, 'reports');

            $severityShort = match ($severity) {
                'Rusak Berat' => 'berat',
                'Rusak Sedang' => 'sedang',
                default => 'ringan',
            };

            $aiDamageType = self::DAMAGE_TYPES[array_rand(self::DAMAGE_TYPES)];
            $aiConfidence = round(0.65 + mt_rand() / mt_getrandmax() * 0.34, 3);

            $deadlineReview = $this->calcDeadline($priority, 'review_hours', 72, $createdAt);
            $deadlineMulai = $this->calcDeadline($priority, 'assignment_start_hours', 48, $ditugaskanAt ?? $createdAt);
            $deadlineResolusi = $this->calcDeadline($priority, 'resolution_hours', 168, $perbaikanDimulaiAt ?? $ditugaskanAt ?? $createdAt);

            $needsAssignment = in_array($status, ['Disetujui', 'Ditugaskan', 'Sedang Diperbaiki', 'Selesai']);
            $assignorName = $needsAssignment ? ['Budi Santoso', 'Siti Marlina', 'Hendra Kusuma', 'Fajar Nugroho'][array_rand([0, 1, 2, 3])] : null;
            $assignedAt = $needsAssignment ? $createdAt->copy()->addHours(mt_rand(1, 48)) : null;
            $ditugaskanAt = in_array($status, ['Ditugaskan', 'Sedang Diperbaiki', 'Selesai'])
                ? ($assignedAt ? $assignedAt->copy()->addHours(mt_rand(1, 24)) : null)
                : null;
            $perbaikanDimulaiAt = in_array($status, ['Sedang Diperbaiki', 'Selesai'])
                ? ($ditugaskanAt ? $ditugaskanAt->copy()->addHours(mt_rand(1, 72)) : $createdAt->copy()->addDays(mt_rand(1, 5)))
                : null;
            $perbaikanSelesaiAt = $status === 'Selesai'
                ? ($perbaikanDimulaiAt ? $perbaikanDimulaiAt->copy()->addDays(mt_rand(2, 14)) : $createdAt->copy()->addDays(mt_rand(6, 14)))
                : null;

            $reportData = [
                'report_code' => $reportCode,
                'user_id' => $user->id,
                'reporter_name' => $user->name,
                'road_name' => self::ROAD_NAMES[array_rand(self::ROAD_NAMES)],
                'district' => $district,
                'latitude' => $lat,
                'longitude' => $lng,
                'koordinat_sumber' => ['exif', 'browser_gps', 'manual'][mt_rand(0, 2)],
                'total_detections' => $severity === 'Baik' ? 0 : mt_rand(1, 8),
                'overall_severity' => $severity,
                'status' => $status,
                'priority' => $priority,
                'ai_jenis_kerusakan' => $aiDamageType,
                'ai_severity' => $severityShort,
                'ai_confidence' => $aiConfidence,
                'system_notes' => match ($status) {
                    'Ditolak' => 'Laporan ditolak: ' . ['Koordinat tidak valid', 'Foto tidak jelas', 'Bukan kerusakan jalan', 'Duplikat', 'Lainnya'][mt_rand(0, 4)],
                    'Selesai' => 'Perbaikan selesai dilaksanakan oleh ' . $user->name,
                    default => 'Laporan dibuat melalui aplikasi JalanKita',
                },
                'catatan_petugas' => match (mt_rand(0, 3)) {
                    0 => 'Kerusakan cukup parah, perlu penanganan segera',
                    1 => 'Lokasi di tepi jalan, agak tersembunyi',
                    2 => 'Sudah dilaporkan warga sekitar',
                    default => null,
                },
                'kerusakan_panjang' => round(0.5 + mt_rand() / mt_getrandmax() * 4.5, 2),
                'kerusakan_lebar' => round(0.3 + mt_rand() / mt_getrandmax() * 2.7, 2),
                'deadline_review' => $deadlineReview,
                'deadline_resolusi' => in_array($status, ['Sedang Diperbaiki', 'Selesai']) ? $deadlineResolusi : null,
                'deadline_mulai' => in_array($status, ['Ditugaskan', 'Sedang Diperbaiki', 'Selesai']) ? $deadlineMulai : null,
                'terlambat_review' => $deadlineReview->isPast() && in_array($status, ['Menunggu Review', 'Ditinjau']),
                'terlambat_resolusi' => $deadlineResolusi?->isPast() && in_array($status, ['Sedang Diperbaiki', 'Selesai']),
                'terlambat_mulai' => $deadlineMulai?->isPast() && in_array($status, ['Disetujui', 'Ditugaskan', 'Sedang Diperbaiki', 'Selesai']),
                'assigned_team_id' => $needsAssignment ? $teamId : null,
                'assigned_at' => $assignedAt,
                'ditugaskan_at' => $ditugaskanAt,
                'assignor_name' => $assignorName,
                'perbaikan_dimulai_at' => $perbaikanDimulaiAt,
                'perbaikan_selesai_at' => $perbaikanSelesaiAt,
                'pelaksana' => in_array($status, ['Sedang Diperbaiki', 'Selesai']) ? $user->name : null,
                'created_at' => $createdAt,
                'updated_at' => $createdAt,
            ];

            if ($isBatch) {
                $reportData['batch_id'] = (string) Str::uuid();
                $reportData['image_original_path'] = null;
            } else {
                $reportData['image_original_path'] = $imagePath;
            }

            if ($status === 'Baik') {
                $reportData['total_detections'] = 0;
                $reportData['ai_jenis_kerusakan'] = null;
                $reportData['ai_severity'] = null;
                $reportData['ai_confidence'] = null;
            }

            $report = Report::create($reportData);

            if ($needsAssignment && $ditugaskanAt) {
                $report->timestamps = false;
                $report->update(['ditugaskan_at' => $ditugaskanAt]);
                $report->timestamps = true;
            }

            $photoCount = $isBatch ? mt_rand(3, 6) : mt_rand(1, 2);

            for ($j = 0; $j < $photoCount; $j++) {
                $photoDirIndex = ($i + $j + 10) % $dirCount;
                $photoDir = self::DATASET_DIRS[$photoDirIndex];
                $photoPath = $this->downloadImage($photoDir, 'reports');

                [$photoLat, $photoLng] = $isBatch
                    ? $this->nearbyGps($lat, $lng, 5)
                    : [$lat, $lng];

                $photoDamageType = self::DAMAGE_TYPES[array_rand(self::DAMAGE_TYPES)];
                $photoConfidence = round(0.65 + mt_rand() / mt_getrandmax() * 0.34, 3);
                $photoSeverity = match ($severity) {
                    'Rusak Berat' => 'berat',
                    'Rusak Sedang' => 'sedang',
                    default => 'ringan',
                };

                ReportPhoto::create([
                    'report_id' => $report->id,
                    'reporter_name' => $user->name,
                    'image_original_path' => $photoPath,
                    'image_hash' => hash('sha256', $report->id . $i . $j . time() . Str::random(8)),
                    'latitude' => $photoLat,
                    'longitude' => $photoLng,
                    'koordinat_sumber' => 'exif',
                    'ai_jenis_kerusakan' => $photoDamageType,
                    'ai_severity' => $photoSeverity,
                    'ai_confidence' => $photoConfidence,
                    'total_detections' => $severity === 'Baik' ? 0 : mt_rand(1, 5),
                    'ai_raw_output' => json_encode($this->generateAiRawOutput($photoDamageType, $photoConfidence)),
                    'kerusakan_panjang' => round(0.5 + mt_rand() / mt_getrandmax() * 7.5, 2),
                    'kerusakan_lebar' => round(0.3 + mt_rand() / mt_getrandmax() * 3.7, 2),
                    'sort_order' => $j,
                    'original_filename' => "patrol_{$i}_photo_{$j}.jpg",
                    'created_at' => $createdAt,
                    'updated_at' => $createdAt,
                ]);
            }

            if ($status === 'Sedang Diperbaiki') {
                $progressCount = mt_rand(1, 2);
                for ($p = 0; $p < $progressCount; $p++) {
                    $progressPath = $this->generatePlaceholder("reports/progress/{$report->id}_progress_{$p}.jpg", 'PROGRESS');
                    ReportProgressUpdate::create([
                        'report_id' => $report->id,
                        'user_id' => $user->id,
                        'foto_path' => $progressPath,
                        'catatan' => ['Pengerjaan tahap awal', 'Perbaikan 50%', 'Penambalan dilakukan', 'Pengaspalan partial'][mt_rand(0, 3)],
                        'created_at' => $perbaikanDimulaiAt ? $perbaikanDimulaiAt->copy()->addDays($p + 1) : $createdAt->copy()->addDays($p + 1),
                        'updated_at' => $perbaikanDimulaiAt ? $perbaikanDimulaiAt->copy()->addDays($p + 1) : $createdAt->copy()->addDays($p + 1),
                    ]);
                }
            }

            if ($status === 'Selesai') {
                $afterCount = mt_rand(1, 2);
                for ($a = 0; $a < $afterCount; $a++) {
                    $afterPath = $this->generatePlaceholder("reports/after/{$report->id}_after_{$a}.jpg", 'SELESAI');
                    ReportAfterPhoto::create([
                        'report_id' => $report->id,
                        'file_path' => $afterPath,
                        'file_hash' => hash('sha256', $report->id . '_after_' . $a . Str::random(4)),
                        'sort_order' => $a,
                        'created_at' => $perbaikanSelesaiAt ?? $createdAt,
                        'updated_at' => $perbaikanSelesaiAt ?? $createdAt,
                    ]);
                }

                $report->update([
                    'after_photo_path' => $afterPath ?? null,
                    'after_photo_hash' => hash('sha256', $report->id . '_after'),
                    'after_photo_notes' => 'Perbaikan selesai dilaksanakan',
                ]);
            }

            if ($status === 'Disetujui' && $teamId && isset($surveyByTeam[$teamId]) && count($surveyByTeam[$teamId]) > 0) {
                $st = $surveyByTeam[$teamId][mt_rand(0, count($surveyByTeam[$teamId]) - 1)];
                $report->update(['survey_task_id' => $st->id]);
            } elseif (in_array($status, ['Ditugaskan', 'Sedang Diperbaiki', 'Selesai']) && $teamId && isset($surveyByTeam[$teamId]) && count($surveyByTeam[$teamId]) > 0) {
                $st = $surveyByTeam[$teamId][mt_rand(0, count($surveyByTeam[$teamId]) - 1)];
                $report->update(['survey_task_id' => $st->id]);
            }

            $this->command->getOutput()->progressAdvance();
        }

        $this->command->getOutput()->progressFinish();
        $this->command->info("\n✓ 60 laporan lengkap berhasil dibuat.");

        // ── 6 Laporan Khusus: Deadline Dekat ──
        $specialConfigs = [
            // Index 60: Menunggu Review, deadline review 10 menit lagi
            [
                'status' => 'Menunggu Review', 'priority' => 'Tinggi', 'severity' => 'Rusak Ringan',
                'createdAt' => now()->subMinutes(1430), // 23j 50m
                'deadlineReview' => now()->addMinutes(10),
                'deadline_resolusi' => null, 'deadline_mulai' => null,
                'terlambat_review' => false, 'terlambat_resolusi' => false, 'terlambat_mulai' => false,
            ],
            // Index 61: Menunggu Review, deadline review sudah lewat 5 menit
            [
                'status' => 'Menunggu Review', 'priority' => 'Tinggi', 'severity' => 'Rusak Sedang',
                'createdAt' => now()->subMinutes(1445), // 24j 5m
                'deadlineReview' => now()->subMinutes(5),
                'deadline_resolusi' => null, 'deadline_mulai' => null,
                'terlambat_review' => true, 'terlambat_resolusi' => false, 'terlambat_mulai' => false,
            ],
            // Index 62: Ditinjau, deadline review 30 menit lagi
            [
                'status' => 'Ditinjau', 'priority' => 'Tinggi', 'severity' => 'Rusak Berat',
                'createdAt' => now()->subMinutes(1410), // 23j 30m
                'deadlineReview' => now()->addMinutes(30),
                'deadline_resolusi' => null, 'deadline_mulai' => null,
                'terlambat_review' => false, 'terlambat_resolusi' => false, 'terlambat_mulai' => false,
            ],
            // Index 63: Sedang Diperbaiki, deadline resolusi 10 menit lagi
            [
                'status' => 'Sedang Diperbaiki', 'priority' => 'Sedang', 'severity' => 'Rusak Sedang',
                'createdAt' => now()->subDays(10),
                'deadlineReview' => now()->subDays(7),
                'deadline_resolusi' => now()->addMinutes(10), 'deadline_mulai' => now()->subDays(5),
                'terlambat_review' => false, 'terlambat_resolusi' => false, 'terlambat_mulai' => false,
                'perbaikanDimulaiAt' => now()->subDays(7),
            ],
            // Index 64: Sedang Diperbaiki, deadline resolusi sudah lewat 5 menit
            [
                'status' => 'Sedang Diperbaiki', 'priority' => 'Tinggi', 'severity' => 'Rusak Berat',
                'createdAt' => now()->subDays(6),
                'deadlineReview' => now()->subDays(5),
                'deadline_resolusi' => now()->subMinutes(5), 'deadline_mulai' => now()->subDays(3),
                'terlambat_review' => false, 'terlambat_resolusi' => true, 'terlambat_mulai' => false,
                'perbaikanDimulaiAt' => now()->subDays(3),
            ],
            // Index 65: Sedang Diperbaiki, deadline resolusi 30 menit lagi (Rendah)
            [
                'status' => 'Sedang Diperbaiki', 'priority' => 'Rendah', 'severity' => 'Rusak Ringan',
                'createdAt' => now()->subDays(21),
                'deadlineReview' => now()->subDays(14),
                'deadline_resolusi' => now()->addMinutes(30), 'deadline_mulai' => now()->subDays(15),
                'terlambat_review' => false, 'terlambat_resolusi' => false, 'terlambat_mulai' => false,
                'perbaikanDimulaiAt' => now()->subDays(14)->addMinutes(30),
            ],
            // Index 66: Ditugaskan, deadline mulai 10 menit lagi
            [
                'status' => 'Ditugaskan', 'priority' => 'Tinggi', 'severity' => 'Rusak Sedang',
                'createdAt' => now()->subDays(2)->subHours(2),
                'deadlineReview' => now()->subDays(1),
                'deadline_resolusi' => null, 'deadline_mulai' => now()->addMinutes(10),
                'terlambat_review' => false, 'terlambat_resolusi' => false, 'terlambat_mulai' => false,
                'ditugaskanAt' => now()->subHours(23)->subMinutes(50),
                'assignedAt' => now()->subDays(1)->subHours(2),
            ],
        ];

        $this->command->warn('Menambahkan ' . count($specialConfigs) . ' laporan khusus dengan deadline dekat...');
        $this->command->getOutput()->progressStart(count($specialConfigs));

        foreach ($specialConfigs as $spIdx => $cfg) {
            $reportCode = 'LP-' . date('Y') . '-' . str_pad($nextNumber++, 5, '0', STR_PAD_LEFT);
            $user = $petugasAgus;
            $teamId = $teamsByUser[$user->id];
            $district = self::KECAMATAN[array_rand(self::KECAMATAN)];
            [$centerLat, $centerLng] = self::KECAMATAN_GPS[$district];
            [$lat, $lng] = $this->nearbyGps($centerLat, $centerLng, 1500);

            $dirName = self::DATASET_DIRS[($spIdx) % $dirCount];
            $imagePath = $this->downloadImage($dirName, 'reports');

            $severityShort = match ($cfg['severity']) {
                'Rusak Berat' => 'berat', 'Rusak Sedang' => 'sedang', default => 'ringan',
            };
            $aiDamageType = self::DAMAGE_TYPES[array_rand(self::DAMAGE_TYPES)];
            $aiConfidence = round(0.65 + mt_rand() / mt_getrandmax() * 0.34, 3);

            $report = Report::create([
                'report_code' => $reportCode,
                'user_id' => $user->id,
                'reporter_name' => $user->name,
                'road_name' => self::ROAD_NAMES[array_rand(self::ROAD_NAMES)],
                'district' => $district,
                'latitude' => $lat, 'longitude' => $lng,
                'koordinat_sumber' => 'exif',
                'total_detections' => mt_rand(1, 5),
                'overall_severity' => $cfg['severity'],
                'status' => $cfg['status'],
                'priority' => $cfg['priority'],
                'ai_jenis_kerusakan' => $aiDamageType,
                'ai_severity' => $severityShort,
                'ai_confidence' => $aiConfidence,
                'system_notes' => 'Laporan khusus untuk verifikasi deadline',
                'catatan_petugas' => null,
                'kerusakan_panjang' => round(0.5 + mt_rand() / mt_getrandmax() * 4.5, 2),
                'kerusakan_lebar' => round(0.3 + mt_rand() / mt_getrandmax() * 2.7, 2),
                'deadline_review' => $cfg['deadlineReview'],
                'deadline_resolusi' => $cfg['deadline_resolusi'],
                'deadline_mulai' => $cfg['deadline_mulai'],
                'terlambat_review' => $cfg['terlambat_review'],
                'terlambat_resolusi' => $cfg['terlambat_resolusi'],
                'terlambat_mulai' => $cfg['terlambat_mulai'],
                'assigned_team_id' => in_array($cfg['status'], ['Ditugaskan', 'Sedang Diperbaiki']) ? $teamId : null,
                'assigned_at' => $cfg['assignedAt'] ?? null,
                'ditugaskan_at' => $cfg['ditugaskanAt'] ?? null,
                'assignor_name' => in_array($cfg['status'], ['Ditugaskan', 'Sedang Diperbaiki']) ? 'Budi Santoso' : null,
                'perbaikan_dimulai_at' => $cfg['perbaikanDimulaiAt'] ?? null,
                'perbaikan_selesai_at' => null,
                'pelaksana' => $cfg['status'] === 'Sedang Diperbaiki' ? $user->name : null,
                'image_original_path' => $imagePath,
                'created_at' => $cfg['createdAt'],
                'updated_at' => $cfg['createdAt'],
            ]);

            // 1 foto untuk setiap laporan khusus
            $photoDir = self::DATASET_DIRS[($spIdx + 5) % $dirCount];
            $photoPath = $this->downloadImage($photoDir, 'reports');
            ReportPhoto::create([
                'report_id' => $report->id,
                'reporter_name' => $user->name,
                'image_original_path' => $photoPath,
                'image_hash' => hash('sha256', $report->id . Str::random(8)),
                'latitude' => $lat, 'longitude' => $lng,
                'koordinat_sumber' => 'exif',
                'ai_jenis_kerusakan' => self::DAMAGE_TYPES[array_rand(self::DAMAGE_TYPES)],
                'ai_severity' => $severityShort,
                'ai_confidence' => $aiConfidence,
                'total_detections' => mt_rand(1, 4),
                'ai_raw_output' => json_encode($this->generateAiRawOutput($aiDamageType, $aiConfidence)),
                'sort_order' => 0,
                'original_filename' => "special_{$spIdx}_photo.jpg",
                'created_at' => $cfg['createdAt'],
                'updated_at' => $cfg['createdAt'],
            ]);

            // Survey task link
            if ($teamId && isset($surveyByTeam[$teamId]) && count($surveyByTeam[$teamId]) > 0) {
                $st = $surveyByTeam[$teamId][mt_rand(0, count($surveyByTeam[$teamId]) - 1)];
                $report->update(['survey_task_id' => $st->id]);
            }

            $this->command->getOutput()->progressAdvance();
        }

        $this->command->getOutput()->progressFinish();
        $this->command->info("\n✓ " . count($specialConfigs) . " laporan khusus deadline dekat berhasil ditambahkan.");
    }

    private function downloadImage(string $dirName, string $subdir): string
    {
        $url = "https://raw.githubusercontent.com/biankatpas/Cracks-and-Potholes-in-Road-Images-Dataset/master/Dataset/{$dirName}/{$dirName}_RAW.jpg";

        if (isset($this->downloaded[$url])) {
            $filename = Str::uuid() . '.jpg';
            $path = $subdir . '/' . $filename;
            Storage::disk('public')->put($path, $this->downloaded[$url]);
            return $path;
        }

        $filename = Str::uuid() . '.jpg';
        $path = $subdir . '/' . $filename;

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
            return $this->generatePlaceholder($path, "Road Damage {$dirName}");
        }

        $this->downloaded[$url] = $imageData;
        Storage::disk('public')->put($path, $imageData);

        return $path;
    }

    private function generatePlaceholder(string $path, string $label): string
    {
        $img = imagecreatetruecolor(400, 300);
        $bg = imagecolorallocate($img, mt_rand(100, 200), mt_rand(100, 200), mt_rand(100, 200));
        imagefill($img, 0, 0, $bg);
        $textColor = imagecolorallocate($img, 255, 255, 255);
        $fontSize = 4;
        $textWidth = imagefontwidth($fontSize) * strlen($label);
        $x = (400 - $textWidth) / 2;
        imagestring($img, $fontSize, (int) $x, 140, $label, $textColor);
        ob_start();
        imagejpeg($img, null, 80);
        $imageData = ob_get_clean();
        imagedestroy($img);
        Storage::disk('public')->put($path, $imageData);
        return $path;
    }

    private function calcDeadline(string $priority, string $key, int $default, \Carbon\Carbon $fromDate): \Carbon\Carbon
    {
        $hours = config("deadline.{$priority}.{$key}", $default);
        return $fromDate->copy()->addHours((int) $hours);
    }

    private function generateAiRawOutput(string $damageType, float $confidence): array
    {
        $count = mt_rand(1, 4);
        $detections = [];
        for ($d = 0; $d < $count; $d++) {
            $detections[] = [
                'class' => $damageType,
                'confidence' => round($confidence - ($d * 0.05), 3),
                'bbox' => [
                    round(mt_rand() / mt_getrandmax() * 400, 2),
                    round(mt_rand() / mt_getrandmax() * 300, 2),
                    round(50 + mt_rand() / mt_getrandmax() * 200, 2),
                    round(50 + mt_rand() / mt_getrandmax() * 150, 2),
                ],
            ];
        }
        return ['detections' => $detections, 'model' => 'yolov8s_ensemble'];
    }
}
