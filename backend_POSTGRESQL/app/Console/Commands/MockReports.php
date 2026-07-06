<?php

namespace App\Console\Commands;

use App\Models\Report;
use App\Models\ReportAfterPhoto;
use App\Models\ReportPhoto;
use App\Models\ReportProgressUpdate;
use App\Models\StatusLog;
use App\Models\SurveyTask;
use App\Models\Team;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class MockReports extends Command
{
    protected $signature = 'mock:reports';

    protected $description = 'Generate 60 mock reports with real distribution of statuses';

    private const DAY_MAP = [
        'Minggu' => 0, 'Senin' => 1, 'Selasa' => 2, 'Rabu' => 3,
        'Kamis' => 4, 'Jumat' => 5, 'Sabtu' => 6,
    ];

    private array $users = [];

    private array $supervisors = [];

    private array $teams = [];

    private array $surveyTasks = [];

    private array $roadNames = [
        'Jl. Raya Porong', 'Jl. Ahmad Yani', 'Jl. Gajah Mada', 'Jl. Majapahit',
        'Jl. Pahlawan', 'Jl. Diponegoro', 'Jl. Jenggolo', 'Jl. Thamrin',
        'Jl. Sudirman', 'Jl. Raya Buduran', 'Jl. Raya Waru', 'Jl. Raya Taman',
        'Jl. Raya Krian', 'Jl. Raya Candi', 'Jl. Raya Tanggulangin',
        'Jl. Raya Sedati', 'Jl. Raya Sukodono', 'Jl. Raya Wonoayu',
    ];

    private array $damageClasses = [
        'Lubang', 'Retak Kulit Buaya', 'Retak Memanjang', 'Retak Melintang',
    ];

    private array $statusDistribution = [];

    private ?int $lastCodeNumber = null;

    private array $stats = [
        'reports' => 0,
        'photos' => 0,
        'logs' => 0,
        'progress' => 0,
        'after_photos' => 0,
        'errors' => 0,
    ];

    public function handle(): int
    {
        $this->info('╔══════════════════════════════════════════╗');
        $this->info('║       Mock Reports Generator             ║');
        $this->info('╚══════════════════════════════════════════╝');
        $this->newLine();

        if (! $this->validateReferences()) {
            return 1;
        }

        $this->lastCodeNumber = $this->resolveLastCodeNumber();
        $this->info("[INFO] Report code terakhir: LP-2026-{$this->lastCodeNumber}");

        $this->buildStatusDistribution();

        foreach ($this->statusDistribution as $i => $item) {
            $this->generateOne($item);
        }

        $this->outputSummary();

        return 0;
    }

    private function validateReferences(): bool
    {
        $this->info('[INFO] Memvalidasi reference data...');

        $this->teams = Team::pluck('id', 'name')->toArray();
        $requiredTeams = ['Tim Satgas Utara', 'Tim Satgas Pusat', 'Tim Satgas Barat', 'Tim Satgas Selatan', 'Tim Satgas Timur'];
        foreach ($requiredTeams as $name) {
            if (! isset($this->teams[$name])) {
                $this->error("[VALIDASI GAGAL] Team '$name' tidak ditemukan.");

                return false;
            }
        }

        $petugasIds = [61, 62, 63, 64, 65];
        $petugas = User::whereIn('id', $petugasIds)->where('role', 'petugas')->get()->keyBy('id');
        $this->users = [];
        foreach ($petugasIds as $id) {
            if (! isset($petugas[$id])) {
                $this->warn("[WARN] Petugas ID $id tidak ditemukan — akan di-skip.");

                continue;
            }
            $this->users[$id] = $petugas[$id];
        }

        $supervisorIds = [66, 67, 68, 69];
        $supervisors = User::whereIn('id', $supervisorIds)->where('role', 'supervisor')->get()->keyBy('id');
        $this->supervisors = [];
        foreach ($supervisorIds as $id) {
            if (! isset($supervisors[$id])) {
                $this->warn("[WARN] Supervisor ID $id tidak ditemukan — akan di-skip.");

                continue;
            }
            $this->supervisors[$id] = $supervisors[$id];
        }

        if (count($this->users) < 3) {
            $this->error('[VALIDASI GAGAL] Minimal 3 petugas diperlukan.');

            return false;
        }

        if (count($this->supervisors) < 2) {
            $this->error('[VALIDASI GAGAL] Minimal 2 supervisor diperlukan.');

            return false;
        }

        $this->surveyTasks = SurveyTask::where('status', 'aktif')
            ->select('id', 'kecamatan', 'team_id', 'tanggal_patroli')
            ->orderBy('tanggal_patroli')
            ->get()
            ->toArray();

        if (empty($this->surveyTasks)) {
            $this->warn('[WARN] Tidak ada survey task aktif — laporan tidak akan di-link ke task.');
        }

        $this->info('[INFO] Validasi reference data ✅');

        return true;
    }

    private function resolveLastCodeNumber(): int
    {
        $last = Report::max('report_code');
        if (! $last) {
            return 67;
        }
        preg_match('/LP-(\d{4})-(\d{5})/', $last, $m);

        return (int) ($m[2] ?? 67);
    }

    private function buildStatusDistribution(): void
    {
        $now = Carbon::now();

        $statuses = [
            ['status' => 'Menunggu Review',     'count' => 12, 'max_age_days' => 0],
            ['status' => 'Ditinjau',             'count' => 6,  'max_age_days' => 0],
            ['status' => 'Disetujui',            'count' => 8,  'max_age_days' => 1],
            ['status' => 'Ditugaskan',           'count' => 6,  'max_age_days' => 1],
            ['status' => 'Sedang Diperbaiki',    'count' => 12, 'max_age_days' => 2],
            ['status' => 'Selesai',              'count' => 10, 'max_age_days' => 180],
            ['status' => 'Ditolak',              'count' => 6,  'max_age_days' => 1],
        ];

        $priorities = ['Rendah', 'Sedang', 'Tinggi'];
        $this->statusDistribution = [];

        $reportIdx = 0;
        foreach ($statuses as $s) {
            for ($i = 0; $i < $s['count']; $i++) {
                $ageDays = $s['max_age_days'] > 0
                    ? random_int(1, $s['max_age_days'])
                    : 0;
                $createdAt = (clone $now)->subDays($ageDays)->addMinutes(random_int(10, 600));
                $priority = $priorities[$reportIdx % 3];
                $reportIdx++;

                $this->statusDistribution[] = [
                    'status' => $s['status'],
                    'created_at' => $createdAt,
                    'priority' => $priority,
                ];
            }
        }

        shuffle($this->statusDistribution);
    }

    private function generateOne(array $item): void
    {
        $status = $item['status'];
        $createdAt = $item['created_at'];
        $priority = $item['priority'];

        $user = $this->users[array_rand($this->users)];
        $teamId = $user->team_id;
        $supervisor = $this->supervisors[array_rand($this->supervisors)];

        [$lat, $lng, $district] = $this->randomCoordinate();
        $roadName = $this->roadNames[array_rand($this->roadNames)];

        $totalDetections = random_int(1, 5);
        $isBaik = random_int(1, 8) === 1;
        if ($isBaik) {
            $totalDetections = 0;
        }
        $severity = $this->randomSeverity($totalDetections);
        $detections = $this->generateDetections($totalDetections);
        $jenisKerusakan = $totalDetections > 0 ? ($detections[0]['class'] ?? null) : null;
        $firstSeverity = $totalDetections > 0 ? ($detections[0]['severity'] ?? null) : null;
        $confidence = $totalDetections > 0 ? ($detections[0]['confidence'] ?? null) : null;

        $isBatch = $totalDetections > 0 && random_int(1, 4) === 1;
        $batchId = $isBatch ? (string) Str::uuid() : null;

        $surveyTask = $this->pickSurveyTask($teamId, $district);

        $photoCount = $isBatch ? random_int(3, 6) : random_int(1, 2);
        $now = Carbon::now();
        DB::beginTransaction();
        try {
            $reportId = (string) Str::uuid();
            $this->lastCodeNumber++;
            $reportCode = sprintf('LP-2026-%05d', $this->lastCodeNumber);

            $perbaikanDimulaiAt = null;
            $perbaikanSelesaiAt = null;

            if (in_array($status, ['Sedang Diperbaiki', 'Selesai'])) {
                $perbaikanDimulaiAt = (clone $createdAt)->addDays(random_int(1, 3))->addHours(random_int(1, 8));
            }
            if ($status === 'Selesai') {
                $perbaikanSelesaiAt = (clone $perbaikanDimulaiAt)->addDays(random_int(2, 7))->addHours(random_int(1, 8));
                if ($perbaikanSelesaiAt > $now) {
                    $perbaikanSelesaiAt = (clone $now)->subHours(random_int(1, 12));
                }
            }

            $deadlineReview = $this->calcDeadlineReview($priority, $createdAt);
            $deadlineResolusi = $perbaikanDimulaiAt
                ? $this->calcDeadlineResolusi($priority, $perbaikanDimulaiAt)
                : null;

            $terlambatReview = $deadlineReview && $deadlineReview->isPast()
                && in_array($status, ['Menunggu Review', 'Ditinjau']);
            $terlambatResolusi = $deadlineResolusi && $deadlineResolusi->isPast()
                && $status === 'Sedang Diperbaiki';

            DB::table('reports')->insert([
                'id' => $reportId,
                'user_id' => $user->id,
                'batch_id' => $batchId,
                'report_code' => $reportCode,
                'reporter_name' => $user->name,
                'road_name' => $roadName,
                'district' => $district,
                'latitude' => $lat,
                'longitude' => $lng,
                'koordinat_sumber' => $isBatch ? 'browser_gps' : 'manual',
                'image_original_path' => null,
                'image_result_path' => null,
                'image_hash' => null,
                'total_detections' => $totalDetections,
                'overall_severity' => $severity,
                'ai_raw_output' => json_encode($detections),
                'ai_jenis_kerusakan' => $jenisKerusakan,
                'ai_severity' => $firstSeverity,
                'ai_confidence' => $confidence,
                'status' => $status,
                'priority' => $priority,
                'system_notes' => 'Laporan mock',
                'catatan_petugas' => random_int(0, 1) ? 'Perlu penanganan segera' : null,
                'kerusakan_panjang' => round(0.5 + mt_rand() / mt_getrandmax() * 4.5, 2),
                'kerusakan_lebar' => round(0.3 + mt_rand() / mt_getrandmax() * 2.7, 2),
                'assigned_team_id' => in_array($status, ['Ditugaskan', 'Sedang Diperbaiki', 'Selesai']) ? $teamId : null,
                'assigned_at' => in_array($status, ['Ditugaskan', 'Sedang Diperbaiki', 'Selesai'])
                    ? (clone $createdAt)->addDays(random_int(1, 2)) : null,
                'ditugaskan_at' => in_array($status, ['Ditugaskan', 'Sedang Diperbaiki', 'Selesai'])
                    ? (clone $createdAt)->addDays(random_int(2, 3)) : null,
                'assignor_name' => in_array($status, ['Ditugaskan', 'Sedang Diperbaiki', 'Selesai']) ? $supervisor->name : null,
                'pelaksana' => in_array($status, ['Sedang Diperbaiki', 'Selesai']) ? $user->name : null,
                'perbaikan_dimulai_at' => $perbaikanDimulaiAt,
                'perbaikan_selesai_at' => $perbaikanSelesaiAt,
                'after_photo_path' => null,
                'after_photo_hash' => null,
                'after_photo_notes' => $status === 'Selesai' ? 'Perbaikan selesai dilaksanakan' : null,
                'estimasi_hari' => $this->estimasiHari($priority),
                'deadline_review' => $deadlineReview,
                'deadline_resolusi' => $deadlineResolusi,
                'terlambat_review' => $terlambatReview,
                'terlambat_resolusi' => $terlambatResolusi,
                'survey_task_id' => $surveyTask['id'] ?? null,
                'created_at' => $createdAt,
                'updated_at' => $createdAt,
            ]);

            $imageHash = '';

            for ($p = 0; $p < $photoCount; $p++) {
                $photoLat = round($lat + (mt_rand() / mt_getrandmax() - 0.5) * 0.002, 6);
                $photoLng = round($lng + (mt_rand() / mt_getrandmax() - 0.5) * 0.002, 6);
                $photoHash = hash('sha256', (string) Str::uuid().microtime());
                $photoDetections = $isBaik ? [] : $this->generateDetections(random_int(1, 3));

                if ($totalDetections === 0 && $p === 0) {
                    $photoDetections = [];
                }

                ReportPhoto::create([
                    'report_id' => $reportId,
                    'reporter_name' => $user->name,
                    'image_original_path' => "reports/originals/$reportCode-$p.jpg",
                    'image_result_path' => $totalDetections > 0 ? "reports/results/$reportCode-$p.jpg" : null,
                    'image_hash' => $photoHash,
                    'latitude' => $photoLat,
                    'longitude' => $photoLng,
                    'koordinat_sumber' => $isBatch && $p === 0 ? 'exif' : 'manual',
                    'ai_jenis_kerusakan' => ! empty($photoDetections) ? ($photoDetections[0]['class'] ?? null) : null,
                    'ai_severity' => ! empty($photoDetections) ? ($photoDetections[0]['severity'] ?? null) : null,
                    'ai_confidence' => ! empty($photoDetections) ? ($photoDetections[0]['confidence'] ?? null) : null,
                    'ai_raw_output' => $photoDetections,
                    'total_detections' => count($photoDetections),
                    'kerusakan_panjang' => round(0.5 + mt_rand() / mt_getrandmax() * 4.5, 2),
                    'kerusakan_lebar' => round(0.3 + mt_rand() / mt_getrandmax() * 2.7, 2),
                    'system_notes' => null,
                    'sort_order' => $p,
                    'original_filename' => "$reportCode-$p.jpg",
                    'created_at' => $createdAt,
                    'updated_at' => $createdAt,
                ]);

                $this->stats['photos']++;
            }

            $statusLogs = $this->generateStatusLogs($status, $reportId, $user, $supervisor, $createdAt, $perbaikanDimulaiAt, $perbaikanSelesaiAt);
            foreach ($statusLogs as $log) {
                StatusLog::create($log);
                $this->stats['logs']++;
            }

            if ($status === 'Sedang Diperbaiki') {
                $progressCount = random_int(2, 4);
                for ($pr = 0; $pr < $progressCount; $pr++) {
                    ReportProgressUpdate::create([
                        'id' => (string) Str::uuid(),
                        'report_id' => $reportId,
                        'user_id' => $user->id,
                        'foto_path' => "reports/progress/$reportCode-prog-$pr.jpg",
                        'catatan' => ['Pengerjaan tahap awal', 'Perbaikan 50%', 'Hampir selesai', 'Finishing'][$pr] ?? 'Tahap pengerjaan',
                        'created_at' => (clone $perbaikanDimulaiAt)->addDays($pr * 2)->addHours(random_int(1, 8)),
                        'updated_at' => (clone $perbaikanDimulaiAt)->addDays($pr * 2)->addHours(random_int(1, 8)),
                    ]);
                    $this->stats['progress']++;
                }
            }

            if ($status === 'Selesai') {
                $afterCount = random_int(2, 3);
                $afterHash = '';
                for ($af = 0; $af < $afterCount; $af++) {
                    $afterHash = hash('sha256', (string) Str::uuid().microtime());
                    ReportAfterPhoto::create([
                        'report_id' => $reportId,
                        'file_path' => "reports/after/$reportCode-after-$af.jpg",
                        'file_hash' => $afterHash,
                        'sort_order' => $af,
                        'created_at' => $perbaikanSelesaiAt,
                        'updated_at' => $perbaikanSelesaiAt,
                    ]);
                    $this->stats['after_photos']++;
                }

                Report::where('id', $reportId)->update([
                    'after_photo_path' => "reports/after/$reportCode-after-0.jpg",
                    'after_photo_hash' => $afterHash,
                ]);
            }

            DB::commit();

            $this->stats['reports']++;
            $this->info("[Mock] ✅ $reportCode — {$user->name} — $district — $status");
        } catch (\Throwable $e) {
            DB::rollBack();
            $this->stats['errors']++;
            $this->warn("[Mock] ❌ {$item['status']} — GAGAL: {$e->getMessage()}");
        }
    }

    private function generateDetections(int $count): array
    {
        if ($count <= 0) {
            return [];
        }

        $results = [];
        $usedClasses = [];

        for ($i = 0; $i < $count; $i++) {
            $cls = $this->damageClasses[array_rand($this->damageClasses)];
            $confidence = round(0.65 + mt_rand() / mt_getrandmax() * 0.33, 2);
            $results[] = [
                'class' => $cls,
                'confidence' => $confidence,
                'severity' => $this->randomAiSeverity(),
                'bbox' => [
                    random_int(50, 400),
                    random_int(50, 400),
                    random_int(50, 200),
                    random_int(50, 200),
                ],
            ];
        }

        return $results;
    }

    private function randomSeverity(int $totalDetections): string
    {
        if ($totalDetections === 0) {
            return 'Baik';
        }
        $weights = [5 => 'Rusak Ringan', 3 => 'Rusak Sedang', 1 => 'Rusak Berat'];
        $rand = random_int(1, array_sum(array_keys($weights)));
        foreach ($weights as $w => $s) {
            $rand -= $w;
            if ($rand <= 0) {
                return $s;
            }
        }

        return 'Rusak Ringan';
    }

    private function randomAiSeverity(): string
    {
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

    private function randomCoordinate(): array
    {
        $districts = [
            ['lat' => -7.4521, 'lng' => 112.7188, 'name' => 'Sidoarjo'],
            ['lat' => -7.4207, 'lng' => 112.7240, 'name' => 'Buduran'],
            ['lat' => -7.3967, 'lng' => 112.6926, 'name' => 'Gedangan'],
            ['lat' => -7.3690, 'lng' => 112.7805, 'name' => 'Sedati'],
            ['lat' => -7.3511, 'lng' => 112.7688, 'name' => 'Waru'],
            ['lat' => -7.3727, 'lng' => 112.6695, 'name' => 'Taman'],
            ['lat' => -7.4086, 'lng' => 112.5733, 'name' => 'Krian'],
            ['lat' => -7.4418, 'lng' => 112.5295, 'name' => 'Balongbendo'],
            ['lat' => -7.4690, 'lng' => 112.6238, 'name' => 'Wonoayu'],
            ['lat' => -7.3892, 'lng' => 112.6461, 'name' => 'Sukodono'],
            ['lat' => -7.4946, 'lng' => 112.7340, 'name' => 'Candi'],
            ['lat' => -7.5398, 'lng' => 112.6869, 'name' => 'Porong'],
            ['lat' => -7.5213, 'lng' => 112.6272, 'name' => 'Krembung'],
            ['lat' => -7.5060, 'lng' => 112.6538, 'name' => 'Tulangan'],
            ['lat' => -7.5128, 'lng' => 112.7094, 'name' => 'Tanggulangin'],
            ['lat' => -7.5734, 'lng' => 112.7509, 'name' => 'Jabon'],
            ['lat' => -7.4517, 'lng' => 112.5549, 'name' => 'Tarik'],
            ['lat' => -7.5425, 'lng' => 112.6060, 'name' => 'Prambon'],
        ];

        $d = $districts[array_rand($districts)];
        $lat = round($d['lat'] + (mt_rand() / mt_getrandmax() - 0.5) * 0.01, 6);
        $lng = round($d['lng'] + (mt_rand() / mt_getrandmax() - 0.5) * 0.01, 6);

        return [$lat, $lng, $d['name']];
    }

    private function pickSurveyTask(string $teamId, string $district): ?array
    {
        $candidates = array_filter($this->surveyTasks, fn ($t) => $t['team_id'] === $teamId && $t['kecamatan'] === $district
        );
        if (empty($candidates)) {
            return null;
        }

        return $candidates[array_rand($candidates)];
    }

    private function generateStatusLogs(
        string $finalStatus,
        string $reportId,
        User $user,
        User $supervisor,
        Carbon $createdAt,
        ?Carbon $perbaikanDimulaiAt,
        ?Carbon $perbaikanSelesaiAt,
    ): array {
        $logs = [];

        $logs[] = [
            'report_id' => $reportId,
            'old_status' => null,
            'new_status' => 'Menunggu Review',
            'actor_name' => $user->name,
            'actor_role' => 'petugas',
            'notes' => 'Laporan dibuat',
            'created_at' => $createdAt,
        ];

        $statusFlow = [
            'Menunggu Review' => [],
            'Ditinjau' => ['Menunggu Review' => 'Ditinjau'],
            'Disetujui' => ['Menunggu Review' => 'Ditinjau', 'Ditinjau' => 'Disetujui'],
            'Ditugaskan' => ['Menunggu Review' => 'Ditinjau', 'Ditinjau' => 'Disetujui', 'Disetujui' => 'Ditugaskan'],
            'Sedang Diperbaiki' => ['Menunggu Review' => 'Ditinjau', 'Ditinjau' => 'Disetujui', 'Disetujui' => 'Ditugaskan', 'Ditugaskan' => 'Sedang Diperbaiki'],
            'Selesai' => ['Menunggu Review' => 'Ditinjau', 'Ditinjau' => 'Disetujui', 'Disetujui' => 'Ditugaskan', 'Ditugaskan' => 'Sedang Diperbaiki', 'Sedang Diperbaiki' => 'Selesai'],
            'Ditolak' => ['Menunggu Review' => 'Ditinjau', 'Ditinjau' => 'Ditolak'],
        ];

        $transitions = $statusFlow[$finalStatus] ?? [];

        $idx = 0;
        $totalTransitions = count($transitions);
        $prevStatus = null;
        foreach ($transitions as $from => $to) {
            $logCreated = (clone $createdAt)->addHours(($idx + 1) * random_int(4, 24));
            if ($logCreated > Carbon::now()) {
                $logCreated = Carbon::now();
            }

            $actorName = in_array($to, ['Ditinjau', 'Disetujui', 'Ditugaskan', 'Ditolak'])
                ? $supervisor->name
                : $user->name;
            $actorRole = in_array($to, ['Ditinjau', 'Disetujui', 'Ditugaskan', 'Ditolak'])
                ? 'supervisor'
                : 'petugas';

            $notesMap = [
                'Ditinjau' => 'Sedang direview',
                'Disetujui' => 'Laporan disetujui',
                'Ditugaskan' => 'Ditugaskan ke tim satgas',
                'Sedang Diperbaiki' => 'Pengerjaan dimulai',
                'Selesai' => 'Perbaikan selesai',
                'Ditolak' => 'Laporan ditolak: tidak sesuai prosedur',
            ];

            if ($to === 'Sedang Diperbaiki' && $perbaikanDimulaiAt) {
                $logCreated = clone $perbaikanDimulaiAt;
            }
            if ($to === 'Selesai' && $perbaikanSelesaiAt) {
                $logCreated = clone $perbaikanSelesaiAt;
            }

            $logs[] = [
                'report_id' => $reportId,
                'old_status' => $from,
                'new_status' => $to,
                'actor_name' => $actorName,
                'actor_role' => $actorRole,
                'notes' => $notesMap[$to] ?? 'Status berubah',
                'created_at' => $logCreated,
            ];

            $prevStatus = $to;
            $idx++;
        }

        return $logs;
    }

    private function calcDeadlineReview(string $priority, Carbon $createdAt): Carbon
    {
        $hours = config("deadline.$priority.review_hours", 72);

        return (clone $createdAt)->copy()->addHours((int) $hours);
    }

    private function calcDeadlineResolusi(string $priority, Carbon $perbaikanDimulaiAt): Carbon
    {
        $hours = config("deadline.$priority.resolution_hours", 168);

        return (clone $perbaikanDimulaiAt)->copy()->addHours((int) $hours);
    }

    private function estimasiHari(string $priority): int
    {
        return match ($priority) {
            'Tinggi' => random_int(3, 5),
            'Sedang' => random_int(5, 10),
            'Rendah' => random_int(10, 14),
            default => 7,
        };
    }

    private function outputSummary(): void
    {
        $this->newLine();
        $this->info('═══════════════════════════════════════');
        $this->info('  Mock Reports Complete');
        $this->info('───────────────────────────────────────');
        $this->info("  Total reports   : {$this->stats['reports']}");
        $this->info("  Total photos    : {$this->stats['photos']}");
        $this->info("  Total logs      : {$this->stats['logs']}");
        $this->info("  Total progress  : {$this->stats['progress']}");
        $this->info("  Total after_photos: {$this->stats['after_photos']}");
        $this->info("  Errors          : {$this->stats['errors']}");
        $this->info('═══════════════════════════════════════');
    }
}
