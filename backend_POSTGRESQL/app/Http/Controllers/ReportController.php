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

            $spatialDuplicates = [];
            $textualDuplicates = [];

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

            return response()->json([
                'spatial_duplicates' => $spatialDuplicates,
                'textual_duplicates' => $textualDuplicates,
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

        // Catat warning jika tidak ada EXIF (foto dari screenshot/internet)
        $systemNotes = null;
        if ($exifCheck['status'] === 'no_exif_date') {
            $systemNotes = '[PERINGATAN] Foto tidak memiliki metadata EXIF tanggal. ' .
                           'Kemungkinan foto dari galeri tanpa GPS atau screenshot. ' .
                           'Perlu verifikasi manual oleh supervisor.';
        }

        // ── LANGKAH 3: Image Hash Check (Anti-Duplikasi Foto) ─────────────
        // Hitung MD5 hash dari konten biner foto sebelum menyimpan ke storage.
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

        // ── LANGKAH 4-7: Proses dalam Database Transaction ───────────────
        // DB::transaction memastikan semua operasi berhasil atau semua dibatalkan.
        try {
            $report = DB::transaction(function () use ($validated, $imageFile, $systemNotes, $imageHash) {

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

                // Gabungkan system notes
                $finalSystemNotes = implode(' | ', array_filter([
                    $localSystemNotes,
                ]));

                // ── 4f: Simpan ke database PostgreSQL ────────────────────
                $report = Report::create([
                    'report_code'          => $reportCode,
                    'reporter_name'        => $validated['reporter_name'],
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
                // URL gambar yang bisa langsung dipakai oleh frontend React
                'image_original_url'  => $report->image_original_url,
                'image_result_url'    => $report->image_result_url,
                'created_at'          => $report->created_at->toIso8601String(),
            ],
        ], 201);
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
            $hash = md5_file($filePath);
            if ($hash === false) {
                Log::warning('JalanKita: md5_file() mengembalikan false.', ['path' => $filePath]);
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
}
