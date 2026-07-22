<?php

namespace App\Http\Controllers;

use App\Models\Report;
use App\Models\ReportAfterPhoto;
use App\Models\ReportDuplicate;
use App\Models\ReportPhoto;
use App\Models\StatusLog;
use App\Models\Team;
use App\Models\Uptd;
use App\Models\User;
use App\Notifications\BulkActionNotification;
use App\Notifications\ProgressUpdateNotification;
use App\Notifications\RepairCompletedNotification;
use App\Notifications\RepairStartedNotification;
use App\Notifications\ReportApprovedNotification;
use App\Notifications\ReportEditedNotification;
use App\Notifications\ReportRejectedNotification;
use App\Notifications\ReportReopenedNotification;
// ── TRUST SCORE [NONAKTIF] — use App\Services\TrustScoreService;
use App\Notifications\TeamAssignedNotification;
use App\Services\DuplicateCheckService;
use App\Services\PciService;
use App\Notifications\TriageUpdatedNotification;
use Illuminate\Http\Client\ConnectionException;
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
use lsolesen\pel\PelJpeg;
use lsolesen\pel\PelTag;

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
                'errors' => $e->errors(),
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
            'message' => 'Analisis AI gagal: '.$aiData['error'],
        ], 500);
    }

    /**
     * Endpoint pengecekan laporan aktif di suatu lokasi.
     *
     * Mencari laporan aktif (status != 'Selesai') berdasarkan:
     * 1. Spatial: radius 15 meter dari koordinat GPS (Haversine Formula)
     * 2. Textual: kecamatan + nama jalan (ILIKE)
     * 3. Image hash: foto yang sama sudah pernah digunakan
     *
     * Endpoint ini bersifat PUBLIK (tidak perlu autentikasi).
     *
     * GET /api/v1/reports/check-duplicate
     * Query params: latitude, longitude, district, road_name, file_hash
     */
    public function checkDuplicate(Request $request): JsonResponse
    {
        try {
            $duplicateCheck = app(DuplicateCheckService::class);
            $foundReport = null;

            // ── Prioritas 1: Pencarian Spasial (Haversine, 6m) ──────
            $lat = $request->query('latitude');
            $lng = $request->query('longitude');
            if ($lat !== null && $lng !== null && is_numeric($lat) && is_numeric($lng)) {
                $nearby = $duplicateCheck->checkSpatial((float) $lat, (float) $lng, 6);
                if ($nearby) {
                    $foundReport = [
                        'id' => $nearby->id,
                        'report_code' => $nearby->report_code,
                        'road_name' => $nearby->road_name,
                        'district' => $nearby->district,
                        'latitude' => $nearby->latitude ? (float) $nearby->latitude : null,
                        'longitude' => $nearby->longitude ? (float) $nearby->longitude : null,
                        'status' => $nearby->status,
                        'created_at' => $nearby->created_at?->toIso8601String(),
                    ];
                }
            }

            // ── Prioritas 2: Pencarian Tekstual (ILIKE) ──────────────
            if (! $foundReport) {
                $district = $request->query('district');
                $roadName = $request->query('road_name');
                if ($district) {
                    $textualResult = $duplicateCheck->checkTextual($district, $roadName);
                    if ($textualResult) {
                        $foundReport = [
                            'id' => $textualResult->id,
                            'report_code' => $textualResult->report_code,
                            'road_name' => $textualResult->road_name,
                            'district' => $textualResult->district,
                            'latitude' => $textualResult->latitude ? (float) $textualResult->latitude : null,
                            'longitude' => $textualResult->longitude ? (float) $textualResult->longitude : null,
                            'status' => $textualResult->status,
                            'created_at' => $textualResult->created_at?->toIso8601String(),
                        ];
                    }
                }
            }

            // ── Prioritas 3: Pencarian Berdasarkan Hash Gambar ──────
            if (! $foundReport) {
                $fileHash = $request->query('file_hash');
                if ($fileHash) {
                    $hashResult = $duplicateCheck->checkByHash($fileHash);
                    if ($hashResult) {
                        $foundReport = [
                            'id' => $hashResult->id,
                            'report_code' => $hashResult->report_code,
                            'road_name' => $hashResult->road_name,
                            'district' => $hashResult->district,
                            'latitude' => $hashResult->latitude ? (float) $hashResult->latitude : null,
                            'longitude' => $hashResult->longitude ? (float) $hashResult->longitude : null,
                            'status' => $hashResult->status,
                            'created_at' => $hashResult->created_at?->toIso8601String(),
                        ];
                    }
                }
            }

            $nearestDistance = null;
            if ($lat !== null && $lng !== null && is_numeric($lat) && is_numeric($lng)) {
                $nearest = $duplicateCheck->findNearest((float) $lat, (float) $lng);
                if ($nearest) {
                    $nearestDistance = $nearest['distance_meters'];
                }
            }

            return response()->json([
                'has_active_report' => $foundReport !== null,
                'report' => $foundReport,
                'nearest_distance_meters' => $nearestDistance,
            ], 200);

        } catch (\Exception $e) {
            Log::error('DeltaJalan: checkDuplicate error.', ['error' => $e->getMessage()]);

            return response()->json([
                'has_active_report' => false,
                'report' => null,
                'nearest_distance_meters' => null,
            ], 200);
        }
    }

    /**
     * Endpoint penambahan bukti foto ke laporan yang sudah ada (evidence).
     *
     * Alur:
     * - Hanya laporan dengan status "Menunggu Review" yang bisa ditambahi bukti
     * - Foto bukti disimpan ke tabel report_photos (seperti foto batch)
     * - Single: dilakukan analisis AI penuh + dimensi kerusakan
     * - Batch (is_batch=true): skip AI, skip dimensi, hanya EXIF GPS
     *
     * POST /api/v1/reports/{id}/add-evidence
     * Memerlukan autentikasi Sanctum.
     *
     * @param  string  $id  UUID laporan
     */
    public function addEvidence(Request $request, string $id): JsonResponse
    {
        try {
            $validated = $request->validate([
                'image' => ['required', 'file', 'mimes:jpeg,jpg,png', 'max:5120'],
                'reporter_name' => ['required', 'string', 'min:2', 'max:100', 'regex:/^[A-Za-zÀ-ÖØ-öø-ÿ \'.-]+$/'],
                'catatan' => ['nullable', 'string', 'max:1000'],
                'is_batch' => ['nullable', 'boolean'],
                'kerusakan_panjang' => ['nullable', 'numeric', 'min:0', 'max:999999.99'],
                'kerusakan_lebar' => ['nullable', 'numeric', 'min:0', 'max:999999.99'],
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Data yang dikirim tidak valid.',
                'errors' => $e->errors(),
            ], 422);
        }

        $report = Report::find($id);
        if (! $report) {
            return response()->json([
                'success' => false,
                'message' => "Laporan dengan ID {$id} tidak ditemukan.",
            ], 404);
        }

        if ($report->status !== 'Menunggu Review') {
            return response()->json([
                'success' => false,
                'message' => "Laporan dengan status \"{$report->status}\" tidak dapat ditambahi bukti foto. Hanya laporan \"Menunggu Review\" yang dapat dilengkapi.",
                'error_code' => 'INVALID_STATUS',
            ], 422);
        }

        $maxEvidence = (int) config('app.max_evidence_per_report', 10);
        $currentEvidenceCount = ReportPhoto::where('report_id', $report->id)->count();
        if ($currentEvidenceCount >= $maxEvidence) {
            return response()->json([
                'success' => false,
                'message' => "Laporan ini sudah memiliki {$currentEvidenceCount} foto bukti (maksimal {$maxEvidence}).",
                'error_code' => 'MAX_EVIDENCE_REACHED',
            ], 422);
        }

        $imageFile = $request->file('image');
        $imageHash = $this->calculateImageHash($imageFile->getPathname());

        if (config('app.dedup_enabled') && $imageHash !== null && Report::imageHashExists($imageHash)) {
            return response()->json([
                'success' => false,
                'message' => 'Foto ini sudah pernah digunakan pada laporan lain.',
                'error_code' => 'DUPLICATE_IMAGE',
            ], 422);
        }

        $isBatch = $validated['is_batch'] ?? false;

        $resultPath = null;
        $totalDetections = 0;
        $aiJeniusKerusakan = null;
        $aiSeverity = null;
        $aiConfidence = null;
        $aiRawOutput = null;
        $exifGpsNotes = null;
        $photoLat = null;
        $photoLng = null;
        $koordinatSumber = 'exif';

        if (! $isBatch) {
            $aiData = $this->callFastApiAnalyze($imageFile->getPathname(), $imageFile->getClientOriginalName());

            if ($aiData['success']) {
                $payload = $aiData['data'];
                $totalDetections = $payload['total'] ?? 0;
                $aiRawOutput = $payload['detections'] ?? null;

                if (! empty($payload['detections'][0]['type'])) {
                    $aiJeniusKerusakan = $payload['detections'][0]['type'];
                }
                $aiSeverity = $payload['overall_severity'] ?? null;
                $aiConfidence = $payload['confidence'] ?? null;

                if (! empty($payload['image_result'])) {
                    $resultPath = $this->saveBase64Image($payload['image_result'], self::RESULTS_FOLDER);
                }
            } else {
                Log::warning('DeltaJalan: FastAPI tidak merespons saat add-evidence.', [
                    'error' => $aiData['error'],
                ]);
            }
        }

        try {
            $exifGps = $this->extractExifGps($imageFile->getPathname());
            if ($exifGps) {
                $photoLat = $exifGps['lat'];
                $photoLng = $exifGps['lng'];
                $koordinatSumber = 'exif';
            }
        } catch (\Exception $e) {
            $exifGpsNotes = '[INFO] Gagal membaca GPS EXIF: '.$e->getMessage();
        }

        try {
            $photo = DB::transaction(function () use ($report, $imageFile, $validated, $imageHash, $isBatch, $resultPath, $totalDetections, $aiJeniusKerusakan, $aiSeverity, $aiConfidence, $aiRawOutput, $photoLat, $photoLng, $koordinatSumber, $exifGpsNotes) {

                $lastSortOrder = ReportPhoto::where('report_id', $report->id)->max('sort_order') ?? -1;

                $ext = $imageFile->getClientOriginalExtension() ?: $imageFile->guessExtension() ?: 'jpg';
                $filename = Str::uuid().'-evidence-'.time().'.'.$ext;
                $photoPath = $this->savePhotoToStorage($imageFile, $filename);

                if (! $photoPath) {
                    throw new \RuntimeException('Gagal menyimpan foto bukti ke storage.');
                }

                $panjang = $isBatch ? null : ($validated['kerusakan_panjang'] ?? null);
                $lebar = $isBatch ? null : ($validated['kerusakan_lebar'] ?? null);

                return ReportPhoto::create([
                    'report_id' => $report->id,
                    'reporter_name' => $validated['reporter_name'],
                    'image_original_path' => $photoPath,
                    'image_result_path' => $resultPath,
                    'image_hash' => $imageHash,
                    'latitude' => $photoLat,
                    'longitude' => $photoLng,
                    'koordinat_sumber' => $koordinatSumber,
                    'ai_jenis_kerusakan' => $aiJeniusKerusakan,
                    'ai_severity' => $aiSeverity,
                    'ai_confidence' => $aiConfidence,
                    'ai_raw_output' => $aiRawOutput,
                    'total_detections' => $totalDetections,
                    'kerusakan_panjang' => $panjang,
                    'kerusakan_lebar' => $lebar,
                    'system_notes' => $exifGpsNotes,
                    'sort_order' => $lastSortOrder + 1,
                    'original_filename' => $imageFile->getClientOriginalName(),
                ]);
            });

            Log::info('DeltaJalan: Evidence foto ditambahkan via addEvidence.', [
                'report_id' => $report->id,
                'report_code' => $report->report_code,
                'reporter_name' => $validated['reporter_name'],
                'photo_id' => $photo->id,
                'is_batch' => $isBatch,
                'timestamp' => now()->toIso8601String(),
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Foto bukti berhasil ditambahkan ke laporan '.$report->report_code.'.',
                'data' => [
                    'report' => [
                        'id' => $report->id,
                        'report_code' => $report->report_code,
                        'road_name' => $report->road_name,
                        'district' => $report->district,
                        'status' => $report->status,
                    ],
                    'photo' => [
                        'id' => $photo->id,
                        'image_original_url' => $photo->image_original_url,
                        'reporter_name' => $photo->reporter_name,
                        'created_at' => $photo->created_at->toIso8601String(),
                    ],
                ],
            ], 200);

        } catch (\Exception $e) {
            Log::error('DeltaJalan: Gagal menyimpan bukti foto.', [
                'error' => $e->getMessage(),
                'report_id' => $id,
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Terjadi kesalahan saat menyimpan bukti foto. Silakan coba lagi.',
                'debug' => config('app.debug') ? $e->getMessage() : null,
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
     */
    public function store(Request $request): JsonResponse
    {
        // ── LANGKAH 1: Validasi Input ─────────────────────────────────────
        try {
            $validated = $request->validate([
                // Nama petugas lapangan yang mengirim laporan
                'reporter_name' => ['required', 'string', 'min:2', 'max:100', 'regex:/^[A-Za-zÀ-ÖØ-öø-ÿ \'.-]+$/'],

                // Nama ruas jalan (input manual atau dari GPS reverse geocoding)
                'road_name' => ['required', 'string', 'max:255'],

                // Kecamatan — harus salah satu dari 18 kecamatan Sidoarjo
                'district' => ['required', 'string', 'in:'.implode(',', $this->getKecamatanList())],

                // Koordinat GPS — validasi range geografis Indonesia
                'latitude' => ['required', 'numeric', 'between:-11,6'],
                'longitude' => ['required', 'numeric', 'between:95,141'],

                // File foto — wajib, hanya JPEG/PNG, maksimal 5MB
                'image' => ['required', 'file', 'mimes:jpeg,jpg,png', 'max:5120'],
                // Dimensi kerusakan — wajib
                'kerusakan_panjang' => ['required', 'numeric', 'min:0', 'max:999999.99'],
                'kerusakan_lebar' => ['required', 'numeric', 'min:0', 'max:999999.99'],
                // Catatan petugas (opsional)
                'catatan' => ['nullable', 'string', 'max:1000'],
                // Duplikasi — diisi saat user override peringatan duplikat
                'duplicate_of_id' => ['nullable', 'string', 'exists:reports,id'],
                'survey_task_id' => ['nullable', 'string', 'exists:survey_tasks,id'],
                // Data AI analysis opsional — jika dikirim, backend skip call FastAPI
                'total_detections' => ['nullable', 'integer', 'min:0'],
                'overall_severity' => ['nullable', 'string', 'max:50'],
                'ai_raw_output' => ['nullable', 'json'],
                'image_result' => ['nullable', 'string'],
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Data yang dikirim tidak valid.',
                'errors' => $e->errors(),
            ], 422);
        }

        // ── Validasi koordinat berada di wilayah Sidoarjo ─────────────────
        if (! $this->isInSidoarjo((float) $validated['latitude'], (float) $validated['longitude'])) {
            return response()->json([
                'success' => false,
                'message' => 'Koordinat berada di luar wilayah Kabupaten Sidoarjo. Pastikan GPS aktif dan Anda berada di lokasi kerusakan.',
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
            $existingReport = app(DuplicateCheckService::class)->checkByHash($imageHash);
            if ($existingReport) {
                return response()->json([
                    'success' => false,
                    'message' => 'Foto ini sudah pernah digunakan untuk laporan '.
                                    $existingReport->report_code.'. '.
                                    'Gunakan fitur bukti foto jika laporan masih dalam status "Menunggu Review".',
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
        }

        // ── LANGKAH 3.5: Validasi nama jalan vs koordinat ─────────────────
        // Dilakukan di sini (sebelum transaction) agar LocationIQ timeout
        // tidak menahan koneksi database.
        $roadValidation = $this->validateRoadNameVsCoordinate(
            $validated['road_name'],
            (float) $validated['latitude'],
            (float) $validated['longitude']
        );
        $fullAddress = $roadValidation['full_address'] ?? null;

        // Ekstrak GPS EXIF sebelum transaction untuk dipakai di trust score.
        $exifGps = $this->extractExifGps($imageFile->getPathname());

        // ── LANGKAH 4: Proses AI + GPS + Trust (DI LUAR transaction) ──────
        // Jika frontend mengirim data AI analysis, gunakan itu (skip FastAPI call).
        // Ini menghindari redundant FastAPI inference yang sudah dilakukan saat analyze.
        $resultPath = null;
        $totalDetections = 0;
        $overallSeverity = 'Baik';
        $aiRawOutput = null;
        $localSystemNotes = null;
        $gpsMismatchNotes = null;
        $fakeGpsSuspected = false;

        $frontendAiRawOutput = $request->input('ai_raw_output');
        if ($frontendAiRawOutput) {
            $totalDetections = (int) ($request->input('total_detections', 0));
            $overallSeverity = $this->normalizeSeverityEnum($request->input('overall_severity', 'Baik'));
            $decoded = json_decode($frontendAiRawOutput, true);
            $aiRawOutput = is_array($decoded) ? $decoded : null;

            $imageResult = $request->input('image_result');
            if (! empty($imageResult)) {
                $resultPath = $this->saveBase64Image($imageResult, self::RESULTS_FOLDER);
            }
        } else {
            // Fallback: panggil FastAPI (legacy mode, backward compatible)
            $aiData = $this->callFastApiAnalyze($imageFile->getPathname(), $imageFile->getClientOriginalName());

            if ($aiData['success']) {
                $payload = $aiData['data'];

                $totalDetections = $payload['total'] ?? 0;
                $overallSeverity = $this->normalizeSeverityEnum($payload['overall_severity'] ?? 'Baik');
                $aiRawOutput = $payload['detections'] ?? null;

                if (! empty($payload['image_result'])) {
                    $resultPath = $this->saveBase64Image(
                        $payload['image_result'],
                        self::RESULTS_FOLDER
                    );
                }
            } else {
                $localSystemNotes = '[FALLBACK] FastAPI tidak merespons: '.$aiData['error'];
                Log::warning('DeltaJalan: FastAPI tidak merespons saat menyimpan laporan.', [
                    'error' => $aiData['error'],
                ]);
            }
        }

        // ── Cek GPS Mismatch ──────────────────────────────────────────────
        if ($exifGps) {
            $distance = $this->haversineDistance(
                $exifGps['lat'], $exifGps['lng'],
                (float) $validated['latitude'], (float) $validated['longitude']
            );
            if ($distance > 500) {
                $gpsMismatchNotes = '[PERINGATAN] GPS EXIF foto berjarak '.round($distance).'m dari koordinat input form. Perlu diverifikasi.';
                $fakeGpsSuspected = true;
            }
        } else {
            $gpsMismatchNotes = '[INFO] Foto tidak memuat GPS EXIF, jarak validasi menggunakan koordinat dari form manual atau Browser GPS.';
        }

        // ── TRUST SCORE [NONAKTIF] — kalkulasi trust score dihapus
        // Gabungkan system notes
        $finalSystemNotes = implode(' | ', array_filter([
            $localSystemNotes,
            $gpsMismatchNotes,
        ]));

        $duplicateOfId = $request->input('duplicate_of_id');
        $surveyTaskId = $request->input('survey_task_id');

        // ── LANGKAH 5: Simpan ke database (DI DALAM transaction) ─────────
        // Hanya operasi DB — tidak ada HTTP/I/O lambat.
        try {
            $report = DB::transaction(function () use ($validated, $imageFile, $imageHash, $resultPath, $totalDetections, $overallSeverity, $aiRawOutput, $finalSystemNotes, $duplicateOfId, $surveyTaskId, $fullAddress) {

                // ── 5a: Generate kode laporan unik ────────────────────────
                $reportCode = $this->generateReportCode();

                // ── 5b: Simpan foto asli ke storage ──────────────────────
                $ext = $imageFile->getClientOriginalExtension() ?: $imageFile->guessExtension() ?: 'jpg';
                $originalFilename = Str::uuid().'-'.time().'.'.$ext;

                $originalPath = $this->savePhotoToStorage($imageFile, $originalFilename);

                if (! $originalPath) {
                    throw new \RuntimeException('Gagal menyimpan foto asli ke storage.');
                }

                // ── 5c: Simpan ke database PostgreSQL ────────────────────
                $defaultPriority = 'Sedang';
                $report = Report::create([
                    'user_id' => auth()->id(),
                    'report_code' => $reportCode,
                    'reporter_name' => auth()->user()?->name ?? $validated['reporter_name'],
                    'road_name' => $validated['road_name'],
                    'district' => $validated['district'],
                    'latitude' => $validated['latitude'],
                    'longitude' => $validated['longitude'],
                    'image_original_path' => $originalPath,
                    'image_result_path' => $resultPath,
                    'image_hash' => $imageHash,
                    'total_detections' => $totalDetections,
                    'overall_severity' => $overallSeverity,
                    'ai_raw_output' => $aiRawOutput,
                    'status' => 'Menunggu Review',
                    'priority' => $defaultPriority,
                    'system_notes' => $finalSystemNotes ?: null,
                    // ── TRUST SCORE [NONAKTIF] — trust_score, trust_label, trust_breakdown dihapus
                    'kerusakan_panjang' => $validated['kerusakan_panjang'] ?? null,
                    'kerusakan_lebar' => $validated['kerusakan_lebar'] ?? null,
                    'catatan_petugas' => $validated['catatan'] ?? null,
                    'survey_task_id' => $surveyTaskId,
                    'full_address' => $fullAddress,
                    'deadline_review' => Report::hitungDeadlineReview($defaultPriority),
                ]);

                // ── 5d: Simpan relasi duplikasi jika ada ────────────────
                if ($duplicateOfId) {
                    ReportDuplicate::create([
                        'report_id' => $report->id,
                        'duplicate_of_id' => $duplicateOfId,
                        'score' => 0.900,
                        'match_type' => 'user_confirmed',
                    ]);
                }

                return $report;
            });

            // Tambahkan system notes dari EXIF check jika ada
            // (dilakukan di luar transaksi agar tidak memblokir)
            if ($systemNotes && $report->system_notes === null) {
                $report->update(['system_notes' => $systemNotes]);
            } elseif ($systemNotes && $report->system_notes !== null) {
                $report->update(['system_notes' => $report->system_notes.' | '.$systemNotes]);
            }

        } catch (\Exception $e) {
            Log::error('DeltaJalan: Gagal menyimpan laporan.', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Terjadi kesalahan saat menyimpan laporan. Silakan coba lagi.',
                'debug' => config('app.debug') ? $e->getMessage() : null,
            ], 500);
        }

        // ── Log aktivitas petugas untuk anomaly detection ─────────────────
        $reporterName = $report->reporter_name;
        $dailyCount = Report::where('reporter_name', $reporterName)
            ->whereDate('created_at', today())
            ->count();
        Log::info('DeltaJalan: Laporan tunggal disimpan.', [
            'reporter_name' => $reporterName,
            'report_code' => $report->report_code,
            // ── TRUST SCORE [NONAKTIF] — trust_score, trust_label dihapus dari log
            'daily_count' => $dailyCount,
        ]);

        // ── Hitung PCI ──
        $pci = app(PciService::class)->calculateFromReport($report);
        if ($pci !== null) {
            $report->pci_score = $pci;
            $report->pci_calculated_at = now();
            $report->saveQuietly();
        }

        // ── LANGKAH 8: Kembalikan Response ke Frontend ────────────────────
        // Muat ulang model untuk mendapatkan data terbaru dari database
        $report->refresh();

        return response()->json([
            'success' => true,
            'message' => 'Laporan berhasil disimpan.',
            'data' => [
                'id' => $report->id,
                'report_code' => $report->report_code,
                'reporter_name' => $report->reporter_name,
                'road_name' => $report->road_name,
                'district' => $report->district,
                'latitude' => (float) $report->latitude,
                'longitude' => (float) $report->longitude,
                'total_detections' => $report->total_detections,
                'overall_severity' => $report->overall_severity,
                'severity_color' => $report->severity_color,
                'status' => $report->status,
                'ai_raw_output' => $report->ai_raw_output,
                // ── TRUST SCORE [NONAKTIF] — trust_score, trust_label dihapus dari response
                // URL gambar yang bisa langsung dipakai oleh frontend React
                'image_original_url' => $report->image_original_url,
                'image_result_url' => $report->image_result_url,
                'catatan_petugas' => $report->catatan_petugas,
                'kerusakan_panjang' => $report->kerusakan_panjang ? (float) $report->kerusakan_panjang : null,
                'kerusakan_lebar' => $report->kerusakan_lebar ? (float) $report->kerusakan_lebar : null,
                'full_address' => $report->full_address,
                'created_at' => $report->created_at->toIso8601String(),
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

        // Filter khusus: hanya laporan tim (tab Perbaikan)
        if ($request->boolean('team_tasks')) {
            if ($user->team_id) {
                $query->where('assigned_team_id', $user->team_id);
                $query->whereNotIn('status', ['Diedit']);
            }
        } elseif ($user->role === 'petugas') {
            $query->where(function ($q) use ($user) {
                $q->where('user_id', $user->id)
                    ->orWhere('assigned_team_id', $user->team_id);
            });
            $query->whereNotIn('status', ['Diedit']);
        }

        // Supervisor hanya melihat laporan yang di-assign ke dirinya
        // atau yang belum di-assign (safety net untuk edge cases)
        if ($user->role === 'supervisor') {
            $query->where(function ($q) use ($user) {
                $q->where('assigned_supervisor_id', $user->id)
                  ->orWhereNull('assigned_supervisor_id');
            });
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

        // Filter by source (warga/petugas)
        if ($request->filled('source')) {
            $query->where('source', $request->input('source'));
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

        // Filter by UPTD / Tim
        if ($request->filled('uptd_id')) {
            $teamIds = Team::where('uptd_id', $request->input('uptd_id'))->pluck('id');
            $query->whereIn('assigned_team_id', $teamIds);
        } elseif ($request->filled('upr_id')) {
            $query->where('assigned_team_id', $request->input('upr_id'));
        }

        // Filter by severity
        if ($request->filled('severity')) {
            $sev = $request->input('severity');
            $query->where(function ($sub) use ($sev) {
                $sub->whereRaw('overall_severity::text = ?', [$sev])
                    ->orWhere('ai_severity', $sev);
            });
        }

        // Filter user_reports=true — paksa filter berdasarkan user id
        if ($request->boolean('user_reports')) {
            $query->where('user_id', $user->id);
        }

        // Filter deadline status
        if ($request->filled('status_deadline')) {
            $statusDeadline = $request->input('status_deadline');
            if ($statusDeadline === 'terlambat') {
                $query->where(function ($q) {
                    $q->where('terlambat_review', true)
                        ->orWhere('terlambat_resolusi', true);
                });
            } elseif ($statusDeadline === 'tepat_waktu') {
                $query->where('terlambat_review', false)
                    ->where('terlambat_resolusi', false);
            }
        }

        // Filter by PCI range
        if ($request->filled('pci')) {
            $pciFilter = $request->input('pci');
            if ($pciFilter === 'kritis') {
                $query->where('pci_score', '<=', 40);
            } elseif ($pciFilter === 'sedang') {
                $query->whereBetween('pci_score', [41, 70]);
            } elseif ($pciFilter === 'baik') {
                $query->where('pci_score', '>=', 71);
            }
        }

        $limit = min((int) $request->input('limit', 50), 100);
        $page = max(1, (int) $request->input('page', 1));

        // Hitung total SEBELUM limit untuk akurasi
        $total = (clone $query)->count();

        // Dynamic sorting — default created_at desc, deadline sort asc
        $allowedSortBy = ['created_at', 'deadline_review', 'deadline_resolusi', 'priority'];
        $sortBy = $request->input('sort_by', 'created_at');
        $sortBy = in_array($sortBy, $allowedSortBy) ? $sortBy : 'created_at';
        $defaultOrder = $sortBy === 'created_at' ? 'desc' : 'asc';
        $order = strtolower($request->input('order', $defaultOrder));
        $order = in_array($order, ['asc', 'desc']) ? $order : $defaultOrder;

        $reports = $query->orderBy($sortBy, $order)
            ->orderBy('report_code', 'desc')
            ->skip(($page - 1) * $limit)
            ->take($limit)
            ->withCount('photos')
            ->withCount('progressUpdates')
            ->with('firstPhoto')
            ->with('assignedTeam')
            ->with('duplicateOf.originalReport')
            ->get()
            ->map(function ($report) {
                return [
                    'id' => $report->id,
                    'report_code' => $report->report_code,
                    'reporter_name' => $report->reporter_name,
                    'road_name' => $report->road_name,
                    'district' => $report->district,
                    'latitude' => $report->latitude ? (float) $report->latitude : null,
                    'longitude' => $report->longitude ? (float) $report->longitude : null,
                    'overall_severity' => $report->overall_severity,
                    'ai_severity' => $report->ai_severity,
                    'total_detections' => $report->total_detections,
                    'status' => $report->status,
                    'source' => $report->source,
                    'description' => $report->description,
                    // ── TRUST SCORE [NONAKTIF] — trust_score, trust_label dihapus dari response index
                    'image_original_url' => $report->image_original_url,
                    'image_result_url' => $report->image_result_url,
                    'after_photo_url' => $report->after_photo_url,
                    'first_photo_url' => $report->first_photo_url,
                    'assigned_team_id' => $report->assigned_team_id,
                    'assigned_team_name' => $report->assignedTeam?->name,
                    'assigned_supervisor_id' => $report->assigned_supervisor_id,
                    'perbaikan_dimulai_at' => $report->perbaikan_dimulai_at?->toIso8601String(),
                    'perbaikan_selesai_at' => $report->perbaikan_selesai_at?->toIso8601String(),
                    'pelaksana' => $report->pelaksana,
                    'kerusakan_panjang' => $report->kerusakan_panjang ? (float) $report->kerusakan_panjang : null,
                    'kerusakan_lebar' => $report->kerusakan_lebar ? (float) $report->kerusakan_lebar : null,
                    'catatan_petugas' => $report->catatan_petugas,
                    'priority' => $report->priority,
                    'estimasi_hari' => $report->estimasi_hari,
                    'batch_id' => $report->batch_id,
                    'photos_count' => $report->batch_id ? (int) $report->photos_count : 0,
                    'deadline_review' => $report->deadline_review?->toIso8601String(),
                    'deadline_resolusi' => $report->deadline_resolusi?->toIso8601String(),
                    'terlambat_review' => $report->terlambat_review,
                    'terlambat_resolusi' => $report->terlambat_resolusi,
                    'progress_updates_count' => (int) $report->progress_updates_count,
                    'ditugaskan_at' => $report->ditugaskan_at?->toIso8601String(),
                    'assignor_name' => $report->assignor_name,
                    'status_deadline' => $report->terlambat_review || $report->terlambat_resolusi ? 'terlambat' : 'tepat_waktu',
                    'pci_score' => $report->pci_score ? (float) $report->pci_score : null,
                    'is_duplicate' => $report->relationLoaded('duplicateOf') && $report->duplicateOf !== null,
                    'duplicate_score' => $report->relationLoaded('duplicateOf') && $report->duplicateOf ? (float) $report->duplicateOf->score : null,
                    'created_at' => $report->created_at?->toIso8601String(),
                ];
            });

        return response()->json([
            'success' => true,
            'data' => $reports,
            'total' => $total,
            'page' => $page,
            'last_page' => max(1, (int) ceil($total / $limit)),
        ]);
    }

    /**
     * GET /api/reports/{id}
     * Detail satu laporan berdasarkan UUID.
     */
    public function show(string $id): JsonResponse
    {
        $report = Report::with(['photos', 'afterPhotos', 'statusLogs', 'duplicateOf.originalReport'])
            ->withCount('progressUpdates')
            ->find($id);

        if (! $report) {
            return response()->json(['success' => false, 'message' => 'Laporan tidak ditemukan.'], 404);
        }

        $user = auth()->user();
        if ($user && $user->role === 'petugas') {
            $isOwnReport = $report->reporter_name === $user->name;
            $isTeamReport = $report->assigned_team_id && $report->assigned_team_id === $user->team_id;
            if (! $isOwnReport && ! $isTeamReport) {
                return response()->json([
                    'success' => false,
                    'message' => 'Anda hanya dapat melihat detail laporan Anda sendiri atau laporan tim Anda.',
                ], 403);
            }
        }

        $data = [
            'id' => $report->id,
            'report_code' => $report->report_code,
            'reporter_name' => $report->reporter_name,
            'road_name' => $report->road_name,
            'district' => $report->district,
            'latitude' => $report->latitude ? (float) $report->latitude : null,
            'longitude' => $report->longitude ? (float) $report->longitude : null,
            'full_address' => $report->full_address,
            'overall_severity' => $report->overall_severity,
            'ai_severity' => $report->ai_severity,
            'total_detections' => $report->total_detections,
            'status' => $report->status,
            'source' => $report->source,
            'description' => $report->description,
            // ── TRUST SCORE [NONAKTIF] — trust_score, trust_label, trust_breakdown dihapus dari response detail
            'system_notes' => $report->system_notes,
            'ai_raw_output' => $report->ai_raw_output,
            'pci_score' => $report->pci_score ? (float) $report->pci_score : null,
            'image_original_url' => $report->image_original_url,
            'image_result_url' => $report->image_result_url,
            'after_photo_url' => $report->after_photo_url,
            'after_photo_notes' => $report->after_photo_notes,
            'after_photos' => $report->afterPhotos->map(fn ($p) => [
                'id' => $p->id,
                'url' => $p->url,
                'sort_order' => $p->sort_order,
            ]),
            'perbaikan_dimulai_at' => $report->perbaikan_dimulai_at?->toIso8601String(),
            'perbaikan_selesai_at' => $report->perbaikan_selesai_at?->toIso8601String(),
            'pelaksana' => $report->pelaksana,
            'assigned_team_id' => $report->assigned_team_id,
            'assigned_team_name' => $report->assignedTeam?->name,
            'assigned_at' => $report->assigned_at?->toIso8601String(),
            'ditugaskan_at' => $report->ditugaskan_at?->toIso8601String(),
            'assignor_name' => $report->assignor_name,
            'catatan_petugas' => $report->catatan_petugas,
            'priority' => $report->priority,
            'deadline_review' => $report->deadline_review?->toIso8601String(),
            'deadline_resolusi' => $report->deadline_resolusi?->toIso8601String(),
            'terlambat_review' => $report->terlambat_review,
            'terlambat_resolusi' => $report->terlambat_resolusi,
            'estimasi_hari' => $report->estimasi_hari,
            'progress_updates_count' => (int) $report->progress_updates_count,
            'status_deadline' => $report->terlambat_review || $report->terlambat_resolusi ? 'terlambat' : 'tepat_waktu',
            'rating' => $report->rating,
            'rating_comment' => $report->rating_comment,
            'rated_at' => $report->rated_at?->toIso8601String(),
            'kerusakan_panjang' => $report->kerusakan_panjang ? (float) $report->kerusakan_panjang : null,
            'kerusakan_lebar' => $report->kerusakan_lebar ? (float) $report->kerusakan_lebar : null,
            'batch_id' => $report->batch_id,
            'created_at' => $report->created_at?->toIso8601String(),
            'updated_at' => $report->updated_at?->toIso8601String(),
            'photos' => $report->photos->map(fn ($p) => [
                'id' => $p->id,
                'reporter_name' => $p->reporter_name,
                'ai_jenis_kerusakan' => $p->ai_jenis_kerusakan,
                'ai_severity' => $p->ai_severity,
                'ai_confidence' => $p->ai_confidence ? (float) $p->ai_confidence : null,
                'total_detections' => $p->total_detections,
                'ai_raw_output' => $p->ai_raw_output,
                'latitude' => $p->latitude ? (float) $p->latitude : null,
                'longitude' => $p->longitude ? (float) $p->longitude : null,
                'image_original_url' => $p->image_original_url,
                'image_result_url' => $p->image_result_url,
                'system_notes' => $p->system_notes,
                'sort_order' => $p->sort_order,
                'kerusakan_panjang' => $p->kerusakan_panjang ? (float) $p->kerusakan_panjang : null,
                'kerusakan_lebar' => $p->kerusakan_lebar ? (float) $p->kerusakan_lebar : null,
                'photo_taken_at' => $p->photo_taken_at?->toIso8601String(),
                'created_at' => $p->created_at?->toIso8601String(),
                'mobileclip_score' => $p->mobileclip_score ? (float) $p->mobileclip_score : null,
                'mobileclip_label' => $p->mobileclip_label,
                'quality_scores' => $p->quality_scores,
            ]),
            // Duplikasi — informasi jika laporan ini diduga duplikat
            'source' => $report->source,
            'description' => $report->description,
            'duplicate_of' => $report->duplicateOf ? [
                'id' => $report->duplicateOf->originalReport?->id,
                'report_code' => $report->duplicateOf->originalReport?->report_code,
                'road_name' => $report->duplicateOf->originalReport?->road_name,
                'district' => $report->duplicateOf->originalReport?->district,
                'latitude' => $report->duplicateOf->originalReport?->latitude ? (float) $report->duplicateOf->originalReport->latitude : null,
                'longitude' => $report->duplicateOf->originalReport?->longitude ? (float) $report->duplicateOf->originalReport->longitude : null,
                'score' => (float) $report->duplicateOf->score,
                'match_type' => $report->duplicateOf->match_type,
                'status' => $report->duplicateOf->originalReport?->status,
            ] : null,

            // Timeline — urut dari paling lama ke paling baru
            'status_history' => $report->statusLogs->map(fn ($log) => [
                'event' => $this->mapStatusToEvent($log->new_status, $log->notes),
                'label' => $this->mapStatusToLabel($log->new_status, $log->notes),
                'status' => $log->new_status,
                'old_status' => $log->old_status,
                'timestamp' => $log->created_at?->toIso8601String(),
                'actor_name' => $log->actor_name,
                'actor_role' => $log->actor_role,
                'notes' => $log->notes,
            ])->values()->toArray(),
        ];

        return response()->json([
            'success' => true,
            'data' => $data,
        ]);
    }

    // ── Peta Interaktif GIS ──────────────────────────────────────────────

    /**
     * GET /api/reports/map-data
     *
     * Data agregat untuk Peta Interaktif:
     *  - districts: statistik per kecamatan (GROUP BY district)
     *  - reports:   laporan dengan koordinat (ringan, untuk marker)
     *  - stats:     statistik global (by severity, by status, terlambat deadline)
     */
    public function mapData(Request $request): JsonResponse
    {
        $user = $request->user();

        // 1. Statistik per kecamatan — cache 5 menit
        $districts = Cache::remember('map_districts', 300, function () {
            return DB::table('reports')
                ->selectRaw("
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
                ->keyBy('district')
                ->all();
        });
        // Guard: stale cache may return __PHP_Incomplete_Class; re-query
        if (! is_array($districts)) {
            Cache::forget('map_districts');
            $districts = DB::table('reports')
                ->selectRaw("
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
                ->keyBy('district')
                ->all();
        }

        // 2. Laporan ringan untuk marker
        $query = Report::select([
            'id', 'user_id', 'latitude', 'longitude', 'status',
            'overall_severity', 'ai_severity', 'road_name', 'district',
            'image_original_path', 'kerusakan_panjang', 'kerusakan_lebar',
            'pci_score',
            // ── TRUST SCORE [NONAKTIF] — 'trust_score' dihapus dari SELECT
            'created_at', 'assigned_team_id',
        ])->with(['firstPhoto', 'assignedTeam'])->whereNotNull('latitude')->whereNotNull('longitude');

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

        if ($request->filled('uptd_id')) {
            $teamIds = Team::where('uptd_id', $request->input('uptd_id'))->pluck('id');
            $query->whereIn('assigned_team_id', $teamIds);
        } elseif ($request->filled('upr_id')) {
            $query->where('assigned_team_id', $request->input('upr_id'));
        }

        // Deadline filter: tampilkan laporan yang sudah > N hari tanpa selesai/ditolak
        if ($request->filled('deadline_hari')) {
            $days = max(1, (int) $request->input('deadline_hari'));
            $query->where('created_at', '<', now()->subDays($days))
                ->whereNotIn('status', ['Selesai', 'Ditolak']);
        }

        $reports = $query->orderBy('created_at', 'desc')->limit(1000)->get()
            ->each(fn ($r) => $r->append('first_photo_url')->setAttribute('assigned_team_name', $r->assignedTeam?->name));

        // 3. Statistik global — single grouped query + cache
        $cacheKey = 'map_global_stats';
        $globalStats = Cache::remember($cacheKey, 60, function () {
            return $this->queryMapGlobalStats();
        });

        // Guard: stale cache can yield an incomplete object; re-fetch from DB
        if (! ($globalStats instanceof \stdClass)) {
            Cache::forget($cacheKey);
            $globalStats = $this->queryMapGlobalStats();
        }

        $total = (int) $globalStats->total;
        $bySeverity = [
            'berat' => (int) $globalStats->berat,
            'sedang' => (int) $globalStats->sedang,
            'ringan' => (int) $globalStats->ringan,
        ];
        $byStatus = [
            'Menunggu Review' => (int) $globalStats->menunggu_review,
            'Disetujui' => (int) $globalStats->disetujui,
            'Sedang Diperbaiki' => (int) $globalStats->sedang_diperbaiki,
            'Selesai' => (int) $globalStats->selesai,
            'Ditolak' => (int) $globalStats->ditolak,
        ];
        $terlambatCount = (int) $globalStats->terlambat_count;

        return response()->json([
            'success' => true,
            'data' => [
                'districts' => $districts,
                'reports' => $reports,
                'stats' => [
                    'total' => $total,
                    'by_severity' => $bySeverity,
                    'by_status' => $byStatus,
                    'terlambat_count' => $terlambatCount,
                    'terlambat_review' => (int) $globalStats->terlambat_review_count,
                    'terlambat_resolusi' => (int) $globalStats->terlambat_resolusi_count,
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
     * @return string|null MD5 hash (32 karakter hex), atau null jika gagal
     */
    private function queryMapGlobalStats(): \stdClass
    {
        return DB::table('reports')
            ->whereNotNull('latitude')
            ->whereNotNull('longitude')
            ->selectRaw("
            COUNT(*) as total,
            SUM(CASE WHEN overall_severity::text = 'Rusak Berat' OR LOWER(ai_severity) = 'berat' THEN 1 ELSE 0 END) as berat,
            SUM(CASE WHEN overall_severity::text = 'Rusak Sedang' OR LOWER(ai_severity) = 'sedang' THEN 1 ELSE 0 END) as sedang,
            SUM(CASE WHEN overall_severity::text = 'Rusak Ringan' OR LOWER(ai_severity) = 'ringan' THEN 1 ELSE 0 END) as ringan,
            SUM(CASE WHEN status IN ('Menunggu Review', 'Ditinjau') THEN 1 ELSE 0 END) as menunggu_review,
            SUM(CASE WHEN status = 'Disetujui' THEN 1 ELSE 0 END) as disetujui,
            SUM(CASE WHEN status = 'Sedang Diperbaiki' THEN 1 ELSE 0 END) as sedang_diperbaiki,
            SUM(CASE WHEN status = 'Selesai' THEN 1 ELSE 0 END) as selesai,
            SUM(CASE WHEN status = 'Ditolak' THEN 1 ELSE 0 END) as ditolak,
            SUM(CASE WHEN created_at < NOW() - INTERVAL '7 days' AND status NOT IN ('Selesai', 'Ditolak') THEN 1 ELSE 0 END) as terlambat_count,
            SUM(CASE WHEN terlambat_review = true THEN 1 ELSE 0 END) as terlambat_review_count,
            SUM(CASE WHEN terlambat_resolusi = true THEN 1 ELSE 0 END) as terlambat_resolusi_count
        ")->first();
    }

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
                'path' => $filePath,
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
     * @param  string  $filePath  Path absolut ke file foto di server
     * @param  string  $fileName  Nama file asli (untuk header multipart)
     * @return array{success: bool, data: array|null, error: string|null}
     */
    private function callFastApiAnalyze(string $filePath, string $fileName): array
    {
        $fastApiUrl = rtrim(config('services.fastapi.url', env('FASTAPI_URL', 'http://127.0.0.1:8000')), '/');
        $endpoint = $fastApiUrl.'/analyze?include_image=true';

        try {
            $response = Http::timeout(30)
                ->attach(
                    'file',
                    fopen($filePath, 'r'),
                    $fileName
                )
                ->post($endpoint);

            if ($response->successful()) {
                $data = $response->json();

                // Validasi struktur response FastAPI
                if (! isset($data['overall_severity'])) {
                    return [
                        'success' => false,
                        'data' => null,
                        'error' => 'Response FastAPI tidak memiliki field overall_severity.',
                    ];
                }

                return [
                    'success' => true,
                    'data' => $data,
                    'error' => null,
                ];
            }

            // Coba parse body untuk pesan error yang lebih informatif (422, dll)
            $body = $response->json();
            $errorMsg = $body['message'] ?? "FastAPI merespons dengan status HTTP {$response->status()}.";

            return [
                'success' => false,
                'data' => null,
                'error' => $errorMsg,
            ];

        } catch (ConnectionException $e) {
            // Server FastAPI mati atau tidak bisa dijangkau
            return [
                'success' => false,
                'data' => null,
                'error' => 'Koneksi ke FastAPI gagal: '.$e->getMessage(),
            ];
        } catch (\Exception $e) {
            // Error lainnya (timeout, dll)
            return [
                'success' => false,
                'data' => null,
                'error' => 'Error saat memanggil FastAPI: '.$e->getMessage(),
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
     * @param  string  $folder  Folder tujuan di storage/app/public/
     * @return string|null Path relatif file yang tersimpan, atau null jika gagal
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
            $filename = Str::uuid().'-result-'.time().'.jpg';
            $path = $folder.'/'.$filename;

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
                'status' => 'no_exif_support',
                'message' => 'Ekstensi EXIF PHP tidak aktif. Validasi tanggal foto dilewati.',
                'photo_date' => null,
            ];
        }

        try {
            // Suppress error dengan @ karena exif_read_data bisa throw warning
            // untuk file yang tidak punya EXIF (PNG, screenshot, dll)
            $exifData = @exif_read_data($filePath, 'EXIF', false);

            if (! $exifData) {
                return [
                    'status' => 'no_exif_date',
                    'message' => 'Foto tidak memiliki metadata EXIF. Kemungkinan screenshot atau foto dari internet.',
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
                    'status' => 'no_exif_date',
                    'message' => 'Metadata EXIF tidak memiliki informasi tanggal pengambilan foto.',
                    'photo_date' => null,
                ];
            }

            // Parse format EXIF: "YYYY:MM:DD HH:MM:SS" → PHP DateTime
            $photoDate = \DateTime::createFromFormat('Y:m:d H:i:s', $rawDate);

            if (! $photoDate) {
                return [
                    'status' => 'exif_read_error',
                    'message' => 'Format tanggal EXIF tidak dapat dibaca.',
                    'photo_date' => null,
                ];
            }

            // Normalisasi ke tengah malam untuk perbandingan tanggal saja
            // Ini mencegah foto yang diambil jam 14:00 dianggap "masa depan"
            // hanya karena server membandingkan dengan jam 10:00 saat ini
            $photoDateOnly = new \DateTime($photoDate->format('Y-m-d'));
            $todayOnly = new \DateTime('today'); // selalu 00:00:00 hari ini

            $diffDays = (int) $todayOnly->diff($photoDateOnly)->days;
            $isFuture = $photoDateOnly > $todayOnly; // besok atau lebih = masa depan

            // Foto dari masa depan — metadata dimanipulasi
            if ($isFuture) {
                return [
                    'status' => 'future_date',
                    'message' => "Tanggal foto ({$photoDate->format('d/m/Y')}) adalah tanggal di masa depan. ".
                                    'Metadata foto kemungkinan telah dimanipulasi.',
                    'photo_date' => $photoDate->format('Y-m-d'),
                ];
            }

            // Foto terlalu lama
            if ($diffDays > self::MAX_PHOTO_AGE_DAYS) {
                return [
                    'status' => 'too_old',
                    'message' => "Foto diambil pada {$photoDate->format('d/m/Y')} ({$diffDays} hari yang lalu). ".
                                    'Sistem hanya menerima foto yang diambil maksimal '.
                                    self::MAX_PHOTO_AGE_DAYS.' hari terakhir.',
                    'photo_date' => $photoDate->format('Y-m-d'),
                ];
            }

            // Lolos semua validasi
            return [
                'status' => 'valid',
                'message' => 'Tanggal foto valid.',
                'photo_date' => $photoDate->format('Y-m-d'),
            ];

        } catch (\Exception $e) {
            // Jika ada error tak terduga, jangan blokir laporan — beri warning saja
            Log::warning('DeltaJalan: Error saat membaca EXIF foto.', [
                'error' => $e->getMessage(),
            ]);

            return [
                'status' => 'exif_read_error',
                'message' => 'Gagal membaca metadata EXIF: '.$e->getMessage(),
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
     */
    public function storeBatch(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'batch_id' => 'required|uuid',
                'road_name' => 'required|string|max:255',
                'district' => 'required|string|in:'.implode(',', $this->getKecamatanList()),
                'latitude' => 'required|numeric|between:-11,6',
                'longitude' => 'required|numeric|between:95,141',
                'koordinat_sumber' => 'required|in:exif,browser_gps,manual',
                // ── TRUST SCORE [NONAKTIF] — 'fake_gps_suspected' => 'boolean', dihapus dari validasi
                'analyses' => 'required|json',
                'kerusakan_panjang' => ['required', 'array', 'min:1'],
                'kerusakan_panjang.*' => ['required', 'numeric', 'min:0', 'max:999999.99'],
                'kerusakan_lebar' => ['required', 'array', 'min:1'],
                'kerusakan_lebar.*' => ['required', 'numeric', 'min:0', 'max:999999.99'],
                'catatan' => ['nullable', 'string', 'max:1000'],
                'duplicate_of_id' => ['nullable', 'string', 'exists:reports,id'],
                'survey_task_id' => ['nullable', 'string', 'exists:survey_tasks,id'],
                'files' => 'required|array|min:1',
                'files.*' => 'required|file|mimes:jpeg,jpg,png|max:5120',
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Data yang dikirim tidak valid.',
                'errors' => $e->errors(),
            ], 422);
        }

        $analyses = json_decode($validated['analyses'], true);

        if (! is_array($analyses) || count($analyses) === 0) {
            return response()->json([
                'success' => false,
                'message' => 'Data analyses tidak valid atau kosong.',
            ], 422);
        }

        // ── Validasi koordinat berada di wilayah Sidoarjo ─────────────────
        if (! $this->isInSidoarjo((float) $validated['latitude'], (float) $validated['longitude'])) {
            return response()->json([
                'success' => false,
                'message' => 'Koordinat berada di luar wilayah Kabupaten Sidoarjo.',
                'error_code' => 'KOORDINAT_DILUAR_WILAYAH',
            ], 422);
        }

        // ── Validasi nama jalan vs koordinat (tidak bisa di-bypass dari frontend) ──
        $roadValidation = $this->validateRoadNameVsCoordinate(
            $validated['road_name'],
            (float) $validated['latitude'],
            (float) $validated['longitude']
        );
        $batchFullAddress = $roadValidation['full_address'] ?? null;

        // ── Deteksi EXIF cloning ──────────────────────────────────────────
        // Jika >80% foto dalam batch memiliki koordinat GPS EXIF yang identik,
        // ini indikasi EXIF di-clone dari satu foto ke foto lainnya.
        $exifCloneSuspected = false;
        $exifCoords = [];
        foreach ($analyses as $a) {
            if (! empty($a['has_exif_gps']) && isset($a['exif_lat'], $a['exif_lng'])) {
                $key = round((float) $a['exif_lat'], 4).','.round((float) $a['exif_lng'], 4);
                $exifCoords[$key] = ($exifCoords[$key] ?? 0) + 1;
            }
        }
        $photosWithExif = count($analyses) - count(array_filter($analyses, fn ($a) => empty($a['has_exif_gps'])));
        if ($photosWithExif >= 3 && count($exifCoords) === 1) {
            $exifCloneSuspected = true;
        } elseif ($photosWithExif >= 5) {
            $maxSame = max($exifCoords);
            if ($maxSame >= $photosWithExif * 0.8) {
                $exifCloneSuspected = true;
            }
        }

        // ── TRUST SCORE [NONAKTIF] — kalkulasi trust score batch dihapus
        // Catat EXIF cloning di system notes main report nanti
        $batchNotes = null;
        if ($exifCloneSuspected) {
            $batchNotes = '[PERINGATAN] Terdeteksi '.$photosWithExif.' foto dengan koordinat GPS EXIF identik — kemungkinan EXIF di-clone.';
        }

        // ── Pre-calculate hashes + batch duplicate check (1 query instead of N) ──
        $imageHashes = [];
        foreach ($request->file('files') as $idx => $file) {
            $hash = $this->calculateImageHash($file->getPathname());
            if ($hash) {
                $imageHashes[$idx] = $hash;
            }
        }
        $existingHashes = [];
        if (config('app.dedup_enabled') && ! empty($imageHashes)) {
            $existingHashes = array_unique(array_merge(
                Report::whereIn('image_hash', $imageHashes)->pluck('image_hash')->toArray(),
                ReportPhoto::whereIn('image_hash', $imageHashes)->pluck('image_hash')->toArray()
            ));
        }

        $duplicateOfId = $request->input('duplicate_of_id');

        try {
            $result = DB::transaction(function () use ($validated, $analyses, $request, $batchNotes, $imageHashes, $existingHashes, $duplicateOfId, $batchFullAddress) {
                $severities = array_column($analyses, 'severity');
                $aggSeverity = $this->aggregateSeverity($severities);
                $severityMap = [
                    'berat' => 'Rusak Berat',
                    'sedang' => 'Rusak Sedang',
                    'ringan' => 'Rusak Ringan',
                    'baik' => 'Baik',
                ];
                $mainReport = Report::create([
                    'user_id' => auth()->id(),
                    'report_code' => $this->generateReportCode(),
                    'reporter_name' => auth()->user()->name ?? 'Petugas',
                    'road_name' => $validated['road_name'],
                    'district' => $validated['district'],
                    'latitude' => $validated['latitude'],
                    'longitude' => $validated['longitude'],
                    'koordinat_sumber' => $validated['koordinat_sumber'],
                    'status' => 'Menunggu Review',
                    'batch_id' => $validated['batch_id'],
                    // ── TRUST SCORE [NONAKTIF] — trust_score, trust_label, trust_breakdown dihapus dari batch create
                    'overall_severity' => $severityMap[$aggSeverity] ?? 'Baik',
                    'ai_severity' => $aggSeverity,
                    'system_notes' => $batchNotes,
                    'kerusakan_panjang' => array_sum($validated['kerusakan_panjang']),
                    'kerusakan_lebar' => array_sum($validated['kerusakan_lebar']),
                    'catatan_petugas' => $validated['catatan'] ?? null,
                    'survey_task_id' => $validated['survey_task_id'] ?? null,
                    'priority' => 'Sedang',
                    'full_address' => $batchFullAddress,
                    'deadline_review' => Report::hitungDeadlineReview('Sedang'),
                ]);

                $photosCreated = 0;
                $duplicatesSkipped = 0;
                $duplicatePhotoList = [];
                foreach ($analyses as $idx => $analysis) {
                    if (! empty($analysis['exif_invalid'])) {
                        Log::info('DeltaJalan: Foto batch dilewati karena EXIF tidak valid.', [
                            'file_index' => $idx,
                            'file_name' => $analysis['file_name'] ?? '',
                            'exif_reason' => $analysis['exif_reason'] ?? '',
                        ]);

                        continue;
                    }

                    $file = $request->file('files')[$idx] ?? null;

                    if (! $file) {
                        Log::warning('DeltaJalan: File tidak ditemukan di request batch.', [
                            'file_index' => $idx,
                            'file_name' => $analysis['file_name'] ?? '',
                        ]);

                        continue;
                    }

                    $photoPath = null;
                    $resultPath = null;
                    $imageHash = $imageHashes[$idx] ?? null;

                    $photoLat = (float) ($analysis['photo_lat'] ?? $validated['latitude']);
                    $photoLng = (float) ($analysis['photo_lng'] ?? $validated['longitude']);
                    $koordinatSumber = $analysis['koordinat_sumber'] ?? $validated['koordinat_sumber'];

                    if ($file) {
                        if ($imageHash && in_array($imageHash, $existingHashes)) {
                            Log::info('DeltaJalan: Foto duplikat dilewati dalam batch.', [
                                'file_index' => $idx,
                                'file_name' => $analysis['file_name'] ?? '',
                                'hash' => $imageHash,
                            ]);
                            $duplicatesSkipped++;
                            $duplicatePhotoList[] = [
                                'file_index' => $idx,
                                'file_name' => $analysis['file_name'] ?? '',
                            ];

                            continue;
                        }

                        $ext = $file->getClientOriginalExtension() ?: $file->guessExtension() ?: 'jpg';
                        $filename = Str::uuid().'-batch-'.time().'.'.$ext;
                        $photoPath = $this->savePhotoToStorage($file, $filename);

                        if (! $photoPath) {
                            Log::error('DeltaJalan: Gagal menyimpan foto batch.', [
                                'file_index' => $idx,
                                'file_name' => $analysis['file_name'] ?? '',
                            ]);

                            continue;
                        }
                    }

                    if (! empty($analysis['image_result'])) {
                        $resultPath = $this->saveBase64Image(
                            $analysis['image_result'],
                            self::RESULTS_FOLDER
                        );
                    }

                    // ── TRUST SCORE [NONAKTIF] — per-photo trust score dihapus
                    $subNotes = null;
                    if (! empty($analysis['gps_mismatch'])) {
                        $dist = round($analysis['gps_distance_meters'] ?? 0);
                        $subNotes = "[PERINGATAN] GPS EXIF foto berjarak {$dist}m dari koordinat yang diinput. Perlu verifikasi.";
                    } elseif (empty($analysis['has_exif_gps'])) {
                        $subNotes = '[INFO] Foto tidak memiliki GPS EXIF. Koordinat dari input form.';
                    }

                    ReportPhoto::create([
                        'report_id' => $mainReport->id,
                        'image_original_path' => $photoPath,
                        'image_result_path' => $resultPath,
                        'image_hash' => $imageHash,
                        'latitude' => $photoLat,
                        'longitude' => $photoLng,
                        'koordinat_sumber' => $koordinatSumber,
                        'ai_jenis_kerusakan' => $analysis['detections'][0]['type'] ?? null,
                        'ai_severity' => $analysis['severity'] ?? 'ringan',
                        'ai_confidence' => $analysis['confidence'] ?? null,
                        'total_detections' => count($analysis['detections'] ?? []),
                        'ai_raw_output' => ! empty($analysis['detections'])
                            ? $analysis['detections']
                            : null,
                        'kerusakan_panjang' => $validated['kerusakan_panjang'][$idx] ?? null,
                        'kerusakan_lebar' => $validated['kerusakan_lebar'][$idx] ?? null,
                        'system_notes' => $subNotes,
                        'sort_order' => $idx,
                        'original_filename' => $analysis['file_name'] ?? null,
                        'photo_taken_at' => $analysis['exif_photo_date'] ?? null,
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
                    $mainReport->update(['system_notes' => ($mainReport->system_notes ? $mainReport->system_notes.' | ' : '').'[INFO] '.$duplicatesSkipped.' foto dilewati karena sudah digunakan pada laporan lain.']);
                }

                // Simpan relasi duplikasi jika ada
                if ($duplicateOfId) {
                    ReportDuplicate::create([
                        'report_id' => $mainReport->id,
                        'duplicate_of_id' => $duplicateOfId,
                        'score' => 0.900,
                        'match_type' => 'user_confirmed',
                    ]);
                }

                return [
                    'main_report' => $mainReport,
                    'photos_count' => $photosCreated,
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
                'debug' => config('app.debug') ? $e->getMessage() : null,
            ], 500);
        }

        $mainReport = $result['main_report'];

        $reporterName = $mainReport->reporter_name;
        $dailyCount = Report::where('reporter_name', $reporterName)
            ->whereDate('created_at', today())
            ->count();
        Log::info('DeltaJalan: Laporan batch berhasil disimpan.', [
            'batch_id' => $validated['batch_id'],
            'main_report_code' => $mainReport->report_code,
            'photos_count' => $result['photos_count'],
            // ── TRUST SCORE [NONAKTIF] — trust_score, trust_label dihapus dari batch log
            'reporter_name' => $reporterName,
            'daily_count' => $dailyCount,
            'exif_clone_suspect' => $exifCloneSuspected,
        ]);

        return response()->json([
            'success' => true,
            'main_report_id' => $mainReport->id,
            'main_report_code' => $mainReport->report_code,
            'photos_count' => $result['photos_count'],
            // ── TRUST SCORE [NONAKTIF] — trust_score, trust_label dihapus dari batch response
            'overall_severity' => $mainReport->ai_severity,
            'road_matched' => $roadValidation['matched'],
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
        $user = auth()->user();

        $cacheKey = 'stats_'.($user->role ?? 'guest').'_'.($user->id ?? '0');
        $cacheTTL = 60; // seconds

        $stats = Cache::remember($cacheKey, $cacheTTL, function () use ($user) {
            $query = Report::query();

            if ($user->role === 'petugas') {
                $query->where('user_id', $user->id);
            }

            if ($user->role === 'supervisor') {
                $query->where('assigned_supervisor_id', $user->id);
            }

            // ── TRUST SCORE [NONAKTIF] — trust_hijau, trust_kuning, trust_merah dihapus dari stats SQL
            // Single grouped query replacing 12 individual COUNTs
            $agg = (clone $query)->selectRaw("
                COUNT(*) as total,
                SUM(CASE WHEN status IN ('Menunggu Review', 'Ditinjau') THEN 1 ELSE 0 END) as menunggu_review,
                SUM(CASE WHEN status = 'Disetujui' THEN 1 ELSE 0 END) as disetujui,
                SUM(CASE WHEN status = 'Ditolak' THEN 1 ELSE 0 END) as ditolak,
                SUM(CASE WHEN status = 'Hasil AI' THEN 1 ELSE 0 END) as hasil_ai,
                SUM(CASE WHEN status = 'Ditugaskan' THEN 1 ELSE 0 END) as ditugaskan,
                SUM(CASE WHEN status = 'Sedang Diperbaiki' THEN 1 ELSE 0 END) as sedang_diperbaiki,
                SUM(CASE WHEN status = 'Selesai' THEN 1 ELSE 0 END) as selesai,
                SUM(CASE WHEN overall_severity::text = 'Rusak Berat' OR LOWER(ai_severity) = 'berat' THEN 1 ELSE 0 END) as rusak_berat,
                SUM(CASE WHEN overall_severity::text = 'Rusak Sedang' OR LOWER(ai_severity) = 'sedang' THEN 1 ELSE 0 END) as rusak_sedang,
                SUM(CASE WHEN overall_severity::text = 'Rusak Ringan' OR LOWER(ai_severity) = 'ringan' THEN 1 ELSE 0 END) as rusak_ringan
            ")->first();

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
                $monthlyQuery->when($user->team_id, fn ($q) => $q->where('assigned_team_id', $user->team_id))
                    ->unless($user->team_id, fn ($q) => $q->whereRaw('1 = 0'));
            }

            if ($user->role === 'supervisor') {
                $monthlyQuery->where('assigned_supervisor_id', $user->id);
            }

            $monthlyTrend = $monthlyQuery
                ->groupBy('bulan')
                ->orderBy('bulan')
                ->get()
                ->keyBy('bulan');

            $trend = [];
            for ($i = 5; $i >= 0; $i--) {
                $bulan = now()->subMonths($i)->format('Y-m');
                $row = $monthlyTrend->get($bulan);
                $trend[] = [
                    'bulan' => $bulan,
                    'total' => (int) ($row->total ?? 0),
                    'selesai' => (int) ($row->selesai ?? 0),
                    'rusak_berat' => (int) ($row->rusak_berat ?? 0),
                ];
            }

            return [
                'total' => (int) $agg->total,
                'menunggu_review' => (int) $agg->menunggu_review,

                'disetujui' => (int) $agg->disetujui,
                'ditolak' => (int) $agg->ditolak,
                'hasil_ai' => (int) $agg->hasil_ai,
                'ditugaskan' => (int) $agg->ditugaskan,
                'sedang_diperbaiki' => (int) $agg->sedang_diperbaiki,
                'selesai' => (int) $agg->selesai,
                // ── TRUST SCORE [NONAKTIF] — trust_hijau, trust_kuning, trust_merah dihapus dari stats response
                'rusak_berat' => (int) $agg->rusak_berat,
                'rusak_sedang' => (int) $agg->rusak_sedang,
                'rusak_ringan' => (int) $agg->rusak_ringan,
                'monthly_trend' => $trend,
            ];
        });

        return response()->json([
            'success' => true,
            'data' => $stats,
        ]);
    }

    /**
     * POST /api/reports/{id}/approve
     * Supervisor menyetujui laporan — ubah status jadi "Disetujui".
     */
    public function approve(Request $request, string $id): JsonResponse
    {
        $report = Report::find($id);
        if (! $report) {
            return response()->json(['success' => false, 'message' => 'Laporan tidak ditemukan.'], 404);
        }

        $allowedStatuses = ['Menunggu Review', 'Ditinjau'];

        if (! in_array($report->status, $allowedStatuses)) {
            return response()->json([
                'success' => false,
                'message' => "Laporan dengan status \"{$report->status}\" tidak dapat disetujui.",
            ], 422);
        }

        $priority = $request->input('priority');
        if ($priority && ! in_array($priority, Report::PRIORITY_VALUES, true)) {
            $priority = null;
        }

        $now = now();
        $finalPriority = $priority ?? $report->priority;

        if (in_array($report->source, ['warga', 'telegram'])) {
            // Warga/Telegram: set status Hasil AI + dispatch AI analysis.
            // Team assignment happens at confirmation step (confirmAiResult).
            $report->update([
                'status' => 'Hasil AI',
                'priority' => $finalPriority,
                'system_notes' => $report->system_notes
                    ? $report->system_notes.' | [APPROVED] Disetujui oleh '.auth()->user()->name
                    : '[APPROVED] Disetujui oleh '.auth()->user()->name,
            ]);

            Log::info('DeltaJalan: Laporan warga/telegram disetujui, AI analysis dimulai.', [
                'report_id' => $report->id,
                'report_code' => $report->report_code,
                'approved_by' => auth()->user()->name,
            ]);

            // Notifikasi ke pelapor
            $reporter = User::find($report->user_id);
            if ($reporter) {
                $reporter->notify(new ReportApprovedNotification($report, auth()->user()->name));
            }

            // AI analysis dilakukan foreground dari frontend via /analyze-ai
            return response()->json([
                'success' => true,
                'message' => 'Laporan disetujui. Analisis AI sedang berjalan.',
                'data' => [
                    'status' => 'Hasil AI',
                ],
            ]);
        }

        // Petugas: auto-assign tim pelapor
        $reporter = User::find($report->user_id);
        if (! $reporter || ! $reporter->team_id) {
            return response()->json([
                'success' => false,
                'message' => 'Pelapor tidak memiliki tim. Tidak dapat menugaskan laporan.',
            ], 422);
        }

        $report->update([
            'status' => 'Ditugaskan',
            'priority' => $finalPriority,
            'assigned_team_id' => $reporter->team_id,
            'assigned_at' => $now,
            'ditugaskan_at' => $now,
            'system_notes' => $report->system_notes
                ? $report->system_notes.' | [APPROVED] Disetujui oleh '.auth()->user()->name
                : '[APPROVED] Disetujui oleh '.auth()->user()->name,
        ]);

        Log::info('DeltaJalan: Laporan disetujui & ditugaskan.', [
            'report_id' => $report->id,
            'report_code' => $report->report_code,
            'approved_by' => auth()->user()->name,
            'assigned_team_id' => $reporter->team_id,
        ]);

        // Notifikasi ke pelapor
        if ($reporter) {
            $reporter->notify(new ReportApprovedNotification($report, auth()->user()->name));
        }

        // Notifikasi ke anggota tim lain
        $tim = User::where('role', 'petugas')
            ->where('team_id', $reporter->team_id)
            ->where('id', '!=', $reporter->id)
            ->get();
        foreach ($tim as $anggota) {
            $anggota->notify(new TeamAssignedNotification($report, auth()->user()->name, $reporter->team?->name ?? 'Tim'));
        }

        return response()->json([
            'success' => true,
            'message' => 'Laporan berhasil disetujui dan ditugaskan ke tim pelapor.',
            'data' => [
                'status' => $report->status,
                'assigned_team_id' => $reporter->team_id,
            ],
        ]);
    }

    /**
     * POST /api/reports/{id}/analyze-ai
     * Analisis AI foreground untuk laporan warga/telegram.
     * Memanggil FastAPI secara sinkron dan langsung menyimpan hasilnya.
     */
    public function analyzeReport(Request $request, string $id): JsonResponse
    {
        $report = Report::find($id);
        if (! $report) {
            return response()->json(['success' => false, 'message' => 'Laporan tidak ditemukan.'], 404);
        }

        if ($report->status !== 'Hasil AI') {
            return response()->json([
                'success' => false,
                'message' => "Laporan dengan status \"{$report->status}\" tidak dapat dianalisis.",
            ], 422);
        }

        $photo = $report->photos()->orderBy('id')->first();
        if (! $photo || ! $photo->image_original_path) {
            return response()->json([
                'success' => false,
                'message' => 'Tidak ada foto untuk dianalisis.',
            ], 422);
        }

        $fullPath = Storage::disk('public')->path($photo->image_original_path);
        if (! file_exists($fullPath)) {
            return response()->json([
                'success' => false,
                'message' => 'File foto tidak ditemukan di storage.',
            ], 422);
        }

        $result = $this->callFastApiAnalyze($fullPath, $photo->image_original_name ?? 'photo.jpg');
        if (! $result['success']) {
            return response()->json([
                'success' => false,
                'message' => 'Analisis AI gagal: '.($result['error'] ?? 'Unknown error'),
            ], 502);
        }

        $aiData = $result['data'];

        // Simpan gambar hasil deteksi (bounding box)
        $resultPath = null;
        if (! empty($aiData['image_result'])) {
            $resultPath = $this->saveBase64Image($aiData['image_result'], 'reports/results');
        }

        $report->update([
            'ai_jenis_kerusakan' => $aiData['detection_type'] ?? $aiData['overall_severity'],
            'ai_severity' => $aiData['overall_severity'],
            'overall_severity' => $aiData['overall_severity'],
            'ai_confidence' => $aiData['confidence'] ?? $aiData['max_confidence'] ?? null,
            'total_detections' => $aiData['total'] ?? 0,
            'ai_raw_output' => $aiData['detections'] ?? $aiData,
            'image_result_path' => $resultPath ?? $report->image_result_path,
        ]);

        $photo->update([
            'ai_jenis_kerusakan' => $aiData['detection_type'] ?? $aiData['overall_severity'],
            'ai_severity' => $aiData['overall_severity'],
            'ai_confidence' => $aiData['confidence'] ?? $aiData['max_confidence'] ?? null,
            'total_detections' => $aiData['total'] ?? 0,
            'ai_raw_output' => $aiData['detections'] ?? $aiData,
            'image_result_path' => $resultPath ?? $photo->image_result_path,
        ]);

        Log::info('DeltaJalan: Analisis AI laporan selesai (foreground).', [
            'report_id' => $report->id,
            'report_code' => $report->report_code,
            'severity' => $aiData['overall_severity'],
        ]);

        // ── Hitung PCI ──
        $pci = app(PciService::class)->calculateFromReport($report);
        if ($pci !== null) {
            $report->pci_score = $pci;
            $report->pci_calculated_at = now();
            $report->saveQuietly();
        }

        return response()->json([
            'success' => true,
            'message' => 'Analisis AI selesai.',
            'data' => $aiData,
        ]);
    }

    /**
     * POST /api/reports/{id}/confirm-ai
     * Supervisor mengonfirmasi hasil AI dan menugaskan tim satgas (auto-resolve by district).
     * Hanya untuk laporan dengan status "Hasil AI".
     */
    public function confirmAiResult(Request $request, string $id): JsonResponse
    {
        $report = Report::find($id);
        if (! $report) {
            return response()->json(['success' => false, 'message' => 'Laporan tidak ditemukan.'], 404);
        }

        if ($report->status !== 'Hasil AI') {
            return response()->json([
                'success' => false,
                'message' => "Laporan dengan status \"{$report->status}\" tidak dapat dikonfirmasi.",
            ], 422);
        }

        $now = now();

        // Auto-resolve team by district
        $teamId = Uptd::resolveTeamIdByDistrict($report->district);
        if (! $teamId) {
            return response()->json([
                'success' => false,
                'message' => 'Tidak dapat menentukan tim satgas untuk kecamatan "'.$report->district.'".',
            ], 422);
        }

        $team = Team::find($teamId);
        if (! $team) {
            return response()->json([
                'success' => false,
                'message' => 'Tim satgas tidak ditemukan.',
            ], 422);
        }

        $report->update([
            'status' => 'Ditugaskan',
            'assigned_team_id' => $team->id,
            'assigned_at' => $now,
            'ditugaskan_at' => $now,
            'system_notes' => $report->system_notes
                ? $report->system_notes.' | [CONFIRMED] Dikonfirmasi oleh '.auth()->user()->name
                : '[CONFIRMED] Dikonfirmasi oleh '.auth()->user()->name,
        ]);

        Log::info('DeltaJalan: Laporan warga/telegram dikonfirmasi & ditugaskan.', [
            'report_id' => $report->id,
            'report_code' => $report->report_code,
            'confirmed_by' => auth()->user()->name,
            'assigned_team_id' => $team->id,
        ]);

        // Notifikasi ke pelapor
        $reporter = User::find($report->user_id);
        if ($reporter) {
            $reporter->notify(new ReportApprovedNotification($report, auth()->user()->name));
        }

        // Notifikasi ke anggota tim
        $tim = User::where('role', 'petugas')
            ->where('team_id', $team->id)
            ->get();
        foreach ($tim as $anggota) {
            $anggota->notify(new TeamAssignedNotification($report, auth()->user()->name, $team->name));
        }

        return response()->json([
            'success' => true,
            'message' => 'Laporan berhasil dikonfirmasi dan ditugaskan ke tim satgas.',
            'data' => [
                'status' => $report->status,
                'assigned_team_id' => $team->id,
            ],
        ]);
    }

    /**
     * POST /api/reports/{id}/approve-and-assign
     * Supervisor menyetujui laporan warga/telegram + AI analysis + auto-assign tim dalam satu langkah.
     * Endpoint pengganti approve → analyze-ai → confirm-ai (3 langkah dikompres jadi 1).
     */
    public function approveAndAssign(Request $request, string $id): JsonResponse
    {
        $report = Report::find($id);
        if (! $report) {
            return response()->json(['success' => false, 'message' => 'Laporan tidak ditemukan.'], 404);
        }

        if (! in_array($report->source, ['warga', 'telegram'])) {
            return response()->json([
                'success' => false,
                'message' => 'Endpoint ini hanya untuk laporan warga/telegram.',
            ], 422);
        }

        if (! in_array($report->status, ['Menunggu Review', 'Ditinjau'])) {
            return response()->json([
                'success' => false,
                'message' => "Laporan dengan status \"{$report->status}\" tidak dapat diproses.",
            ], 422);
        }

        $priority = $request->input('priority');
        if ($priority && ! in_array($priority, Report::PRIORITY_VALUES, true)) {
            $priority = null;
        }
        $finalPriority = $priority ?? $report->priority;
        $now = now();

        // Step 1: AI Analysis — panggil FastAPI sinkron
        $photo = $report->photos()->orderBy('id')->first();
        if (! $photo || ! $photo->image_original_path) {
            return response()->json([
                'success' => false,
                'message' => 'Tidak ada foto untuk dianalisis.',
            ], 422);
        }

        $fullPath = Storage::disk('public')->path($photo->image_original_path);
        if (! file_exists($fullPath)) {
            return response()->json([
                'success' => false,
                'message' => 'File foto tidak ditemukan di storage.',
            ], 422);
        }

        $result = $this->callFastApiAnalyze($fullPath, $photo->image_original_name ?? 'photo.jpg');
        if (! $result['success']) {
            return response()->json([
                'success' => false,
                'message' => 'Analisis AI gagal: '.($result['error'] ?? 'Unknown error'),
            ], 502);
        }

        $aiData = $result['data'];

        // Simpan gambar hasil deteksi (bounding box)
        $resultPath = null;
        if (! empty($aiData['image_result'])) {
            $resultPath = $this->saveBase64Image($aiData['image_result'], 'reports/results');
        }

        // Step 2: Resolve tim — auto by district atau manual dari request
        $assignedTeamId = $request->input('assigned_team_id');
        if (! $assignedTeamId) {
            $assignedTeamId = Uptd::resolveTeamIdByDistrict($report->district);
        }

        if (! $assignedTeamId) {
            return response()->json([
                'success' => false,
                'needs_team' => true,
                'message' => 'Tidak dapat menentukan tim satgas untuk kecamatan "'.$report->district.'". Silakan pilih tim secara manual.',
            ], 422);
        }

        $team = Team::find($assignedTeamId);
        if (! $team) {
            return response()->json([
                'success' => false,
                'message' => 'Tim satgas tidak ditemukan.',
            ], 422);
        }

        // Step 3: Update report — status → Ditugaskan, simpan AI result + team
        $report->update([
            'status' => 'Ditugaskan',
            'priority' => $finalPriority,
            'assigned_team_id' => $team->id,
            'assigned_at' => $now,
            'ditugaskan_at' => $now,
            'overall_severity' => $aiData['overall_severity'],
            'total_detections' => $aiData['total'] ?? 0,
            'ai_raw_output' => $aiData['detections'] ?? $aiData,
            'image_result_path' => $resultPath ?? $report->image_result_path,
            'ai_jenis_kerusakan' => $aiData['detection_type'] ?? $aiData['overall_severity'],
            'ai_severity' => $aiData['overall_severity'],
            'ai_confidence' => $aiData['confidence'] ?? $aiData['max_confidence'] ?? null,
            'ai_analyzed_at' => $now,
            'system_notes' => $report->system_notes
                ? $report->system_notes.' | [APPROVED] Disetujui oleh '.auth()->user()->name
                : '[APPROVED] Disetujui oleh '.auth()->user()->name,
        ]);
        $report->increment('ai_analysis_count');

        // Update photo dengan data AI
        $photo->update([
            'ai_jenis_kerusakan' => $aiData['detection_type'] ?? $aiData['overall_severity'],
            'ai_severity' => $aiData['overall_severity'],
            'ai_confidence' => $aiData['confidence'] ?? $aiData['max_confidence'] ?? null,
            'total_detections' => $aiData['total'] ?? 0,
            'ai_raw_output' => $aiData['detections'] ?? $aiData,
            'image_result_path' => $resultPath ?? $photo->image_result_path,
            'ai_analyzed_at' => $now,
        ]);
        $photo->increment('ai_analysis_count');

        Log::info('DeltaJalan: Laporan warga/telegram disetujui & ditugaskan (approve-and-assign).', [
            'report_id' => $report->id,
            'report_code' => $report->report_code,
            'approved_by' => auth()->user()->name,
            'assigned_team_id' => $team->id,
            'severity' => $aiData['overall_severity'],
        ]);

        // ── Hitung PCI ──
        $pci = app(PciService::class)->calculateFromReport($report);
        if ($pci !== null) {
            $report->pci_score = $pci;
            $report->pci_calculated_at = now();
            $report->saveQuietly();
        }

        // Notifikasi ke pelapor
        $reporter = User::find($report->user_id);
        if ($reporter) {
            $reporter->notify(new ReportApprovedNotification($report, auth()->user()->name));
        }

        // Notifikasi ke anggota tim
        $tim = User::where('role', 'petugas')
            ->where('team_id', $team->id)
            ->get();
        foreach ($tim as $anggota) {
            $anggota->notify(new TeamAssignedNotification($report, auth()->user()->name, $team->name));
        }

        return response()->json([
            'success' => true,
            'message' => 'Laporan berhasil disetujui, dianalisis, dan ditugaskan ke tim satgas.',
            'data' => [
                'status' => $report->status,
                'assigned_team_id' => $team->id,
                'overall_severity' => $aiData['overall_severity'],
            ],
        ]);
    }

    /**
     * POST /api/reports/{id}/tolak
     * Supervisor menolak laporan dengan alasan.
     */
    public function tolak(Request $request, string $id): JsonResponse
    {
        $report = Report::find($id);
        if (! $report) {
            return response()->json(['success' => false, 'message' => 'Laporan tidak ditemukan.'], 404);
        }

        if (! in_array($report->status, ['Menunggu Review', 'Ditinjau'])) {
            return response()->json([
                'success' => false,
                'message' => "Laporan dengan status \"{$report->status}\" tidak dapat ditolak.",
            ], 422);
        }

        $validated = $request->validate([
            'alasan' => 'required|string|max:100',
            'catatan' => 'nullable|string|max:500',
        ]);

        $alasan = $validated['alasan'];
        $catatan = $validated['catatan'] ?? '-';

        $report->update([
            'status' => 'Ditolak',
            'system_notes' => $report->system_notes
                ? $report->system_notes.' | [REJECTED] Ditolak oleh '.auth()->user()->name." (alasan: {$alasan}, catatan: {$catatan})"
                : '[REJECTED] Ditolak oleh '.auth()->user()->name." (alasan: {$alasan}, catatan: {$catatan})",
        ]);

        Log::info('DeltaJalan: Laporan ditolak.', [
            'report_id' => $report->id,
            'report_code' => $report->report_code,
            'alasan' => $alasan,
            'catatan' => $catatan,
            'rejected_by' => auth()->user()->name,
        ]);

        // Notifikasi ke pelapor (by user_id — works for both petugas and warga)
        $reporter = User::find($report->user_id);
        if ($reporter) {
            $reporter->notify(new ReportRejectedNotification($report, auth()->user()->name, $alasan));
        }

        return response()->json([
            'success' => true,
            'message' => 'Laporan berhasil ditolak.',
            'data' => ['status' => $report->status],
        ]);
    }

    /**
     * POST /api/reports/{id}/disposisi
     * Supervisor mendisposisi laporan untuk dikerjakan — "Sedang Diperbaiki".
     *
     * @deprecated Gunakan assign() → mulai() workflow untuk akuntabilitas lebih baik.
     */
    public function disposisi(Request $request, string $id): JsonResponse
    {
        $report = Report::find($id);
        if (! $report) {
            return response()->json(['success' => false, 'message' => 'Laporan tidak ditemukan.'], 404);
        }

        $allowedStatuses = ['Disetujui', 'Ditugaskan'];
        if (! in_array($report->status, $allowedStatuses)) {
            return response()->json([
                'success' => false,
                'message' => "Hanya laporan dengan status \"Disetujui\" atau \"Ditugaskan\" yang bisa didisposisi. Status saat ini: \"{$report->status}\".",
            ], 422);
        }

        Log::warning('DeltaJalan: disposisi() deprecated dipanggil.', [
            'report_id' => $report->id,
            'report_code' => $report->report_code,
            'by' => auth()->user()->name,
        ]);

        $report->update([
            'status' => 'Sedang Diperbaiki',
            'perbaikan_dimulai_at' => now(),
            'system_notes' => $report->system_notes
                ? $report->system_notes.' | [DISPOSISI] Didisposisi oleh '.auth()->user()->name
                : '[DISPOSISI] Didisposisi oleh '.auth()->user()->name,
        ]);

        Log::info('DeltaJalan: Laporan didisposisi.', [
            'report_id' => $report->id,
            'report_code' => $report->report_code,
            'disposisi_by' => auth()->user()->name,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Laporan berhasil didisposisi.',
            'data' => ['status' => $report->status],
        ]);
    }

    // ── Closing & Assignment ──────────────────────────────────────────────

    /**
     * POST /api/reports/{id}/mulai
     * Satgas memulai perbaikan — status "Ditugaskan" → "Sedang Diperbaiki".
     */
    public function mulai(Request $request, string $id): JsonResponse
    {
        $report = Report::find($id);
        if (! $report) {
            return response()->json(['success' => false, 'message' => 'Laporan tidak ditemukan.'], 404);
        }

        if ($report->status !== 'Ditugaskan') {
            return response()->json([
                'success' => false,
                'message' => "Hanya laporan Ditugaskan yang bisa dimulai. Status saat ini: \"{$report->status}\".",
            ], 422);
        }

        $user = auth()->user();
        if ($user->role === 'petugas') {
            if (! $user->team_id || $report->assigned_team_id !== $user->team_id) {
                return response()->json([
                    'success' => false,
                    'message' => 'Anda tidak memiliki akses untuk memulai laporan ini.',
                ], 403);
            }
        }

        $validated = $request->validate([
            'catatan' => 'nullable|string|max:500',
            'estimasi_selesai_hari' => 'nullable|integer|min:1|max:90',
        ]);

        $estimasiHari = $validated['estimasi_selesai_hari'];

        if ($estimasiHari !== null) {
            $deadline = now()->copy()->addHours((int) $estimasiHari * 24);
        } else {
            $endOfDay = now()->copy()->endOfDay();
            $deadline = now()->diffInHours($endOfDay) >= 8
                ? $endOfDay
                : now()->copy()->addHours(24);
        }

        $report->update([
            'status' => 'Sedang Diperbaiki',
            'perbaikan_dimulai_at' => now(),
            'estimasi_hari' => $estimasiHari,
            'deadline_resolusi' => $deadline,
            'terlambat_resolusi' => false,
            'catatan_petugas' => $validated['catatan'] ?? $report->catatan_petugas,
            'system_notes' => $report->system_notes
                ? $report->system_notes.' | [MULAI] Perbaikan dimulai oleh '.$user->name
                : '[MULAI] Perbaikan dimulai oleh '.$user->name,
        ]);

        Log::info('DeltaJalan: Perbaikan dimulai.', [
            'report_id' => $report->id,
            'report_code' => $report->report_code,
            'mulai_by' => $user->name,
        ]);

        // Notifikasi supervisor bahwa perbaikan telah dimulai
        try {
            $supervisors = User::where('role', 'supervisor')->get();
            foreach ($supervisors as $supervisor) {
                $supervisor->notify(new RepairStartedNotification($report, $user->name));
            }
        } catch (\Throwable $e) {
            Log::warning('Gagal mengirim notifikasi mulai ke supervisor: '.$e->getMessage());
        }

        return response()->json([
            'success' => true,
            'message' => 'Perbaikan telah dimulai.',
            'data' => ['status' => $report->status],
        ]);
    }

    /**
     * POST /api/reports/{id}/complete
     * Menyelesaikan laporan dengan foto after perbaikan.
     */
    public function complete(Request $request, string $id): JsonResponse
    {
        $report = Report::find($id);
        if (! $report) {
            return response()->json(['success' => false, 'message' => 'Laporan tidak ditemukan.'], 404);
        }

        if ($report->status !== 'Sedang Diperbaiki') {
            return response()->json([
                'success' => false,
                'message' => "Hanya laporan Sedang Diperbaiki yang bisa diselesaikan. Status saat ini: \"{$report->status}\".",
            ], 422);
        }

        $user = auth()->user();
        if ($user->role === 'petugas') {
            // Auto-resolve untuk laporan lama yang assigned_team_id-nya null
            if (! $report->assigned_team_id) {
                $resolvedId = $report->assigned_team_id ?? $report->user?->team_id;
                if ($resolvedId) {
                    $report->update(['assigned_team_id' => $resolvedId]);
                }
            }

            if (! $user->team_id || $report->assigned_team_id !== $user->team_id) {
                return response()->json([
                    'success' => false,
                    'message' => 'Anda tidak memiliki akses untuk menyelesaikan laporan ini.',
                ], 403);
            }
        }

        $validated = $request->validate([
            'after_photo' => 'required|array|min:1',
            'after_photo.*' => 'required|image|mimes:jpeg,jpg,png|max:5120',
            'catatan' => 'nullable|string|max:1000',
        ]);

        try {
            $folder = 'reports/after';
            $firstPath = null;

            foreach ($validated['after_photo'] as $i => $file) {
                $hash = hash_file('sha256', $file->getRealPath());

                // Cek duplikasi (bandingkan dengan hash di tabel report_after_photos)
                $existingAfter = ReportAfterPhoto::where('file_hash', $hash)->first();
                if ($existingAfter) {
                    Log::warning('DeltaJalan: Foto after duplikat.', [
                        'report_id' => $report->id,
                        'existing_id' => $existingAfter->report_id,
                        'hash' => $hash,
                    ]);
                }

                $ext = $file->getClientOriginalExtension() ?: $file->guessExtension() ?: 'jpg';
                $filename = $report->id.'_after_'.time().'_'.$i.'.'.$ext;
                $path = $file->storeAs($folder, $filename, 'public');

                if ($i === 0) {
                    $firstPath = $path;
                }

                $report->afterPhotos()->create([
                    'file_path' => $path,
                    'file_hash' => $hash,
                    'sort_order' => $i,
                ]);
            }

            $report->update([
                'status' => 'Selesai',
                'after_photo_path' => $firstPath,
                'after_photo_hash' => $hash ?? null,
                'after_photo_notes' => $validated['catatan'] ?? null,
                'perbaikan_selesai_at' => now(),
                'system_notes' => $report->system_notes
                    ? $report->system_notes.' | [SELESAI] Perbaikan selesai oleh '.auth()->user()->name
                    : '[SELESAI] Perbaikan selesai oleh '.auth()->user()->name,
            ]);

            Log::info('DeltaJalan: Laporan selesai.', [
                'report_id' => $report->id,
                'report_code' => $report->report_code,
                'selesai_by' => auth()->user()->name,
            ]);

            // Notifikasi ke semua supervisor
            $supervisors = User::where('role', 'supervisor')->get();
            foreach ($supervisors as $supervisor) {
                $supervisor->notify(new RepairCompletedNotification($report, auth()->user()->name));
            }

            return response()->json([
                'success' => true,
                'message' => 'Laporan berhasil diselesaikan.',
                'data' => ['status' => $report->status],
            ]);
        } catch (\Exception $e) {
            Log::error('DeltaJalan: Gagal menyelesaikan laporan.', [
                'report_id' => $report->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Gagal menyelesaikan laporan: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * POST /api/reports/{id}/progress
     * Satgas upload progress foto + catatan selama pengerjaan.
     */
    public function updateProgress(Request $request, string $id): JsonResponse
    {
        $report = Report::find($id);
        if (! $report) {
            return response()->json(['success' => false, 'message' => 'Laporan tidak ditemukan.'], 404);
        }

        if ($report->status !== 'Sedang Diperbaiki') {
            return response()->json([
                'success' => false,
                'message' => 'Hanya laporan yang sedang diperbaiki yang bisa diupdate progress-nya.',
            ], 422);
        }

        $user = auth()->user();
        if ($user->role === 'petugas') {
            if (! $user->team_id || $report->assigned_team_id !== $user->team_id) {
                return response()->json([
                    'success' => false,
                    'message' => 'Anda tidak memiliki akses ke laporan ini.',
                ], 403);
            }
        }

        $validated = $request->validate([
            'foto' => 'required|image|mimes:jpeg,jpg,png|max:5120',
            'catatan' => 'nullable|string|max:1000',
        ]);

        $foto = $validated['foto'];
        $exifCheck = $this->validatePhotoDateExif($foto->getPathname());
        if ($exifCheck['status'] !== 'valid' && $exifCheck['status'] !== 'no_exif_support') {
            $statusMap = [
                'too_old' => 'PHOTO_TOO_OLD',
                'future_date' => 'PHOTO_FUTURE_DATE',
                'no_exif_date' => 'PHOTO_NO_EXIF_DATE',
                'exif_read_error' => 'PHOTO_EXIF_READ_ERROR',
            ];

            return response()->json([
                'success' => false,
                'message' => $exifCheck['message'],
                'error_code' => $statusMap[$exifCheck['status']] ?? 'PHOTO_EXIF_ERROR',
            ], 422);
        }

        try {
            $folder = 'reports/progress';
            $ext = $validated['foto']->getClientOriginalExtension() ?: $validated['foto']->guessExtension() ?: 'jpg';
            $filename = $report->id.'_progress_'.time().'.'.$ext;
            $path = $validated['foto']->storeAs($folder, $filename, 'public');

            $report->progressUpdates()->create([
                'user_id' => $user->id,
                'foto_path' => $path,
                'catatan' => $validated['catatan'] ?? null,
            ]);

            Log::info('DeltaJalan: Progress update.', [
                'report_id' => $report->id,
                'report_code' => $report->report_code,
                'by' => $user->name,
            ]);

            // Notifikasi supervisor
            try {
                $supervisors = User::where('role', 'supervisor')->get();
                $msg = 'Progress baru pada '.$report->report_code.': '.($validated['catatan'] ?? 'foto terbaru');
                foreach ($supervisors as $supervisor) {
                    $supervisor->notify(new ProgressUpdateNotification($report, $user->name, $validated['catatan']));
                }
            } catch (\Throwable $e) {
                Log::warning('Gagal kirim notif progress: '.$e->getMessage());
            }

            return response()->json([
                'success' => true,
                'message' => 'Progress berhasil diupdate.',
            ]);
        } catch (\Exception $e) {
            Log::error('DeltaJalan: Gagal upload progress.', ['error' => $e->getMessage()]);

            return response()->json([
                'success' => false,
                'message' => 'Gagal mengupdate progress: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * GET /api/reports/{id}/progress
     * Daftar progress updates untuk timeline supervisor.
     */
    public function getProgress(string $id): JsonResponse
    {
        $report = Report::find($id);
        if (! $report) {
            return response()->json(['success' => false, 'message' => 'Laporan tidak ditemukan.'], 404);
        }

        $mulai = $report->perbaikan_dimulai_at;
        $updates = $report->progressUpdates()->with('user:id,name')->get()->map(fn ($u) => [
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
            'data' => $updates,
        ]);
    }

    /**
     * POST /api/reports/bulk-approve
     * Approve multiple reports sekaligus.
     */
    public function bulkApprove(Request $request): JsonResponse
    {
        $user = auth()->user();
        if (!in_array($user->role, ['admin', 'supervisor'])) {
            return response()->json(['success' => false, 'message' => 'Unauthorized.'], 403);
        }

        $ids = $request->validate(['ids' => 'required|array', 'ids.*' => 'string|uuid']);

        $reports = Report::whereIn('id', $ids['ids'])
            ->whereIn('status', ['Menunggu Review', 'Ditinjau'])
            ->get();

        $noteSuffix = " | [BULK APPROVE] oleh {$user->name}";
        $now = now();

        foreach ($reports as $report) {
            $report->update([
                'status' => 'Disetujui',
                'system_notes' => $report->system_notes
                    ? $report->system_notes.$noteSuffix
                    : "[BULK APPROVE] oleh {$user->name}",
            ]);
            if ($report->reporter_name) {
                $petugasUser = User::where('name', $report->reporter_name)->first();
                if ($petugasUser) {
                    $petugasUser->notify(new BulkActionNotification($report, 'approve', $user->name));
                }
            }
        }

        $count = $reports->count();
        Log::info('DeltaJalan: Bulk approve.', ['count' => $count, 'by' => $user->name]);

        return response()->json([
            'success' => true,
            'message' => "{$count} laporan berhasil disetujui.",
            'data' => ['approved_count' => $count],
        ]);
    }

    /**
     * POST /api/reports/bulk-tolak
     * Tolak multiple reports sekaligus.
     */
    public function bulkTolak(Request $request): JsonResponse
    {
        $user = auth()->user();
        if (!in_array($user->role, ['admin', 'supervisor'])) {
            return response()->json(['success' => false, 'message' => 'Unauthorized.'], 403);
        }

        $validated = $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'string|uuid',
            'alasan' => 'required|string|max:500',
        ]);

        $reports = Report::whereIn('id', $validated['ids'])
            ->whereIn('status', ['Menunggu Review', 'Ditinjau'])
            ->get();

        $alasan = $validated['alasan'];
        foreach ($reports as $report) {
            $report->update([
                'status' => 'Ditolak',
                'system_notes' => $report->system_notes
                    ? $report->system_notes." | [BULK TOLAK] oleh {$user->name}: {$alasan}"
                    : "[BULK TOLAK] oleh {$user->name}: {$alasan}",
            ]);
            if ($report->reporter_name) {
                $petugasUser = User::where('name', $report->reporter_name)->first();
                if ($petugasUser) {
                    $petugasUser->notify(new BulkActionNotification($report, 'tolak', $user->name));
                }
            }
        }

        $count = $reports->count();
        Log::info('DeltaJalan: Bulk tolak.', ['count' => $count, 'by' => $user->name]);

        return response()->json([
            'success' => true,
            'message' => "{$count} laporan berhasil ditolak.",
            'data' => ['rejected_count' => $count],
        ]);
    }

    /**
     * GET /api/reports/stats-by-team
     * Statistik per Tim (total, sedang diperbaiki, selesai, total panjang).
     */
    public function statsByTeam(Request $request): JsonResponse
    {
        $stats = Cache::remember('stats_by_team', 120, function () {
            $teams = Team::all();

            // Single grouped query — replaces N*5 individual queries
            $grouped = Report::selectRaw("
                assigned_team_id,
                COUNT(*) as total,
                SUM(CASE WHEN status = 'Ditugaskan' THEN 1 ELSE 0 END) as ditugaskan,
                SUM(CASE WHEN status = 'Sedang Diperbaiki' THEN 1 ELSE 0 END) as sedang_diperbaiki,
                SUM(CASE WHEN status = 'Selesai' THEN 1 ELSE 0 END) as selesai,
                COALESCE(SUM(NULLIF(kerusakan_panjang, 0)), 0) as total_panjang,
                COALESCE(SUM(NULLIF(kerusakan_panjang, 0) * NULLIF(kerusakan_lebar, 0)), 0) as total_luas
            ")
                ->whereNotNull('assigned_team_id')
                ->groupBy('assigned_team_id')
                ->get()
                ->keyBy('assigned_team_id');

            $stats = [];
            foreach ($teams as $team) {
                $g = $grouped->get($team->id);
                $stats[] = [
                    'team_id' => $team->id,
                    'team_name' => $team->name,
                    'total' => (int) ($g->total ?? 0),
                    'ditugaskan' => (int) ($g->ditugaskan ?? 0),
                    'sedang_diperbaiki' => (int) ($g->sedang_diperbaiki ?? 0),
                    'selesai' => (int) ($g->selesai ?? 0),
                    'total_panjang_m' => round((float) ($g->total_panjang ?? 0), 1),
                    'total_luas_m2' => round((float) ($g->total_luas ?? 0), 1),
                ];
            }

            return $stats;
        });

        return response()->json(['success' => true, 'data' => $stats]);
    }

    /**
     * POST /api/reports/{id}/reopen
     * Re-open laporan yang sudah selesai — balik ke "Sedang Diperbaiki".
     */
    public function reopen(Request $request, string $id): JsonResponse
    {
        $report = Report::find($id);
        if (! $report) {
            return response()->json(['message' => 'Laporan tidak ditemukan.'], 404);
        }

        if ($report->status !== 'Selesai') {
            return response()->json([
                'message' => "Hanya laporan Selesai yang bisa di-reopen. Status: \"{$report->status}\".",
            ], 422);
        }

        $user = auth()->user();
        $report->update([
            'status' => 'Sedang Diperbaiki',
            'perbaikan_selesai_at' => null,
            'system_notes' => $report->system_notes
                ? $report->system_notes." | [REOPEN] oleh {$user->name}"
                : "[REOPEN] oleh {$user->name}",
        ]);

        try {
            $eksekusiUsers = User::where('role', 'petugas')->get();
            foreach ($eksekusiUsers as $eksekusi) {
                $eksekusi->notify(new ReportReopenedNotification($report, $user->name));
            }
        } catch (\Throwable $e) {
            Log::warning('Gagal mengirim notifikasi reopen: '.$e->getMessage());
        }

        return response()->json([
            'success' => true,
            'message' => 'Laporan dibuka kembali untuk perbaikan.',
            'data' => ['status' => $report->status],
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
        if (! $report) {
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
            'data' => ['status' => $report->status],
        ]);
    }

    /**
     * POST /api/reports/{id}/batal-edit
     * Petugas batal mengedit — status → "Menunggu Review".
     */
    public function batalEdit(string $id): JsonResponse
    {
        $report = Report::find($id);
        if (! $report) {
            return response()->json(['success' => false, 'message' => 'Laporan tidak ditemukan.'], 404);
        }

        $user = auth()->user();
        if ($user->role !== 'petugas') {
            return response()->json(['success' => false, 'message' => 'Hanya petugas yang dapat membatalkan edit.'], 403);
        }
        if ($report->status !== 'Diedit') {
            return response()->json(['success' => false, 'message' => 'Laporan tidak dalam status edit.'], 422);
        }

        $report->update(['status' => 'Menunggu Review']);

        try {
            $supervisors = User::where('role', 'supervisor')->get();
            foreach ($supervisors as $supervisor) {
                $supervisor->notify(new ReportEditedNotification($report, $user->name, 'batal'));
            }
        } catch (\Throwable $e) {
            Log::warning('Gagal mengirim notifikasi batal edit: '.$e->getMessage());
        }

        return response()->json([
            'success' => true,
            'message' => 'Edit dibatalkan.',
            'data' => ['status' => $report->status],
        ]);
    }

    /**
     * PUT /api/reports/{id}
     * Simpan perubahan dari petugas — status → "Menunggu Review".
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $report = Report::find($id);
        if (! $report) {
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
            return response()->json(['success' => false, 'message' => 'Laporan tidak dalam status edit.'], 422);
        }

        $validated = $request->validate([
            'catatan' => ['nullable', 'string', 'max:1000'],
            'kerusakan_panjang' => ['required_without:photos', 'nullable', 'numeric', 'min:0', 'max:999999.99'],
            'kerusakan_lebar' => ['required_without:photos', 'nullable', 'numeric', 'min:0', 'max:999999.99'],
            'road_name' => ['nullable', 'string', 'max:255'],
            'district' => ['nullable', 'string', 'max:100'],
            'photos' => ['nullable', 'array'],
            'photos.*.id' => ['required', 'string', 'exists:report_photos,id'],
            'photos.*.kerusakan_panjang' => ['required', 'numeric', 'min:0', 'max:999999.99'],
            'photos.*.kerusakan_lebar' => ['required', 'numeric', 'min:0', 'max:999999.99'],
        ]);

        $updateData = array_filter([
            'catatan_petugas' => $validated['catatan'] ?? $report->catatan_petugas,
            'road_name' => $validated['road_name'] ?? $report->road_name,
            'district' => $validated['district'] ?? $report->district,
            'status' => 'Menunggu Review',
        ], fn ($v) => $v !== null);

        if ($request->has('photos')) {
            $totalPanjang = 0;
            $totalLebar = 0;
            foreach ($validated['photos'] as $photoData) {
                $photo = ReportPhoto::findOrFail($photoData['id']);
                if ($photo->report_id !== $report->id) {
                    continue;
                }
                $photo->update([
                    'kerusakan_panjang' => $photoData['kerusakan_panjang'],
                    'kerusakan_lebar' => $photoData['kerusakan_lebar'],
                ]);
                $totalPanjang += (float) $photoData['kerusakan_panjang'];
                $totalLebar += (float) $photoData['kerusakan_lebar'];
            }
            $updateData['kerusakan_panjang'] = $totalPanjang;
            $updateData['kerusakan_lebar'] = $totalLebar;
        } else {
            $updateData['kerusakan_panjang'] = $validated['kerusakan_panjang'];
            $updateData['kerusakan_lebar'] = $validated['kerusakan_lebar'];
        }

        $report->update($updateData);

        try {
            $supervisors = User::where('role', 'supervisor')->get();
            foreach ($supervisors as $supervisor) {
                $supervisor->notify(new ReportEditedNotification($report, $user->name, 'edit'));
            }
        } catch (\Throwable $e) {
            Log::warning('Gagal mengirim notifikasi edit laporan: '.$e->getMessage());
        }

        return response()->json([
            'success' => true,
            'message' => 'Laporan berhasil diperbarui.',
            'data' => [
                'id' => $report->id,
                'status' => $report->status,
                'kerusakan_panjang' => $report->kerusakan_panjang,
                'kerusakan_lebar' => $report->kerusakan_lebar,
                'catatan_petugas' => $report->catatan_petugas,
                'road_name' => $report->road_name,
                'district' => $report->district,
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
        if (! $report) {
            return response()->json(['success' => false, 'message' => 'Laporan tidak ditemukan.'], 404);
        }

        $user = auth()->user();
        if (! in_array($user->role, ['supervisor', 'admin'], true)) {
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
            'data' => ['status' => $report->status],
        ]);
    }

    /**
     * POST /api/reports/{id}/update-triage
     * Petugas memperbarui kategori kerusakan (overall_severity) dan/atau prioritas.
     */
    public function updateTriage(Request $request, string $id): JsonResponse
    {
        $report = Report::find($id);
        if (! $report) {
            return response()->json(['success' => false, 'message' => 'Laporan tidak ditemukan.'], 404);
        }

        $user = auth()->user();
        if ($user->role !== 'petugas') {
            return response()->json(['success' => false, 'message' => 'Hanya petugas yang dapat mengubah triase.'], 403);
        }
        if (! $user->team_id || $report->assigned_team_id !== $user->team_id) {
            return response()->json(['success' => false, 'message' => 'Anda tidak memiliki akses ke laporan ini.'], 403);
        }
        if (! in_array($report->status, ['Disetujui', 'Sedang Diperbaiki'])) {
            return response()->json([
                'success' => false,
                'message' => 'Laporan tidak dalam status yang dapat diubah. Hanya laporan Disetujui atau Sedang Diperbaiki.',
            ], 422);
        }

        $validated = $request->validate([
            'priority' => ['nullable', 'string', 'in:'.implode(',', Report::PRIORITY_VALUES)],
            'severity' => ['nullable', 'string', 'in:'.implode(',', Report::SEVERITY_VALUES)],
        ]);

        if (empty($validated['priority']) && empty($validated['severity'])) {
            return response()->json(['success' => false, 'message' => 'Tidak ada data yang diubah.'], 422);
        }

        $updateData = [];
        if (! empty($validated['priority'])) {
            $updateData['priority'] = $validated['priority'];
            $updateData['deadline_review'] = Report::hitungDeadlineReview($validated['priority']);
        }
        if (! empty($validated['severity'])) {
            $updateData['overall_severity'] = $validated['severity'];
        }
        $updateData['system_notes'] = $report->system_notes
            ? $report->system_notes.' | [TRIAGE] Diperbarui oleh '.$user->name
            : '[TRIAGE] Diperbarui oleh '.$user->name;

        $report->update($updateData);

        try {
            $supervisors = User::where('role', 'supervisor')->get();
            foreach ($supervisors as $supervisor) {
                $supervisor->notify(new TriageUpdatedNotification($report, $user->name));
            }
        } catch (\Throwable $e) {
            Log::warning('Gagal mengirim notifikasi triage: '.$e->getMessage());
        }

        return response()->json([
            'success' => true,
            'message' => 'Kategori berhasil diperbarui.',
            'data' => [
                'id' => $report->id,
                'priority' => $report->priority,
                'overall_severity' => $report->overall_severity,
            ],
        ]);
    }

    /**
     * DELETE /api/reports/{id}
     * Petugas lapangan menghapus laporan miliknya sendiri.
     */
    public function destroy(string $id): JsonResponse
    {
        $report = Report::find($id);
        if (! $report) {
            return response()->json(['success' => false, 'message' => 'Laporan tidak ditemukan.'], 404);
        }

        $user = auth()->user();

        // Hanya pemilik laporan yang bisa menghapus, kecuali supervisor
        if ($report->user_id !== $user->id && $user->role !== 'supervisor') {
            return response()->json(['success' => false, 'message' => 'Anda tidak memiliki akses untuk menghapus laporan ini.'], 403);
        }

        // Hanya laporan dengan status tertentu yang bisa dihapus
        if (! in_array($report->status, ['Menunggu Review', 'Ditinjau', 'Diedit', 'Ditolak'])) {
            return response()->json([
                'success' => false,
                'message' => "Laporan dengan status \"{$report->status}\" tidak dapat dihapus.",
            ], 422);
        }

        // Hapus file foto dari storage
        if ($report->image_original_path && Storage::exists($report->image_original_path)) {
            Storage::delete($report->image_original_path);
        }
        if ($report->image_result_path && Storage::exists($report->image_result_path)) {
            Storage::delete($report->image_result_path);
        }

        // Hapus foto-foto terkait di report_photos
        foreach ($report->photos as $photo) {
            if ($photo->image_original_path && Storage::exists($photo->image_original_path)) {
                Storage::delete($photo->image_original_path);
            }
            if ($photo->image_result_path && Storage::exists($photo->image_result_path)) {
                Storage::delete($photo->image_result_path);
            }
        }

        // Hapus after photos
        foreach ($report->afterPhotos as $afterPhoto) {
            if ($afterPhoto->file_path && Storage::exists($afterPhoto->file_path)) {
                Storage::delete($afterPhoto->file_path);
            }
        }

        // Hapus after photo lama (legacy single)
        if ($report->after_photo_path && Storage::exists($report->after_photo_path)) {
            Storage::delete($report->after_photo_path);
        }

        // Delete report — cascade akan menghapus report_photos & status_logs
        $report->delete();

        Log::info('DeltaJalan: Laporan dihapus.', [
            'report_id' => $report->id,
            'report_code' => $report->report_code,
            'deleted_by' => $user->name,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Laporan berhasil dihapus.',
        ]);
    }

    /**
     * DELETE /api/reports/{id}/duplicate
     * Supervisor menghapus marking duplikasi dari laporan.
     */
    public function destroyDuplicate(string $id): JsonResponse
    {
        $report = Report::find($id);
        if (! $report) {
            return response()->json(['success' => false, 'message' => 'Laporan tidak ditemukan.'], 404);
        }

        $user = auth()->user();
        if (! $user || $user->role !== 'supervisor') {
            return response()->json(['success' => false, 'message' => 'Hanya supervisor yang dapat menghapus marking duplikasi.'], 403);
        }

        $deleted = ReportDuplicate::where('report_id', $id)->delete();

        if (! $deleted) {
            return response()->json(['success' => false, 'message' => 'Laporan ini tidak memiliki marking duplikasi.'], 404);
        }

        Log::info('DeltaJalan: Marking duplikasi dihapus oleh supervisor.', [
            'report_id' => $id,
            'deleted_by' => $user->name,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Marking duplikasi berhasil dihapus.',
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
     * @param  float  $lat  Latitude koordinat
     * @param  float  $lng  Longitude koordinat
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
            '/\bJl\.?\b/i' => 'Jalan',
            '/\bJln\.?\b/i' => 'Jalan',
            '/\bGg\.?\b/i' => 'Gang',
            '/\bDsn\.?\b/i' => 'Dusun',
            '/\bPerum\.?\b/i' => 'Perumahan',
            '/\bKomplek\b/i' => 'Kompleks',
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
        $long = strlen($a) <= strlen($b) ? $b : $a;

        // Ambil kata terakhir dari string pendek sebagai penanda minimal
        // Contoh: "Jalan Raya Kedungpeluk" vs "Kedungpeluk" → contained
        return str_contains($long, $short);
    }

    private function validateRoadNameVsCoordinate(string $namaJalan, float $lat, float $lng): array
    {
        $cacheKey = 'locationiq_'.md5("{$lat},{$lng}");

        return Cache::remember($cacheKey, 3600, function () use ($namaJalan, $lat, $lng) {
            try {
                $response = Http::timeout(2)->get('https://us1.locationiq.com/v1/reverse', [
                    'key' => config('services.locationiq.key'),
                    'lat' => $lat,
                    'lon' => $lng,
                    'format' => 'json',
                ]);

                if (! $response->ok()) {
                    return ['matched' => false, 'similarity' => null, 'geocoded_road' => '', 'reason' => 'locationiq_unavailable', 'full_address' => null];
                }

                $data = $response->json();
                $geocodedRoad = $data['address']['road']
                    ?? $data['address']['residential']
                    ?? $data['display_name']
                    ?? '';

                $normalizedInput = $this->normalizeRoadName($namaJalan);
                $normalizedGeo = $this->normalizeRoadName($geocodedRoad);

                similar_text($normalizedInput, $normalizedGeo, $percent);

                $matched = $percent >= 60 || $this->roadNameContained($normalizedInput, $normalizedGeo);

                return [
                    'matched' => $matched,
                    'similarity' => round($percent, 1),
                    'geocoded_road' => $geocodedRoad,
                    'reason' => $matched ? 'ok' : 'mismatch',
                    'full_address' => $data['display_name'] ?? null,
                ];
            } catch (\Exception $e) {
                return ['matched' => false, 'similarity' => null, 'geocoded_road' => '', 'reason' => 'exception', 'full_address' => null];
            }
        });
    }

    /**
     * Aggregate severity dari array severities — ambil yang terparah.
     *
     * @param  array  $severities  Array string severity ('ringan', 'sedang', 'berat')
     * @return string Severity terparah
     */
    private function aggregateSeverity(array $severities): string
    {
        $order = ['berat' => 3, 'sedang' => 2, 'ringan' => 1, 'baik' => 0];
        $max = 0;
        $result = 'baik';

        foreach ($severities as $s) {
            $val = $order[strtolower((string) $s)] ?? 0;
            if ($val > $max) {
                $max = $val;
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
            'berat' => 'Rusak Berat',
            'rusak berat' => 'Rusak Berat',
            'sedang' => 'Rusak Sedang',
            'rusak sedang' => 'Rusak Sedang',
            'ringan' => 'Rusak Ringan',
            'rusak ringan' => 'Rusak Ringan',
            'baik' => 'Baik',
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
     */
    private function isInSidoarjo(float $lat, float $lng): bool
    {
        return $lat >= -7.65 && $lat <= -7.25
            && $lng >= 112.50 && $lng <= 112.95;
    }

    /**
     * POST /api/v1/reports/extract-exif-gps
     *
     * Ekstrak koordinat GPS dari EXIF foto yang diupload.
     * Fallback untuk mobile browser yang strip EXIF dari File object.
     *
     * Request: multipart/form-data dengan field "image" (file JPEG/PNG, max 5MB)
     * Response: { lat: float|null, lng: float|null }
     */
    public function extractExifGpsFromUpload(Request $request): JsonResponse
    {
        $request->validate([
            'image' => ['required', 'file', 'mimes:jpeg,jpg,png', 'max:5120'],
        ]);

        $file = $request->file('image');
        $filePath = $file->getPathname();

        $gps = $this->extractExifGps($filePath);

        if (! $gps) {
            Log::warning('[extractExifGps] Gagal ekstrak GPS dari EXIF', [
                'mime' => $file->getMimeType(),
                'size' => $file->getSize(),
            ]);
        }

        return response()->json([
            'lat' => $gps ? $gps['lat'] : null,
            'lng' => $gps ? $gps['lng'] : null,
        ]);
    }

    /**
     * POST /api/test/extract-exif
     *
     * Ekstrak EXIF LENGKAP dari foto — public, tanpa auth.
     * Untuk halaman diagnostic test-exif.html.
     * Mengembalikan semua section: GPS, IFD0, EXIF Sub, COMPUTED, dll.
     * Juga mencoba ExifTool (jika binary tersedia) sebagai gold standard.
     *
     * Request: multipart/form-data dengan field "image" (file JPEG/PNG, max 5MB)
     * Response: { success: bool, gps: {lat, lng}|null, exif: {section}, exiftool: {...}|null, file: {...}, diagnostic: {...} }
     */
    public function extractFullExif(Request $request): JsonResponse
    {
        $request->validate([
            'image' => ['required', 'file', 'mimes:jpeg,jpg,png,heic,heif', 'max:5120'],
        ]);

        $file = $request->file('image');
        $filePath = $file->getPathname();
        $ext = strtolower($file->getClientOriginalExtension());

        $tStart = microtime(true);
        $gps = $this->extractExifGps($filePath);
        $phpParseTime = (microtime(true) - $tStart) * 1000;

        $tStartExif = microtime(true);
        $rawExif = @exif_read_data($filePath, 'ANY_TAG', true);
        $exif = $rawExif !== false
            ? $this->sanitizeExifForJson($rawExif)
            : null;

        $tStartXtool = microtime(true);
        $exiftoolResult = $this->extractExifWithExifTool($filePath);
        $exiftoolTime = (microtime(true) - $tStartXtool) * 1000;

        return response()->json([
            'success' => true,
            'gps' => $gps,
            'exif' => $exif,
            'exiftool' => $exiftoolResult,
            'file' => [
                'name' => $file->getClientOriginalName(),
                'size' => $file->getSize(),
                'mime' => $file->getMimeType(),
                'ext' => $ext,
            ],
            'diagnostic' => [
                'php_parse_time_ms' => round($phpParseTime + (microtime(true) - $tStartExif) * 1000, 1),
                'exiftool_time_ms' => round($exiftoolTime, 1),
                'has_exiftool' => $exiftoolResult !== null,
                'exec_available' => $this->isExecAvailable(),
                'is_heic' => in_array($ext, ['heic', 'heif']),
            ],
        ]);
    }

    /**
     * Coba ekstrak EXIF menggunakan ExifTool (Perl) — gold standard parsing.
     * Return null jika binary tidak tersedia atau gagal.
     */
    private function extractExifWithExifTool(string $filePath): ?array
    {
        if (! $this->isExecAvailable()) {
            return null;
        }

        $binary = $this->findExifToolBinary();
        if (! $binary) {
            return null;
        }

        $cmd = escapeshellcmd($binary)
            .' -json -G -a'
            .' '.escapeshellarg($filePath)
            .' 2>&1';

        try {
            $output = shell_exec($cmd);
            if ($output === null || $output === false) {
                return null;
            }

            $data = json_decode($output, true);
            if (! is_array($data) || empty($data)) {
                return null;
            }

            $result = $data[0];
            // Flatten group-prefixed keys into sections
            $sectioned = [];
            foreach ($result as $key => $value) {
                if (str_contains($key, ':')) {
                    [$group, $tag] = explode(':', $key, 2);
                    $sectioned[$group][$tag] = $value;
                } else {
                    $sectioned['_root'][$key] = $value;
                }
            }

            return $sectioned;
        } catch (\Throwable $e) {
            Log::warning('DeltaJalan: ExifTool gagal', ['error' => $e->getMessage()]);

            return null;
        }
    }

    /**
     * Cari binary exiftool di system PATH + fallback ke path umum.
     */
    private function findExifToolBinary(): ?string
    {
        $cmd = PHP_OS_FAMILY === 'Windows'
            ? 'where exiftool 2>NUL'
            : 'which exiftool 2>/dev/null';

        $path = trim((string) shell_exec($cmd));

        if ($path !== '' && file_exists($path)) {
            return $path;
        }

        // Fallback: cek path umum jika binary tidak di PATH
        $commonPaths = PHP_OS_FAMILY === 'Windows'
            ? [
                'C:\ProgramData\chocolatey\bin\exiftool.exe',
                'C:\Program Files\exiftool\exiftool.exe',
                'C:\exiftool\exiftool.exe',
            ]
            : [
                '/usr/bin/exiftool',
                '/usr/local/bin/exiftool',
                '/usr/share/perl5/vendor_perl/Image/ExifTool/exiftool',
            ];

        foreach ($commonPaths as $p) {
            if (file_exists($p)) {
                return $p;
            }
        }

        return null;
    }

    /**
     * Cek apakah exec/shell_exec tersedia (tidak di-disable di php.ini).
     */
    private function isExecAvailable(): bool
    {
        static $available = null;
        if ($available !== null) {
            return $available;
        }

        $disabled = explode(',', ini_get('disable_functions'));
        $available = ! in_array('shell_exec', array_map('trim', $disabled));

        return $available;
    }

    /**
     * Rekursif sanitasi EXIF data agar JSON-safe.
     * Buang null bytes, binary strings yang nggak perlu, konversi array ke string.
     */
    private function sanitizeExifForJson(mixed $data): mixed
    {
        if ($data === null) {
            return null;
        }
        if (is_bool($data)) {
            return $data;
        }
        if (is_int($data) || is_float($data)) {
            return $data;
        }
        if (is_string($data)) {
            $data = str_replace("\x00", '', $data);
            $data = trim($data);

            return $data === '' ? null : $data;
        }
        if (is_array($data)) {
            // Skip thumbnail binary
            if (isset($data['THUMBNAIL']) && ! is_array($data['THUMBNAIL'])) {
                $data['THUMBNAIL'] = '['.strlen($data['THUMBNAIL']).' bytes binary]';
            }
            foreach ($data as $key => $value) {
                $data[$key] = $this->sanitizeExifForJson($value);
            }

            // Remove null values for cleaner output
            return array_filter($data, fn ($v) => $v !== null);
        }

        return (string) $data;
    }

    /**
     * Ekstrak koordinat GPS dari metadata EXIF foto.
     *
     * Strategy 1: PHP exif_read_data (fast path, works for most files).
     * Strategy 2: PEL library (pure-PHP fallback untuk Samsung et al yang broken).
     */
    private function extractExifGps(string $filePath): ?array
    {
        $result = $this->extractExifGpsNative($filePath);
        if ($result) {
            return $result;
        }

        return $this->extractExifGpsWithPel($filePath);
    }

    private function extractExifGpsNative(string $filePath): ?array
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

    /**
     * PEL fallback — baca GPS langsung dari raw bytes, tanpa bergantung exif_read_data.
     */
    private function extractExifGpsWithPel(string $filePath): ?array
    {
        if (! class_exists(PelJpeg::class)) {
            return null;
        }

        try {
            $jpeg = new PelJpeg($filePath);
            $exif = $jpeg->getExif();
            if (! $exif) {
                return null;
            }
            $tiff = $exif->getTiff();
            if (! $tiff) {
                return null;
            }
            $ifd0 = $tiff->getIfd();
            if (! $ifd0) {
                return null;
            }
            $gps = $ifd0->getSubIfd(PelTag::GPS_INFO_IFD);
            if (! $gps) {
                return null;
            }

            $latEntry = $gps->getEntry(PelTag::GPS_LATITUDE);
            $lngEntry = $gps->getEntry(PelTag::GPS_LONGITUDE);
            if (! $latEntry || ! $lngEntry) {
                return null;
            }

            $latValues = $latEntry->getValue();
            $lngValues = $lngEntry->getValue();

            $latRefEntry = $gps->getEntry(PelTag::GPS_LATITUDE_REF);
            $lngRefEntry = $gps->getEntry(PelTag::GPS_LONGITUDE_REF);
            $latRef = $latRefEntry ? trim($latRefEntry->getValue()) : 'N';
            $lngRef = $lngRefEntry ? trim($lngRefEntry->getValue()) : 'E';

            $lat = $this->dmsToDecimal($latValues, $latRef);
            $lng = $this->dmsToDecimal($lngValues, $lngRef);

            if ($lat === null || $lng === null) {
                return null;
            }
            if (! $this->inIndonesiaBounds($lat, $lng)) {
                return null;
            }

            return ['lat' => $lat, 'lng' => $lng];
        } catch (\Throwable $e) {
            Log::warning('[extractExifGps] PEL gagal', ['error' => $e->getMessage()]);

            return null;
        }
    }

    private function dmsToDecimal(array $values, string $ref): ?float
    {
        if (count($values) < 3) {
            return null;
        }
        $decimal = ((float) $values[0]) + ((float) $values[1]) / 60 + ((float) $values[2]) / 3600;
        if (in_array(strtoupper($ref), ['S', 'W'])) {
            $decimal = -$decimal;
        }

        return round($decimal, 8);
    }

    /**
     * Normalize GPS value from various PHP exif_read_data formats to decimal degrees.
     *
     * PHP 8 can return GPS data in multiple formats:
     * - ["7/1", "26/1", "35660400/1000000"]  — string rationals (PHP 7)
     * - [[7, 1], [26, 1], [35660400, 1000000]] — raw rational pairs (PHP 8)
     * - [7, 26, 35.6604] — already decimal
     * - "7/1,26/1,35660400/1000000" — single comma-separated string
     */
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
            // Check first element type
            if (is_array($gpsValue[0])) {
                // Raw rational pairs: [[7,1], [26,1], [35660400,1000000]]
                $degrees = $this->rationalPairToFloat($gpsValue[0]);
                $minutes = $this->rationalPairToFloat($gpsValue[1]);
                $seconds = $this->rationalPairToFloat($gpsValue[2]);
            } elseif (is_numeric($gpsValue[0])) {
                // Already numeric: [7, 26, 35.6604]
                $degrees = (float) $gpsValue[0];
                $minutes = (float) ($gpsValue[1] ?? 0);
                $seconds = (float) ($gpsValue[2] ?? 0);
            } else {
                // String rationals: ["7/1", "26/1", "35660400/1000000"]
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
        if ($notes === 'Laporan dibuat') {
            return 'laporan_dibuat';
        }
        if ($notes && str_contains($notes, '[APPROVED]')) {
            return 'disetujui';
        }
        if ($notes && str_contains($notes, '[REJECTED]')) {
            return 'ditolak';
        }
        if ($notes && str_contains($notes, '[DISPOSISI]')) {
            return 'disposisi';
        }
        if ($notes && str_contains($notes, '[MULAI]')) {
            return 'perbaikan_dimulai';
        }
        if ($notes && str_contains($notes, '[SELESAI]')) {
            return 'perbaikan_selesai';
        }
        if ($notes && str_contains($notes, '[REOPEN]')) {
            return 'dibuka_kembali';
        }
        if ($notes && str_contains($notes, '[ASSIGN]')) {
            return 'ditugaskan';
        }
        if ($notes && str_contains($notes, '[TRIAGE]')) {
            return 'triage';
        }
        if ($notes && str_contains($notes, 'Perbaikan dimulai')) {
            return 'perbaikan_dimulai';
        }
        if ($notes && str_contains($notes, 'Perbaikan selesai')) {
            return 'perbaikan_selesai';
        }

        return match ($status) {
            'Ditinjau' => 'ditinjau',
            'Disetujui' => 'disetujui',
            'Ditolak' => 'ditolak',
            'Sedang Diperbaiki' => 'perbaikan_dimulai',
            'Selesai' => 'perbaikan_selesai',
            'Diedit' => 'diedit',
            'Menunggu Review' => 'menunggu_review',
            default => 'status_changed',
        };
    }

    /**
     * Map status value to a human-readable label.
     */
    private function mapStatusToLabel(string $status, ?string $notes): string
    {
        if ($notes === 'Laporan dibuat') {
            return 'Laporan Dibuat';
        }
        if ($notes && str_contains($notes, '[APPROVED]')) {
            return 'Disetujui Supervisor';
        }
        if ($notes && str_contains($notes, '[REJECTED]')) {
            return 'Ditolak Supervisor';
        }
        if ($notes && str_contains($notes, '[DISPOSISI]')) {
            return 'Disposisi Tim';
        }
        if ($notes && str_contains($notes, '[MULAI]')) {
            return 'Perbaikan Dimulai';
        }
        if ($notes && str_contains($notes, '[SELESAI]')) {
            return 'Perbaikan Selesai';
        }
        if ($notes && str_contains($notes, '[REOPEN]')) {
            return 'Laporan Dibuka Kembali';
        }
        if ($notes && str_contains($notes, '[ASSIGN]')) {
            return 'Penugasan Tim';
        }
        if ($notes && str_contains($notes, '[TRIAGE]')) {
            return 'Diperbarui';
        }
        if ($notes && str_contains($notes, 'Perbaikan dimulai')) {
            return 'Perbaikan Dimulai';
        }
        if ($notes && str_contains($notes, 'Perbaikan selesai')) {
            return 'Perbaikan Selesai';
        }

        return match ($status) {
            'Ditinjau' => 'Sedang Ditinjau',
            'Disetujui' => 'Disetujui',
            'Ditolak' => 'Ditolak',
            'Sedang Diperbaiki' => 'Perbaikan Dimulai',
            'Selesai' => 'Perbaikan Selesai',
            'Diedit' => 'Laporan Diedit',
            'Menunggu Review' => 'Menunggu Review',
            default => "Status: {$status}",
        };
    }

    /**
     * DELETE /api/admin/reports/{id}
     * Admin menghapus laporan apapun tanpa batasan kepemilikan.
     */
    public function adminDestroy(string $id): JsonResponse
    {
        $report = Report::find($id);
        if (! $report) {
            return response()->json(['success' => false, 'message' => 'Laporan tidak ditemukan.'], 404);
        }

        $user = auth()->user();
        if ($user->role !== 'admin') {
            return response()->json(['success' => false, 'message' => 'Hanya admin yang dapat menghapus laporan ini.'], 403);
        }

        // Hapus file foto dari storage
        if ($report->image_original_path && Storage::exists($report->image_original_path)) {
            Storage::delete($report->image_original_path);
        }
        if ($report->image_result_path && Storage::exists($report->image_result_path)) {
            Storage::delete($report->image_result_path);
        }

        foreach ($report->photos as $photo) {
            if ($photo->image_original_path && Storage::exists($photo->image_original_path)) {
                Storage::delete($photo->image_original_path);
            }
            if ($photo->image_result_path && Storage::exists($photo->image_result_path)) {
                Storage::delete($photo->image_result_path);
            }
        }

        foreach ($report->afterPhotos as $afterPhoto) {
            if ($afterPhoto->file_path && Storage::exists($afterPhoto->file_path)) {
                Storage::delete($afterPhoto->file_path);
            }
        }

        if ($report->after_photo_path && Storage::exists($report->after_photo_path)) {
            Storage::delete($report->after_photo_path);
        }

        $report_code = $report->report_code;
        $report->delete();

        Log::info('DeltaJalan: Laporan dihapus oleh admin.', [
            'report_id' => $id,
            'report_code' => $report_code,
            'deleted_by' => $user->name,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Laporan berhasil dihapus.',
        ]);
    }

    /**
     * POST /api/admin/reports/{id}/status
     * Admin mengubah status laporan secara paksa.
     */
    public function adminUpdateStatus(Request $request, string $id): JsonResponse
    {
        $report = Report::find($id);
        if (! $report) {
            return response()->json(['success' => false, 'message' => 'Laporan tidak ditemukan.'], 404);
        }

        $user = auth()->user();
        if ($user->role !== 'admin') {
            return response()->json(['success' => false, 'message' => 'Hanya admin yang dapat mengubah status ini.'], 403);
        }

        $validated = $request->validate([
            'status' => ['required', 'string', 'in:Menunggu Review,Disetujui,Ditolak,Hasil AI,Sedang Diperbaiki,Selesai'],
        ]);

        $old_status = $report->status;
        $new_status = $validated['status'];

        if ($old_status === $new_status) {
            return response()->json(['success' => false, 'message' => 'Status tidak berubah.'], 422);
        }

        $report->status = $new_status;
        $report->save();

        StatusLog::create([
            'report_id' => $report->id,
            'old_status' => $old_status,
            'new_status' => $new_status,
            'actor_name' => $user->name,
            'actor_role' => 'admin',
            'notes' => '[ADMIN] Status diubah oleh admin',
        ]);

        Log::info('DeltaJalan: Status laporan diubah oleh admin.', [
            'report_id' => $id,
            'report_code' => $report->report_code,
            'old_status' => $old_status,
            'new_status' => $new_status,
            'updated_by' => $user->name,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Status laporan berhasil diubah.',
            'data' => [
                'id' => $report->id,
                'status' => $new_status,
                'old_status' => $old_status,
            ],
        ]);
    }

    /**
     * GET /api/supervisor/regions
     * Mengembalikan daftar UPTD yang diawasi oleh supervisor yang sedang login.
     */
    public function mySupervisorRegions(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->role !== 'supervisor') {
            return response()->json(['success' => false, 'message' => 'Hanya untuk supervisor.'], 403);
        }

        $uptds = $user->supervisedUptds()->get(['id', 'nama', 'kecamatan_wilayah']);

        return response()->json([
            'success' => true,
            'data' => [
                'uptds' => $uptds,
                'label' => $uptds->pluck('nama')->implode(', '),
                'districts' => $uptds->pluck('kecamatan_wilayah')->flatten()->unique()->values(),
            ],
        ]);
    }

    private function savePhotoToStorage(UploadedFile $file, string $filename): ?string
    {
        try {
            $path = $file->storeAs(self::ORIGINALS_FOLDER, $filename, 'public');
            if ($path !== false) {
                return $path;
            }
        } catch (\Exception $e) {
            Log::warning('DeltaJalan: storeAs gagal, fallback copy manual.', [
                'error' => $e->getMessage(),
                'filename' => $filename,
            ]);
        }

        try {
            $destDir = storage_path('app/public/'.self::ORIGINALS_FOLDER);
            if (! is_dir($destDir)) {
                mkdir($destDir, 0755, true);
            }
            $destPath = rtrim($destDir, '\\/').'/'.$filename;
            if (copy($file->getPathname(), $destPath)) {
                Log::info('DeltaJalan: Fallback copy berhasil.', ['filename' => $filename]);

                return self::ORIGINALS_FOLDER.'/'.$filename;
            }
        } catch (\Exception $e) {
            Log::warning('DeltaJalan: Fallback copy exception.', ['error' => $e->getMessage()]);
        }

        return null;
    }
}
