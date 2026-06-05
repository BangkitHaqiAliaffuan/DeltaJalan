<?php

namespace App\Http\Controllers;

use App\Models\Report;
use App\Models\ReportEvidence;
use App\Models\ReportPhoto;
use App\Models\User;
use App\Notifications\ReportApprovedNotification;
use App\Notifications\ReportRejectedNotification;
use App\Notifications\UprAssignedNotification;
use App\Notifications\RepairCompletedNotification;
use App\Notifications\ReportEditedNotification;
use App\Notifications\TriageUpdatedNotification;
use App\Notifications\ReportReopenedNotification;
use App\Notifications\BulkActionNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * ReportController
 *
 * Menangani seluruh operasi CRUD untuk laporan kerusakan jalan.
 * Komponen utama dalam arsitektur Hybrid Stack DeltaJalan:
 *
 *   Frontend React → POST /api/reports → ReportController@store
 *                                              ↓
 *                                    FastAPI AI Server (YOLOv8)
 *                                              ↓
 *                                    PostgreSQL (tabel reports)
 */
class ReportController extends Controller
{
    // ── Konfigurasi ───────────────────────────────────────────────────────

    /**
     * Folder penyimpanan foto asli (relatif dari storage/app/public/).
     */
    private const ORIGINALS_FOLDER = 'reports/originals';

    /**
     * Folder penyimpanan foto hasil AI dengan bounding box.
     */
    private const RESULTS_FOLDER = 'reports/results';

    /**
     * Maksimal usia foto yang diizinkan (dalam hari).
     * Sinkron dengan konstanta MAX_AGE_DAYS di frontend validatePhotoDate.ts.
     */
    private const MAX_PHOTO_AGE_DAYS = 2;

    // ── Endpoint Utama ────────────────────────────────────────────────────

    /**
     * Endpoint proxy untuk analisis AI.
     *
     * Frontend memanggil endpoint ini (bukan FastAPI langsung) untuk menghindari CORS issues.
     * Laravel menerima file, forward ke FastAPI, dan return hasilnya ke frontend.
     *
     * Alur:
     * Frontend → POST /api/analyze → Laravel → FastAPI → Laravel → Frontend
     *
     * @param  Request  $request  File foto dari frontend
     * @return JsonResponse
     */
    public function analyze(Request $request): JsonResponse
    {
        try {
            $request->validate([
                'file' => ['required', 'file', 'mimes:jpeg,jpg,png', 'max:5120'],
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'File tidak valid.',
                'errors'  => $e->errors(),
            ], 422);
        }

        $imageFile = $request->file('file');

        // Forward ke FastAPI
        $aiData = $this->callFastApiAnalyze($imageFile->getPathname(), $imageFile->getClientOriginalName());

        if ($aiData['success']) {
            return response()->json($aiData['data'], 200);
        }

        return response()->json([
            'success' => false,
            'message' => 'Analisis AI gagal: ' . $aiData['error'],
        ], 500);
    }

