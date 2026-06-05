<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * AIController
 *
 * Menangani operasi yang berhubungan dengan AI Server (FastAPI YOLOv8).
 *
 * Endpoint:
 * - POST /api/analyze-batch  → Analisis batch foto (maks 20 foto sekaligus)
 *
 * Keamanan batch:
 * - Validasi EXIF tanggal per foto (sama seperti single upload)
 * - Ekstrak GPS EXIF per foto — koordinat EXIF lebih dipercaya dari koordinat form
 * - Foto tanpa GPS EXIF tetap diterima tapi trust score lebih rendah
 */
class AIController extends Controller
{
    /**
     * Analisis batch foto ke AI Server.
     *
     * Alur per foto:
     * 1. Validasi EXIF tanggal (tolak jika terlalu lama / masa depan)
     * 2. Ekstrak GPS EXIF (jika ada, lebih dipercaya dari koordinat form)
     * 3. Kirim ke FastAPI untuk deteksi kerusakan
     * 4. Kembalikan hasil + metadata EXIF ke frontend
     *
     * Foto tanpa GPS EXIF tetap diterima — koordinat fallback ke koordinat form.
     * Ini mengakomodasi kamera yang tidak menyimpan tag lokasi.
     *
     * POST /api/analyze-batch
     * Memerlukan autentikasi Sanctum.
     */
    public function analyzeBatch(Request $request): JsonResponse
    {
        try {
            $request->validate([
                'files'     => 'required|array|min:1|max:20',
                'files.*'   => 'required|file|mimes:jpeg,jpg,png|max:5120',
                'latitude'  => 'required|numeric|between:-11,6',
                'longitude' => 'required|numeric|between:95,141',
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Data tidak valid.',
                'errors'  => $e->errors(),
            ], 422);
        }

        $inputLat = (float) $request->latitude;
        $inputLng = (float) $request->longitude;
        $batchId  = (string) Str::uuid();
        $analyses = [];

        foreach ($request->file('files') as $idx => $file) {
            $fileName = $file->getClientOriginalName();
            $filePath = $file->getPathname();

            // ── Langkah 1: Validasi EXIF tanggal ─────────────────────────
            // Dilakukan di backend agar tidak bisa di-bypass dari frontend.
            // Foto tanpa EXIF (kamera tanpa tag lokasi) tetap diterima dengan warning.
            $exifCheck = $this->validatePhotoDateExif($filePath);

            if (in_array($exifCheck['status'], ['too_old', 'future_date', 'no_exif_date', 'exif_read_error'])) {
                // Foto terlalu lama, masa depan, atau tanpa EXIF tanggal — skip, jangan gagalkan batch
                Log::warning('DeltaJalan: Foto batch ditolak karena EXIF tanggal tidak valid atau tidak ada.', [
                    'file_index' => $idx,
                    'file_name'  => $fileName,
                    'exif_status' => $exifCheck['status'],
                ]);

                $analyses[] = [
                    'file_index'    => $idx,
                    'file_name'     => $fileName,
                    'detections'    => [],
                    'severity'      => 'ringan',
                    'context_valid' => false,
                    'confidence'    => 0.0,
                    'exif_invalid'  => true,
                    'exif_reason'   => $exifCheck['status'],
                    'exif_message'  => $exifCheck['message'],
                    'error'         => $exifCheck['message'],
                    // Tidak ada GPS EXIF karena foto ditolak
                    'exif_lat'      => null,
                    'exif_lng'      => null,
                    'has_exif_gps'  => false,
                    'koordinat_sumber' => 'manual',
                ];
                continue;
            }

            // ── Langkah 2: Ekstrak GPS EXIF ───────────────────────────────
            // Jika foto punya GPS EXIF → gunakan koordinat EXIF (lebih akurat, tidak bisa dipalsukan frontend)
            // Jika tidak ada → fallback ke koordinat form (koordinat yang diinput user)
            // Ini mengakomodasi kamera yang tidak menyimpan tag lokasi GPS.
            $exifGps = $this->extractExifGps($filePath);

            $photoLat         = $exifGps ? $exifGps['lat'] : $inputLat;
            $photoLng         = $exifGps ? $exifGps['lng'] : $inputLng;
            $hasExifGps       = $exifGps !== null;
            $koordinatSumber  = $hasExifGps ? 'exif' : 'manual';

            // Hitung jarak antara GPS EXIF dan koordinat yang diinput user
            // Jika jauh (> 500m), ini indikasi koordinat form tidak sesuai lokasi foto
            $gpsDistanceMeters = null;
            if ($hasExifGps) {
                $gpsDistanceMeters = $this->haversineDistance(
                    $exifGps['lat'], $exifGps['lng'],
                    $inputLat, $inputLng
                );
            }

            // ── Langkah 3: Kirim ke FastAPI ───────────────────────────────
            try {
                $aiResult = $this->sendToAIServer($filePath, $fileName);

                if ($aiResult['success']) {
                    $payload      = $aiResult['data'];
                    $detections   = $payload['detections'] ?? [];
                    $rawSeverity  = $payload['overall_severity'] ?? 'Baik';
                    $severity     = $this->normalizeSeverity($rawSeverity);
                    $contextValid = count($detections) > 0;
                    $maxConf      = !empty($detections)
                        ? max(array_column($detections, 'confidence'))
                        : 0.0;

                    $analyses[] = [
                        'file_index'    => $idx,
                        'file_name'     => $fileName,
                        'detections'    => array_map(fn($d) => [
                            'type'       => $d['class']      ?? 'Unknown',
                            'confidence' => $d['confidence'] ?? 0.0,
                            'bbox'       => isset($d['bbox'])
                                ? [$d['bbox']['x1'], $d['bbox']['y1'], $d['bbox']['x2'], $d['bbox']['y2']]
                                : [],
                        ], $detections),
                        'severity'         => $severity,
                        'context_valid'    => $contextValid,
                        'confidence'       => round($maxConf, 3),
                        'image_result'     => $payload['image_result'] ?? null,
                        // Metadata EXIF — dipakai storeBatch untuk koordinat per foto
                        'exif_lat'         => $exifGps ? $exifGps['lat'] : null,
                        'exif_lng'         => $exifGps ? $exifGps['lng'] : null,
                        'has_exif_gps'     => $hasExifGps,
                        'photo_lat'        => $photoLat,   // koordinat efektif foto ini
                        'photo_lng'        => $photoLng,
                        'koordinat_sumber' => $koordinatSumber,
                        'exif_invalid'     => false,
                        'exif_date_status' => $exifCheck['status'], // 'valid' | 'no_exif_date' | 'exif_read_error'
                        // Jarak GPS EXIF vs koordinat form — null jika tidak ada EXIF GPS
                        'gps_distance_meters' => $gpsDistanceMeters,
                        // Flag jika koordinat EXIF jauh dari koordinat form (> 500m)
                        'gps_mismatch'     => $gpsDistanceMeters !== null && $gpsDistanceMeters > 500,
                    ];
                } else {
                    Log::warning('DeltaJalan: FastAPI gagal untuk satu foto dalam batch.', [
                        'file_index' => $idx,
                        'file_name'  => $fileName,
                        'error'      => $aiResult['error'],
                    ]);

                    $analyses[] = [
                        'file_index'       => $idx,
                        'file_name'        => $fileName,
                        'detections'       => [],
                        'severity'         => 'ringan',
                        'context_valid'    => false,
                        'confidence'       => 0.0,
                        'exif_lat'         => $exifGps ? $exifGps['lat'] : null,
                        'exif_lng'         => $exifGps ? $exifGps['lng'] : null,
                        'has_exif_gps'     => $hasExifGps,
                        'photo_lat'        => $photoLat,
                        'photo_lng'        => $photoLng,
                        'koordinat_sumber' => $koordinatSumber,
                        'exif_invalid'     => false,
                        'exif_date_status' => $exifCheck['status'],
                        'gps_distance_meters' => $gpsDistanceMeters,
                        'gps_mismatch'     => $gpsDistanceMeters !== null && $gpsDistanceMeters > 500,
                        'error'            => $aiResult['error'],
                    ];
                }
            } catch (\Exception $e) {
                Log::error('DeltaJalan: Exception saat analisis foto dalam batch.', [
                    'file_index' => $idx,
                    'error'      => $e->getMessage(),
                ]);

                $analyses[] = [
                    'file_index'       => $idx,
                    'file_name'        => $fileName,
                    'detections'       => [],
                    'severity'         => 'ringan',
                    'context_valid'    => false,
                    'confidence'       => 0.0,
                    'exif_lat'         => null,
                    'exif_lng'         => null,
                    'has_exif_gps'     => false,
                    'photo_lat'        => $inputLat,
                    'photo_lng'        => $inputLng,
                    'koordinat_sumber' => 'manual',
                    'exif_invalid'     => false,
                    'exif_date_status' => 'exif_read_error',
                    'gps_distance_meters' => null,
                    'gps_mismatch'     => false,
                    'error'            => $e->getMessage(),
                ];
            }
        }

        // Hitung berapa foto yang punya GPS EXIF
        $photosWithExifGps = count(array_filter($analyses, fn($a) => $a['has_exif_gps'] ?? false));
        $photosRejected    = count(array_filter($analyses, fn($a) => $a['exif_invalid'] ?? false));

        return response()->json([
            'batch_id'             => $batchId,
            'total_files'          => count($analyses),
            'photos_with_exif_gps' => $photosWithExifGps,
            'photos_rejected'      => $photosRejected,
            'analyses'             => $analyses,
            'latitude'             => $inputLat,
            'longitude'            => $inputLng,
        ]);
    }

