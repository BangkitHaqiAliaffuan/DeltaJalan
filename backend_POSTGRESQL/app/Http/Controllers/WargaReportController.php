<?php

namespace App\Http\Controllers;

use App\Models\DailyUploadCounter;
use App\Models\Report;
use App\Models\ReportPhoto;
use App\Models\StatusLog;
use App\Models\User;
use App\Services\MobileClipService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class WargaReportController extends Controller
{
    private const ORIGINALS_FOLDER = 'reports/originals';

    private const MAX_PHOTO_AGE_DAYS = 7;

    private const DAILY_LIMIT = 5;

    private const FINGERPRINT_LIMIT = 1;

    private const DEVICE_LIMIT = 1;

    public function store(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'reporter_name' => ['required', 'string', 'min:2', 'max:100', 'regex:/^[A-Za-zÀ-ÖØ-öø-ÿ \'.-]+$/'],
                'road_name' => ['required', 'string', 'max:255'],
                'district' => ['required', 'string', 'in:'.implode(',', $this->getKecamatanList())],
                'latitude' => ['required', 'numeric', 'between:-11,6'],
                'longitude' => ['required', 'numeric', 'between:95,141'],
                'description' => ['nullable', 'string', 'max:2000'],
                'images' => ['required', 'array', 'min:1', 'max:3'],
                'images.*' => ['required', 'file', 'mimes:jpeg,jpg,png', 'max:5120'],
                'kerusakan_panjang' => ['nullable', 'numeric', 'min:0.01', 'max:100'],
                'kerusakan_lebar' => ['nullable', 'numeric', 'min:0.01', 'max:100'],
                'full_address' => ['nullable', 'string', 'max:500'],
                'quality_scores' => ['nullable', 'array', 'max:3'],
                'quality_scores.*' => ['nullable', 'json'],
                'captcha_token' => ['nullable', 'string'],
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

        if (! empty($validated['captcha_token'])) {
            $captchaResult = $this->verifyRecaptcha($validated['captcha_token']);
            if ($captchaResult !== true) {
                return $captchaResult;
            }
        }

        $userId = auth()->id();

        $dailyLimitResult = $this->checkDailyLimit($userId);
        if ($dailyLimitResult !== null) {
            return $dailyLimitResult;
        }

        // Fingerprint & device limits only for guests
        if (!$userId) {
            $fingerprintCheck = $this->checkFingerprintLimit($request);
            if ($fingerprintCheck !== null) {
                return $fingerprintCheck;
            }

            $deviceCheck = $this->checkDeviceLimit($request);
            if ($deviceCheck !== null) {
                return $deviceCheck;
            }
        }

        $response = $this->processAndCreateReport($request, $validated, $userId);

        if ($response->getStatusCode() === 201 && !$userId) {
            $this->incrementFingerprintCounter($request);
            $this->incrementDeviceCounter($request);
        }

        return $response;
    }

    /**
     * POST /api/public/reports — No auth required.
     * Auto-create warga user by phone number.
     */
    public function storePublic(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'phone' => ['required', 'string', 'regex:/^(?:\+62|62|0)8[1-9][0-9]{6,9}$/'],
                'reporter_name' => ['required', 'string', 'min:2', 'max:100', 'regex:/^[A-Za-zÀ-ÖØ-öø-ÿ \'.-]+$/'],
                'road_name' => ['required', 'string', 'max:255'],
                'district' => ['required', 'string', 'in:'.implode(',', $this->getKecamatanList())],
                'latitude' => ['required', 'numeric', 'between:-11,6'],
                'longitude' => ['required', 'numeric', 'between:95,141'],
                'description' => ['nullable', 'string', 'max:2000'],
                'images' => ['required', 'array', 'min:1', 'max:3'],
                'images.*' => ['required', 'file', 'mimes:jpeg,jpg,png', 'max:5120'],
                'kerusakan_panjang' => ['nullable', 'numeric', 'min:0.01', 'max:100'],
                'kerusakan_lebar' => ['nullable', 'numeric', 'min:0.01', 'max:100'],
                'full_address' => ['nullable', 'string', 'max:500'],
                'quality_scores' => ['nullable', 'array', 'max:3'],
                'quality_scores.*' => ['nullable', 'json'],
                'captcha_token' => ['nullable', 'string'],
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

        if (! empty($validated['captcha_token'])) {
            $captchaResult = $this->verifyRecaptcha($validated['captcha_token']);
            if ($captchaResult !== true) {
                return $captchaResult;
            }
        }

        // ── Layer 1: Pseudo-fingerprint (IP + User-Agent) daily limit ──────
        $fingerprintCheck = $this->checkFingerprintLimit($request);
        if ($fingerprintCheck !== null) {
            return $fingerprintCheck;
        }

        // ── Layer 2: Device ID daily limit ────────────────────────────────
        $deviceCheck = $this->checkDeviceLimit($request);
        if ($deviceCheck !== null) {
            return $deviceCheck;
        }

        $phone = $validated['phone'];
        if (str_starts_with($phone, '+62')) {
            $phone = '0'.substr($phone, 3);
        } elseif (str_starts_with($phone, '62')) {
            $phone = '0'.substr($phone, 2);
        }
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

        $response = $this->processAndCreateReport($request, $validated, $user->id);

        if ($response->getStatusCode() === 201) {
            $this->incrementFingerprintCounter($request);
            $this->incrementDeviceCounter($request);
        }

        return $response;
    }

    /**
     * GET /api/public/reports?phone=xxx — No auth required.
     * Track reports by phone number.
     */
    public function indexByPhone(Request $request): JsonResponse
    {
        $phone = $request->query('phone');

        if (! $phone || ! preg_match('/^(?:\+62|62|0)8[1-9][0-9]{6,9}$/', $phone)) {
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
            ->with([
                'photos' => function ($q) {
                    $q->orderBy('sort_order');
                },
                'afterPhotos',
                'assignedTeam',
                'progressUpdates' => function ($q) {
                    $q->with('user:id,name')->orderBy('created_at');
                },
            ])
            ->first();

        if (! $report) {
            return response()->json([
                'success' => false,
                'message' => 'Laporan tidak ditemukan.',
            ], 404);
        }

        $timeline = StatusLog::where('report_id', $report->id)
            ->orderBy('created_at', 'asc')
            ->get(['old_status', 'new_status', 'notes', 'created_at', 'actor_name', 'actor_role']);

        $reportData = $report->toArray();

        // Transform after_photos: expose only needed fields
        $reportData['after_photos'] = $report->afterPhotos->map(fn ($ap) => [
            'id' => $ap->id,
            'url' => $ap->url,
            'sort_order' => $ap->sort_order,
        ]);

        // Transform progress_updates: add computed day_number + user_name
        $mulai = $report->perbaikan_dimulai_at;
        $reportData['progress_updates'] = $report->progressUpdates->map(fn ($u) => [
            'id' => $u->id,
            'foto_url' => $u->foto_url,
            'catatan' => $u->catatan,
            'user_name' => $u->user?->name,
            'created_at' => $u->created_at?->toIso8601String(),
            'day_number' => $mulai
                ? $mulai->copy()->startOfDay()->diffInDays($u->created_at->copy()->startOfDay()) + 1
                : 1,
        ]);

        return response()->json([
            'success' => true,
            'data' => [
                'report' => $reportData,
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
                    'overall_severity' => $report->overall_severity,
                    'created_at' => $report->created_at?->toIso8601String(),
                    'updated_at' => $report->updated_at?->toIso8601String(),
                    'description' => $report->description,
                    'photos' => $report->photos->map(function ($p) {
                        return [
                            'image_original_url' => $p->image_original_url,
                            'image_result_url' => $p->image_result_url,
                            'photo_taken_at' => $p->photo_taken_at?->toIso8601String(),
                            'created_at' => $p->created_at?->toIso8601String(),
                            'mobileclip_score' => $p->mobileclip_score ? (float) $p->mobileclip_score : null,
                            'mobileclip_label' => $p->mobileclip_label,
                            'quality_scores' => $p->quality_scores,
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

    /**
     * GET /api/v1/public/reports/{reportCode} — No auth required.
     * Public report detail by report_code (for sharing). No lat/lng/phone exposed.
     */
    public function publicShow(string $reportCode): JsonResponse
    {
        $report = Report::where('report_code', $reportCode)
            ->with([
                'photos' => function ($q) {
                    $q->orderBy('sort_order');
                },
                'afterPhotos',
            ])
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
                    'overall_severity' => $report->overall_severity,
                    'created_at' => $report->created_at?->toIso8601String(),
                    'updated_at' => $report->updated_at?->toIso8601String(),
                    'description' => $report->description,
                    'rating' => $report->rating,
                    'rating_comment' => $report->rating_comment,
                    'photos' => $report->photos->map(function ($p) {
                        return [
                            'image_original_url' => $p->image_original_url,
                            'image_result_url' => $p->image_result_url,
                            'photo_taken_at' => $p->photo_taken_at?->toIso8601String(),
                            'created_at' => $p->created_at?->toIso8601String(),
                            'mobileclip_score' => $p->mobileclip_score ? (float) $p->mobileclip_score : null,
                            'mobileclip_label' => $p->mobileclip_label,
                            'quality_scores' => $p->quality_scores,
                        ];
                    }),
                    'after_photos' => $report->afterPhotos->map(fn ($ap) => [
                        'id' => $ap->id,
                        'url' => $ap->url,
                        'sort_order' => $ap->sort_order,
                    ]),
                ],
                'timeline' => $timeline,
            ],
        ]);
    }

    /**
     * POST /api/warga/reports/{id}/rating — Auth required (warga).
     * Warga memberikan rating kepuasan untuk laporan yang sudah selesai.
     */
    public function rate(Request $request, string $id): JsonResponse
    {
        $report = Report::where('id', $id)
            ->where('user_id', auth()->id())
            ->whereIn('source', ['warga', 'telegram'])
            ->first();

        if (! $report) {
            return response()->json([
                'success' => false,
                'message' => 'Laporan tidak ditemukan.',
            ], 404);
        }

        if ($report->status !== 'Selesai') {
            return response()->json([
                'success' => false,
                'message' => 'Hanya laporan yang sudah selesai yang dapat diberi rating.',
            ], 422);
        }

        if ($report->rated_at !== null) {
            return response()->json([
                'success' => false,
                'message' => 'Anda sudah memberikan rating untuk laporan ini.',
            ], 422);
        }

        try {
            $validated = $request->validate([
                'rating' => ['required', 'integer', 'min:1', 'max:5'],
                'comment' => ['nullable', 'string', 'max:500'],
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Data rating tidak valid.',
                'errors' => $e->errors(),
            ], 422);
        }

        $report->update([
            'rating' => $validated['rating'],
            'rating_comment' => $validated['comment'] ?? null,
            'rated_at' => now(),
        ]);

        Log::info('DeltaJalan: Rating warga.', [
            'report_id' => $report->id,
            'report_code' => $report->report_code,
            'rating' => $validated['rating'],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Terima kasih! Penilaian Anda telah disimpan.',
            'data' => [
                'rating' => (int) $validated['rating'],
                'rating_comment' => $validated['comment'] ?? null,
            ],
        ]);
    }

    /**
     * GET /api/v1/reports/remaining — No auth required (but checks if authenticated).
     * Returns remaining daily upload quota considering fingerprint, device ID, and user limits.
     * Headers: X-Device-ID (optional), Authorization (optional)
     */
    public function checkRemaining(Request $request): JsonResponse
    {
        $limits = [];
        $user = $request->user();

        // Fingerprint & device limits only for guests
        if (!$user) {
            // 1. Fingerprint limit
            $fingerprint = $this->buildFingerprint($request);
            $fpCounter = DailyUploadCounter::where('identifier_type', 'fingerprint')
                ->where('identifier_hash', $fingerprint)
                ->where('report_date', today())
                ->first();
            $fingerprintCount = $fpCounter?->count ?? 0;
            $limits[] = self::FINGERPRINT_LIMIT - $fingerprintCount;

            // 2. Device ID limit (if header provided)
            $deviceId = $request->header('X-Device-ID');
            if ($deviceId && preg_match('/^[a-f0-9\-]{36}$/', $deviceId)) {
                $devCounter = DailyUploadCounter::where('identifier_type', 'device_id')
                    ->where('identifier_hash', $deviceId)
                    ->where('report_date', today())
                    ->first();
                $deviceCount = $devCounter?->count ?? 0;
                $limits[] = self::DEVICE_LIMIT - $deviceCount;
            }
        }

        // 3. User daily limit (if authenticated)
        if ($user) {
            $todayCount = Report::where('user_id', $user->id)
                ->whereDate('created_at', today())
                ->count();
            $limits[] = self::DAILY_LIMIT - $todayCount;
        }

        $remaining = max(0, min($limits));

        return response()->json([
            'success' => true,
            'data' => [
                'remaining' => $remaining,
                'limit' => self::DAILY_LIMIT,
                'reached' => $remaining <= 0,
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

    private function buildFingerprint(Request $request): string
    {
        return hash('sha256', $request->ip().'|'.$request->userAgent());
    }

    private function checkFingerprintLimit(Request $request): ?JsonResponse
    {
        $fingerprint = $this->buildFingerprint($request);
        $counter = DailyUploadCounter::where('identifier_type', 'fingerprint')
            ->where('identifier_hash', $fingerprint)
            ->where('report_date', today())
            ->first();

        $count = $counter?->count ?? 0;

        if ($count >= self::FINGERPRINT_LIMIT) {
            return response()->json([
                'success' => false,
                'message' => 'Batas upload harian (1 laporan) telah tercapai. Daftar atau login akun untuk mendapatkan kuota 5 laporan per hari.',
                'error_code' => 'FINGERPRINT_LIMIT_EXCEEDED',
            ], 429);
        }

        return null;
    }

    private function incrementFingerprintCounter(Request $request): void
    {
        $fingerprint = $this->buildFingerprint($request);
        DB::transaction(function () use ($fingerprint) {
            $counter = DailyUploadCounter::where('identifier_type', 'fingerprint')
                ->where('identifier_hash', $fingerprint)
                ->where('report_date', today())
                ->lockForUpdate()
                ->first();

            if ($counter) {
                $counter->increment('count');
            } else {
                DailyUploadCounter::create([
                    'identifier_type' => 'fingerprint',
                    'identifier_hash' => $fingerprint,
                    'report_date' => today(),
                    'count' => 1,
                ]);
            }
        });
    }

    private function checkDeviceLimit(Request $request): ?JsonResponse
    {
        $deviceId = $request->header('X-Device-ID');
        if (! $deviceId || ! preg_match('/^[a-f0-9\-]{36}$/', $deviceId)) {
            return null;
        }

        $counter = DailyUploadCounter::where('identifier_type', 'device_id')
            ->where('identifier_hash', $deviceId)
            ->where('report_date', today())
            ->first();

        $count = $counter?->count ?? 0;

        if ($count >= self::DEVICE_LIMIT) {
            return response()->json([
                'success' => false,
                'message' => 'Batas upload harian (1 laporan) telah tercapai. Daftar atau login akun untuk mendapatkan kuota 5 laporan per hari.',
                'error_code' => 'DEVICE_LIMIT_EXCEEDED',
            ], 429);
        }

        return null;
    }

    private function incrementDeviceCounter(Request $request): void
    {
        $deviceId = $request->header('X-Device-ID');
        if (! $deviceId) {
            return;
        }

        DB::transaction(function () use ($deviceId) {
            $counter = DailyUploadCounter::where('identifier_type', 'device_id')
                ->where('identifier_hash', $deviceId)
                ->where('report_date', today())
                ->lockForUpdate()
                ->first();

            if ($counter) {
                $counter->increment('count');
            } else {
                DailyUploadCounter::create([
                    'identifier_type' => 'device_id',
                    'identifier_hash' => $deviceId,
                    'report_date' => today(),
                    'count' => 1,
                ]);
            }
        });
    }

    private function verifyRecaptcha(string $token): true|JsonResponse
    {
        if (! config('services.recaptcha.secret')) {
            return true;
        }

        $response = Http::asForm()->post('https://www.google.com/recaptcha/api/siteverify', [
            'secret' => config('services.recaptcha.secret'),
            'response' => $token,
        ]);

        $body = $response->json();

        if (! ($body['success'] ?? false) || ($body['score'] ?? 0) < 0.5) {
            return response()->json([
                'success' => false,
                'message' => 'Verifikasi keamanan gagal. Silakan coba lagi.',
                'error_code' => 'RECAPTCHA_FAILED',
            ], 422);
        }

        Log::info('reCAPTCHA v3', ['score' => $body['score'] ?? null]);

        return true;
    }

    private function processAndCreateReport(Request $request, array $validated, int $userId): JsonResponse
    {
        $files = $request->file('images', []);
        $files = array_slice($files, 0, 3);
        $qualityInputs = $request->input('quality_scores', []);

        $processedPhotos = [];
        $warnings = [];

        $severityLevels = ['Baik' => 0, 'Rusak Ringan' => 1, 'Rusak Sedang' => 2, 'Rusak Berat' => 3];

        foreach ($files as $idx => $imageFile) {
            // ── EXIF Date Validation (blocking for ALL photos) ──
            $exifCheck = $this->validatePhotoDateExif($imageFile->getPathname());

            if ($exifCheck['status'] !== 'valid') {
                $errorCode = match ($exifCheck['status']) {
                    'future_date' => 'PHOTO_FUTURE_DATE',
                    'too_old' => 'PHOTO_TOO_OLD',
                    'no_exif_date' => 'PHOTO_NO_EXIF_DATE',
                    default => 'PHOTO_EXIF_READ_ERROR',
                };
                if ($idx === 0) {
                    return response()->json([
                        'success' => false,
                        'message' => $exifCheck['message'],
                        'error_code' => $errorCode,
                    ], 422);
                }
                $warnings[] = 'Foto ke-'.($idx + 1).': '.$exifCheck['message'];

                continue;
            }

            // ── Image Hash (Anti-Duplikasi) ──
            $imageHash = $this->calculateImageHash($imageFile->getPathname());
            if ($imageHash !== null) {
                $existingReport = Report::where('image_hash', $imageHash)->first();
                if (! $existingReport) {
                    $existingPhoto = ReportPhoto::where('image_hash', $imageHash)->first();
                    if ($existingPhoto) {
                        $existingReport = Report::find($existingPhoto->report_id);
                    }
                }
                if ($existingReport && $idx === 0) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Foto ini sudah pernah digunakan untuk laporan '.
                                        $existingReport->report_code.'.',
                        'error_code' => 'DUPLICATE_IMAGE',
                        'existing_report' => [
                            'id' => $existingReport->id,
                            'report_code' => $existingReport->report_code,
                            'road_name' => $existingReport->road_name,
                            'district' => $existingReport->district,
                            'status' => $existingReport->status,
                        ],
                    ], 422);
                }
                if ($existingReport && $idx > 0) {
                    $warnings[] = 'Foto ke-'.($idx + 1).' sudah digunakan pada laporan '.$existingReport->report_code.', dilewati.';

                    continue;
                }
            }

            // ── EXIF GPS ──
            $exifGps = $this->extractExifGps($imageFile->getPathname());

            // ── GPS Distance Check (only first photo) ──
            $systemNotes = null;
            if ($idx === 0) {
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
            }

            // ── MobileCLIP (skip + warning for all photos) ──
            $mobileclipResult = app(MobileClipService::class)->checkBlocking(
                $imageFile->getPathname(),
                $imageFile->getClientOriginalName()
            );

            if ($mobileclipResult !== null && $mobileclipResult['blocked']) {
                $warnings[] = 'Foto ke-'.($idx + 1).' tidak relevan dengan kerusakan jalan, dilewati.';

                continue;
            }

            $mobileclipScore = $mobileclipResult !== null ? $mobileclipResult['score'] : null;
            $mobileclipLabel = $mobileclipResult !== null ? $mobileclipResult['label'] : null;

            // ── Auto YOLO Analysis ──
            $aiResult = null;
            if ($imageHash) {
                $cached = Cache::get('yolo_result_'.$imageHash);
                if ($cached) {
                    $aiResult = $cached;
                } else {
                    try {
                        $fastApiUrl = rtrim(config('services.fastapi.url', env('FASTAPI_URL', 'http://127.0.0.1:8000')), '/');
                        $response = Http::timeout(10)
                            ->connectTimeout(5)
                            ->attach('file', fopen($imageFile->getPathname(), 'r'), $imageFile->getClientOriginalName())
                            ->post($fastApiUrl.'/analyze?include_image=true');
                        if ($response->successful()) {
                            $data = $response->json();
                            if (isset($data['overall_severity'])) {
                                $aiResult = $data;
                                Cache::put('yolo_result_'.$imageHash, $data, now()->addHours(24));
                            }
                        }
                    } catch (\Exception $e) {
                        Log::warning('Auto YOLO failed', [
                            'error' => $e->getMessage(),
                            'image_hash' => $imageHash,
                        ]);
                    }
                }
            }
            $hasAiResult = is_array($aiResult);

            $aiResultPath = null;
            if ($hasAiResult && ! empty($aiResult['image_result'])) {
                $aiResultPath = $this->saveBase64Image($aiResult['image_result'], 'reports/results');
            }

            // ── Quality Scores (per-photo) ──
            $qualityScores = null;
            if (! empty($qualityInputs[$idx])) {
                $decoded = json_decode($qualityInputs[$idx], true);
                if (is_array($decoded)) {
                    $qualityScores = $decoded;
                }
            }

            $processedPhotos[] = [
                'file' => $imageFile,
                'imageHash' => $imageHash,
                'exifCheck' => $exifCheck,
                'exifGps' => $exifGps,
                'systemNotes' => $systemNotes,
                'mobileclipScore' => $mobileclipScore,
                'mobileclipLabel' => $mobileclipLabel,
                'aiResult' => $aiResult,
                'hasAiResult' => $hasAiResult,
                'aiResultPath' => $aiResultPath,
                'qualityScores' => $qualityScores,
            ];
        }

        // ── Guard: no valid photos ──
        if (empty($processedPhotos)) {
            $errMsg = 'Tidak ada foto valid yang bisa diproses.';
            if (! empty($warnings)) {
                $errMsg .= ' '.implode(' ', $warnings);
            }

            return response()->json([
                'success' => false,
                'message' => $errMsg,
                'error_code' => 'NO_VALID_PHOTOS',
            ], 422);
        }

        // ── Aggregate severity across all photos ──
        $topSeverity = 0;
        $topSeverityLabel = 'Baik';
        foreach ($processedPhotos as $pp) {
            if ($pp['hasAiResult'] && isset($pp['aiResult']['overall_severity'])) {
                $level = $severityLevels[$pp['aiResult']['overall_severity']] ?? 0;
                if ($level > $topSeverity) {
                    $topSeverity = $level;
                    $topSeverityLabel = $pp['aiResult']['overall_severity'];
                }
            }
        }

        $allSystemNotes = array_values(array_filter(array_column($processedPhotos, 'systemNotes')));

        try {
            $report = DB::transaction(function () use ($processedPhotos, $validated, $userId, $topSeverityLabel, $allSystemNotes) {

                $reportCode = null;
                do {
                    $year = date('Y');
                    $lastReport = Report::where('report_code', 'like', "LP-{$year}-%")
                        ->orderBy('report_code', 'desc')
                        ->first();

                    $lastNumber = $lastReport ? (int) substr($lastReport->report_code, -5) : 0;
                    $code = sprintf('LP-%s-%05d', $year, $lastNumber + 1);
                    $reportCode = $code;
                } while (Report::where('report_code', $reportCode)->exists());

                // ── Save primary photo ──
                $primary = $processedPhotos[0];
                $primaryFile = $primary['file'];
                $ext = $primaryFile->getClientOriginalExtension() ?: $primaryFile->guessExtension() ?: 'jpg';
                $primaryFilename = Str::uuid()->toString().'-'.time().'.'.$ext;
                $primaryPath = $this->savePhotoToStorage($primaryFile, $primaryFilename);

                if (! $primaryPath) {
                    throw new \RuntimeException('Gagal menyimpan foto ke storage.');
                }

                // ── Count AI stats ──
                $totalAiAnalysis = 0;
                $latestAiAnalyzedAt = null;
                $hasPrimaryAi = $primary['hasAiResult'];
                $primaryAi = $primary['aiResult'];
                foreach ($processedPhotos as $pp) {
                    if ($pp['hasAiResult']) {
                        $totalAiAnalysis++;
                        $latestAiAnalyzedAt = now();
                    }
                }

                $report = Report::create([
                    'user_id' => $userId,
                    'report_code' => $reportCode,
                    'reporter_name' => $validated['reporter_name'],
                    'road_name' => $validated['road_name'],
                    'district' => $validated['district'],
                    'latitude' => $validated['latitude'],
                    'longitude' => $validated['longitude'],
                    'image_original_path' => $primaryPath,
                    'image_hash' => $primary['imageHash'],
                    'status' => 'Menunggu Review',
                    'source' => 'warga',
                    'description' => $validated['description'] ?? null,
                    'full_address' => $validated['full_address'] ?? null,
                    'kerusakan_panjang' => $validated['kerusakan_panjang'] ?? null,
                    'kerusakan_lebar' => $validated['kerusakan_lebar'] ?? null,
                    'catatan_petugas' => null,
                    'priority' => 'Sedang',
                    'deadline_review' => Report::hitungDeadlineReview('Sedang'),
                    'overall_severity' => $topSeverityLabel,
                    'total_detections' => $hasPrimaryAi ? ($primaryAi['total'] ?? 0) : 0,
                    'ai_raw_output' => $hasPrimaryAi ? $primaryAi : null,
                    'image_result_path' => $primary['aiResultPath'],
                    'ai_analyzed_at' => $latestAiAnalyzedAt,
                    'ai_analysis_count' => $totalAiAnalysis,
                ]);

                // ── Save each photo as ReportPhoto ──
                foreach ($processedPhotos as $ppIdx => $pp) {
                    $tFile = $pp['file'];
                    $tExt = $tFile->getClientOriginalExtension() ?: $tFile->guessExtension() ?: 'jpg';
                    $tFilename = Str::uuid()->toString().'-'.time().'-'.$ppIdx.'.'.$tExt;
                    $tPath = $this->savePhotoToStorage($tFile, $tFilename);

                    if (! $tPath) {
                        throw new \RuntimeException('Gagal menyimpan foto ke storage.');
                    }

                    $exifGps = $pp['exifGps'];

                    $photoData = [
                        'report_id' => $report->id,
                        'reporter_name' => $validated['reporter_name'],
                        'image_original_path' => $tPath,
                        'image_hash' => $pp['imageHash'],
                        'latitude' => $exifGps ? $exifGps['lat'] : $validated['latitude'],
                        'longitude' => $exifGps ? $exifGps['lng'] : $validated['longitude'],
                        'koordinat_sumber' => $exifGps ? 'exif' : 'form',
                        'sort_order' => $ppIdx,
                        'original_filename' => $tFile->getClientOriginalName(),
                        'photo_taken_at' => $pp['exifCheck']['photo_date'],
                        'mobileclip_score' => $pp['mobileclipScore'],
                        'mobileclip_label' => $pp['mobileclipLabel'],
                        'quality_scores' => $pp['qualityScores'],
                        'ai_severity' => $pp['hasAiResult'] ? ($pp['aiResult']['overall_severity'] ?? null) : null,
                        'ai_raw_output' => $pp['hasAiResult'] ? $pp['aiResult'] : null,
                        'image_result_path' => $pp['aiResultPath'],
                        'ai_analyzed_at' => $pp['hasAiResult'] ? now() : null,
                        'ai_analysis_count' => $pp['hasAiResult'] ? 1 : 0,
                    ];

                    ReportPhoto::create($photoData);
                }

                // ── System notes ──
                if (! empty($allSystemNotes)) {
                    $report->update(['system_notes' => implode(' | ', $allSystemNotes)]);
                }

                return $report;
            });

            Log::info('DeltaJalan: Laporan warga baru.', [
                'report_id' => $report->id,
                'report_code' => $report->report_code,
                'user_id' => $userId,
                'total_photos' => count($processedPhotos),
            ]);

            $primary = $processedPhotos[0];

            return response()->json([
                'success' => true,
                'message' => 'Laporan berhasil dikirim dan sedang menunggu verifikasi petugas.',
                'data' => [
                    'report' => $report->toArray(),
                    'total_photos' => count($processedPhotos),
                    'warnings' => $warnings,
                    'mobileclip_score' => $primary['mobileclipScore'],
                    'mobileclip_label' => $primary['mobileclipLabel'],
                    'ai_severity' => $primary['hasAiResult'] ? ($primary['aiResult']['overall_severity'] ?? null) : null,
                    'ai_total_detections' => $primary['hasAiResult'] ? ($primary['aiResult']['total'] ?? 0) : 0,
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

    private function saveBase64Image(string $base64String, string $folder): ?string
    {
        try {
            if (str_contains($base64String, ',')) {
                $base64String = explode(',', $base64String, 2)[1];
            }

            $imageData = base64_decode($base64String, strict: true);

            if ($imageData === false) {
                Log::warning('DeltaJalan: Gagal decode base64 image dari FastAPI.');

                return null;
            }

            $filename = Str::uuid()->toString().'-result-'.time().'.jpg';
            $path = $folder.'/'.$filename;

            Storage::disk('public')->put($path, $imageData);

            return $path;
        } catch (\Exception $e) {
            Log::warning('DeltaJalan: Gagal menyimpan foto hasil AI.', [
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }
}
