<?php

namespace App\Http\Controllers;

use App\Models\Report;
use App\Models\ReportEvidence;
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
 * Komponen utama dalam arsitektur Hybrid Stack JalanKita:
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
                        HAVING (
                            6371000 * acos(
                                LEAST(1.0, cos(radians(:lat3)) * cos(radians(latitude::float))
                                * cos(radians(longitude::float) - radians(:lng2))
                                + sin(radians(:lat4)) * sin(radians(latitude::float)))
                            )
                        ) <= 15
                        ORDER BY distance_meters ASC
                        LIMIT 20
                    ", [
                        'lat1' => $latF, 'lng1' => $lngF,
                        'lat2' => $latF,
                        'lat3' => $latF, 'lng2' => $lngF,
                        'lat4' => $latF,
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
                $imageResults = Report::where('image_hash', $fileHash)
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
            Log::error('JalanKita: checkDuplicate error.', ['error' => $e->getMessage()]);
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
            if (Report::where('image_hash', $imageHash)->exists()) {
                return response()->json([
                    'success'    => false,
                    'message'    => 'Foto ini sudah digunakan pada laporan lain.',
                    'error_code' => 'DUPLICATE_IMAGE',
                ], 422);
            }
            if (ReportEvidence::where('image_hash', $imageHash)->exists()) {
                return response()->json([
                    'success'    => false,
                    'message'    => 'Foto ini sudah pernah dikirim sebagai bukti sebelumnya.',
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

            Log::info('JalanKita: Evidence ditambahkan.', [
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
            Log::error('JalanKita: Gagal menyimpan evidence.', [
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
                'image'         => ['required', 'file', 'mimes:jpeg,jpg,png', 'max:5120'],
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
                    $overallSeverity = $payload['overall_severity'] ?? 'Baik';
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
                    Log::warning('JalanKita: FastAPI tidak merespons saat menyimpan laporan.', [
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
            Log::error('JalanKita: Gagal menyimpan laporan.', [
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
        Log::info('JalanKita: Laporan tunggal disimpan.', [
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

        // Filter status (case-insensitive, ubah underscore ke spasi)
        if ($request->filled('status')) {
            $status = str_replace('_', ' ', $request->input('status'));
            $query->whereRaw('LOWER(status::text) = ?', [strtolower($status)]);
        }

        // Filter user_reports=true — paksa filter berdasarkan user name
        if ($request->boolean('user_reports')) {
            $query->where('reporter_name', $user->name);
        }

        $limit = min((int) $request->input('limit', 50), 100);

        $reports = $query->orderBy('created_at', 'desc')
            ->limit($limit)
            ->get()
            ->map(function ($report) {
                return [
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
                    'image_original_url' => $report->image_original_url,
                    'image_result_url'   => $report->image_result_url,
                    'after_photo_url'    => $report->after_photo_url,
                    'perbaikan_dimulai_at' => $report->perbaikan_dimulai_at?->toIso8601String(),
                    'perbaikan_selesai_at' => $report->perbaikan_selesai_at?->toIso8601String(),
                    'pelaksana'          => $report->pelaksana,
                    'created_at'         => $report->created_at?->toIso8601String(),
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
        $report = Report::with('evidences')->find($id);

        if (!$report) {
            return response()->json(['success' => false, 'message' => 'Laporan tidak ditemukan.'], 404);
        }

        return response()->json([
            'success' => true,
            'data'    => [
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
                'assigned_at'        => $report->assigned_at?->toIso8601String(),
                'catatan_petugas'    => $report->catatan_petugas,
                'is_batch_main'      => $report->is_batch_main,
                'is_batch_sub'       => $report->is_batch_sub,
                'batch_id'           => $report->batch_id,
                'parent_report_id'   => $report->parent_report_id,
                'created_at'         => $report->created_at?->toIso8601String(),
                'updated_at'         => $report->updated_at?->toIso8601String(),
                'evidences'          => $report->evidences->map(fn ($e) => [
                    'id'            => $e->id,
                    'image_url'     => $e->image_url,
                    'reporter_name' => $e->reporter_name,
                    'notes'         => $e->notes,
                    'created_at'    => $e->created_at?->toIso8601String(),
                ]),
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
                Log::warning('JalanKita: hash_file() mengembalikan false.', ['path' => $filePath]);
                return null;
            }
            return $hash;
        } catch (\Exception $e) {
            Log::warning('JalanKita: Gagal menghitung image hash.', [
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
                Log::warning('JalanKita: Gagal decode base64 image dari FastAPI.');
                return null;
            }

            // Generate nama file unik
            $filename = Str::uuid() . '-result-' . time() . '.jpg';
            $path     = $folder . '/' . $filename;

            // Simpan ke storage/app/public/ menggunakan disk 'public'
            Storage::disk('public')->put($path, $imageData);

            return $path;

        } catch (\Exception $e) {
            Log::warning('JalanKita: Gagal menyimpan foto hasil AI.', [
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
            Log::warning('JalanKita: Error saat membaca EXIF foto.', [
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
            'exif_lat'           => $validated['koordinat_sumber'] === 'exif' ? $validated['latitude']  : null,
            'exif_lng'           => $validated['koordinat_sumber'] === 'exif' ? $validated['longitude'] : null,
            'road_name_matched'  => $roadValidation['matched'],
            'ai_detections'      => $firstAnalysis['detections']    ?? [],
            'ai_context_valid'   => $firstAnalysis['context_valid'] ?? false,
            'fake_gps_suspected' => $batchFakeGps,
        ]);

        // Catat EXIF cloning di system notes main report nanti
        $batchNotes = null;
        if ($exifCloneSuspected) {
            $batchNotes = '[PERINGATAN] Terdeteksi ' . $photosWithExif . ' foto dengan koordinat GPS EXIF identik — kemungkinan EXIF di-clone.';
        }

        try {
            $result = DB::transaction(function () use ($validated, $analyses, $request, $trustResult, $roadValidation, $batchNotes, $exifCloneSuspected) {
                // ── Buat laporan utama ────────────────────────────────────
                $severities  = array_column($analyses, 'severity');
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
                    'is_batch_main'    => true,
                    'trust_score'      => $trustResult['score'],
                    'trust_label'      => $trustResult['label'],
                    'trust_breakdown'  => $trustResult['breakdown'],
                    'ai_severity'      => $this->aggregateSeverity($severities),
                    'system_notes'     => $batchNotes,
                ]);

                // ── Buat sub-laporan per foto ─────────────────────────────
                $subReports = [];
                foreach ($analyses as $idx => $analysis) {
                    // Lewati foto yang ditolak karena EXIF tidak valid
                    if (!empty($analysis['exif_invalid'])) {
                        Log::info('JalanKita: Sub-laporan dilewati karena foto ditolak EXIF.', [
                            'file_index'  => $idx,
                            'file_name'   => $analysis['file_name'] ?? '',
                            'exif_reason' => $analysis['exif_reason'] ?? '',
                        ]);
                        continue;
                    }

                    $file      = $request->file('files')[$idx] ?? null;
                    $photoPath = null;
                    $imageHash = null;

                    // Koordinat per foto: gunakan GPS EXIF jika ada, fallback ke koordinat form
                    // Ini menyelesaikan celah 2.2 — setiap foto punya koordinat sendiri
                    $photoLat        = (float) ($analysis['photo_lat'] ?? $validated['latitude']);
                    $photoLng        = (float) ($analysis['photo_lng'] ?? $validated['longitude']);
                    $koordinatSumber = $analysis['koordinat_sumber'] ?? $validated['koordinat_sumber'];

                    if ($file) {
                        // Cek duplikasi hash per file
                        $imageHash = $this->calculateImageHash($file->getPathname());

                        if ($imageHash && Report::where('image_hash', $imageHash)->exists()) {
                            Log::info('JalanKita: Foto duplikat dilewati dalam batch.', [
                                'file_index' => $idx,
                                'hash'       => $imageHash,
                            ]);
                            continue;
                        }

                        $filename  = Str::uuid() . '-batch-' . time() . '.' . $file->getClientOriginalExtension();
                        $photoPath = $file->storeAs(self::ORIGINALS_FOLDER, $filename, 'public');
                    }

                    // Hitung trust score per foto berdasarkan GPS EXIF foto itu sendiri
                    $photoTrustResult = app(\App\Services\TrustScoreService::class)->calculate([
                        'exif_lat'           => $analysis['has_exif_gps'] ? $analysis['exif_lat'] : null,
                        'exif_lng'           => $analysis['has_exif_gps'] ? $analysis['exif_lng'] : null,
                        'road_name_matched'  => $roadValidation['matched'],
                        'ai_detections'      => $analysis['detections'] ?? [],
                        'ai_context_valid'   => $analysis['context_valid'] ?? false,
                        // Jika GPS EXIF jauh dari koordinat form, tandai sebagai suspicious
                        'fake_gps_suspected' => $analysis['gps_mismatch'] ?? false,
                    ]);

                    // Tambahkan catatan jika GPS EXIF jauh dari koordinat form
                    $subNotes = null;
                    if (!empty($analysis['gps_mismatch'])) {
                        $dist = round($analysis['gps_distance_meters'] ?? 0);
                        $subNotes = "[PERINGATAN] GPS EXIF foto berjarak {$dist}m dari koordinat yang diinput. Perlu verifikasi.";
                    } elseif (empty($analysis['has_exif_gps'])) {
                        $subNotes = '[INFO] Foto tidak memiliki GPS EXIF. Koordinat dari input form.';
                    }

                    $subReport = Report::create([
                        'report_code'         => $this->generateReportCode(),
                        'reporter_name'       => auth()->user()->name ?? 'Petugas',
                        'road_name'           => $validated['road_name'],
                        'district'            => $validated['district'],
                        'latitude'            => $photoLat,
                        'longitude'           => $photoLng,
                        'koordinat_sumber'    => $koordinatSumber,
                        'status'              => 'Menunggu Review',
                        'batch_id'            => $validated['batch_id'],
                        'is_batch_sub'        => true,
                        'parent_report_id'    => $mainReport->id,
                        'trust_score'         => $photoTrustResult['score'],
                        'trust_label'         => $photoTrustResult['label'],
                        'ai_jenis_kerusakan'  => $analysis['detections'][0]['type'] ?? null,
                        'ai_severity'         => $analysis['severity'] ?? 'ringan',
                        'ai_confidence'       => $analysis['confidence'] ?? null,
                        'image_original_path' => $photoPath,
                        'image_hash'          => $imageHash,
                        'system_notes'        => $subNotes,
                    ]);

                    $subReports[] = $subReport->id;
                }

                return [
                    'main_report'       => $mainReport,
                    'sub_reports_count' => count($subReports),
                ];
            });

        } catch (\Exception $e) {
            Log::error('JalanKita: Gagal menyimpan laporan batch.', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Terjadi kesalahan saat menyimpan laporan batch. Silakan coba lagi.',
                'debug'   => config('app.debug') ? $e->getMessage() : null,
            ], 500);
        }

        $mainReport = $result['main_report'];

        // Log aktivitas untuk anomaly detection
        $reporterName = $mainReport->reporter_name;
        $dailyCount = Report::where('reporter_name', $reporterName)
            ->whereDate('created_at', today())
            ->count();
        Log::info('JalanKita: Laporan batch berhasil disimpan.', [
            'batch_id'           => $validated['batch_id'],
            'main_report_code'   => $mainReport->report_code,
            'sub_reports_count'  => $result['sub_reports_count'],
            'trust_score'        => $trustResult['score'],
            'trust_label'        => $trustResult['label'],
            'reporter_name'      => $reporterName,
            'daily_count'        => $dailyCount,
            'exif_clone_suspect' => $exifCloneSuspected,
        ]);

        return response()->json([
            'success'           => true,
            'main_report_id'    => $mainReport->id,
            'main_report_code'  => $mainReport->report_code,
            'sub_reports_count' => $result['sub_reports_count'],
            'trust_score'       => $trustResult['score'],
            'trust_label'       => $trustResult['label'],
            'overall_severity'  => $mainReport->ai_severity,
            'road_matched'      => $roadValidation['matched'],
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

        // Supervisor bisa melihat semua; petugas hanya miliknya
        if (auth()->user()->role === 'petugas') {
            $query->where('reporter_name', auth()->user()->name);
        }

        $total = (clone $query)->count();
        $menungguReview = (clone $query)->where('status', 'Menunggu Review')->count();
        $disetujui      = (clone $query)->where('status', 'Disetujui')->count();
        $ditolak        = (clone $query)->where('status', 'Ditolak')->count();
        $diperbaiki     = (clone $query)->where('status', 'Sedang Diperbaiki')->count();
        $selesai        = (clone $query)->where('status', 'Selesai')->count();

        $hijau  = (clone $query)->where('trust_label', 'hijau')->count();
        $kuning = (clone $query)->where('trust_label', 'kuning')->count();
        $merah  = (clone $query)->where('trust_label', 'merah')->count();

        return response()->json([
            'success' => true,
            'data'    => [
                'total'           => $total,
                'menunggu_review' => $menungguReview,
                'disetujui'       => $disetujui,
                'ditolak'         => $ditolak,
                'sedang_diperbaiki' => $diperbaiki,
                'selesai'         => $selesai,
                'trust_hijau'     => $hijau,
                'trust_kuning'    => $kuning,
                'trust_merah'     => $merah,
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

        if ($report->status !== 'Menunggu Review') {
            return response()->json([
                'success' => false,
                'message' => "Laporan dengan status \"{$report->status}\" tidak dapat disetujui.",
            ], 422);
        }

        $report->update([
            'status'       => 'Disetujui',
            'system_notes' => $report->system_notes
                ? $report->system_notes . ' | [APPROVED] Disetujui oleh ' . auth()->user()->name
                : '[APPROVED] Disetujui oleh ' . auth()->user()->name,
        ]);

        Log::info('JalanKita: Laporan disetujui.', [
            'report_id'   => $report->id,
            'report_code' => $report->report_code,
            'approved_by' => auth()->user()->name,
        ]);

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

        if ($report->status !== 'Menunggu Review') {
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

        Log::info('JalanKita: Laporan ditolak.', [
            'report_id'   => $report->id,
            'report_code' => $report->report_code,
            'alasan'      => $alasan,
            'catatan'     => $catatan,
            'rejected_by' => auth()->user()->name,
        ]);

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

        Log::info('JalanKita: Laporan didisposisi.', [
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

        Log::info('JalanKita: Perbaikan dimulai.', [
            'report_id'   => $report->id,
            'report_code' => $report->report_code,
            'mulai_by'    => auth()->user()->name,
            'pelaksana'   => $report->pelaksana,
        ]);

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
                Log::warning('JalanKita: Foto after duplikat.', [
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

            Log::info('JalanKita: Laporan selesai.', [
                'report_id'   => $report->id,
                'report_code' => $report->report_code,
                'selesai_by'  => auth()->user()->name,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Laporan berhasil diselesaikan.',
                'data'    => ['status' => $report->status],
            ]);
        } catch (\Exception $e) {
            Log::error('JalanKita: Gagal menyelesaikan laporan.', [
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

        Log::info('JalanKita: UPR ditugaskan.', [
            'report_id'   => $report->id,
            'report_code' => $report->report_code,
            'upr_id'      => $upr->id,
            'upr_name'    => $upr->name,
            'assigned_by' => auth()->user()->name,
        ]);

        return response()->json([
            'success' => true,
            'message' => "Laporan ditugaskan ke {$upr->name}.",
            'data'    => ['assigned_upr_id' => $upr->id, 'assigned_upr_name' => $upr->name],
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
}