    // ── Helper Methods ────────────────────────────────────────────────────

    /**
     * Kirim satu foto ke FastAPI AI Server untuk dianalisis.
     */
    private function sendToAIServer(string $filePath, string $fileName): array
    {
        $fastApiUrl = rtrim(config('services.fastapi.url', env('FASTAPI_URL', 'http://127.0.0.1:8000')), '/');
        $endpoint   = $fastApiUrl . '/analyze';

        try {
            $response = Http::timeout(30)
                ->attach('file', file_get_contents($filePath), $fileName)
                ->post($endpoint);

            if ($response->successful()) {
                $data = $response->json();
                if (!isset($data['overall_severity'])) {
                    return ['success' => false, 'data' => null, 'error' => 'Response FastAPI tidak memiliki field overall_severity.'];
                }
                return ['success' => true, 'data' => $data, 'error' => null];
            }

            return ['success' => false, 'data' => null, 'error' => "FastAPI merespons HTTP {$response->status()}."];

        } catch (\Illuminate\Http\Client\ConnectionException $e) {
            return ['success' => false, 'data' => null, 'error' => 'Koneksi ke FastAPI gagal: ' . $e->getMessage()];
        } catch (\Exception $e) {
            return ['success' => false, 'data' => null, 'error' => 'Error FastAPI: ' . $e->getMessage()];
        }
    }

