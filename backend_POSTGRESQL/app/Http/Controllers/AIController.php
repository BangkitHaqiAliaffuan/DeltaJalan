<?php

namespace App\Http\Controllers;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Pool;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use lsolesen\pel\PelJpeg;
use lsolesen\pel\PelTag;

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
                'files' => 'required|array|min:1|max:20',
                'files.*' => 'required|file|mimes:jpeg,jpg,png|max:5120',
                'latitude' => 'required|numeric|between:-11,6',
                'longitude' => 'required|numeric|between:95,141',
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Data tidak valid.',
                'errors' => $e->errors(),
            ], 422);
        }

        $inputLat = (float) $request->latitude;
        $inputLng = (float) $request->longitude;
        $batchId = (string) Str::uuid();
        $analyses = [];

        $fastApiUrl = rtrim(config('services.fastapi.url', env('FASTAPI_URL', 'http://127.0.0.1:8000')), '/');
        $endpoint = $fastApiUrl.'/analyze';

        // ── Pass 1: EXIF checks (fast, local) ──
        $pendingAi = [];
        foreach ($request->file('files') as $idx => $file) {
            $fileName = $file->getClientOriginalName();
            $filePath = $file->getPathname();

            $exifCheck = $this->validatePhotoDateExif($filePath);

            if (in_array($exifCheck['status'], ['too_old', 'future_date', 'no_exif_date', 'exif_read_error'])) {
                Log::warning('DeltaJalan: Foto batch ditolak karena EXIF tanggal tidak valid atau tidak ada.', [
                    'file_index' => $idx,
                    'file_name' => $fileName,
                    'exif_status' => $exifCheck['status'],
                ]);

                $analyses[] = [
                    'file_index' => $idx,
                    'file_name' => $fileName,
                    'detections' => [],
                    'severity' => 'ringan',
                    'context_valid' => false,
                    'confidence' => 0.0,
                    'exif_invalid' => true,
                    'exif_reason' => $exifCheck['status'],
                    'exif_message' => $exifCheck['message'],
                    'error' => $exifCheck['message'],
                    'exif_lat' => null,
                    'exif_lng' => null,
                    'has_exif_gps' => false,
                    'koordinat_sumber' => 'manual',
                ];

                continue;
            }

            $exifGps = $this->extractExifGps($filePath);

            $photoLat = $exifGps ? $exifGps['lat'] : $inputLat;
            $photoLng = $exifGps ? $exifGps['lng'] : $inputLng;
            $hasExifGps = $exifGps !== null;
            $koordinatSumber = $hasExifGps ? 'exif' : 'manual';

            $gpsDistanceMeters = null;
            if ($hasExifGps) {
                $gpsDistanceMeters = $this->haversineDistance(
                    $exifGps['lat'], $exifGps['lng'],
                    $inputLat, $inputLng
                );
            }

            $pendingAi[$idx] = compact(
                'fileName', 'filePath', 'exifGps', 'photoLat', 'photoLng',
                'hasExifGps', 'koordinatSumber', 'gpsDistanceMeters', 'exifCheck'
            );
        }

        // ── Pass 2: Parallel FastAPI calls via Http::pool() ──
        $aiResponses = [];
        if (! empty($pendingAi)) {
            $poolRequests = Http::pool(fn (Pool $pool) => array_map(
                fn ($item, $key) => $pool->as('f'.$key)
                    ->timeout(30)
                    ->attach('file', fopen($item['filePath'], 'r'), $item['fileName'])
                    ->post($endpoint),
                $pendingAi,
                array_keys($pendingAi)
            ));
            $aiResponses = $poolRequests;
        }

        // ── Pass 3: Build results ──
        foreach ($pendingAi as $idx => $item) {
            $respKey = 'f'.$idx;
            $response = $aiResponses[$respKey] ?? null;

            if ($response && $response->successful()) {
                $payload = $response->json();
                $detections = $payload['detections'] ?? [];
                $rawSeverity = $payload['overall_severity'] ?? 'Baik';
                $severity = $this->normalizeSeverity($rawSeverity);
                $contextValid = count($detections) > 0;
                $maxConf = ! empty($detections)
                    ? max(array_column($detections, 'confidence'))
                    : 0.0;

                $analyses[] = [
                    'file_index' => $idx,
                    'file_name' => $item['fileName'],
                    'detections' => array_map(fn ($d) => [
                        'type' => $d['class'] ?? 'Unknown',
                        'confidence' => $d['confidence'] ?? 0.0,
                        'bbox' => isset($d['bbox'])
                            ? [$d['bbox']['x1'], $d['bbox']['y1'], $d['bbox']['x2'], $d['bbox']['y2']]
                            : [],
                    ], $detections),
                    'severity' => $severity,
                    'context_valid' => $contextValid,
                    'confidence' => round($maxConf, 3),
                    'image_result' => $payload['image_result'] ?? null,
                    'exif_lat' => $item['exifGps'] ? $item['exifGps']['lat'] : null,
                    'exif_lng' => $item['exifGps'] ? $item['exifGps']['lng'] : null,
                    'has_exif_gps' => $item['hasExifGps'],
                    'photo_lat' => $item['photoLat'],
                    'photo_lng' => $item['photoLng'],
                    'koordinat_sumber' => $item['koordinatSumber'],
                    'exif_invalid' => false,
                    'exif_date_status' => $item['exifCheck']['status'],
                    'gps_distance_meters' => $item['gpsDistanceMeters'],
                    'gps_mismatch' => $item['gpsDistanceMeters'] !== null && $item['gpsDistanceMeters'] > 500,
                ];
            } else {
                $errorMsg = $response ? "FastAPI merespons HTTP {$response->status()}." : 'Koneksi ke FastAPI gagal.';

                if (! $response) {
                    Log::error('DeltaJalan: FastAPI connection failed in batch pool.', [
                        'file_index' => $idx,
                        'file_name' => $item['fileName'],
                    ]);
                } else {
                    Log::warning('DeltaJalan: FastAPI gagal untuk satu foto dalam batch.', [
                        'file_index' => $idx,
                        'file_name' => $item['fileName'],
                        'status' => $response->status(),
                    ]);
                }

                $analyses[] = [
                    'file_index' => $idx,
                    'file_name' => $item['fileName'],
                    'detections' => [],
                    'severity' => 'ringan',
                    'context_valid' => false,
                    'confidence' => 0.0,
                    'exif_lat' => $item['exifGps'] ? $item['exifGps']['lat'] : null,
                    'exif_lng' => $item['exifGps'] ? $item['exifGps']['lng'] : null,
                    'has_exif_gps' => $item['hasExifGps'],
                    'photo_lat' => $item['photoLat'],
                    'photo_lng' => $item['photoLng'],
                    'koordinat_sumber' => $item['koordinatSumber'],
                    'exif_invalid' => false,
                    'exif_date_status' => $item['exifCheck']['status'],
                    'gps_distance_meters' => $item['gpsDistanceMeters'],
                    'gps_mismatch' => $item['gpsDistanceMeters'] !== null && $item['gpsDistanceMeters'] > 500,
                    'error' => $errorMsg,
                ];
            }
        }

        $photosWithExifGps = count(array_filter($analyses, fn ($a) => $a['has_exif_gps'] ?? false));
        $photosRejected = count(array_filter($analyses, fn ($a) => $a['exif_invalid'] ?? false));

        return response()->json([
            'batch_id' => $batchId,
            'total_files' => count($analyses),
            'photos_with_exif_gps' => $photosWithExifGps,
            'photos_rejected' => $photosRejected,
            'analyses' => $analyses,
            'latitude' => $inputLat,
            'longitude' => $inputLng,
        ]);
    }

    // ── Helper Methods ────────────────────────────────────────────────────

    /**
     * Kirim satu foto ke FastAPI AI Server untuk dianalisis.
     */
    private function sendToAIServer(string $filePath, string $fileName): array
    {
        $fastApiUrl = rtrim(config('services.fastapi.url', env('FASTAPI_URL', 'http://127.0.0.1:8000')), '/');
        $endpoint = $fastApiUrl.'/analyze';

        try {
            $response = Http::timeout(30)
                ->attach('file', fopen($filePath, 'r'), $fileName)
                ->post($endpoint);

            if ($response->successful()) {
                $data = $response->json();
                if (! isset($data['overall_severity'])) {
                    return ['success' => false, 'data' => null, 'error' => 'Response FastAPI tidak memiliki field overall_severity.'];
                }

                return ['success' => true, 'data' => $data, 'error' => null];
            }

            return ['success' => false, 'data' => null, 'error' => "FastAPI merespons HTTP {$response->status()}."];

        } catch (ConnectionException $e) {
            return ['success' => false, 'data' => null, 'error' => 'Koneksi ke FastAPI gagal: '.$e->getMessage()];
        } catch (\Exception $e) {
            return ['success' => false, 'data' => null, 'error' => 'Error FastAPI: '.$e->getMessage()];
        }
    }

    /**
     * Normalisasi severity dari format FastAPI ke format internal.
     */
    private function normalizeSeverity(string $rawSeverity): string
    {
        return match (strtolower(trim($rawSeverity))) {
            'rusak berat', 'berat' => 'berat',
            'rusak sedang', 'sedang' => 'sedang',
            'rusak ringan', 'ringan' => 'ringan',
            'baik' => 'baik',
            default => 'ringan',
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
        if (! function_exists('exif_read_data')) {
            return ['status' => 'no_exif_support', 'message' => 'Ekstensi EXIF PHP tidak aktif.', 'photo_date' => null];
        }

        try {
            $exifData = @exif_read_data($filePath, 'EXIF', false);

            if (! $exifData) {
                return ['status' => 'no_exif_date', 'message' => 'Foto tidak memiliki metadata EXIF.', 'photo_date' => null];
            }

            $rawDate = $exifData['DateTimeOriginal'] ?? $exifData['DateTimeDigitized'] ?? $exifData['DateTime'] ?? null;

            if (! $rawDate) {
                return ['status' => 'no_exif_date', 'message' => 'Metadata EXIF tidak memiliki informasi tanggal.', 'photo_date' => null];
            }

            $photoDate = \DateTime::createFromFormat('Y:m:d H:i:s', $rawDate);
            if (! $photoDate) {
                return ['status' => 'exif_read_error', 'message' => 'Format tanggal EXIF tidak dapat dibaca.', 'photo_date' => null];
            }

            $photoDateOnly = new \DateTime($photoDate->format('Y-m-d'));
            $todayOnly = new \DateTime('today');
            $diffDays = (int) $todayOnly->diff($photoDateOnly)->days;
            $isFuture = $photoDateOnly > $todayOnly;

            if ($isFuture) {
                return [
                    'status' => 'future_date',
                    'message' => "Tanggal foto ({$photoDate->format('d/m/Y')}) adalah tanggal di masa depan. Metadata kemungkinan dimanipulasi.",
                    'photo_date' => $photoDate->format('Y-m-d'),
                ];
            }

            $maxDays = (int) config('app.max_photo_age_days', 2);
            if ($diffDays > $maxDays) {
                return [
                    'status' => 'too_old',
                    'message' => "Foto diambil pada {$photoDate->format('d/m/Y')} ({$diffDays} hari yang lalu). Maksimal {$maxDays} hari.",
                    'photo_date' => $photoDate->format('Y-m-d'),
                ];
            }

            return ['status' => 'valid', 'message' => 'Tanggal foto valid.', 'photo_date' => $photoDate->format('Y-m-d')];

        } catch (\Exception $e) {
            return ['status' => 'exif_read_error', 'message' => 'Gagal membaca EXIF: '.$e->getMessage(), 'photo_date' => null];
        }
    }

    /**
     * Ekstrak koordinat GPS dari metadata EXIF foto.
     *
     * Menggunakan exif_read_data() bawaan PHP — tidak butuh library tambahan.
     * Mendukung format GPS EXIF standar (derajat, menit, detik dalam format rasional).
     *
     * @param  string  $filePath  Path absolut ke file foto
     * @return array{lat: float, lng: float}|null Koordinat GPS, atau null jika tidak ada
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
            Log::warning('DeltaJalan: PEL gagal baca GPS.', ['error' => $e->getMessage()]);

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

    private function inIndonesiaBounds(float $lat, float $lng): bool
    {
        return $lat >= -11 && $lat <= 6 && $lng >= 95 && $lng <= 141;
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

    /**
     * Hitung jarak antara dua koordinat GPS menggunakan Haversine Formula.
     *
     * @param  float  $lat1  Latitude titik 1
     * @param  float  $lng1  Longitude titik 1
     * @param  float  $lat2  Latitude titik 2
     * @param  float  $lng2  Longitude titik 2
     * @return float Jarak dalam meter
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