    /**
     * Endpoint pengecekan duplikasi laporan.
     *
     * Mencari laporan aktif (status != 'Selesai') berdasarkan:
     * 1. Spatial: radius 15 meter dari koordinat GPS (Haversine Formula)
     * 2. Textual: kecamatan + nama jalan (ILIKE)
     *
     * Endpoint ini bersifat PUBLIK (tidak perlu autentikasi).
     *
     * GET /api/v1/reports/check-duplicate
     * Query params: latitude, longitude, district, road_name
     *
     * @param  Request  $request
     * @return JsonResponse
     */
    public function checkDuplicate(Request $request): JsonResponse
    {
        try {
            $lat      = $request->query('latitude');
            $lng      = $request->query('longitude');
            $district = $request->query('district');
            $roadName = $request->query('road_name');
            $fileHash = $request->query('file_hash');

            $spatialDuplicates = [];
            $textualDuplicates = [];
            $imageDuplicates   = [];

            // ── Pencarian Spasial (Haversine Formula) ─────────────────────
            if ($lat !== null && $lng !== null && is_numeric($lat) && is_numeric($lng)) {
                $latF = (float) $lat;
                $lngF = (float) $lng;

                if ($latF >= -11 && $latF <= 6 && $lngF >= 95 && $lngF <= 141) {
                    $spatialResults = DB::select("
                        SELECT * FROM (
                            SELECT
                                id, report_code, road_name, district,
                                latitude, longitude, status, support_count, created_at,
                                (
                                    6371000 * acos(
                                        LEAST(1.0, cos(radians(:lat1)) * cos(radians(latitude::float))
                                        * cos(radians(longitude::float) - radians(:lng1))
                                        + sin(radians(:lat2)) * sin(radians(latitude::float)))
                                    )
                                ) AS distance_meters
                            FROM reports
                            WHERE status != 'Selesai'
                        ) sub
                        WHERE distance_meters <= 15
                        ORDER BY distance_meters ASC
                        LIMIT 20
                    ", [
                        'lat1' => $latF, 'lng1' => $lngF,
                        'lat2' => $latF,
                    ]);

                    $spatialDuplicates = array_map(function ($row) {
                        return [
                            'id'              => $row->id,
                            'report_code'     => $row->report_code,
                            'road_name'       => $row->road_name,
                            'district'        => $row->district,
                            'latitude'        => (float) $row->latitude,
                            'longitude'       => (float) $row->longitude,
                            'status'          => $row->status,
                            'support_count'   => (int) $row->support_count,
                            'created_at'      => $row->created_at,
                            'distance_meters' => round((float) $row->distance_meters, 1),
                        ];
                    }, $spatialResults);
                }
            }

            // ── Pencarian Tekstual (ILIKE) ────────────────────────────────
            if ($district) {
                $query = Report::where('status', '!=', 'Selesai')
                    ->where('district', $district);

                if ($roadName && strlen(trim($roadName)) >= 1) {
                    $query->where('road_name', 'ilike', '%' . trim($roadName) . '%');
                }

                $textualResults = $query
                    ->select([
                        'id', 'report_code', 'road_name', 'district',
                        'latitude', 'longitude', 'status', 'support_count', 'created_at',
                    ])
                    ->orderBy('created_at', 'desc')
                    ->limit(20)
                    ->get();

                $textualDuplicates = $textualResults->map(function ($report) {
                    return [
                        'id'            => $report->id,
                        'report_code'   => $report->report_code,
                        'road_name'     => $report->road_name,
                        'district'      => $report->district,
                        'latitude'      => $report->latitude ? (float) $report->latitude : null,
                        'longitude'     => $report->longitude ? (float) $report->longitude : null,
                        'status'        => $report->status,
                        'support_count' => (int) $report->support_count,
                        'created_at'    => $report->created_at?->toIso8601String(),
                    ];
                })->toArray();
            }

            // ── Pencarian Berdasarkan Hash Gambar ───────────────────────────
            if ($fileHash) {
                $photoReportIds = ReportPhoto::where('image_hash', $fileHash)->pluck('report_id');
                $imageResults = Report::whereIn('id', $photoReportIds)
                    ->orWhere('image_hash', $fileHash)
                    ->select([
                        'id', 'report_code', 'road_name', 'district',
                        'latitude', 'longitude', 'status', 'support_count', 'created_at',
                    ])
                    ->orderBy('created_at', 'desc')
                    ->limit(20)
                    ->get();

                $imageDuplicates = $imageResults->map(function ($report) {
                    return [
                        'id'            => $report->id,
                        'report_code'   => $report->report_code,
                        'road_name'     => $report->road_name,
                        'district'      => $report->district,
                        'latitude'      => $report->latitude ? (float) $report->latitude : null,
                        'longitude'     => $report->longitude ? (float) $report->longitude : null,
                        'status'        => $report->status,
                        'support_count' => (int) $report->support_count,
                        'created_at'    => $report->created_at?->toIso8601String(),
                    ];
                })->toArray();
            }

            return response()->json([
                'spatial_duplicates' => $spatialDuplicates,
                'textual_duplicates' => $textualDuplicates,
                'image_duplicates'   => $imageDuplicates,
            ], 200);

        } catch (\Exception $e) {
            Log::error('DeltaJalan: checkDuplicate error.', ['error' => $e->getMessage()]);
            return response()->json([
                'spatial_duplicates' => [],
                'textual_duplicates' => [],
            ], 200);
        }
    }

    /**
     * Endpoint penambahan bukti foto ke laporan yang sudah ada.
     *
     * POST /api/v1/reports/{id}/add-evidence
     * Memerlukan autentikasi Sanctum.
     *
     * @param  Request  $request
     * @param  string   $id  UUID laporan
     * @return JsonResponse
     */
    public function addEvidence(Request $request, string $id): JsonResponse
    {
        try {
            $validated = $request->validate([
                'image'         => ['required', 'file', 'mimes:jpeg,jpg,png', 'max:5120'],
                'reporter_name' => ['required', 'string', 'max:100'],
                'notes'         => ['nullable', 'string', 'max:500'],
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Data yang dikirim tidak valid.',
                'errors'  => $e->errors(),
            ], 422);
        }

        $report = Report::find($id);
        if (! $report) {
            return response()->json([
                'success' => false,
                'message' => "Laporan dengan ID {$id} tidak ditemukan.",
            ], 404);
        }

        $imageFile = $request->file('image');
        $imageHash = $this->calculateImageHash($imageFile->getPathname());

        if ($imageHash !== null) {
            if (Report::imageHashExists($imageHash) || ReportEvidence::where('image_hash', $imageHash)->exists()) {
                return response()->json([
                    'success'    => false,
                    'message'    => 'Foto ini sudah digunakan pada laporan lain.',
                    'error_code' => 'DUPLICATE_IMAGE',
                ], 422);
            }
        }

        try {
            $evidence = DB::transaction(function () use ($report, $imageFile, $validated, $imageHash) {
                $filename  = Str::uuid() . '-evidence-' . time() . '.' . $imageFile->getClientOriginalExtension();
                $imagePath = $imageFile->storeAs('reports/evidences', $filename, 'public');

                if (! $imagePath) {
                    throw new \RuntimeException('Gagal menyimpan foto bukti ke storage.');
                }

                $evidence = ReportEvidence::create([
                    'report_id'     => $report->id,
                    'image_path'    => $imagePath,
                    'image_hash'    => $imageHash,
                    'reporter_name' => $validated['reporter_name'],
                    'notes'         => $validated['notes'] ?? null,
                ]);

                $report->increment('support_count');
                return $evidence;
            });

            Log::info('DeltaJalan: Evidence ditambahkan.', [
                'report_id'     => $report->id,
                'report_code'   => $report->report_code,
                'reporter_name' => $validated['reporter_name'],
                'evidence_id'   => $evidence->id,
                'timestamp'     => now()->toIso8601String(),
            ]);

            $report->refresh();
            $report->load('evidences');

            return response()->json([
                'success' => true,
                'message' => 'Foto bukti berhasil ditambahkan ke laporan ' . $report->report_code . '.',
                'data'    => [
                    'report' => [
                        'id'            => $report->id,
                        'report_code'   => $report->report_code,
                        'road_name'     => $report->road_name,
                        'district'      => $report->district,
                        'status'        => $report->status,
                        'support_count' => $report->support_count,
                    ],
                    'evidence' => [
                        'id'            => $evidence->id,
                        'image_url'     => $evidence->image_url,
                        'reporter_name' => $evidence->reporter_name,
                        'created_at'    => $evidence->created_at->toIso8601String(),
                    ],
                    'all_evidences' => $report->evidences->map(fn ($e) => [
                        'id'            => $e->id,
                        'image_url'     => $e->image_url,
                        'reporter_name' => $e->reporter_name,
                        'created_at'    => $e->created_at->toIso8601String(),
                    ]),
                ],
            ], 200);

        } catch (\Exception $e) {
            Log::error('DeltaJalan: Gagal menyimpan evidence.', [
                'error'     => $e->getMessage(),
                'report_id' => $id,
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Terjadi kesalahan saat menyimpan bukti foto. Silakan coba lagi.',
                'debug'   => config('app.debug') ? $e->getMessage() : null,
            ], 500);
        }
    }

    /**
     * Menyimpan laporan kerusakan jalan baru.
     *
     * Alur proses:
     * 1. Validasi input dari frontend
     * 2. Cek anti-fraud tanggal EXIF foto (opsional/fallback)
     * 3. Hitung ImageHash dan cek duplikasi foto
     * 4. Simpan foto asli ke storage
     * 5. Kirim foto ke FastAPI untuk analisis AI
     * 6. Simpan foto hasil AI (base64 → file fisik)
     * 7. Simpan semua data ke PostgreSQL dalam satu transaksi
     * 8. Kembalikan response JSON lengkap ke frontend
     *
     * @param  Request  $request  Data form dari frontend React
     * @return JsonResponse
     */
    public function store(Request $request): JsonResponse
    {
        // ── LANGKAH 1: Validasi Input ─────────────────────────────────────
        try {
            $validated = $request->validate([
                // Nama petugas lapangan yang mengirim laporan
                'reporter_name' => ['required', 'string', 'max:100'],

                // Nama ruas jalan (input manual atau dari GPS reverse geocoding)
                'road_name'     => ['required', 'string', 'max:255'],

                // Kecamatan — harus salah satu dari 18 kecamatan Sidoarjo
                'district'      => ['required', 'string', 'in:' . implode(',', $this->getKecamatanList())],

                // Koordinat GPS — validasi range geografis Indonesia
                'latitude'      => ['required', 'numeric', 'between:-11,6'],
                'longitude'     => ['required', 'numeric', 'between:95,141'],

                // File foto — wajib, hanya JPEG/PNG, maksimal 5MB
                'image'              => ['required', 'file', 'mimes:jpeg,jpg,png', 'max:5120'],
                // Dimensi kerusakan — wajib
                'kerusakan_panjang'  => ['required', 'numeric', 'min:0', 'max:999999.99'],
                'kerusakan_lebar'    => ['required', 'numeric', 'min:0', 'max:999999.99'],
                // Catatan petugas (opsional)
                'catatan'            => ['nullable', 'string', 'max:1000'],
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Data yang dikirim tidak valid.',
                'errors'  => $e->errors(),
            ], 422);
        }

        // ── Validasi koordinat berada di wilayah Sidoarjo ─────────────────
        if (!$this->isInSidoarjo((float) $validated['latitude'], (float) $validated['longitude'])) {
            return response()->json([
                'success'    => false,
                'message'    => 'Koordinat berada di luar wilayah Kabupaten Sidoarjo. Pastikan GPS aktif dan Anda berada di lokasi kerusakan.',
                'error_code' => 'KOORDINAT_DILUAR_WILAYAH',
            ], 422);
        }

        // ── LANGKAH 2: Anti-Fraud EXIF Check ─────────────────────────────
        $imageFile = $request->file('image');
        $exifCheck = $this->validatePhotoDateExif($imageFile->getPathname());

        // Jika foto terlalu lama (lebih dari MAX_PHOTO_AGE_DAYS hari), tolak
        if ($exifCheck['status'] === 'too_old') {
            return response()->json([
                'success' => false,
                'message' => $exifCheck['message'],
                'error_code' => 'PHOTO_TOO_OLD',
            ], 422);
        }

        // Jika tanggal foto di masa depan (metadata dimanipulasi), tolak
        if ($exifCheck['status'] === 'future_date') {
            return response()->json([
                'success' => false,
                'message' => $exifCheck['message'],
                'error_code' => 'PHOTO_FUTURE_DATE',
            ], 422);
        }

        // Jika tidak ada EXIF (foto dari screenshot/internet), tolak mutlak
        if ($exifCheck['status'] === 'no_exif_date') {
            return response()->json([
                'success' => false,
                'message' => 'Foto tidak memiliki metadata tanggal (EXIF). Screenshot atau foto unduhan tidak diizinkan untuk dilaporkan.',
                'error_code' => 'PHOTO_NO_EXIF_DATE',
            ], 422);
        }

        // Jika EXIF terbaca tapi tanggal tidak bisa diparse, tolak
        if ($exifCheck['status'] === 'exif_read_error') {
            return response()->json([
                'success' => false,
                'message' => 'Metadata tanggal pada foto tidak dapat dibaca. Gunakan foto asli dari kamera perangkat Anda.',
                'error_code' => 'PHOTO_EXIF_READ_ERROR',
            ], 422);
        }

        $systemNotes = null;

        // ── LANGKAH 3: Image Hash Check (Anti-Duplikasi Foto) ─────────────
        // Hitung SHA-256 hash dari konten biner foto sebelum menyimpan ke storage.
        $imageHash = $this->calculateImageHash($imageFile->getPathname());

        if ($imageHash !== null) {
            $existingReport = Report::where('image_hash', $imageHash)->first();
            if (!$existingReport) {
                $existingPhoto = ReportPhoto::where('image_hash', $imageHash)->first();
                if ($existingPhoto) {
                    $existingReport = Report::find($existingPhoto->report_id);
                }
            }
            if ($existingReport) {
                return response()->json([
                    'success'    => false,
                    'message'    => 'Foto ini sudah pernah digunakan untuk laporan ' .
                                    $existingReport->report_code . '. ' .
                                    'Gunakan fitur "Dukung Laporan" jika Anda menemukan kerusakan yang sama.',
                    'error_code' => 'DUPLICATE_IMAGE',
                    'existing_report' => [
                        'id'          => $existingReport->id,
                        'report_code' => $existingReport->report_code,
                        'road_name'   => $existingReport->road_name,
                        'district'    => $existingReport->district,
                        'status'      => $existingReport->status,
                    ],
                ], 422);
            }
        }

        // ── LANGKAH 3.5: Validasi nama jalan vs koordinat ─────────────────
        // Dilakukan di sini (sebelum transaction) agar LocationIQ timeout
        // tidak menahan koneksi database.
        $roadValidation = $this->validateRoadNameVsCoordinate(
            $validated['road_name'],
            (float) $validated['latitude'],
            (float) $validated['longitude']
        );

        // Ekstrak GPS EXIF sebelum transaction untuk dipakai di trust score.
        $exifGps = $this->extractExifGps($imageFile->getPathname());

        // ── LANGKAH 4-7: Proses dalam Database Transaction ───────────────
        // DB::transaction memastikan semua operasi berhasil atau semua dibatalkan.
        try {
            $report = DB::transaction(function () use ($validated, $imageFile, $systemNotes, $imageHash, $roadValidation, $exifGps) {

                // ── 4a: Generate kode laporan unik ────────────────────────
                $reportCode = $this->generateReportCode();

                // ── 4b: Simpan foto asli ke storage ──────────────────────
                $originalFilename = Str::uuid() . '-' . time() . '.' . $imageFile->getClientOriginalExtension();

                $originalPath = $imageFile->storeAs(
                    self::ORIGINALS_FOLDER,
                    $originalFilename,
                    'public'
                );

                if (! $originalPath) {
                    throw new \RuntimeException('Gagal menyimpan foto asli ke storage.');
                }

                // ── 4c: Kirim foto ke FastAPI untuk analisis AI ───────────
                $aiData = $this->callFastApiAnalyze($imageFile->getPathname(), $imageFile->getClientOriginalName());

                // ── 4d: Proses hasil FastAPI ──────────────────────────────
                $resultPath       = null;
                $totalDetections  = 0;
                $overallSeverity  = 'Baik';
                $aiRawOutput      = null;
                $localSystemNotes = null;
                $gpsMismatchNotes = null;
                $fakeGpsSuspected = false;

                if ($aiData['success']) {
                    $payload = $aiData['data'];

                    $totalDetections = $payload['total'] ?? 0;
                    $overallSeverity = $this->normalizeSeverityEnum($payload['overall_severity'] ?? 'Baik');
                    $aiRawOutput     = $payload['detections'] ?? null;

                    // ── 4e: Decode base64 → simpan foto hasil AI ─────────
                    if (! empty($payload['image_result'])) {
                        $resultPath = $this->saveBase64Image(
                            $payload['image_result'],
                            self::RESULTS_FOLDER
                        );
                    }
                } else {
                    $localSystemNotes = '[FALLBACK] FastAPI tidak merespons: ' . $aiData['error'];
                    Log::warning('DeltaJalan: FastAPI tidak merespons saat menyimpan laporan.', [
                        'error' => $aiData['error'],
                    ]);
                }
                
                // ── Cek GPS Mismatch ──────────────────────────────────────
                // Jika GPS EXIF jauh dari koordinat form, tandai fake_gps_suspected
                // agar trust score berkurang.
                if ($exifGps) {
                    $distance = $this->haversineDistance(
                        $exifGps['lat'], $exifGps['lng'],
                        (float) $validated['latitude'], (float) $validated['longitude']
                    );
                    if ($distance > 500) {
                        $gpsMismatchNotes = '[PERINGATAN] GPS EXIF foto berjarak ' . round($distance) . 'm dari koordinat input form. Perlu diverifikasi.';
                        $fakeGpsSuspected = true;
                    }
                } else {
                    $gpsMismatchNotes = '[INFO] Foto tidak memuat GPS EXIF, jarak validasi menggunakan koordinat dari form manual atau Browser GPS.';
                }

                // ── Hitung Trust Score ────────────────────────────────────
                $trustResult = app(\App\Services\TrustScoreService::class)->calculate([
                    'exif_lat'           => $exifGps ? $exifGps['lat'] : null,
                    'exif_lng'           => $exifGps ? $exifGps['lng'] : null,
                    'road_name_matched'  => $roadValidation['matched'],
                    'ai_detections'      => $aiRawOutput ?? [],
                    'ai_context_valid'   => !empty($aiRawOutput) && count($aiRawOutput) > 0,
                    'fake_gps_suspected' => $fakeGpsSuspected,
                ]);

                // Gabungkan system notes
                $finalSystemNotes = implode(' | ', array_filter([
                    $localSystemNotes,
                    $gpsMismatchNotes,
                ]));

                // ── 4f: Simpan ke database PostgreSQL ────────────────────
                $report = Report::create([
                    'report_code'          => $reportCode,
                    // Prioritaskan nama dari auth token, fallback ke input form
                    'reporter_name'        => auth()->user()?->name ?? $validated['reporter_name'],
                    'road_name'            => $validated['road_name'],
                    'district'             => $validated['district'],
                    'latitude'             => $validated['latitude'],
                    'longitude'            => $validated['longitude'],
                    'image_original_path'  => $originalPath,
                    'image_result_path'    => $resultPath,
                    'image_hash'           => $imageHash,
                    'support_count'        => 0,
                    'total_detections'     => $totalDetections,
                    'overall_severity'     => $overallSeverity,
                    'ai_raw_output'        => $aiRawOutput,
                    'status'               => 'Menunggu Review',
                    'system_notes'         => $finalSystemNotes ?: null,
                    // Trust score
                    'trust_score'          => $trustResult['score'],
                    'trust_label'          => $trustResult['label'],
                    'trust_breakdown'      => $trustResult['breakdown'],
                    // Dimensi kerusakan
                    'kerusakan_panjang'    => $validated['kerusakan_panjang'] ?? null,
                    'kerusakan_lebar'      => $validated['kerusakan_lebar'] ?? null,
                    // Catatan petugas
                    'catatan_petugas'      => $validated['catatan'] ?? null,
                ]);

                return $report;
            });

            // Tambahkan system notes dari EXIF check jika ada
            // (dilakukan di luar transaksi agar tidak memblokir)
            if ($systemNotes && $report->system_notes === null) {
                $report->update(['system_notes' => $systemNotes]);
            } elseif ($systemNotes && $report->system_notes !== null) {
                $report->update(['system_notes' => $report->system_notes . ' | ' . $systemNotes]);
            }

        } catch (\Exception $e) {
            Log::error('DeltaJalan: Gagal menyimpan laporan.', [
                'error'   => $e->getMessage(),
                'trace'   => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Terjadi kesalahan saat menyimpan laporan. Silakan coba lagi.',
                'debug'   => config('app.debug') ? $e->getMessage() : null,
            ], 500);
        }

        // ── Log aktivitas petugas untuk anomaly detection ─────────────────
        $reporterName = $report->reporter_name;
        $dailyCount = Report::where('reporter_name', $reporterName)
            ->whereDate('created_at', today())
            ->count();
        Log::info('DeltaJalan: Laporan tunggal disimpan.', [
            'reporter_name' => $reporterName,
            'report_code'   => $report->report_code,
            'trust_score'   => $report->trust_score,
            'trust_label'   => $report->trust_label,
            'daily_count'   => $dailyCount,
        ]);

        // ── LANGKAH 8: Kembalikan Response ke Frontend ────────────────────
        // Muat ulang model untuk mendapatkan data terbaru dari database
        $report->refresh();

        return response()->json([
            'success' => true,
            'message' => 'Laporan berhasil disimpan.',
            'data'    => [
                'id'                  => $report->id,
                'report_code'         => $report->report_code,
                'reporter_name'       => $report->reporter_name,
                'road_name'           => $report->road_name,
                'district'            => $report->district,
                'latitude'            => (float) $report->latitude,
                'longitude'           => (float) $report->longitude,
                'total_detections'    => $report->total_detections,
                'overall_severity'    => $report->overall_severity,
                'severity_color'      => $report->severity_color,
                'status'              => $report->status,
                'ai_raw_output'       => $report->ai_raw_output,
                // Trust score (sekarang tersedia untuk single upload juga)
                'trust_score'         => $report->trust_score,
                'trust_label'         => $report->trust_label,
                // URL gambar yang bisa langsung dipakai oleh frontend React
                'image_original_url'  => $report->image_original_url,
                'image_result_url'    => $report->image_result_url,
                'catatan_petugas'     => $report->catatan_petugas,
                'kerusakan_panjang'   => $report->kerusakan_panjang ? (float) $report->kerusakan_panjang : null,
                'kerusakan_lebar'     => $report->kerusakan_lebar ? (float) $report->kerusakan_lebar : null,
                'created_at'          => $report->created_at->toIso8601String(),
            ],
        ], 201);
    }

    // ── Daftar Laporan ──────────────────────────────────────────────────

    /**
     * GET /api/reports
     * Daftar laporan — petugas hanya melihat laporannya sendiri,
     * supervisor melihat semua (bisa difilter via ?status=).
     */
    public function index(Request $request): JsonResponse
    {
        $user = auth()->user();

        $query = Report::query();

        // Petugas hanya melihat laporannya sendiri
        if ($user->role === 'petugas') {
            $query->where('reporter_name', $user->name);
        }

        // Petugas eksekusi hanya melihat laporan yang ditugaskan ke UPR-nya
        if ($user->role === 'petugas_eksekusi') {
            $query->when($user->upr_id, fn($q) => $q->where('assigned_upr_id', $user->upr_id))
                  ->unless($user->upr_id, fn($q) => $q->whereRaw('1 = 0'));
            $query->whereNotIn('status', ['Diedit']);
        }

        // Supervisor tidak melihat laporan yang sedang diedit petugas
        if ($user->role === 'supervisor') {
            $query->whereNotIn('status', ['Diedit']);
        }

        // Filter status (case-insensitive, ubah underscore ke spasi)
        if ($request->filled('status')) {
            $status = str_replace('_', ' ', $request->input('status'));
            $lower = strtolower($status);
            if ($lower === 'menunggu review') {
                $query->whereIn('status', ['Menunggu Review', 'Ditinjau']);
            } else {
                $query->whereRaw('LOWER(status::text) = ?', [$lower]);
            }
        }

        // Search — cari berdasarkan report_code, road_name, reporter_name
        if ($request->filled('q')) {
            $q = $request->input('q');
            $query->where(function ($sub) use ($q) {
                $sub->where('report_code', 'ilike', "%{$q}%")
                     ->orWhere('road_name', 'ilike', "%{$q}%")
                     ->orWhere('reporter_name', 'ilike', "%{$q}%");
            });
        }

        // Filter by UPR
        if ($request->filled('upr_id')) {
            $query->where('assigned_upr_id', (int) $request->input('upr_id'));
        }

        // Filter by severity
        if ($request->filled('severity')) {
            $sev = $request->input('severity');
            $query->where(function ($sub) use ($sev) {
                $sub->whereRaw('overall_severity::text = ?', [$sev])
                     ->orWhere('ai_severity', $sev);
            });
        }

        // Filter user_reports=true — paksa filter berdasarkan user name
        if ($request->boolean('user_reports')) {
            $query->where('reporter_name', $user->name);
        }

        $limit = min((int) $request->input('limit', 50), 100);

        $reports = $query->orderBy('created_at', 'desc')
            ->limit($limit)
            ->withCount('photos')
            ->with('firstPhoto')
            ->get()
            ->map(function ($report) {
                return [
                    'id'                   => $report->id,
                    'report_code'          => $report->report_code,
                    'reporter_name'        => $report->reporter_name,
                    'road_name'            => $report->road_name,
                    'district'             => $report->district,
                    'latitude'             => $report->latitude ? (float) $report->latitude : null,
                    'longitude'            => $report->longitude ? (float) $report->longitude : null,
                    'overall_severity'     => $report->overall_severity,
                    'ai_severity'          => $report->ai_severity,
                    'total_detections'     => $report->total_detections,
                    'status'               => $report->status,
                    'trust_score'          => $report->trust_score,
                    'trust_label'          => $report->trust_label,
                    'image_original_url'   => $report->image_original_url,
                    'image_result_url'     => $report->image_result_url,
                    'after_photo_url'      => $report->after_photo_url,
                    'first_photo_url'      => $report->first_photo_url,
                    'assigned_upr_id'      => $report->assigned_upr_id,
                    'assigned_upr_name'    => $report->assignedUpr?->name,
                    'perbaikan_dimulai_at' => $report->perbaikan_dimulai_at?->toIso8601String(),
                    'perbaikan_selesai_at' => $report->perbaikan_selesai_at?->toIso8601String(),
                    'pelaksana'            => $report->pelaksana,
                    'kerusakan_panjang'    => $report->kerusakan_panjang ? (float) $report->kerusakan_panjang : null,
                    'kerusakan_lebar'      => $report->kerusakan_lebar ? (float) $report->kerusakan_lebar : null,
                    'catatan_petugas'      => $report->catatan_petugas,
                    'priority'             => $report->priority,
                    'batch_id'             => $report->batch_id,
                    'photos_count'         => $report->batch_id ? (int) $report->photos_count : 0,
                    'created_at'           => $report->created_at?->toIso8601String(),
                ];
            });

        return response()->json([
            'success' => true,
            'data'    => $reports,
            'total'   => $reports->count(),
        ]);
    }

    /**
     * GET /api/reports/{id}
     * Detail satu laporan berdasarkan UUID.
     */
    public function show(string $id): JsonResponse
    {
        $report = Report::with(['evidences', 'photos', 'statusLogs'])->find($id);

        if (!$report) {
            return response()->json(['success' => false, 'message' => 'Laporan tidak ditemukan.'], 404);
        }

        $user = auth()->user();
        if ($user && $user->role === 'petugas' && $report->reporter_name !== $user->name) {
            return response()->json([
                'success' => false,
                'message' => 'Anda hanya dapat melihat detail laporan Anda sendiri.',
            ], 403);
        }

        $data = [
            'id'                 => $report->id,
            'report_code'        => $report->report_code,
            'reporter_name'      => $report->reporter_name,
            'road_name'          => $report->road_name,
            'district'           => $report->district,
            'latitude'           => $report->latitude ? (float) $report->latitude : null,
            'longitude'          => $report->longitude ? (float) $report->longitude : null,
            'overall_severity'   => $report->overall_severity,
            'ai_severity'        => $report->ai_severity,
            'total_detections'   => $report->total_detections,
            'status'             => $report->status,
            'trust_score'        => $report->trust_score,
            'trust_label'        => $report->trust_label,
            'trust_breakdown'    => $report->trust_breakdown,
            'system_notes'       => $report->system_notes,
            'ai_raw_output'      => $report->ai_raw_output,
            'image_original_url' => $report->image_original_url,
            'image_result_url'   => $report->image_result_url,
            'after_photo_url'    => $report->after_photo_url,
            'after_photo_notes'  => $report->after_photo_notes,
            'perbaikan_dimulai_at' => $report->perbaikan_dimulai_at?->toIso8601String(),
            'perbaikan_selesai_at' => $report->perbaikan_selesai_at?->toIso8601String(),
            'pelaksana'          => $report->pelaksana,
            'assigned_upr_id'    => $report->assigned_upr_id,
            'assigned_upr_name'  => $report->assignedUpr?->name,
            'assigned_at'        => $report->assigned_at?->toIso8601String(),
            'catatan_petugas'    => $report->catatan_petugas,
            'priority'           => $report->priority,
            'kerusakan_panjang'    => $report->kerusakan_panjang ? (float) $report->kerusakan_panjang : null,
            'kerusakan_lebar'      => $report->kerusakan_lebar ? (float) $report->kerusakan_lebar : null,
            'batch_id'             => $report->batch_id,
            'created_at'           => $report->created_at?->toIso8601String(),
            'updated_at'           => $report->updated_at?->toIso8601String(),
            'evidences'            => $report->evidences->map(fn ($e) => [
                'id'            => $e->id,
                'image_url'     => $e->image_url,
                'reporter_name' => $e->reporter_name,
                'notes'         => $e->notes,
                'created_at'    => $e->created_at?->toIso8601String(),
            ]),
            'photos'             => $report->photos->map(fn ($p) => [
                'id'                 => $p->id,
                'ai_jenis_kerusakan' => $p->ai_jenis_kerusakan,
                'ai_severity'        => $p->ai_severity,
                'ai_confidence'      => $p->ai_confidence ? (float) $p->ai_confidence : null,
                'total_detections'   => $p->total_detections,
                'latitude'           => $p->latitude ? (float) $p->latitude : null,
                'longitude'          => $p->longitude ? (float) $p->longitude : null,
                'image_original_url' => $p->image_original_url,
                'image_result_url'   => $p->image_result_url,
                'system_notes'       => $p->system_notes,
                'sort_order'         => $p->sort_order,
                'created_at'         => $p->created_at?->toIso8601String(),
            ]),
            // Timeline — urut dari paling lama ke paling baru
            'status_history'     => $report->statusLogs->map(fn ($log) => [
                'event'      => $this->mapStatusToEvent($log->new_status, $log->notes),
                'label'      => $this->mapStatusToLabel($log->new_status, $log->notes),
                'status'     => $log->new_status,
                'old_status' => $log->old_status,
                'timestamp'  => $log->created_at?->toIso8601String(),
                'actor_name' => $log->actor_name,
                'actor_role' => $log->actor_role,
                'notes'      => $log->notes,
            ])->values()->toArray(),
        ];

        return response()->json([
            'success' => true,
            'data'    => $data,
        ]);
    }

    // ── Peta Interaktif GIS ──────────────────────────────────────────────

    /**
     * GET /api/reports/map-data
     *
     * Data agregat untuk Peta Interaktif:
     *  - districts: statistik per kecamatan (GROUP BY district)
     *  - reports:   laporan dengan koordinat (ringan, untuk marker)
     *  - stats:     statistik global (by severity, by status, SLA breach)
     */
    public function mapData(Request $request): JsonResponse
    {
        $user = $request->user();

        // 1. Statistik per kecamatan
        $districts = Report::selectRaw("
            district,
            COUNT(*) as total,
            SUM(CASE WHEN overall_severity::text = 'Rusak Berat' OR LOWER(ai_severity) = 'berat' THEN 1 ELSE 0 END) as rusak_berat,
            SUM(CASE WHEN overall_severity::text = 'Rusak Sedang' OR LOWER(ai_severity) = 'sedang' THEN 1 ELSE 0 END) as rusak_sedang,
            SUM(CASE WHEN overall_severity::text = 'Rusak Ringan' OR LOWER(ai_severity) = 'ringan' THEN 1 ELSE 0 END) as rusak_ringan,
            AVG(CASE
                WHEN overall_severity::text = 'Rusak Berat' OR LOWER(ai_severity) = 'berat' THEN 3
                WHEN overall_severity::text = 'Rusak Sedang' OR LOWER(ai_severity) = 'sedang' THEN 2
                WHEN overall_severity::text = 'Rusak Ringan' OR LOWER(ai_severity) = 'ringan' THEN 1
                ELSE 0
            END) as avg_severity_score
        ")
            ->whereNotNull('district')
            ->whereNotNull('latitude')
            ->whereNotNull('longitude')
            ->groupBy('district')
            ->get()
            ->keyBy('district');

        // 2. Laporan ringan untuk marker
        $query = Report::select([
            'id', 'latitude', 'longitude', 'status',
            'overall_severity', 'ai_severity', 'road_name', 'district',
            'image_original_path', 'kerusakan_panjang', 'kerusakan_lebar',
            'trust_score', 'created_at', 'assigned_upr_id',
        ])->with(['firstPhoto', 'assignedUpr'])->whereNotNull('latitude')->whereNotNull('longitude');

        // Filter query params
        if ($request->filled('status')) {
            $statuses = is_array($request->input('status'))
                ? $request->input('status')
                : explode(',', $request->input('status'));
            $query->whereIn('status', $statuses);
        }

        if ($request->filled('severity')) {
            $severities = is_array($request->input('severity'))
                ? $request->input('severity')
                : explode(',', $request->input('severity'));
            $query->where(function ($q) use ($severities) {
                foreach ($severities as $s) {
                    $q->orWhere(function ($q2) use ($s) {
                        $sev = strtolower($s);
                        $enumMap = ['berat' => 'Rusak Berat', 'sedang' => 'Rusak Sedang', 'ringan' => 'Rusak Ringan'];
                        $enumVal = $enumMap[$sev] ?? null;
                        if ($enumVal) {
                            $q2->whereRaw('(overall_severity::text = ? OR LOWER(ai_severity) = ?)', [$enumVal, $sev]);
                        } else {
                            $q2->whereRaw('LOWER(ai_severity) = ?', [$sev]);
                        }
                    });
                }
            });
        }

        if ($request->filled('district')) {
            $query->where('district', $request->input('district'));
        }

        if ($request->filled('upr_id')) {
            $query->where('assigned_upr_id', (int) $request->input('upr_id'));
        }

        // SLA filter: tampilkan laporan yang sudah > N hari tanpa selesai/ditolak
        if ($request->filled('sla_days')) {
            $days = max(1, (int) $request->input('sla_days'));
            $query->where('created_at', '<', now()->subDays($days))
                  ->whereNotIn('status', ['Selesai', 'Ditolak']);
        }

        $reports = $query->orderBy('created_at', 'desc')->limit(1000)->get()
            ->each(fn ($r) => $r->append('first_photo_url')->setAttribute('assigned_upr_name', $r->assignedUpr?->name));

        // 3. Statistik global
        $baseStats = Report::whereNotNull('latitude')->whereNotNull('longitude');

        $total = (clone $baseStats)->count();

        $bySeverity = [
            'berat'  => (clone $baseStats)->where(function ($q) { $q->whereRaw("overall_severity::text = 'Rusak Berat'")->orWhereRaw("LOWER(ai_severity) = 'berat'"); })->count(),
            'sedang' => (clone $baseStats)->where(function ($q) { $q->whereRaw("overall_severity::text = 'Rusak Sedang'")->orWhereRaw("LOWER(ai_severity) = 'sedang'"); })->count(),
            'ringan' => (clone $baseStats)->where(function ($q) { $q->whereRaw("overall_severity::text = 'Rusak Ringan'")->orWhereRaw("LOWER(ai_severity) = 'ringan'"); })->count(),
        ];

        $byStatus = [
            'Menunggu Review'   => (clone $baseStats)->whereIn('status', ['Menunggu Review', 'Ditinjau'])->count(),
            'Disetujui'         => (clone $baseStats)->where('status', 'Disetujui')->count(),
            'Sedang Diperbaiki' => (clone $baseStats)->where('status', 'Sedang Diperbaiki')->count(),
            'Selesai'           => (clone $baseStats)->where('status', 'Selesai')->count(),
            'Ditolak'           => (clone $baseStats)->where('status', 'Ditolak')->count(),
        ];

        $slaBreachCount = (clone $baseStats)
            ->where('created_at', '<', now()->subDays(7))
            ->whereNotIn('status', ['Selesai', 'Ditolak'])
            ->count();

        return response()->json([
            'success' => true,
            'data'    => [
                'districts' => $districts,
                'reports'   => $reports,
                'stats'     => [
                    'total'             => $total,
                    'by_severity'       => $bySeverity,
                    'by_status'         => $byStatus,
                    'sla_breach_count'  => $slaBreachCount,
                ],
            ],
        ]);
    }

    // ── Helper Methods ────────────────────────────────────────────────────

    /**
     * Menghitung MD5 hash dari konten biner file gambar.
     *
     * Digunakan untuk mendeteksi foto yang identik secara konten,
     * mencegah petugas mengirim laporan ganda dengan foto yang sama.
     *
     * @param  string  $filePath  Path absolut ke file foto
     * @return string|null        MD5 hash (32 karakter hex), atau null jika gagal
     */
    private function calculateImageHash(string $filePath): ?string
    {
        try {
            $hash = hash_file('sha256', $filePath);
            if ($hash === false) {
                Log::warning('DeltaJalan: hash_file() mengembalikan false.', ['path' => $filePath]);
                return null;
            }
            return $hash;
        } catch (\Exception $e) {
            Log::warning('DeltaJalan: Gagal menghitung image hash.', [
                'error' => $e->getMessage(),
                'path'  => $filePath,
            ]);
            return null;
        }
    }

    /**
     * Generate kode laporan unik dengan format LP-{TAHUN}-{5 DIGIT ANGKA}.
     *
     * Contoh: LP-2026-00042
     *
     * Menggunakan loop dengan pengecekan database untuk memastikan
     * tidak ada duplikasi kode, meskipun kemungkinannya sangat kecil.
     *
     * @return string Kode laporan unik
     */
    private function generateReportCode(): string
    {
        $year = date('Y');

        do {
            // Ambil nomor urut terakhir dari database untuk tahun ini,
            // lalu tambahkan 1. Jika belum ada, mulai dari 1.
            $lastReport = Report::where('report_code', 'like', "LP-{$year}-%")
                ->orderBy('report_code', 'desc')
                ->first();

            if ($lastReport) {
                // Ambil 5 digit terakhir dari kode, konversi ke integer, tambah 1
                $lastNumber = (int) substr($lastReport->report_code, -5);
                $nextNumber = $lastNumber + 1;
            } else {
                $nextNumber = 1;
            }

            // Format: LP-2026-00001 (5 digit dengan leading zeros)
            $code = sprintf('LP-%s-%05d', $year, $nextNumber);

        } while (Report::where('report_code', $code)->exists());
        // Loop ulang jika kode sudah ada (race condition protection)

        return $code;
    }

    /**
     * Memanggil endpoint /analyze di FastAPI AI Server.
     *
     * Menggunakan Laravel HTTP Client dengan timeout 30 detik.
     * Jika server mati atau timeout, mengembalikan array dengan success=false
     * sehingga laporan tetap bisa disimpan dalam mode fallback.
     *
     * @param  string  $filePath   Path absolut ke file foto di server
     * @param  string  $fileName   Nama file asli (untuk header multipart)
     * @return array{success: bool, data: array|null, error: string|null}
     */
    private function callFastApiAnalyze(string $filePath, string $fileName): array
    {
        $fastApiUrl = rtrim(config('services.fastapi.url', env('FASTAPI_URL', 'http://127.0.0.1:8000')), '/');
        $endpoint   = $fastApiUrl . '/analyze';

        try {
            $response = Http::timeout(30)
                ->attach(
                    'file',                    // Nama parameter di FastAPI: file: UploadFile = File(...)
                    file_get_contents($filePath), // Konten file sebagai binary string
                    $fileName                  // Nama file yang dikirim
                )
                ->post($endpoint);

            if ($response->successful()) {
                $data = $response->json();

                // Validasi struktur response FastAPI
                if (! isset($data['overall_severity'])) {
                    return [
                        'success' => false,
                        'data'    => null,
                        'error'   => 'Response FastAPI tidak memiliki field overall_severity.',
                    ];
                }

                return [
                    'success' => true,
                    'data'    => $data,
                    'error'   => null,
                ];
            }

            return [
                'success' => false,
                'data'    => null,
                'error'   => "FastAPI merespons dengan status HTTP {$response->status()}.",
            ];

        } catch (\Illuminate\Http\Client\ConnectionException $e) {
            // Server FastAPI mati atau tidak bisa dijangkau
            return [
                'success' => false,
                'data'    => null,
                'error'   => 'Koneksi ke FastAPI gagal: ' . $e->getMessage(),
            ];
        } catch (\Exception $e) {
            // Error lainnya (timeout, dll)
            return [
                'success' => false,
                'data'    => null,
                'error'   => 'Error saat memanggil FastAPI: ' . $e->getMessage(),
            ];
        }
    }

    /**
     * Menyimpan gambar dari string base64 ke file fisik di storage.
     *
     * FastAPI mengembalikan foto hasil bounding box sebagai string base64.
     * Fungsi ini mengkonversinya kembali menjadi file .jpg dan menyimpannya.
     *
     * @param  string  $base64String  String base64 gambar (tanpa prefix data:image/...)
     * @param  string  $folder        Folder tujuan di storage/app/public/
     * @return string|null            Path relatif file yang tersimpan, atau null jika gagal
     */
    private function saveBase64Image(string $base64String, string $folder): ?string
    {
        try {
            // Bersihkan prefix data URI jika ada (misal: "data:image/jpeg;base64,")
            if (str_contains($base64String, ',')) {
                $base64String = explode(',', $base64String, 2)[1];
            }

            // Decode base64 ke binary
            $imageData = base64_decode($base64String, strict: true);

            if ($imageData === false) {
                Log::warning('DeltaJalan: Gagal decode base64 image dari FastAPI.');
                return null;
            }

            // Generate nama file unik
            $filename = Str::uuid() . '-result-' . time() . '.jpg';
            $path     = $folder . '/' . $filename;

            // Simpan ke storage/app/public/ menggunakan disk 'public'
            Storage::disk('public')->put($path, $imageData);

            return $path;

        } catch (\Exception $e) {
            Log::warning('DeltaJalan: Gagal menyimpan foto hasil AI.', [
                'error' => $e->getMessage(),
            ]);
            return null;
        }
    }

    /**
     * Validasi tanggal foto dari metadata EXIF (Anti-Fraud Layer).
     *
     * Ini adalah lapisan keamanan di sisi server yang memverifikasi
     * bahwa foto yang dikirim adalah foto baru (bukan foto lama atau
     * foto yang dimanipulasi metadata-nya).
     *
     * Catatan: Fungsi ini bersifat "best effort" — jika PHP tidak bisa
     * membaca EXIF (ekstensi tidak aktif, file PNG, dll), akan mengembalikan
     * status 'no_exif_date' sebagai warning, bukan error fatal.
     *
     * @param  string  $filePath  Path absolut ke file foto
     * @return array{status: string, message: string, photo_date: string|null}
     */
    private function validatePhotoDateExif(string $filePath): array
    {
        // Cek apakah ekstensi EXIF tersedia di PHP
        if (! function_exists('exif_read_data')) {
            // Ekstensi EXIF tidak aktif — skip validasi, beri warning saja
            return [
                'status'     => 'no_exif_support',
                'message'    => 'Ekstensi EXIF PHP tidak aktif. Validasi tanggal foto dilewati.',
                'photo_date' => null,
            ];
        }

        try {
            // Suppress error dengan @ karena exif_read_data bisa throw warning
            // untuk file yang tidak punya EXIF (PNG, screenshot, dll)
            $exifData = @exif_read_data($filePath, 'EXIF', false);

            if (! $exifData) {
                return [
                    'status'     => 'no_exif_date',
                    'message'    => 'Foto tidak memiliki metadata EXIF. Kemungkinan screenshot atau foto dari internet.',
                    'photo_date' => null,
                ];
            }

            // Coba baca DateTimeOriginal (prioritas utama) atau fallback ke DateTime
            $rawDate = $exifData['DateTimeOriginal']
                ?? $exifData['DateTimeDigitized']
                ?? $exifData['DateTime']
                ?? null;

            if (! $rawDate) {
                return [
                    'status'     => 'no_exif_date',
                    'message'    => 'Metadata EXIF tidak memiliki informasi tanggal pengambilan foto.',
                    'photo_date' => null,
                ];
            }

            // Parse format EXIF: "YYYY:MM:DD HH:MM:SS" → PHP DateTime
            $photoDate = \DateTime::createFromFormat('Y:m:d H:i:s', $rawDate);

            if (! $photoDate) {
                return [
                    'status'     => 'exif_read_error',
                    'message'    => 'Format tanggal EXIF tidak dapat dibaca.',
                    'photo_date' => null,
                ];
            }

            // Normalisasi ke tengah malam untuk perbandingan tanggal saja
            // Ini mencegah foto yang diambil jam 14:00 dianggap "masa depan"
            // hanya karena server membandingkan dengan jam 10:00 saat ini
            $photoDateOnly = new \DateTime($photoDate->format('Y-m-d'));
            $todayOnly     = new \DateTime('today'); // selalu 00:00:00 hari ini

            $diffDays = (int) $todayOnly->diff($photoDateOnly)->days;
            $isFuture = $photoDateOnly > $todayOnly; // besok atau lebih = masa depan

            // Foto dari masa depan — metadata dimanipulasi
            if ($isFuture) {
                return [
                    'status'     => 'future_date',
                    'message'    => "Tanggal foto ({$photoDate->format('d/m/Y')}) adalah tanggal di masa depan. " .
                                    'Metadata foto kemungkinan telah dimanipulasi.',
                    'photo_date' => $photoDate->format('Y-m-d'),
                ];
            }

            // Foto terlalu lama
            if ($diffDays > self::MAX_PHOTO_AGE_DAYS) {
                return [
                    'status'     => 'too_old',
                    'message'    => "Foto diambil pada {$photoDate->format('d/m/Y')} ({$diffDays} hari yang lalu). " .
                                    'Sistem hanya menerima foto yang diambil maksimal ' .
                                    self::MAX_PHOTO_AGE_DAYS . ' hari terakhir.',
                    'photo_date' => $photoDate->format('Y-m-d'),
                ];
            }

            // Lolos semua validasi
            return [
                'status'     => 'valid',
                'message'    => 'Tanggal foto valid.',
                'photo_date' => $photoDate->format('Y-m-d'),
            ];

        } catch (\Exception $e) {
            // Jika ada error tak terduga, jangan blokir laporan — beri warning saja
            Log::warning('DeltaJalan: Error saat membaca EXIF foto.', [
                'error' => $e->getMessage(),
            ]);

            return [
                'status'     => 'exif_read_error',
                'message'    => 'Gagal membaca metadata EXIF: ' . $e->getMessage(),
                'photo_date' => null,
            ];
        }
    }

    // ── Batch Upload Methods ──────────────────────────────────────────────

    /**
     * Simpan laporan batch (satu laporan utama + sub-laporan per foto).
     *
     * POST /api/reports/batch
     * Memerlukan autentikasi Sanctum.
     *
     * @param  Request  $request
     * @return JsonResponse
     */
    public function storeBatch(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'batch_id'           => 'required|uuid',
                'road_name'          => 'required|string|max:255',
                'district'           => 'required|string|in:' . implode(',', $this->getKecamatanList()),
                'latitude'           => 'required|numeric|between:-11,6',
                'longitude'          => 'required|numeric|between:95,141',
                'koordinat_sumber'   => 'required|in:exif,browser_gps,manual',
                'fake_gps_suspected' => 'boolean',
                'analyses'           => 'required|json',
                'kerusakan_panjang'  => ['required', 'array', 'min:1'],
                'kerusakan_panjang.*' => ['required', 'numeric', 'min:0', 'max:999999.99'],
                'kerusakan_lebar'    => ['required', 'array', 'min:1'],
                'kerusakan_lebar.*'  => ['required', 'numeric', 'min:0', 'max:999999.99'],
                'catatan'            => ['nullable', 'string', 'max:1000'],
                'files'              => 'required|array|min:1',
                'files.*'            => 'required|file|mimes:jpeg,jpg,png|max:5120',
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Data yang dikirim tidak valid.',
                'errors'  => $e->errors(),
            ], 422);
        }

        $analyses = json_decode($validated['analyses'], true);

        if (!is_array($analyses) || count($analyses) === 0) {
            return response()->json([
                'success' => false,
                'message' => 'Data analyses tidak valid atau kosong.',
            ], 422);
        }

        // ── Validasi koordinat berada di wilayah Sidoarjo ─────────────────
        if (!$this->isInSidoarjo((float) $validated['latitude'], (float) $validated['longitude'])) {
            return response()->json([
                'success'    => false,
                'message'    => 'Koordinat berada di luar wilayah Kabupaten Sidoarjo.',
                'error_code' => 'KOORDINAT_DILUAR_WILAYAH',
            ], 422);
        }

        // ── Validasi nama jalan vs koordinat (tidak bisa di-bypass dari frontend) ──
        $roadValidation = $this->validateRoadNameVsCoordinate(
            $validated['road_name'],
            (float) $validated['latitude'],
            (float) $validated['longitude']
        );

        // ── Deteksi EXIF cloning ──────────────────────────────────────────
        // Jika >80% foto dalam batch memiliki koordinat GPS EXIF yang identik,
        // ini indikasi EXIF di-clone dari satu foto ke foto lainnya.
        $exifCloneSuspected = false;
        $exifCoords = [];
        foreach ($analyses as $a) {
            if (!empty($a['has_exif_gps']) && isset($a['exif_lat'], $a['exif_lng'])) {
                $key = round((float)$a['exif_lat'], 4) . ',' . round((float)$a['exif_lng'], 4);
                $exifCoords[$key] = ($exifCoords[$key] ?? 0) + 1;
            }
        }
        $photosWithExif = count($analyses) - count(array_filter($analyses, fn($a) => empty($a['has_exif_gps'])));
        if ($photosWithExif >= 3 && count($exifCoords) === 1) {
            $exifCloneSuspected = true;
        } elseif ($photosWithExif >= 5) {
            $maxSame = max($exifCoords);
            if ($maxSame >= $photosWithExif * 0.8) {
                $exifCloneSuspected = true;
            }
        }

        // ── Hitung trust score ────────────────────────────────────────────
        $firstAnalysis = $analyses[0] ?? [];
        $batchFakeGps = $validated['fake_gps_suspected'] ?? false;
        if ($exifCloneSuspected) {
            $batchFakeGps = true; // EXIF cloning = fake GPS
        }
        $trustResult   = app(\App\Services\TrustScoreService::class)->calculate([
            'exif_lat'           => !empty($firstAnalysis['has_exif_gps']) ? ($firstAnalysis['exif_lat'] ?? $validated['latitude'])  : null,
            'exif_lng'           => !empty($firstAnalysis['has_exif_gps']) ? ($firstAnalysis['exif_lng'] ?? $validated['longitude']) : null,
            'road_name_matched'  => $roadValidation['matched'],
            'ai_detections'      => $firstAnalysis['detections']    ?? [],
            'ai_context_valid'   => !empty($firstAnalysis['detections']),
            'fake_gps_suspected' => $batchFakeGps,
        ]);

        // Catat EXIF cloning di system notes main report nanti
        $batchNotes = null;
        if ($exifCloneSuspected) {
            $batchNotes = '[PERINGATAN] Terdeteksi ' . $photosWithExif . ' foto dengan koordinat GPS EXIF identik — kemungkinan EXIF di-clone.';
        }

        try {
            $result = DB::transaction(function () use ($validated, $analyses, $request, $trustResult, $roadValidation, $batchNotes, $exifCloneSuspected) {
                $severities  = array_column($analyses, 'severity');
                $aggSeverity = $this->aggregateSeverity($severities);
                $severityMap = [
                    'berat'  => 'Rusak Berat',
                    'sedang' => 'Rusak Sedang',
                    'ringan' => 'Rusak Ringan',
                    'baik'   => 'Baik',
                ];
                $mainReport  = Report::create([
                    'report_code'      => $this->generateReportCode(),
                    'reporter_name'    => auth()->user()->name ?? 'Petugas',
                    'road_name'        => $validated['road_name'],
                    'district'         => $validated['district'],
                    'latitude'         => $validated['latitude'],
                    'longitude'        => $validated['longitude'],
                    'koordinat_sumber' => $validated['koordinat_sumber'],
                    'status'           => 'Menunggu Review',
                    'batch_id'         => $validated['batch_id'],
                    'trust_score'      => $trustResult['score'],
                    'trust_label'      => $trustResult['label'],
                    'trust_breakdown'  => $trustResult['breakdown'],
                    'overall_severity'   => $severityMap[$aggSeverity] ?? 'Baik',
                    'ai_severity'        => $aggSeverity,
                    'system_notes'       => $batchNotes,
                    'kerusakan_panjang'  => array_sum($validated['kerusakan_panjang']),
                    'kerusakan_lebar'    => array_sum($validated['kerusakan_lebar']),
                    'catatan_petugas'    => $validated['catatan'] ?? null,
                ]);

                $photosCreated = 0;
                $duplicatesSkipped = 0;
                $duplicatePhotoList = [];
                foreach ($analyses as $idx => $analysis) {
                    if (!empty($analysis['exif_invalid'])) {
                        Log::info('DeltaJalan: Foto batch dilewati karena EXIF tidak valid.', [
                            'file_index'  => $idx,
                            'file_name'   => $analysis['file_name'] ?? '',
                            'exif_reason' => $analysis['exif_reason'] ?? '',
                        ]);
                        continue;
                    }

                    $file       = $request->file('files')[$idx] ?? null;
                    $photoPath  = null;
                    $resultPath = null;
                    $imageHash  = null;

                    $photoLat        = (float) ($analysis['photo_lat'] ?? $validated['latitude']);
                    $photoLng        = (float) ($analysis['photo_lng'] ?? $validated['longitude']);
                    $koordinatSumber = $analysis['koordinat_sumber'] ?? $validated['koordinat_sumber'];

                    if ($file) {
                        $imageHash = $this->calculateImageHash($file->getPathname());

                        if ($imageHash && Report::imageHashExists($imageHash)) {
                            Log::info('DeltaJalan: Foto duplikat dilewati dalam batch.', [
                                'file_index' => $idx,
                                'file_name'  => $analysis['file_name'] ?? '',
                                'hash'       => $imageHash,
                            ]);
                            $duplicatesSkipped++;
                            $duplicatePhotoList[] = [
                                'file_index' => $idx,
                                'file_name'  => $analysis['file_name'] ?? '',
                            ];
                            continue;
                        }

                        $filename  = Str::uuid() . '-batch-' . time() . '.' . $file->getClientOriginalExtension();
                        $photoPath = $file->storeAs(self::ORIGINALS_FOLDER, $filename, 'public');
                    }

                    if (!empty($analysis['image_result'])) {
                        $resultPath = $this->saveBase64Image(
                            $analysis['image_result'],
                            self::RESULTS_FOLDER
                        );
                    }

                    $photoTrustResult = app(\App\Services\TrustScoreService::class)->calculate([
                        'exif_lat'           => $analysis['has_exif_gps'] ? $analysis['exif_lat'] : null,
                        'exif_lng'           => $analysis['has_exif_gps'] ? $analysis['exif_lng'] : null,
                        'road_name_matched'  => $roadValidation['matched'],
                        'ai_detections'      => $analysis['detections'] ?? [],
                        'ai_context_valid'   => !empty($analysis['detections']),
                        'fake_gps_suspected' => $analysis['gps_mismatch'] ?? false,
                    ]);

                    $subNotes = null;
                    if (!empty($analysis['gps_mismatch'])) {
                        $dist = round($analysis['gps_distance_meters'] ?? 0);
                        $subNotes = "[PERINGATAN] GPS EXIF foto berjarak {$dist}m dari koordinat yang diinput. Perlu verifikasi.";
                    } elseif (empty($analysis['has_exif_gps'])) {
                        $subNotes = '[INFO] Foto tidak memiliki GPS EXIF. Koordinat dari input form.';
                    }

                    ReportPhoto::create([
                        'report_id'           => $mainReport->id,
                        'image_original_path' => $photoPath,
                        'image_result_path'   => $resultPath,
                        'image_hash'          => $imageHash,
                        'latitude'            => $photoLat,
                        'longitude'           => $photoLng,
                        'koordinat_sumber'    => $koordinatSumber,
                        'ai_jenis_kerusakan'  => $analysis['detections'][0]['type'] ?? null,
                        'ai_severity'         => $analysis['severity'] ?? 'ringan',
                        'ai_confidence'       => $analysis['confidence'] ?? null,
                        'total_detections'    => count($analysis['detections'] ?? []),
                        'kerusakan_panjang'   => $validated['kerusakan_panjang'][$idx] ?? null,
                        'kerusakan_lebar'     => $validated['kerusakan_lebar'][$idx] ?? null,
                        'system_notes'        => $subNotes,
                        'sort_order'          => $idx,
                        'original_filename'   => $analysis['file_name'] ?? null,
                    ]);

                    $photosCreated++;
                }

                if ($photosCreated === 0) {
                    throw new \RuntimeException(
                        $duplicatesSkipped > 0
                            ? 'Semua foto sudah pernah digunakan pada laporan lain.'
                            : 'Tidak ada foto yang berhasil diproses.'
                    );
                }

                if ($duplicatesSkipped > 0) {
                    $mainReport->update(['system_notes' => ($mainReport->system_notes ? $mainReport->system_notes . ' | ' : '') . '[INFO] ' . $duplicatesSkipped . ' foto dilewati karena sudah digunakan pada laporan lain.']);
                }

                return [
                    'main_report'      => $mainReport,
                    'photos_count'     => $photosCreated,
                    'duplicate_photos' => $duplicatePhotoList,
                ];
            });

        } catch (\Exception $e) {
            Log::error('DeltaJalan: Gagal menyimpan laporan batch.', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            $userMessage = match (true) {
                str_contains($e->getMessage(), 'Semua foto sudah pernah digunakan') => $e->getMessage(),
                default => 'Terjadi kesalahan saat menyimpan laporan batch. Silakan coba lagi.',
            };

            return response()->json([
                'success' => false,
                'message' => $userMessage,
                'debug'   => config('app.debug') ? $e->getMessage() : null,
            ], 500);
        }

        $mainReport = $result['main_report'];

        $reporterName = $mainReport->reporter_name;
        $dailyCount = Report::where('reporter_name', $reporterName)
            ->whereDate('created_at', today())
            ->count();
        Log::info('DeltaJalan: Laporan batch berhasil disimpan.', [
            'batch_id'           => $validated['batch_id'],
            'main_report_code'   => $mainReport->report_code,
            'photos_count'       => $result['photos_count'],
            'trust_score'        => $trustResult['score'],
            'trust_label'        => $trustResult['label'],
            'reporter_name'      => $reporterName,
            'daily_count'        => $dailyCount,
            'exif_clone_suspect' => $exifCloneSuspected,
        ]);

        return response()->json([
            'success'          => true,
            'main_report_id'   => $mainReport->id,
            'main_report_code' => $mainReport->report_code,
            'photos_count'     => $result['photos_count'],
            'trust_score'      => $trustResult['score'],
            'trust_label'      => $trustResult['label'],
            'overall_severity' => $mainReport->ai_severity,
            'road_matched'     => $roadValidation['matched'],
            'duplicate_photos' => $result['duplicate_photos'] ?? [],
        ], 201);
    }

    // ── Supervisor Actions ─────────────────────────────────────────────────

    /**
     * GET /api/reports/stats
     * Statistik ringkasan untuk dashboard supervisor.
     */
    public function stats(Request $request): JsonResponse
    {
        $query = Report::query();

        $user = auth()->user();

        if ($user->role === 'petugas') {
            $query->where('reporter_name', $user->name);
        }

        if ($user->role === 'petugas_eksekusi') {
            $query->when($user->upr_id, fn($q) => $q->where('assigned_upr_id', $user->upr_id))
                  ->unless($user->upr_id, fn($q) => $q->whereRaw('1 = 0'));
        }

        $total = (clone $query)->count();
        $menungguReview = (clone $query)->whereIn('status', ['Menunggu Review', 'Ditinjau'])->count();
        $disetujui      = (clone $query)->where('status', 'Disetujui')->count();
        $ditolak        = (clone $query)->where('status', 'Ditolak')->count();
        $diperbaiki     = (clone $query)->where('status', 'Sedang Diperbaiki')->count();
        $selesai        = (clone $query)->where('status', 'Selesai')->count();

        $hijau  = (clone $query)->where('trust_label', 'hijau')->count();
        $kuning = (clone $query)->where('trust_label', 'kuning')->count();
        $merah  = (clone $query)->where('trust_label', 'merah')->count();

        // Severity distribution
        $rusakBerat  = (clone $query)->where(function ($q) {
            $q->whereRaw("overall_severity::text = 'Rusak Berat'")->orWhereRaw("LOWER(ai_severity) = 'berat'");
        })->count();
        $rusakSedang = (clone $query)->where(function ($q) {
            $q->whereRaw("overall_severity::text = 'Rusak Sedang'")->orWhereRaw("LOWER(ai_severity) = 'sedang'");
        })->count();
        $rusakRingan = (clone $query)->where(function ($q) {
            $q->whereRaw("overall_severity::text = 'Rusak Ringan'")->orWhereRaw("LOWER(ai_severity) = 'ringan'");
        })->count();

        // Monthly trend — last 6 months
        $sixMonthsAgo = now()->subMonths(6)->startOfMonth();
        $monthlyQuery = Report::selectRaw("
            TO_CHAR(created_at, 'YYYY-MM') as bulan,
            COUNT(*) as total,
            SUM(CASE WHEN status = 'Selesai' THEN 1 ELSE 0 END) as selesai,
            SUM(CASE
                WHEN overall_severity::text = 'Rusak Berat' OR LOWER(ai_severity) = 'berat' THEN 1
                ELSE 0
            END) as rusak_berat
        ")
            ->where('created_at', '>=', $sixMonthsAgo);

        if ($user->role === 'petugas') {
            $monthlyQuery->where('reporter_name', $user->name);
        }
        if ($user->role === 'petugas_eksekusi') {
            $monthlyQuery->when($user->upr_id, fn($q) => $q->where('assigned_upr_id', $user->upr_id))
                         ->unless($user->upr_id, fn($q) => $q->whereRaw('1 = 0'));
        }

        $monthlyTrend = $monthlyQuery
            ->groupBy('bulan')
            ->orderBy('bulan')
            ->get()
            ->keyBy('bulan');

        // Fill missing months with zeroes
        $trend = [];
        for ($i = 5; $i >= 0; $i--) {
            $bulan = now()->subMonths($i)->format('Y-m');
            $row = $monthlyTrend->get($bulan);
            $trend[] = [
                'bulan'       => $bulan,
                'total'       => (int) ($row->total ?? 0),
                'selesai'     => (int) ($row->selesai ?? 0),
                'rusak_berat' => (int) ($row->rusak_berat ?? 0),
            ];
        }

        return response()->json([
            'success' => true,
            'data'    => [
                'total'             => $total,
                'menunggu_review'   => $menungguReview,
                'disetujui'         => $disetujui,
                'ditolak'           => $ditolak,
                'sedang_diperbaiki' => $diperbaiki,
                'selesai'           => $selesai,
                'trust_hijau'       => $hijau,
                'trust_kuning'      => $kuning,
                'trust_merah'       => $merah,
                'rusak_berat'       => $rusakBerat,
                'rusak_sedang'      => $rusakSedang,
                'rusak_ringan'      => $rusakRingan,
                'monthly_trend'     => $trend,
            ],
        ]);
    }

    /**
     * POST /api/reports/{id}/approve
     * Supervisor menyetujui laporan — ubah status jadi "Disetujui".
     */
    public function approve(Request $request, string $id): JsonResponse
    {
        $report = Report::find($id);
        if (!$report) {
            return response()->json(['success' => false, 'message' => 'Laporan tidak ditemukan.'], 404);
        }

        if (!in_array($report->status, ['Menunggu Review', 'Ditinjau'])) {
            return response()->json([
                'success' => false,
                'message' => "Laporan dengan status \"{$report->status}\" tidak dapat disetujui.",
            ], 422);
        }

        $priority = $request->input('priority');
        if ($priority && !in_array($priority, \App\Models\Report::PRIORITY_VALUES, true)) {
            $priority = null;
        }

        $report->update([
            'status'       => 'Disetujui',
            'priority'     => $priority ?? $report->priority,
            'system_notes' => $report->system_notes
                ? $report->system_notes . ' | [APPROVED] Disetujui oleh ' . auth()->user()->name
                : '[APPROVED] Disetujui oleh ' . auth()->user()->name,
        ]);

        Log::info('DeltaJalan: Laporan disetujui.', [
            'report_id'   => $report->id,
            'report_code' => $report->report_code,
            'approved_by' => auth()->user()->name,
        ]);

        // Notifikasi ke pelapor
        $petugas = User::where('name', $report->reporter_name)->first();
        if ($petugas) {
            $petugas->notify(new ReportApprovedNotification($report, auth()->user()->name));
        }

        return response()->json([
            'success' => true,
            'message' => 'Laporan berhasil disetujui.',
            'data'    => ['status' => $report->status],
        ]);
    }

    /**
     * POST /api/reports/{id}/tolak
     * Supervisor menolak laporan dengan alasan.
     */
    public function tolak(Request $request, string $id): JsonResponse
    {
        $report = Report::find($id);
        if (!$report) {
            return response()->json(['success' => false, 'message' => 'Laporan tidak ditemukan.'], 404);
        }

        if (!in_array($report->status, ['Menunggu Review', 'Ditinjau'])) {
            return response()->json([
                'success' => false,
                'message' => "Laporan dengan status \"{$report->status}\" tidak dapat ditolak.",
            ], 422);
        }

        $validated = $request->validate([
            'alasan'  => 'required|string|max:100',
            'catatan' => 'nullable|string|max:500',
        ]);

        $alasan  = $validated['alasan'];
        $catatan = $validated['catatan'] ?? '-';

        $report->update([
            'status'       => 'Ditolak',
            'system_notes' => $report->system_notes
                ? $report->system_notes . " | [REJECTED] Ditolak oleh " . auth()->user()->name . " (alasan: {$alasan}, catatan: {$catatan})"
                : "[REJECTED] Ditolak oleh " . auth()->user()->name . " (alasan: {$alasan}, catatan: {$catatan})",
        ]);

        Log::info('DeltaJalan: Laporan ditolak.', [
            'report_id'   => $report->id,
            'report_code' => $report->report_code,
            'alasan'      => $alasan,
            'catatan'     => $catatan,
            'rejected_by' => auth()->user()->name,
        ]);

        // Notifikasi ke pelapor
        $petugas = User::where('name', $report->reporter_name)->first();
        if ($petugas) {
            $petugas->notify(new ReportRejectedNotification($report, auth()->user()->name, $alasan));
        }

        return response()->json([
            'success' => true,
            'message' => 'Laporan berhasil ditolak.',
            'data'    => ['status' => $report->status],
        ]);
    }

    /**
     * POST /api/reports/{id}/disposisi
     * Supervisor mendisposisi laporan untuk dikerjakan — "Sedang Diperbaiki".
     */
    public function disposisi(Request $request, string $id): JsonResponse
    {
        $report = Report::find($id);
        if (!$report) {
            return response()->json(['success' => false, 'message' => 'Laporan tidak ditemukan.'], 404);
        }

        if ($report->status !== 'Disetujui') {
            return response()->json([
                'success' => false,
                'message' => "Hanya laporan dengan status \"Disetujui\" yang bisa didisposisi. Status saat ini: \"{$report->status}\".",
            ], 422);
        }

        $report->update([
            'status'       => 'Sedang Diperbaiki',
            'system_notes' => $report->system_notes
                ? $report->system_notes . ' | [DISPOSISI] Didisposisi oleh ' . auth()->user()->name
                : '[DISPOSISI] Didisposisi oleh ' . auth()->user()->name,
        ]);

        Log::info('DeltaJalan: Laporan didisposisi.', [
            'report_id'     => $report->id,
            'report_code'   => $report->report_code,
            'disposisi_by'  => auth()->user()->name,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Laporan berhasil didisposisi.',
            'data'    => ['status' => $report->status],
        ]);
    }

    // ── Closing & Assignment ──────────────────────────────────────────────

    /**
     * GET /api/uprs
     * Daftar UPR/tim satgas yang aktif.
     */
    public function getUprs(): JsonResponse
    {
        $uprs = \App\Models\Upr::where('is_active', true)->get(['id', 'name', 'wilayah', 'leader_name', 'phone']);
        return response()->json(['success' => true, 'data' => $uprs]);
    }

    /**
     * POST /api/reports/{id}/mulai
     * Supervisor menandai bahwa perbaikan dimulai.
     */
    public function mulai(Request $request, string $id): JsonResponse
    {
        $report = Report::find($id);
        if (!$report) {
            return response()->json(['success' => false, 'message' => 'Laporan tidak ditemukan.'], 404);
        }

        if ($report->status !== 'Disetujui') {
            return response()->json([
                'success' => false,
                'message' => "Hanya laporan Disetujui yang bisa dimulai. Status saat ini: \"{$report->status}\".",
            ], 422);
        }

        $user = auth()->user();
        if ($user->role === 'petugas_eksekusi') {
            if (!$user->upr_id || $report->assigned_upr_id !== $user->upr_id) {
                return response()->json([
                    'success' => false,
                    'message' => 'Anda tidak memiliki akses untuk memulai laporan ini.',
                ], 403);
            }
        }

        $validated = $request->validate([
            'assigned_upr_id' => 'nullable|integer|exists:uprs,id',
            'pelaksana'       => 'nullable|string|max:100',
            'catatan'         => 'nullable|string|max:500',
        ]);

        $report->update([
            'status'             => 'Sedang Diperbaiki',
            'assigned_upr_id'    => $validated['assigned_upr_id'] ?? $report->assigned_upr_id,
            'pelaksana'          => $validated['pelaksana'] ?? $report->pelaksana,
            'assigned_at'        => now(),
            'perbaikan_dimulai_at' => now(),
            'catatan_petugas'    => $validated['catatan'] ?? $report->catatan_petugas,
            'system_notes'       => $report->system_notes
                ? $report->system_notes . ' | [MULAI] Perbaikan dimulai oleh ' . auth()->user()->name
                : '[MULAI] Perbaikan dimulai oleh ' . auth()->user()->name,
        ]);

        Log::info('DeltaJalan: Perbaikan dimulai.', [
            'report_id'   => $report->id,
            'report_code' => $report->report_code,
            'mulai_by'    => auth()->user()->name,
            'pelaksana'   => $report->pelaksana,
        ]);

        // Notifikasi ke petugas eksekusi jika ada assigned_upr_id
        if ($report->assigned_upr_id) {
            try {
                $upr = \App\Models\Upr::find($report->assigned_upr_id);
                $eksekusiUsers = User::where('role', 'petugas_eksekusi')
                    ->where('upr_id', $report->assigned_upr_id)
                    ->get();
                foreach ($eksekusiUsers as $eksekusi) {
                    $eksekusi->notify(new UprAssignedNotification($report, auth()->user()->name, $upr?->name));
                }
            } catch (\Throwable $e) {
                Log::warning('Gagal mengirim notifikasi mulai: ' . $e->getMessage());
            }
        }

        return response()->json([
            'success' => true,
            'message' => 'Perbaikan telah dimulai.',
            'data'    => ['status' => $report->status],
        ]);
    }

    /**
     * POST /api/reports/{id}/complete
     * Menyelesaikan laporan dengan foto after perbaikan.
     */
    public function complete(Request $request, string $id): JsonResponse
    {
        $report = Report::find($id);
        if (!$report) {
            return response()->json(['success' => false, 'message' => 'Laporan tidak ditemukan.'], 404);
        }

        if ($report->status !== 'Sedang Diperbaiki') {
            return response()->json([
                'success' => false,
                'message' => "Hanya laporan Sedang Diperbaiki yang bisa diselesaikan. Status saat ini: \"{$report->status}\".",
            ], 422);
        }

        $user = auth()->user();
        if ($user->role === 'petugas_eksekusi') {
            if (!$user->upr_id || $report->assigned_upr_id !== $user->upr_id) {
                return response()->json([
                    'success' => false,
                    'message' => 'Anda tidak memiliki akses untuk menyelesaikan laporan ini.',
                ], 403);
            }
        }

        $validated = $request->validate([
            'after_photo' => 'required|image|mimes:jpeg,jpg,png|max:5120',
            'catatan'     => 'nullable|string|max:1000',
        ]);

        try {
            $file = $validated['after_photo'];
            $hash = hash_file('sha256', $file->getRealPath());

            // Cek duplikasi foto after (bandingkan dengan after_photo_hash di laporan lain)
            $existingAfter = Report::where('after_photo_hash', $hash)->whereNotNull('after_photo_path')->first();
            if ($existingAfter) {
                Log::warning('DeltaJalan: Foto after duplikat.', [
                    'report_id'    => $report->id,
                    'existing_id'  => $existingAfter->id,
                    'hash'         => $hash,
                ]);
            }

            // Simpan foto ke storage
            $folder = 'reports/after';
            $filename = $report->id . '_after_' . time() . '.' . $file->getClientOriginalExtension();
            $path = $file->storeAs($folder, $filename, 'public');

            $report->update([
                'status'              => 'Selesai',
                'after_photo_path'    => $path,
                'after_photo_hash'    => $hash,
                'after_photo_notes'   => $validated['catatan'] ?? null,
                'perbaikan_selesai_at' => now(),
                'system_notes'        => $report->system_notes
                    ? $report->system_notes . ' | [SELESAI] Perbaikan selesai oleh ' . auth()->user()->name
                    : '[SELESAI] Perbaikan selesai oleh ' . auth()->user()->name,
            ]);

            Log::info('DeltaJalan: Laporan selesai.', [
                'report_id'   => $report->id,
                'report_code' => $report->report_code,
                'selesai_by'  => auth()->user()->name,
            ]);

            // Notifikasi ke semua supervisor
            $supervisors = User::where('role', 'supervisor')->get();
            foreach ($supervisors as $supervisor) {
                $supervisor->notify(new RepairCompletedNotification($report, auth()->user()->name));
            }

            return response()->json([
                'success' => true,
                'message' => 'Laporan berhasil diselesaikan.',
                'data'    => ['status' => $report->status],
            ]);
        } catch (\Exception $e) {
            Log::error('DeltaJalan: Gagal menyelesaikan laporan.', [
                'report_id' => $report->id,
                'error'     => $e->getMessage(),
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Gagal menyelesaikan laporan: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * POST /api/reports/{id}/assign
     * Supervisor menetapkan UPR/tim satgas ke laporan.
     */
    public function assign(Request $request, string $id): JsonResponse
    {
        $report = Report::find($id);
        if (!$report) {
            return response()->json(['success' => false, 'message' => 'Laporan tidak ditemukan.'], 404);
        }

        $user = auth()->user();
        if ($user->role !== 'supervisor') {
            return response()->json([
                'success' => false,
                'message' => 'Hanya supervisor yang dapat menugaskan UPR.',
            ], 403);
        }

        $validated = $request->validate([
            'assigned_upr_id' => 'required|integer|exists:uprs,id',
        ]);

        $upr = \App\Models\Upr::find($validated['assigned_upr_id']);

        $report->update([
            'assigned_upr_id' => $upr->id,
            'assigned_at'     => now(),
            'pelaksana'       => $report->pelaksana ?? $upr->name,
            'system_notes'    => $report->system_notes
                ? $report->system_notes . " | [ASSIGN] Ditugaskan ke {$upr->name} oleh " . auth()->user()->name
                : "[ASSIGN] Ditugaskan ke {$upr->name} oleh " . auth()->user()->name,
        ]);

        Log::info('DeltaJalan: UPR ditugaskan.', [
            'report_id'   => $report->id,
            'report_code' => $report->report_code,
            'upr_id'      => $upr->id,
            'upr_name'    => $upr->name,
            'assigned_by' => auth()->user()->name,
        ]);

        // Notifikasi ke petugas eksekusi di UPR tersebut
        $eksekusiUsers = User::where('role', 'petugas_eksekusi')
            ->where('upr_id', $upr->id)
            ->get();
        foreach ($eksekusiUsers as $eksekusi) {
            $eksekusi->notify(new UprAssignedNotification($report, auth()->user()->name, $upr->name));
        }

        return response()->json([
            'success' => true,
            'message' => "Laporan ditugaskan ke {$upr->name}.",
            'data'    => ['assigned_upr_id' => $upr->id, 'assigned_upr_name' => $upr->name],
        ]);
    }

    /**
     * POST /api/reports/bulk-approve
     * Approve multiple reports sekaligus.
     */
    public function bulkApprove(Request $request): JsonResponse
    {
        $ids = $request->validate(['ids' => 'required|array', 'ids.*' => 'string|uuid']);
        $user = auth()->user();

        $count = 0;
        foreach ($ids['ids'] as $id) {
            $report = Report::find($id);
            if (!$report || !in_array($report->status, ['Menunggu Review', 'Ditinjau'])) continue;
            $report->update([
                'status'       => 'Disetujui',
                'system_notes' => $report->system_notes
                    ? $report->system_notes . " | [BULK APPROVE] oleh {$user->name}"
                    : "[BULK APPROVE] oleh {$user->name}",
            ]);
            try {
                if ($report->reporter_name) {
                    $petugasUser = User::where('name', $report->reporter_name)->first();
                    if ($petugasUser) {
                        $petugasUser->notify(new BulkActionNotification($report, 'approve', $user->name));
                    }
                }
            } catch (\Throwable $e) {
                Log::warning('Gagal mengirim notifikasi bulk approve: ' . $e->getMessage());
            }
            $count++;
        }

        Log::info('DeltaJalan: Bulk approve.', ['count' => $count, 'by' => $user->name]);

        return response()->json([
            'success' => true,
            'message' => "{$count} laporan berhasil disetujui.",
            'data'    => ['approved_count' => $count],
        ]);
    }

    /**
     * POST /api/reports/bulk-tolak
     * Tolak multiple reports sekaligus.
     */
    public function bulkTolak(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ids'    => 'required|array',
            'ids.*'  => 'string|uuid',
            'alasan' => 'required|string|max:500',
        ]);
        $user = auth()->user();

        $count = 0;
        foreach ($validated['ids'] as $id) {
            $report = Report::find($id);
            if (!$report || !in_array($report->status, ['Menunggu Review', 'Ditinjau'])) continue;
            $report->update([
                'status'       => 'Ditolak',
                'system_notes' => $report->system_notes
                    ? $report->system_notes . " | [BULK TOLAK] oleh {$user->name}: {$validated['alasan']}"
                    : "[BULK TOLAK] oleh {$user->name}: {$validated['alasan']}",
            ]);
            try {
                if ($report->reporter_name) {
                    $petugasUser = User::where('name', $report->reporter_name)->first();
                    if ($petugasUser) {
                        $petugasUser->notify(new BulkActionNotification($report, 'tolak', $user->name));
                    }
                }
            } catch (\Throwable $e) {
                Log::warning('Gagal mengirim notifikasi bulk tolak: ' . $e->getMessage());
            }
            $count++;
        }

        Log::info('DeltaJalan: Bulk tolak.', ['count' => $count, 'by' => $user->name]);

        return response()->json([
            'success' => true,
            'message' => "{$count} laporan berhasil ditolak.",
            'data'    => ['rejected_count' => $count],
        ]);
    }

    /**
     * GET /api/reports/stats-by-upr
     * Statistik per UPR (total, sedang diperbaiki, selesai, total panjang).
     */
    public function statsByUpr(Request $request): JsonResponse
    {
        $uprs = \App\Models\Upr::where('is_active', true)->get();
        $stats = [];

        foreach ($uprs as $upr) {
            $query = Report::where('assigned_upr_id', $upr->id);
            $total      = (clone $query)->count();
            $diperbaiki = (clone $query)->where('status', 'Sedang Diperbaiki')->count();
            $selesai    = (clone $query)->where('status', 'Selesai')->count();
            $totalPanjang = (clone $query)->whereNotNull('kerusakan_panjang')->sum('kerusakan_panjang');
            $totalLuas    = (clone $query)
                ->whereNotNull('kerusakan_panjang')
                ->whereNotNull('kerusakan_lebar')
                ->selectRaw('COALESCE(SUM(kerusakan_panjang * kerusakan_lebar), 0) as total_luas')
                ->value('total_luas');

            $stats[] = [
                'upr_id'          => $upr->id,
                'upr_name'        => $upr->name,
                'wilayah'         => $upr->wilayah,
                'total'           => $total,
                'sedang_diperbaiki' => $diperbaiki,
                'selesai'         => $selesai,
                'total_panjang_m' => round((float) $totalPanjang, 1),
                'total_luas_m2'   => round((float) $totalLuas, 1),
            ];
        }

        return response()->json(['success' => true, 'data' => $stats]);
    }

    /**
     * POST /api/reports/{id}/reopen
     * Re-open laporan yang sudah selesai — balik ke "Sedang Diperbaiki".
     */
    public function reopen(Request $request, string $id): JsonResponse
    {
        $report = Report::find($id);
        if (!$report) {
            return response()->json(['message' => 'Laporan tidak ditemukan.'], 404);
        }

        if ($report->status !== 'Selesai') {
            return response()->json([
                'message' => "Hanya laporan Selesai yang bisa di-reopen. Status: \"{$report->status}\".",
            ], 422);
        }

        $user = auth()->user();
        $report->update([
            'status'              => 'Sedang Diperbaiki',
            'perbaikan_selesai_at' => null,
            'system_notes'        => $report->system_notes
                ? $report->system_notes . " | [REOPEN] oleh {$user->name}"
                : "[REOPEN] oleh {$user->name}",
        ]);

        try {
            $eksekusiUsers = User::whereIn('role', ['petugas_eksekusi', 'eksekusi'])->get();
            foreach ($eksekusiUsers as $eksekusi) {
                $eksekusi->notify(new ReportReopenedNotification($report, $user->name));
            }
        } catch (\Throwable $e) {
            Log::warning('Gagal mengirim notifikasi reopen: ' . $e->getMessage());
        }

        return response()->json([
            'success' => true,
            'message' => 'Laporan dibuka kembali untuk perbaikan.',
            'data'    => ['status' => $report->status],
        ]);
    }

    // ── Edit Laporan ─────────────────────────────────────────────────────────

    /**
     * POST /api/reports/{id}/mulai-edit
     * Petugas mulai mengedit — status → "Diedit", disembunyikan dari supervisor.
     */
    public function mulaiEdit(string $id): JsonResponse
    {
        $report = Report::find($id);
        if (!$report) {
            return response()->json(['success' => false, 'message' => 'Laporan tidak ditemukan.'], 404);
        }

        $user = auth()->user();
        if ($user->role !== 'petugas') {
            return response()->json(['success' => false, 'message' => 'Hanya petugas yang dapat mengedit laporan.'], 403);
        }
        if ($report->reporter_name !== $user->name) {
            return response()->json(['success' => false, 'message' => 'Anda hanya dapat mengedit laporan Anda sendiri.'], 403);
        }
        if ($report->status !== 'Menunggu Review') {
            return response()->json(['success' => false, 'message' => "Laporan status \"{$report->status}\" tidak dapat diedit."], 422);
        }

        $report->update(['status' => 'Diedit']);

        return response()->json([
            'success' => true,
            'message' => 'Laporan siap diedit.',
            'data'    => ['status' => $report->status],
        ]);
    }

    /**
     * POST /api/reports/{id}/batal-edit
     * Petugas batal mengedit — status → "Menunggu Review".
     */
    public function batalEdit(string $id): JsonResponse
    {
        $report = Report::find($id);
        if (!$report) {
            return response()->json(['success' => false, 'message' => 'Laporan tidak ditemukan.'], 404);
        }

        $user = auth()->user();
        if ($user->role !== 'petugas') {
            return response()->json(['success' => false, 'message' => 'Hanya petugas yang dapat membatalkan edit.'], 403);
        }
        if ($report->status !== 'Diedit') {
            return response()->json(['success' => false, 'message' => "Laporan tidak dalam status edit."], 422);
        }

        $report->update(['status' => 'Menunggu Review']);

        try {
            $supervisors = User::where('role', 'supervisor')->get();
            foreach ($supervisors as $supervisor) {
                $supervisor->notify(new ReportEditedNotification($report, $user->name, 'batal'));
            }
        } catch (\Throwable $e) {
            Log::warning('Gagal mengirim notifikasi batal edit: ' . $e->getMessage());
        }

        return response()->json([
            'success' => true,
            'message' => 'Edit dibatalkan.',
            'data'    => ['status' => $report->status],
        ]);
    }

    /**
     * PUT /api/reports/{id}
     * Simpan perubahan dari petugas — status → "Menunggu Review".
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $report = Report::find($id);
        if (!$report) {
            return response()->json(['success' => false, 'message' => 'Laporan tidak ditemukan.'], 404);
        }

        $user = auth()->user();
        if ($user->role !== 'petugas') {
            return response()->json(['success' => false, 'message' => 'Hanya petugas yang dapat mengubah laporan.'], 403);
        }
        if ($report->reporter_name !== $user->name) {
            return response()->json(['success' => false, 'message' => 'Anda hanya dapat mengubah laporan Anda sendiri.'], 403);
        }
        if ($report->status !== 'Diedit') {
            return response()->json(['success' => false, 'message' => "Laporan tidak dalam status edit."], 422);
        }

        $validated = $request->validate([
            'catatan'             => ['nullable', 'string', 'max:1000'],
            'kerusakan_panjang'   => ['required', 'numeric', 'min:0', 'max:999999.99'],
            'kerusakan_lebar'     => ['required', 'numeric', 'min:0', 'max:999999.99'],
            'road_name'           => ['nullable', 'string', 'max:255'],
            'district'            => ['nullable', 'string', 'max:100'],
        ]);

        $updateData = array_filter([
            'catatan_petugas'    => $validated['catatan'] ?? $report->catatan_petugas,
            'kerusakan_panjang'  => $validated['kerusakan_panjang'],
            'kerusakan_lebar'    => $validated['kerusakan_lebar'],
            'road_name'          => $validated['road_name'] ?? $report->road_name,
            'district'           => $validated['district'] ?? $report->district,
            'status'             => 'Menunggu Review',
        ], fn ($v) => $v !== null);

        $report->update($updateData);

        try {
            $supervisors = User::where('role', 'supervisor')->get();
            foreach ($supervisors as $supervisor) {
                $supervisor->notify(new ReportEditedNotification($report, $user->name, 'edit'));
            }
        } catch (\Throwable $e) {
            Log::warning('Gagal mengirim notifikasi edit laporan: ' . $e->getMessage());
        }

        return response()->json([
            'success' => true,
            'message' => 'Laporan berhasil diperbarui.',
            'data'    => [
                'id'                => $report->id,
                'status'            => $report->status,
                'kerusakan_panjang' => $report->kerusakan_panjang,
                'kerusakan_lebar'   => $report->kerusakan_lebar,
                'catatan_petugas'   => $report->catatan_petugas,
                'road_name'         => $report->road_name,
                'district'          => $report->district,
            ],
        ]);
    }

    /**
     * POST /api/reports/{id}/mulai-review
     * Supervisor mulai membaca — status → "Ditinjau".
     */
    public function mulaiReview(string $id): JsonResponse
    {
        $report = Report::find($id);
        if (!$report) {
            return response()->json(['success' => false, 'message' => 'Laporan tidak ditemukan.'], 404);
        }

        $user = auth()->user();
        if ($user->role !== 'supervisor') {
            return response()->json(['success' => false, 'message' => 'Hanya supervisor.'], 403);
        }
        if ($report->status !== 'Menunggu Review') {
            // Tidak error — cukup skip karena status sudah bukan Menunggu Review
            return response()->json(['success' => true, 'message' => 'OK.', 'data' => ['status' => $report->status]]);
        }

        $report->update(['status' => 'Ditinjau']);

        return response()->json([
            'success' => true,
            'message' => 'Laporan sedang ditinjau.',
            'data'    => ['status' => $report->status],
        ]);
    }

    /**
     * POST /api/reports/{id}/update-triage
     * Petugas eksekusi memperbarui kategori kerusakan (overall_severity) dan/atau prioritas.
     */
    public function updateTriage(Request $request, string $id): JsonResponse
    {
        $report = Report::find($id);
        if (!$report) {
            return response()->json(['success' => false, 'message' => 'Laporan tidak ditemukan.'], 404);
        }

        $user = auth()->user();
        if ($user->role !== 'petugas_eksekusi') {
            return response()->json(['success' => false, 'message' => 'Hanya petugas eksekusi.'], 403);
        }
        if (!$user->upr_id || $report->assigned_upr_id !== $user->upr_id) {
            return response()->json(['success' => false, 'message' => 'Anda tidak memiliki akses ke laporan ini.'], 403);
        }
        if (!in_array($report->status, ['Disetujui', 'Sedang Diperbaiki'])) {
            return response()->json([
                'success' => false,
                'message' => 'Laporan tidak dalam status yang dapat diubah. Hanya laporan Disetujui atau Sedang Diperbaiki.',
            ], 422);
        }

        $validated = $request->validate([
            'priority' => ['nullable', 'string', 'in:' . implode(',', Report::PRIORITY_VALUES)],
            'severity' => ['nullable', 'string', 'in:' . implode(',', Report::SEVERITY_VALUES)],
        ]);

        if (empty($validated['priority']) && empty($validated['severity'])) {
            return response()->json(['success' => false, 'message' => 'Tidak ada data yang diubah.'], 422);
        }

        $updateData = [];
        if (!empty($validated['priority'])) {
            $updateData['priority'] = $validated['priority'];
        }
        if (!empty($validated['severity'])) {
            $updateData['overall_severity'] = $validated['severity'];
        }
        $updateData['system_notes'] = $report->system_notes
            ? $report->system_notes . ' | [TRIAGE] Diperbarui oleh ' . $user->name
            : '[TRIAGE] Diperbarui oleh ' . $user->name;

        $report->update($updateData);

        try {
            $supervisors = User::where('role', 'supervisor')->get();
            foreach ($supervisors as $supervisor) {
                $supervisor->notify(new TriageUpdatedNotification($report, $user->name));
            }
        } catch (\Throwable $e) {
            Log::warning('Gagal mengirim notifikasi triage: ' . $e->getMessage());
        }

        return response()->json([
            'success' => true,
            'message' => 'Kategori berhasil diperbarui.',
            'data'    => [
                'id'               => $report->id,
                'priority'         => $report->priority,
                'overall_severity' => $report->overall_severity,
            ],
        ]);
    }

    // ── Trust & Validation Methods ────────────────────────────────────────

    /**
     * Validasi nama jalan vs koordinat menggunakan LocationIQ reverse geocoding.
     *
     * Tidak memblokir laporan jika LocationIQ tidak tersedia — hanya mencatat.
     * Supervisor tetap bisa melihat hasil validasi ini di trust breakdown.
     *
     * @param  string  $namaJalan  Nama jalan yang diinput user
     * @param  float   $lat        Latitude koordinat
     * @param  float   $lng        Longitude koordinat
     * @return array{matched: bool, similarity: float|null, geocoded_road: string, reason: string}
     */
    /**
     * Normalisasi nama jalan untuk perbandingan fuzzy: samakan singkatan kata,
     * hapus spasi berlebih, lowercase.
     */
    private function normalizeRoadName(string $name): string
    {
        $name = trim($name);
        $name = preg_replace('/\s+/', ' ', $name); // hapus spasi ganda

        $replacements = [
            '/\bJl\.?\b/i'     => 'Jalan',
            '/\bJln\.?\b/i'    => 'Jalan',
            '/\bGg\.?\b/i'     => 'Gang',
            '/\bDsn\.?\b/i'    => 'Dusun',
            '/\bPerum\.?\b/i'  => 'Perumahan',
            '/\bKomplek\b/i'   => 'Kompleks',
        ];

        $name = preg_replace(array_keys($replacements), array_values($replacements), $name);

        return strtolower(trim($name));
    }

    /**
     * Cek apakah salah satu string terkandung dalam string lainnya (containment).
     */
    private function roadNameContained(string $a, string $b): bool
    {
        $short = strlen($a) <= strlen($b) ? $a : $b;
        $long  = strlen($a) <= strlen($b) ? $b : $a;

        // Ambil kata terakhir dari string pendek sebagai penanda minimal
        // Contoh: "Jalan Raya Kedungpeluk" vs "Kedungpeluk" → contained
        return str_contains($long, $short);
    }

    private function validateRoadNameVsCoordinate(string $namaJalan, float $lat, float $lng): array
    {
        try {
            $response = Http::timeout(5)->get('https://us1.locationiq.com/v1/reverse', [
                'key'    => config('services.locationiq.key'),
                'lat'    => $lat,
                'lon'    => $lng,
                'format' => 'json',
            ]);

            if (!$response->ok()) {
                // LocationIQ tidak tersedia — jangan block laporan, catat saja
                return ['matched' => false, 'similarity' => null, 'geocoded_road' => '', 'reason' => 'locationiq_unavailable'];
            }

            $data        = $response->json();
            $geocodedRoad = $data['address']['road']
                ?? $data['address']['residential']
                ?? $data['display_name']
                ?? '';

            $normalizedInput = $this->normalizeRoadName($namaJalan);
            $normalizedGeo   = $this->normalizeRoadName($geocodedRoad);

            similar_text($normalizedInput, $normalizedGeo, $percent);

            $matched = $percent >= 60 || $this->roadNameContained($normalizedInput, $normalizedGeo);

            return [
                'matched'       => $matched,
                'similarity'    => round($percent, 1),
                'geocoded_road' => $geocodedRoad,
                'reason'        => $matched ? 'ok' : 'mismatch',
            ];
        } catch (\Exception $e) {
            return ['matched' => false, 'similarity' => null, 'geocoded_road' => '', 'reason' => 'exception'];
        }
    }

    /**
     * Aggregate severity dari array severities — ambil yang terparah.
     *
     * @param  array  $severities  Array string severity ('ringan', 'sedang', 'berat')
     * @return string  Severity terparah
     */
    private function aggregateSeverity(array $severities): string
    {
        $order  = ['berat' => 3, 'sedang' => 2, 'ringan' => 1];
        $max    = 0;
        $result = 'ringan';

        foreach ($severities as $s) {
            $val = $order[strtolower((string) $s)] ?? 0;
            if ($val > $max) {
                $max    = $val;
                $result = strtolower((string) $s);
            }
        }

        return $result;
    }

    /**
     * Normalisasi nilai severity agar cocok dengan PostgreSQL severity_enum.
     *
     * severity_enum hanya menerima: 'Baik', 'Rusak Ringan', 'Rusak Sedang', 'Rusak Berat'.
     * FastAPI bisa mengembalikan short form ('berat') atau long form ('Rusak Berat').
     */
    private function normalizeSeverityEnum(string $value): string
    {
        $map = [
            'berat'       => 'Rusak Berat',
            'rusak berat' => 'Rusak Berat',
            'sedang'      => 'Rusak Sedang',
            'rusak sedang' => 'Rusak Sedang',
            'ringan'      => 'Rusak Ringan',
            'rusak ringan' => 'Rusak Ringan',
            'baik'        => 'Baik',
        ];
        return $map[strtolower(trim($value))] ?? 'Baik';
    }

    /**
     * Daftar 18 kecamatan di Kabupaten Sidoarjo.
     * Digunakan untuk validasi field 'district'.
     *
     * @return array<string>
     */
    private function getKecamatanList(): array
    {
        return [
            'Sidoarjo',
            'Buduran',
            'Gedangan',
            'Sedati',
            'Waru',
            'Taman',
            'Krian',
            'Balongbendo',
            'Wonoayu',
            'Sukodono',
            'Candi',
            'Porong',
            'Krembung',
            'Tulangan',
            'Tanggulangin',
            'Jabon',
            'Tarik',
            'Prambon',
        ];
    }

    /**
     * Cek apakah koordinat berada di dalam bounding box Kabupaten Sidoarjo.
     *
     * Bounding box: lat -7.65 s/d -7.25, lng 112.50 s/d 112.95
     * Sumber: OpenStreetMap administrative boundary Kabupaten Sidoarjo.
     *
     * @param  float  $lat  Latitude
     * @param  float  $lng  Longitude
     * @return bool
     */
    private function isInSidoarjo(float $lat, float $lng): bool
    {
        return $lat >= -7.65 && $lat <= -7.25
            && $lng >= 112.50 && $lng <= 112.95;
    }

    /**
     * Ekstrak koordinat GPS dari metadata EXIF foto.
     */
    private function extractExifGps(string $filePath): ?array
    {
        if (!function_exists('exif_read_data')) {
            return null;
        }

        try {
            $exifData = @exif_read_data($filePath, 'GPS', false);

            if (!$exifData || !isset($exifData['GPSLatitude'], $exifData['GPSLongitude'])) {
                return null;
            }

            $lat = $this->convertGpsDmsToDecimal(
                $exifData['GPSLatitude'],
                $exifData['GPSLatitudeRef'] ?? 'N'
            );
            $lng = $this->convertGpsDmsToDecimal(
                $exifData['GPSLongitude'],
                $exifData['GPSLongitudeRef'] ?? 'E'
            );

            if ($lat === null || $lng === null) {
                return null;
            }

            if ($lat < -11 || $lat > 6 || $lng < 95 || $lng > 141) {
                return null;
            }

            return ['lat' => $lat, 'lng' => $lng];
        } catch (\Exception $e) {
            return null;
        }
    }

    private function convertGpsDmsToDecimal(array $dms, string $ref): ?float
    {
        if (count($dms) < 3) return null;

        $parseRational = function (string $rational): float {
            $parts = explode('/', $rational);
            if (count($parts) === 2 && (float) $parts[1] !== 0.0) {
                return (float) $parts[0] / (float) $parts[1];
            }
            return (float) $parts[0];
        };

        $degrees = $parseRational((string) $dms[0]);
        $minutes = $parseRational((string) $dms[1]);
        $seconds = $parseRational((string) $dms[2]);

        $decimal = $degrees + ($minutes / 60) + ($seconds / 3600);

        if (in_array(strtoupper($ref), ['S', 'W'])) {
            $decimal = -$decimal;
        }

        return round($decimal, 8);
    }

    /**
     * Hitung jarak antara dua koordinat GPS menggunakan Haversine Formula.
     */
    private function haversineDistance(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $earthRadius = 6371000;
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);

        $a = sin($dLat / 2) ** 2
           + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;

        return $earthRadius * 2 * asin(sqrt($a));
    }

    // ── Timeline / Status History Helpers ───────────────────────────────

    /**
     * Map status value to a machine-readable event key.
     */
    private function mapStatusToEvent(string $status, ?string $notes): string
    {
        if ($notes === 'Laporan dibuat') return 'laporan_dibuat';
        if ($notes && str_contains($notes, '[APPROVED]')) return 'disetujui';
        if ($notes && str_contains($notes, '[REJECTED]')) return 'ditolak';
        if ($notes && str_contains($notes, '[DISPOSISI]')) return 'disposisi';
        if ($notes && str_contains($notes, '[MULAI]')) return 'perbaikan_dimulai';
        if ($notes && str_contains($notes, '[SELESAI]')) return 'perbaikan_selesai';
        if ($notes && str_contains($notes, '[REOPEN]')) return 'dibuka_kembali';
        if ($notes && str_contains($notes, '[ASSIGN]')) return 'ditugaskan';
        if ($notes && str_contains($notes, '[TRIAGE]')) return 'triage';
        if ($notes && str_contains($notes, 'Perbaikan dimulai')) return 'perbaikan_dimulai';
        if ($notes && str_contains($notes, 'Perbaikan selesai')) return 'perbaikan_selesai';

        return match ($status) {
            'Ditinjau'          => 'ditinjau',
            'Disetujui'         => 'disetujui',
            'Ditolak'           => 'ditolak',
            'Sedang Diperbaiki' => 'perbaikan_dimulai',
            'Selesai'           => 'perbaikan_selesai',
            'Diedit'            => 'diedit',
            'Menunggu Review'   => 'menunggu_review',
            default             => 'status_changed',
        };
    }

    /**
     * Map status value to a human-readable label.
     */
    private function mapStatusToLabel(string $status, ?string $notes): string
    {
        if ($notes === 'Laporan dibuat') return 'Laporan Dibuat';
        if ($notes && str_contains($notes, '[APPROVED]')) return 'Disetujui Supervisor';
        if ($notes && str_contains($notes, '[REJECTED]')) return 'Ditolak Supervisor';
        if ($notes && str_contains($notes, '[DISPOSISI]')) return 'Disposisi UPR';
        if ($notes && str_contains($notes, '[MULAI]')) return 'Perbaikan Dimulai';
        if ($notes && str_contains($notes, '[SELESAI]')) return 'Perbaikan Selesai';
        if ($notes && str_contains($notes, '[REOPEN]')) return 'Laporan Dibuka Kembali';
        if ($notes && str_contains($notes, '[ASSIGN]')) return 'Penugasan UPR';
        if ($notes && str_contains($notes, '[TRIAGE]')) return 'Diperbarui';
        if ($notes && str_contains($notes, 'Perbaikan dimulai')) return 'Perbaikan Dimulai';
        if ($notes && str_contains($notes, 'Perbaikan selesai')) return 'Perbaikan Selesai';

        return match ($status) {
            'Ditinjau'          => 'Sedang Ditinjau',
            'Disetujui'         => 'Disetujui',
            'Ditolak'           => 'Ditolak',
            'Sedang Diperbaiki' => 'Perbaikan Dimulai',
            'Selesai'           => 'Perbaikan Selesai',
            'Diedit'            => 'Laporan Diedit',
            'Menunggu Review'   => 'Menunggu Review',
            default             => "Status: {$status}",
        };
    }
}