    /**
     * Normalisasi severity dari format FastAPI ke format internal.
     */
    private function normalizeSeverity(string $rawSeverity): string
    {
        return match(strtolower(trim($rawSeverity))) {
            'rusak berat', 'berat'   => 'berat',
            'rusak sedang', 'sedang' => 'sedang',
            default                  => 'ringan',
        };
    }

    /**
     * Validasi tanggal foto dari metadata EXIF.
     *
     * Sama persis dengan ReportController::validatePhotoDateExif().
     * Duplikasi disengaja agar AIController tidak bergantung pada ReportController.
     *
     * @return array{status: string, message: string, photo_date: string|null}
     */
    private function validatePhotoDateExif(string $filePath): array
    {
        if (!function_exists('exif_read_data')) {
            return ['status' => 'no_exif_support', 'message' => 'Ekstensi EXIF PHP tidak aktif.', 'photo_date' => null];
        }

        try {
            $exifData = @exif_read_data($filePath, 'EXIF', false);

            if (!$exifData) {
                return ['status' => 'no_exif_date', 'message' => 'Foto tidak memiliki metadata EXIF.', 'photo_date' => null];
            }

            $rawDate = $exifData['DateTimeOriginal'] ?? $exifData['DateTimeDigitized'] ?? $exifData['DateTime'] ?? null;

            if (!$rawDate) {
                return ['status' => 'no_exif_date', 'message' => 'Metadata EXIF tidak memiliki informasi tanggal.', 'photo_date' => null];
            }

            $photoDate = \DateTime::createFromFormat('Y:m:d H:i:s', $rawDate);
            if (!$photoDate) {
                return ['status' => 'exif_read_error', 'message' => 'Format tanggal EXIF tidak dapat dibaca.', 'photo_date' => null];
            }

            $photoDateOnly = new \DateTime($photoDate->format('Y-m-d'));
            $todayOnly     = new \DateTime('today');
            $diffDays      = (int) $todayOnly->diff($photoDateOnly)->days;
            $isFuture      = $photoDateOnly > $todayOnly;

            if ($isFuture) {
                return [
                    'status'     => 'future_date',
                    'message'    => "Tanggal foto ({$photoDate->format('d/m/Y')}) adalah tanggal di masa depan. Metadata kemungkinan dimanipulasi.",
                    'photo_date' => $photoDate->format('Y-m-d'),
                ];
            }

            $maxDays = (int) config('app.max_photo_age_days', 2);
            if ($diffDays > $maxDays) {
                return [
                    'status'     => 'too_old',
                    'message'    => "Foto diambil pada {$photoDate->format('d/m/Y')} ({$diffDays} hari yang lalu). Maksimal {$maxDays} hari.",
                    'photo_date' => $photoDate->format('Y-m-d'),
                ];
            }

            return ['status' => 'valid', 'message' => 'Tanggal foto valid.', 'photo_date' => $photoDate->format('Y-m-d')];

        } catch (\Exception $e) {
            return ['status' => 'exif_read_error', 'message' => 'Gagal membaca EXIF: ' . $e->getMessage(), 'photo_date' => null];
        }
    }

