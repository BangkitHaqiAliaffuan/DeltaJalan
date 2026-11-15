<?php

namespace App\Services;

use DateTime;
use Illuminate\Http\UploadedFile;

/**
 * Validasi metadata foto unggahan untuk alur inspeksi native.
 *
 * Aturan umur foto petugas mengikuti `AGENTS.md`: maksimal 2 hari
 * (`ReportController::MAX_PHOTO_AGE_DAYS`). Foto inspeksi memakai aturan
 * petugas, bukan aturan warga (7 hari).
 *
 * Catatan: `config('app.max_photo_age_days')` sengaja dipakai dengan default 2
 * karena key tersebut belum didefinisikan di `config/app.php`; default inilah
 * yang menjaga perilaku tetap 2 hari.
 */
class PhotoMetadataService
{
    public const MAX_PHOTO_AGE_DAYS = 2;

    /** @return array{status:string,message:string,photo_date:string|null} */
    public function validateCaptureDate(UploadedFile|string $file): array
    {
        $path = $file instanceof UploadedFile ? $file->getPathname() : $file;
        if (! function_exists('exif_read_data')) {
            return [
                'status' => 'no_exif_support',
                'message' => 'Ekstensi EXIF PHP tidak aktif sehingga tanggal foto tidak dapat diverifikasi.',
                'photo_date' => null,
            ];
        }

        try {
            $exif = @exif_read_data($path, 'EXIF', false);
            $raw = $exif['DateTimeOriginal'] ?? $exif['DateTimeDigitized'] ?? $exif['DateTime'] ?? null;
            if (! $raw) {
                return [
                    'status' => 'no_exif_date',
                    'message' => 'Foto tidak memiliki metadata tanggal EXIF.',
                    'photo_date' => null,
                ];
            }

            $photoDate = DateTime::createFromFormat('Y:m:d H:i:s', $raw);
            if (! $photoDate) {
                return [
                    'status' => 'exif_read_error',
                    'message' => 'Format tanggal EXIF tidak dapat dibaca.',
                    'photo_date' => null,
                ];
            }

            $photoDay = new DateTime($photoDate->format('Y-m-d'));
            $today = new DateTime('today');
            $days = (int) $today->diff($photoDay)->days;

            if ($photoDay > $today) {
                return [
                    'status' => 'future_date',
                    'message' => 'Tanggal foto berada di masa depan.',
                    'photo_date' => $photoDay->format('Y-m-d'),
                ];
            }

            $maxDays = (int) config('app.max_photo_age_days', self::MAX_PHOTO_AGE_DAYS);
            if ($days > $maxDays) {
                return [
                    'status' => 'too_old',
                    'message' => "Foto melebihi batas usia {$maxDays} hari.",
                    'photo_date' => $photoDay->format('Y-m-d'),
                ];
            }

            return [
                'status' => 'valid',
                'message' => 'Tanggal foto valid.',
                'photo_date' => $photoDay->format('Y-m-d'),
            ];
        } catch (\Throwable) {
            return [
                'status' => 'exif_read_error',
                'message' => 'Gagal membaca metadata EXIF.',
                'photo_date' => null,
            ];
        }
    }

    /** @return array{lat:float,lng:float}|null */
    public function extractGps(UploadedFile|string $file): ?array
    {
        $path = $file instanceof UploadedFile ? $file->getPathname() : $file;
        if (! function_exists('exif_read_data')) {
            return null;
        }

        try {
            $exif = @exif_read_data($path, null, false);
            if (! is_array($exif) || ! isset($exif['GPSLatitude'], $exif['GPSLongitude'])) {
                return null;
            }

            $lat = $this->gpsCoordinate($exif['GPSLatitude'], $exif['GPSLatitudeRef'] ?? 'N');
            $lng = $this->gpsCoordinate($exif['GPSLongitude'], $exif['GPSLongitudeRef'] ?? 'E');

            return ($lat !== null && $lng !== null) ? ['lat' => $lat, 'lng' => $lng] : null;
        } catch (\Throwable) {
            return null;
        }
    }

    private function gpsCoordinate(mixed $coordinate, string $ref): ?float
    {
        if (! is_array($coordinate) || count($coordinate) < 3) {
            return null;
        }

        $values = [];
        foreach ($coordinate as $part) {
            if (is_string($part) && str_contains($part, '/')) {
                [$n, $d] = array_pad(explode('/', $part, 2), 2, null);
                if (! is_numeric($n) || ! is_numeric($d) || (float) $d === 0.0) {
                    return null;
                }
                $values[] = (float) $n / (float) $d;
            } elseif (is_numeric($part)) {
                $values[] = (float) $part;
            } else {
                return null;
            }
        }

        $decimal = $values[0] + ($values[1] / 60) + ($values[2] / 3600);

        return in_array(strtoupper($ref), ['S', 'W'], true) ? -$decimal : $decimal;
    }
}
