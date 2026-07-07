<?php

namespace App\Http\Controllers;

use App\Models\Report;
use App\Models\ReportPhoto;
use App\Models\StatusLog;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class WargaReportController extends Controller
{
    private const ORIGINALS_FOLDER = 'reports/originals';

    private const MAX_PHOTO_AGE_DAYS = 7;

    private const DAILY_LIMIT = 3;

    public function store(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'reporter_name' => ['required', 'string', 'max:100'],
                'road_name' => ['required', 'string', 'max:255'],
                'district' => ['required', 'string', 'in:'.implode(',', $this->getKecamatanList())],
                'latitude' => ['required', 'numeric', 'between:-11,6'],
                'longitude' => ['required', 'numeric', 'between:95,141'],
                'description' => ['nullable', 'string', 'max:2000'],
                'image' => ['required', 'file', 'mimes:jpeg,jpg,png', 'max:5120'],
                'kerusakan_panjang' => ['nullable', 'numeric', 'min:0.01', 'max:100'],
                'kerusakan_lebar' => ['nullable', 'numeric', 'min:0.01', 'max:100'],
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Data yang dikirim tidak valid.',
                'errors' => $e->errors(),
            ], 422);
        }

        if (! $this->isInSidoarjo((float) $validated['latitude'], (float) $validated['longitude'])) {
            return response()->json([
                'success' => false,
                'message' => 'Koordinat berada di luar wilayah Kabupaten Sidoarjo.',
                'error_code' => 'KOORDINAT_DILUAR_WILAYAH',
            ], 422);
        }

        $userId = auth()->id();

        $dailyLimitResult = $this->checkDailyLimit($userId);
        if ($dailyLimitResult !== null) {
            return $dailyLimitResult;
        }

        return $this->processAndCreateReport($request, $validated, $userId);
    }

    /**
     * POST /api/public/reports — No auth required.
     * Auto-create warga user by phone number.
     */
    public function storePublic(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'phone' => ['required', 'string', 'regex:/^08[0-9]{8,13}$/'],
                'reporter_name' => ['required', 'string', 'max:100'],
                'road_name' => ['required', 'string', 'max:255'],
                'district' => ['required', 'string', 'in:'.implode(',', $this->getKecamatanList())],
                'latitude' => ['required', 'numeric', 'between:-11,6'],
                'longitude' => ['required', 'numeric', 'between:95,141'],
                'description' => ['nullable', 'string', 'max:2000'],
                'image' => ['required', 'file', 'mimes:jpeg,jpg,png', 'max:5120'],
                'kerusakan_panjang' => ['nullable', 'numeric', 'min:0.01', 'max:100'],
                'kerusakan_lebar' => ['nullable', 'numeric', 'min:0.01', 'max:100'],
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Data yang dikirim tidak valid.',
                'errors' => $e->errors(),
            ], 422);
        }

        if (! $this->isInSidoarjo((float) $validated['latitude'], (float) $validated['longitude'])) {
            return response()->json([
                'success' => false,
                'message' => 'Koordinat berada di luar wilayah Kabupaten Sidoarjo.',
                'error_code' => 'KOORDINAT_DILUAR_WILAYAH',
            ], 422);
        }

        $phone = $validated['phone'];
        $user = User::firstOrCreate(
            ['email' => 'warga_'.$phone.'@jalankita.local'],
            [
                'name' => $validated['reporter_name'],
                'phone' => $phone,
                'password' => bcrypt(Str::random(32)),
                'role' => 'warga',
                'registration_ip' => $request->ip(),
            ]
        );

        $dailyLimitResult = $this->checkDailyLimit($user->id);
        if ($dailyLimitResult !== null) {
            return $dailyLimitResult;
        }

        return $this->processAndCreateReport($request, $validated, $user->id);
    }

    /**
     * GET /api/public/reports?phone=xxx — No auth required.
     * Track reports by phone number.
     */
    public function indexByPhone(Request $request): JsonResponse
    {
        $phone = $request->query('phone');

        if (! $phone || ! preg_match('/^08[0-9]{8,13}$/', $phone)) {
            return response()->json([
                'success' => false,
                'message' => 'Nomor telepon tidak valid.',
            ], 422);
        }

        $user = User::where('phone', $phone)->first();

        if (! $user) {
            return response()->json([
                'success' => true,
                'data' => [],
                'meta' => ['total' => 0],
            ]);
        }

        $perPage = min((int) $request->query('per_page', 10), 50);
        $status = $request->query('status');

        $query = Report::where('user_id', $user->id)
            ->whereIn('source', ['warga', 'telegram'])
            ->orderBy('created_at', 'desc');

        if ($status) {
            $query->where('status', $status);
        }

        $reports = $query->paginate($perPage);
        $reports->getCollection()->each(fn ($r) => $r->append('first_photo_url'));

        return response()->json([
            'success' => true,
            'data' => $reports->items(),
            'meta' => [
                'current_page' => $reports->currentPage(),
                'last_page' => $reports->lastPage(),
                'per_page' => $reports->perPage(),
                'total' => $reports->total(),
            ],
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $perPage = min((int) $request->query('per_page', 10), 50);
        $status = $request->query('status');

        $query = Report::where('user_id', auth()->id())
            ->whereIn('source', ['warga', 'telegram'])
            ->orderBy('created_at', 'desc');

        if ($status) {
            $query->where('status', $status);
        }

        $reports = $query->paginate($perPage);
        $reports->getCollection()->each(fn ($r) => $r->append('first_photo_url'));

        return response()->json([
            'success' => true,
            'data' => $reports->items(),
            'meta' => [
                'current_page' => $reports->currentPage(),
                'last_page' => $reports->lastPage(),
                'per_page' => $reports->perPage(),
                'total' => $reports->total(),
            ],
        ]);
    }

    public function show(string $id): JsonResponse
    {
        $report = Report::where('id', $id)
            ->where('user_id', auth()->id())
            ->whereIn('source', ['warga', 'telegram'])
            ->with(['photos' => function ($q) {
                $q->orderBy('sort_order');
            }])
            ->first();

        if (! $report) {
            return response()->json([
                'success' => false,
                'message' => 'Laporan tidak ditemukan.',
            ], 404);
        }

        $timeline = StatusLog::where('report_id', $report->id)
            ->orderBy('created_at', 'asc')
            ->get(['old_status', 'new_status', 'notes', 'created_at', 'user_id']);

        return response()->json([
            'success' => true,
            'data' => [
                'report' => $report->toArray(),
                'timeline' => $timeline,
            ],
        ]);
    }

    public function track(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'report_code' => ['required', 'string', 'max:20'],
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Kode laporan tidak valid.',
                'errors' => $e->errors(),
            ], 422);
        }

        $report = Report::where('report_code', $validated['report_code'])
            ->with(['photos' => function ($q) {
                $q->orderBy('sort_order');
            }])
            ->first();

        if (! $report) {
            return response()->json([
                'success' => false,
                'message' => 'Laporan dengan kode tersebut tidak ditemukan.',
            ], 404);
        }

        $timeline = StatusLog::where('report_id', $report->id)
            ->orderBy('created_at', 'asc')
            ->get(['old_status', 'new_status', 'notes', 'created_at']);

        return response()->json([
            'success' => true,
            'data' => [
                'report' => [
                    'id' => $report->id,
                    'report_code' => $report->report_code,
                    'road_name' => $report->road_name,
                    'district' => $report->district,
                    'status' => $report->status,
                    'created_at' => $report->created_at?->toIso8601String(),
                    'updated_at' => $report->updated_at?->toIso8601String(),
                    'description' => $report->description,
                    'photos' => $report->photos->map(function ($p) {
                        return [
                            'image_original_url' => $p->image_original_url,
                            'created_at' => $p->created_at?->toIso8601String(),
                        ];
                    }),
                ],
                'timeline' => $timeline,
            ],
        ]);
    }

    /**
     * GET /api/public/stats — No auth required.
     * Returns aggregated statistics and recent reports for the landing page.
     */
    public function publicStats(): JsonResponse
    {
        $totalReports = Report::count();
        $completedReports = Report::where('status', 'Selesai')->count();
        $inProgress = Report::whereNotIn('status', ['Selesai', 'Ditolak'])->count();

        $recentReports = Report::where('status', 'Selesai')
            ->whereNotNull('road_name')
            ->orderBy('updated_at', 'desc')
            ->take(5)
            ->get(['report_code', 'road_name', 'district', 'status', 'description', 'updated_at']);

        $kecamatan = $this->getKecamatanList();

        return response()->json([
            'success' => true,
            'data' => [
                'total_reports' => $totalReports,
                'completed_reports' => $completedReports,
                'in_progress' => $inProgress,
                'kecamatan_count' => count($kecamatan),
                'kecamatan' => $kecamatan,
                'recent_reports' => $recentReports->map(fn ($r) => [
                    'report_code' => $r->report_code,
                    'road_name' => $r->road_name,
                    'district' => $r->district,
                    'status' => $r->status,
                    'description' => $r->description,
                    'updated_at' => $r->updated_at?->toIso8601String(),
                ]),
            ],
        ]);
    }

    // ── Shared Helpers ─────────────────────────────────────────────────

    private function checkDailyLimit(int $userId): ?JsonResponse
    {
        $todayCount = Report::where('user_id', $userId)
            ->whereDate('created_at', today())
            ->count();

        if ($todayCount >= self::DAILY_LIMIT) {
            return response()->json([
                'success' => false,
                'message' => 'Anda telah mencapai batas laporan harian ('.self::DAILY_LIMIT.' laporan). Silakan coba lagi besok.',
                'error_code' => 'DAILY_LIMIT_EXCEEDED',
            ], 429);
        }

        return null;
    }

    private function processAndCreateReport(Request $request, array $validated, int $userId): JsonResponse
    {
        $imageFile = $request->file('image');

        $exifCheck = $this->validatePhotoDateExif($imageFile->getPathname());

        if ($exifCheck['status'] === 'future_date') {
            return response()->json([
                'success' => false,
                'message' => $exifCheck['message'],
                'error_code' => 'PHOTO_FUTURE_DATE',
            ], 422);
        }

        if ($exifCheck['status'] === 'too_old') {
            return response()->json([
                'success' => false,
                'message' => $exifCheck['message'],
                'error_code' => 'PHOTO_TOO_OLD',
            ], 422);
        }

        if ($exifCheck['status'] === 'no_exif_date') {
            return response()->json([
                'success' => false,
                'message' => 'Foto tidak memiliki metadata tanggal. Gunakan foto asli dari kamera.',
                'error_code' => 'PHOTO_NO_EXIF_DATE',
            ], 422);
        }

        if ($exifCheck['status'] === 'exif_read_error') {
            return response()->json([
                'success' => false,
                'message' => 'Metadata foto tidak dapat dibaca. Gunakan foto asli dari kamera perangkat Anda.',
                'error_code' => 'PHOTO_EXIF_READ_ERROR',
            ], 422);
        }

        $imageHash = $this->calculateImageHash($imageFile->getPathname());

        if ($imageHash !== null) {
            $existingPhoto = ReportPhoto::where('image_hash', $imageHash)->first();
            if ($existingPhoto) {
                $existingReport = Report::find($existingPhoto->report_id);
                if ($existingReport) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Foto ini sudah pernah digunakan untuk laporan '.$existingReport->report_code.'.',
                        'error_code' => 'DUPLICATE_IMAGE',
                    ], 422);
                }
            }
        }

        $exifGps = $this->extractExifGps($imageFile->getPathname());
        $systemNotes = null;

        if ($exifGps) {
            $gpsDistance = $this->haversineDistance(
                $exifGps['lat'], $exifGps['lng'],
                (float) $validated['latitude'], (float) $validated['longitude']
            );

            if ($gpsDistance > 1000) {
                $systemNotes = '[INFO] GPS EXIF foto berjarak '.round($gpsDistance).'m dari koordinat form.';
            }
        } else {
            $systemNotes = '[INFO] Foto tidak memiliki GPS EXIF, menggunakan koordinat dari browser.';
        }

        try {
            $report = DB::transaction(function () use ($validated, $imageFile, $imageHash, $exifGps, $userId, $systemNotes) {

                $reportCode = null;
                do {
                    $year = date('Y');
                    $lastReport = Report::where('report_code', 'like', "LP-{$year}-%")
                        ->orderBy('report_code', 'desc')
                        ->first();

                    if ($lastReport) {
                        $lastNumber = (int) substr($lastReport->report_code, -5);
                        $nextNumber = $lastNumber + 1;
                    } else {
                        $nextNumber = 1;
                    }

                    $code = sprintf('LP-%s-%05d', $year, $nextNumber);
                    $reportCode = $code;
                } while (Report::where('report_code', $reportCode)->exists());

                $ext = $imageFile->getClientOriginalExtension() ?: $imageFile->guessExtension() ?: 'jpg';
                $filename = Str::uuid()->toString().'-'.time().'.'.$ext;

                $photoPath = $this->savePhotoToStorage($imageFile, $filename);

                if (! $photoPath) {
                    throw new \RuntimeException('Gagal menyimpan foto ke storage.');
                }

                $report = Report::create([
                    'user_id' => $userId,
                    'report_code' => $reportCode,
                    'reporter_name' => $validated['reporter_name'],
                    'road_name' => $validated['road_name'],
                    'district' => $validated['district'],
                    'latitude' => $validated['latitude'],
                    'longitude' => $validated['longitude'],
                    'image_original_path' => $photoPath,
                    'image_hash' => $imageHash,
                    'status' => 'Menunggu Verifikasi',
                    'source' => 'warga',
                    'description' => $validated['description'] ?? null,
                    'kerusakan_panjang' => $validated['kerusakan_panjang'] ?? null,
                    'kerusakan_lebar' => $validated['kerusakan_lebar'] ?? null,
                    'catatan_petugas' => null,
                    'priority' => 'Sedang',
                    'overall_severity' => null,
                ]);

                ReportPhoto::create([
                    'report_id' => $report->id,
                    'reporter_name' => $validated['reporter_name'],
                    'image_original_path' => $photoPath,
                    'image_hash' => $imageHash,
                    'latitude' => $exifGps ? $exifGps['lat'] : $validated['latitude'],
                    'longitude' => $exifGps ? $exifGps['lng'] : $validated['longitude'],
                    'koordinat_sumber' => $exifGps ? 'exif' : 'form',
                    'sort_order' => 0,
                    'original_filename' => $imageFile->getClientOriginalName(),
                ]);

                if ($systemNotes) {
                    $report->update(['system_notes' => $systemNotes]);
                }

                return $report;
            });

            Log::info('DeltaJalan: Laporan warga baru.', [
                'report_id' => $report->id,
                'report_code' => $report->report_code,
                'user_id' => $userId,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Laporan berhasil dikirim dan sedang menunggu verifikasi petugas.',
                'data' => [
                    'report' => $report->toArray(),
                ],
            ], 201);

        } catch (\Exception $e) {
            Log::error('DeltaJalan: Gagal menyimpan laporan warga.', [
                'error' => $e->getMessage(),
                'user_id' => $userId,
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Terjadi kesalahan saat menyimpan laporan. Silakan coba lagi.',
                'debug' => config('app.debug') ? $e->getMessage() : null,
            ], 500);
        }
    }

    // ── Helper Methods ──────────────────────────────────────────────────

    private function validatePhotoDateExif(string $filePath): array
    {
        if (! function_exists('exif_read_data')) {
            return [
                'status' => 'no_exif_support',
                'message' => 'Ekstensi EXIF PHP tidak aktif.',
                'photo_date' => null,
            ];
        }

        try {
            $exifData = @exif_read_data($filePath, 'EXIF', false);

            if (! $exifData) {
                return [
                    'status' => 'no_exif_date',
                    'message' => 'Foto tidak memiliki metadata EXIF.',
                    'photo_date' => null,
                ];
            }

            $rawDate = $exifData['DateTimeOriginal']
                ?? $exifData['DateTimeDigitized']
                ?? $exifData['DateTime']
                ?? null;

            if (! $rawDate) {
                return [
                    'status' => 'no_exif_date',
                    'message' => 'Metadata EXIF tidak memiliki informasi tanggal.',
                    'photo_date' => null,
                ];
            }

            $photoDate = \DateTime::createFromFormat('Y:m:d H:i:s', $rawDate);

            if (! $photoDate) {
                return [
                    'status' => 'exif_read_error',
                    'message' => 'Format tanggal EXIF tidak dapat dibaca.',
                    'photo_date' => null,
                ];
            }

            $photoDateOnly = new \DateTime($photoDate->format('Y-m-d'));
            $todayOnly = new \DateTime('today');

            $diffDays = (int) $todayOnly->diff($photoDateOnly)->days;
            $isFuture = $photoDateOnly > $todayOnly;

            if ($isFuture) {
                return [
                    'status' => 'future_date',
                    'message' => "Tanggal foto ({$photoDate->format('d/m/Y')}) adalah tanggal di masa depan.",
                    'photo_date' => $photoDate->format('Y-m-d'),
                ];
            }

            if ($diffDays > self::MAX_PHOTO_AGE_DAYS) {
                return [
                    'status' => 'too_old',
                    'message' => "Foto diambil pada {$photoDate->format('d/m/Y')} ({$diffDays} hari yang lalu). ".
                                    'Sistem hanya menerima foto maksimal '.self::MAX_PHOTO_AGE_DAYS.' hari terakhir.',
                    'photo_date' => $photoDate->format('Y-m-d'),
                ];
            }

            return [
                'status' => 'valid',
                'message' => 'Tanggal foto valid.',
                'photo_date' => $photoDate->format('Y-m-d'),
            ];
        } catch (\Exception $e) {
            Log::warning('DeltaJalan: Error EXIF warga.', ['error' => $e->getMessage()]);

            return [
                'status' => 'exif_read_error',
                'message' => 'Gagal membaca metadata EXIF.',
                'photo_date' => null,
            ];
        }
    }

    private function extractExifGps(string $filePath): ?array
    {
        if (! function_exists('exif_read_data')) {
            return null;
        }

        try {
            $exif = @exif_read_data($filePath, null, false);
            if (! $exif) {
                return null;
            }

            if (isset($exif['GPSLatitude'], $exif['GPSLongitude'])) {
                $lat = $this->normalizeAndConvertGps($exif['GPSLatitude'], $exif['GPSLatitudeRef'] ?? 'N');
                $lng = $this->normalizeAndConvertGps($exif['GPSLongitude'], $exif['GPSLongitudeRef'] ?? 'E');
                if ($lat !== null && $lng !== null && $this->inIndonesiaBounds($lat, $lng)) {
                    return ['lat' => $lat, 'lng' => $lng];
                }
            }

            if (isset($exif['COMPUTED']['GPSLatitude'], $exif['COMPUTED']['GPSLongitude'])) {
                $lat = (float) $exif['COMPUTED']['GPSLatitude'];
                $lng = (float) $exif['COMPUTED']['GPSLongitude'];
                if ($this->inIndonesiaBounds($lat, $lng)) {
                    return ['lat' => $lat, 'lng' => $lng];
                }
            }

            foreach (['IFD0', 'EXIF'] as $section) {
                if (! isset($exif[$section])) {
                    continue;
                }
                $s = $exif[$section];
                if (isset($s['GPSLatitude'], $s['GPSLongitude'])) {
                    $lat = $this->normalizeAndConvertGps($s['GPSLatitude'], $s['GPSLatitudeRef'] ?? 'N');
                    $lng = $this->normalizeAndConvertGps($s['GPSLongitude'], $s['GPSLongitudeRef'] ?? 'E');
                    if ($lat !== null && $lng !== null && $this->inIndonesiaBounds($lat, $lng)) {
                        return ['lat' => $lat, 'lng' => $lng];
                    }
                }
            }

            return null;
        } catch (\Exception $e) {
            return null;
        }
    }

    private function normalizeAndConvertGps(mixed $gpsValue, string $ref): ?float
    {
        $degrees = null;
        $minutes = null;
        $seconds = null;

        if (is_string($gpsValue)) {
            $parts = array_map('trim', explode(',', $gpsValue));
            if (count($parts) >= 3) {
                $degrees = $this->parseRational($parts[0]);
                $minutes = $this->parseRational($parts[1]);
                $seconds = $this->parseRational($parts[2]);
            }
        } elseif (is_array($gpsValue) && count($gpsValue) >= 3) {
            if (is_array($gpsValue[0])) {
                $degrees = $this->rationalPairToFloat($gpsValue[0]);
                $minutes = $this->rationalPairToFloat($gpsValue[1]);
                $seconds = $this->rationalPairToFloat($gpsValue[2]);
            } elseif (is_numeric($gpsValue[0])) {
                $degrees = (float) $gpsValue[0];
                $minutes = (float) ($gpsValue[1] ?? 0);
                $seconds = (float) ($gpsValue[2] ?? 0);
            } else {
                $degrees = $this->parseRational((string) $gpsValue[0]);
                $minutes = $this->parseRational((string) $gpsValue[1]);
                $seconds = $this->parseRational((string) $gpsValue[2]);
            }
        }

        if ($degrees === null || $minutes === null || $seconds === null) {
            return null;
        }

        $decimal = $degrees + ($minutes / 60) + ($seconds / 3600);
        if (in_array(strtoupper($ref), ['S', 'W'])) {
            $decimal = -$decimal;
        }

        return round($decimal, 8);
    }

    private function parseRational(string $rational): float
    {
        $parts = explode('/', $rational);
        if (count($parts) === 2 && (float) $parts[1] !== 0.0) {
            return (float) $parts[0] / (float) $parts[1];
        }

        return (float) $parts[0];
    }

    private function rationalPairToFloat(array $pair): float
    {
        if (count($pair) < 2) {
            return (float) ($pair[0] ?? 0);
        }

        return ((float) $pair[0]) / ((float) $pair[1]);
    }

    private function inIndonesiaBounds(float $lat, float $lng): bool
    {
        return $lat >= -11 && $lat <= 6 && $lng >= 95 && $lng <= 141;
    }

    private function haversineDistance(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $earthRadius = 6371000;
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);

        $a = sin($dLat / 2) ** 2
           + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;

        return $earthRadius * 2 * asin(sqrt($a));
    }

    private function isInSidoarjo(float $lat, float $lng): bool
    {
        return $lat >= -7.65 && $lat <= -7.25
            && $lng >= 112.50 && $lng <= 112.95;
    }

    private function getKecamatanList(): array
    {
        return [
            'Sidoarjo', 'Buduran', 'Gedangan', 'Sedati', 'Waru', 'Taman',
            'Krian', 'Balongbendo', 'Wonoayu', 'Sukodono', 'Candi', 'Porong',
            'Krembung', 'Tulangan', 'Tanggulangin', 'Jabon', 'Tarik', 'Prambon',
        ];
    }

    private function calculateImageHash(string $filePath): ?string
    {
        try {
            $hash = hash_file('sha256', $filePath);
            if ($hash === false) {
                return null;
            }

            return $hash;
        } catch (\Exception $e) {
            Log::warning('DeltaJalan: Gagal hash warga.', ['error' => $e->getMessage()]);

            return null;
        }
    }

    private function savePhotoToStorage(UploadedFile $file, string $filename): ?string
    {
        try {
            $path = $file->storeAs(self::ORIGINALS_FOLDER, $filename, 'public');
            if ($path !== false) {
                return $path;
            }
        } catch (\Exception $e) {
            Log::warning('DeltaJalan: storeAs gagal.', ['error' => $e->getMessage()]);
        }

        try {
            $destDir = storage_path('app/public/'.self::ORIGINALS_FOLDER);
            if (! is_dir($destDir)) {
                mkdir($destDir, 0755, true);
            }
            $destPath = rtrim($destDir, '\\/').'/'.$filename;
            if (copy($file->getPathname(), $destPath)) {
                return self::ORIGINALS_FOLDER.'/'.$filename;
            }
        } catch (\Exception $e) {
            Log::warning('DeltaJalan: Fallback copy gagal.', ['error' => $e->getMessage()]);
        }

        return null;
    }
}