    /**
     * Ekstrak koordinat GPS dari metadata EXIF foto.
     *
     * Menggunakan exif_read_data() bawaan PHP — tidak butuh library tambahan.
     * Mendukung format GPS EXIF standar (derajat, menit, detik dalam format rasional).
     *
     * @param  string  $filePath  Path absolut ke file foto
     * @return array{lat: float, lng: float}|null  Koordinat GPS, atau null jika tidak ada
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

            // Validasi range koordinat Indonesia
            if ($lat < -11 || $lat > 6 || $lng < 95 || $lng > 141) {
                Log::warning('DeltaJalan: GPS EXIF di luar range Indonesia.', [
                    'lat' => $lat, 'lng' => $lng, 'file' => basename($filePath),
                ]);
                return null;
            }

            return ['lat' => $lat, 'lng' => $lng];

        } catch (\Exception $e) {
            Log::warning('DeltaJalan: Gagal membaca GPS EXIF.', ['error' => $e->getMessage()]);
            return null;
        }
    }

    /**
     * Konversi format GPS EXIF (Degrees/Minutes/Seconds) ke desimal.
     *
     * Format EXIF GPS: array of rational strings, misal ["7/1", "27/1", "3456/100"]
     * = 7° 27' 34.56" → 7 + 27/60 + 34.56/3600 = 7.459600
     *
     * @param  array   $dms  Array [derajat, menit, detik] dalam format rasional
     * @param  string  $ref  'N'/'S' untuk latitude, 'E'/'W' untuk longitude
     * @return float|null
     */
    private function convertGpsDmsToDecimal(array $dms, string $ref): ?float
    {
        if (count($dms) < 3) {
            return null;
        }

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

        // S dan W adalah negatif
        if (in_array(strtoupper($ref), ['S', 'W'])) {
            $decimal = -$decimal;
        }

        return round($decimal, 8);
    }

    /**
     * Hitung jarak antara dua koordinat GPS menggunakan Haversine Formula.
     *
     * @param  float  $lat1  Latitude titik 1
     * @param  float  $lng1  Longitude titik 1
     * @param  float  $lat2  Latitude titik 2
     * @param  float  $lng2  Longitude titik 2
     * @return float  Jarak dalam meter
     */
    private function haversineDistance(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $earthRadius = 6371000; // meter
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);

        $a = sin($dLat / 2) ** 2
           + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;

        return $earthRadius * 2 * asin(sqrt($a));
    }
}