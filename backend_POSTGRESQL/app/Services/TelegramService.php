<?php

namespace App\Services;

use App\Models\Report;
use App\Models\ReportPhoto;
use App\Models\StatusLog;
use App\Models\User;
use Illuminate\Http\Client\Pool;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class TelegramService
{
    private string $apiUrl;

    private string $token;

    private const TIMEOUT = 30;

    public function __construct()
    {
        $this->token = config('services.telegram.bot_token', '');
        $this->apiUrl = "https://api.telegram.org/bot{$this->token}";
    }

    public function sendMessage(int|string $chatId, string $text, ?array $replyMarkup = null): ?array
    {
        $payload = [
            'chat_id' => $chatId,
            'text' => $text,
            'parse_mode' => 'HTML',
            'disable_web_page_preview' => true,
        ];
        if ($replyMarkup) {
            $payload['reply_markup'] = json_encode($replyMarkup);
        }

        return $this->post('sendMessage', $payload);
    }

    public function sendPhoto(int|string $chatId, string $photo, string $caption = '', ?array $replyMarkup = null): ?array
    {
        $payload = [
            'chat_id' => $chatId,
            'photo' => $photo,
            'caption' => $caption,
            'parse_mode' => 'HTML',
        ];
        if ($replyMarkup) {
            $payload['reply_markup'] = json_encode($replyMarkup);
        }

        return $this->post('sendPhoto', $payload);
    }

    public function answerCallbackQuery(string $callbackQueryId, string $text = ''): ?array
    {
        return $this->post('answerCallbackQuery', [
            'callback_query_id' => $callbackQueryId,
            'text' => $text,
        ]);
    }

    public function editMessageReplyMarkup(int|string $chatId, int $messageId): ?array
    {
        return $this->post('editMessageReplyMarkup', [
            'chat_id' => $chatId,
            'message_id' => $messageId,
        ]);
    }

    public function answerAndRemoveKeyboard(string $callbackId, int|string $chatId, int $messageId): void
    {
        Http::pool(fn (Pool $pool) => [
            $pool->asJson()->post("{$this->apiUrl}/answerCallbackQuery", [
                'callback_query_id' => $callbackId,
                'text' => 'Sedang diproses...',
            ]),
            $pool->asJson()->post("{$this->apiUrl}/editMessageReplyMarkup", [
                'chat_id' => (string) $chatId,
                'message_id' => $messageId,
            ]),
        ]);
    }

    public function downloadFile(string $fileId): ?string
    {
        $fileInfo = $this->getFile($fileId);
        if (! $fileInfo || ! isset($fileInfo['file_path'])) {
            return null;
        }

        $fileUrl = "https://api.telegram.org/file/bot{$this->token}/{$fileInfo['file_path']}";

        try {
            $response = Http::timeout(self::TIMEOUT)->get($fileUrl);
            if (! $response->successful()) {
                return null;
            }

            $ext = pathinfo($fileInfo['file_path'], PATHINFO_EXTENSION) ?: 'jpg';
            $filename = 'telegram_'.time().'_'.bin2hex(random_bytes(8)).'.'.$ext;
            $dir = storage_path('app/public/telegram/originals');

            if (! is_dir($dir)) {
                mkdir($dir, 0755, true);
            }

            $path = $dir.'/'.$filename;
            file_put_contents($path, $response->body());

            return 'telegram/originals/'.$filename;
        } catch (\Exception $e) {
            Log::warning('DeltaJalan: Gagal download file Telegram.', [
                'error' => $e->getMessage(),
                'file_id' => $fileId,
            ]);

            return null;
        }
    }

    public function deleteWebhook(bool $dropPending = false): ?array
    {
        return $this->post('deleteWebhook', ['drop_pending_updates' => $dropPending]);
    }

    public function getWebhookInfo(): ?array
    {
        return $this->post('getWebhookInfo');
    }

    private function getFile(string $fileId): ?array
    {
        return $this->post('getFile', ['file_id' => $fileId]);
    }

    public function readExifData(string $relativePath): ?array
    {
        $fullPath = storage_path("app/public/{$relativePath}");

        if (! file_exists($fullPath)) {
            Log::warning('DeltaJalan: File EXIF tidak ditemukan.', ['path' => $fullPath]);

            return null;
        }

        try {
            $exif = @exif_read_data($fullPath, 'ANY_TAG', true);

            return $exif !== false ? $exif : null;
        } catch (\Exception $e) {
            Log::warning('DeltaJalan: Gagal baca EXIF.', [
                'path' => $relativePath,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    public function formatExifMessage(array $exif, string $fileName, int $fileSize): string
    {
        $msg = "<b>EXIF Lengkap — {$fileName}</b>\n";
        $msg .= 'Ukuran: '.$this->formatFileSize($fileSize)."\n";
        $msg .= "═══════════════════════\n\n";

        // ── GPS ─────────────────────────────────────────────────────────
        if (isset($exif['GPS'])) {
            $gps = $exif['GPS'];
            $msg .= "<b>GPS — ADA</b>\n";

            if (isset($gps['GPSLatitude'], $gps['GPSLongitude'])) {
                $lat = $this->gpsToDecimal($gps['GPSLatitude'], $gps['GPSLatitudeRef'] ?? 'N');
                $lng = $this->gpsToDecimal($gps['GPSLongitude'], $gps['GPSLongitudeRef'] ?? 'E');
                $msg .= "Latitude: {$lat} {$gps['GPSLatitudeRef']}\n";
                $msg .= "Longitude: {$lng} {$gps['GPSLongitudeRef']}\n";
            }
            if (isset($gps['GPSAltitude'])) {
                $alt = $this->rationalToFloat($gps['GPSAltitude']);
                $ref = ($gps['GPSAltitudeRef'] ?? "\x00") === "\x01" ? ' (bawah laut)' : '';
                $msg .= "Altitude: {$alt}m{$ref}\n";
            }
            if (isset($gps['GPSDateStamp'], $gps['GPSTimeStamp'])) {
                $time = $this->formatGpsTime($gps['GPSTimeStamp']);
                $msg .= "GPS DateTime: {$gps['GPSDateStamp']} {$time}\n";
            } elseif (isset($gps['GPSDateStamp'])) {
                $msg .= "GPS Date: {$gps['GPSDateStamp']}\n";
            }
            if (isset($gps['GPSImgDirection'])) {
                $dir = $this->rationalToFloat($gps['GPSImgDirection']);
                $ref = $gps['GPSImgDirectionRef'] ?? '';
                $msg .= "Direction: {$dir} {$ref}\n";
            }

            foreach ($gps as $key => $val) {
                if (in_array($key, ['GPSLatitude', 'GPSLatitudeRef', 'GPSLongitude', 'GPSLongitudeRef', 'GPSAltitude', 'GPSAltitudeRef', 'GPSDateStamp', 'GPSTimeStamp', 'GPSImgDirection', 'GPSImgDirectionRef'])) {
                    continue;
                }
                if ($val !== null && $val !== '' && $val !== "\x00") {
                    $msg .= "{$key}: {$this->formatExifValue($val)}\n";
                }
            }
            $msg .= "\n";
        } else {
            $msg .= "<b>GPS — TIDAK ADA</b>\n\n";
        }

        // ── IFD0 (Camera) ──────────────────────────────────────────────
        if (isset($exif['IFD0'])) {
            $msg .= "<b>Kamera (IFD0)</b>\n";
            $ifd0 = $exif['IFD0'];
            foreach (['Make', 'Model', 'Software', 'DateTime', 'Orientation', 'Artist', 'Copyright', 'ImageDescription'] as $key) {
                if (isset($ifd0[$key]) && $ifd0[$key] !== '' && $ifd0[$key] !== "\x00") {
                    $msg .= "{$key}: {$this->formatExifValue($ifd0[$key])}\n";
                }
            }
            foreach ($ifd0 as $key => $val) {
                if (in_array($key, ['Make', 'Model', 'Software', 'DateTime', 'Orientation', 'Artist', 'Copyright', 'ImageDescription'])) {
                    continue;
                }
                if ($val !== null && $val !== '' && $val !== "\x00") {
                    $msg .= "{$key}: {$this->formatExifValue($val)}\n";
                }
            }
            $msg .= "\n";
        }

        // ── EXIF Sub-IFD ────────────────────────────────────────────────
        if (isset($exif['EXIF'])) {
            $msg .= "<b>EXIF Sub</b>\n";
            $sub = $exif['EXIF'];
            foreach (['DateTimeOriginal', 'DateTimeDigitized', 'ExposureTime', 'FNumber', 'ISOSpeedRatings', 'FocalLength', 'Flash', 'ExposureProgram', 'ExposureBiasValue', 'MeteringMode', 'LightSource', 'WhiteBalance', 'DigitalZoomRatio', 'SceneCaptureType', 'Sharpness', 'Saturation', 'Contrast', 'ColorSpace', 'PixelXDimension', 'PixelYDimension'] as $key) {
                if (isset($sub[$key]) && $sub[$key] !== '' && $sub[$key] !== "\x00") {
                    $val = $this->formatExifValue($sub[$key]);
                    if ($val !== '') {
                        $msg .= "{$key}: {$val}\n";
                    }
                }
            }
            foreach ($sub as $key => $val) {
                if (in_array($key, ['DateTimeOriginal', 'DateTimeDigitized', 'ExposureTime', 'FNumber', 'ISOSpeedRatings', 'FocalLength', 'Flash', 'ExposureProgram', 'ExposureBiasValue', 'MeteringMode', 'LightSource', 'WhiteBalance', 'DigitalZoomRatio', 'SceneCaptureType', 'Sharpness', 'Saturation', 'Contrast', 'ColorSpace', 'PixelXDimension', 'PixelYDimension'])) {
                    continue;
                }
                if ($val !== null && $val !== '' && $val !== "\x00") {
                    $msg .= "{$key}: {$this->formatExifValue($val)}\n";
                }
            }
            $msg .= "\n";
        }

        // ── Computed ────────────────────────────────────────────────────
        if (isset($exif['COMPUTED'])) {
            $msg .= "<b>Computed</b>\n";
            $computed = $exif['COMPUTED'];
            foreach (['Width', 'Height', 'MimeType', 'ApertureFNumber', 'UserComment'] as $key) {
                if (isset($computed[$key]) && $computed[$key] !== '' && $computed[$key] !== "\x00") {
                    $msg .= "{$key}: {$this->formatExifValue($computed[$key])}\n";
                }
            }
            $msg .= "\n";
        }

        // ── Remaining sections ──────────────────────────────────────────
        $sectionsShown = ['GPS', 'IFD0', 'EXIF', 'COMPUTED'];
        $skipBinary = ['THUMBNAIL', 'MAKERNOTE', 'COMMENT'];
        foreach ($exif as $section => $data) {
            if (in_array($section, $sectionsShown) || in_array($section, $skipBinary) || ! is_array($data)) {
                continue;
            }
            $msg .= "<b>{$section}</b>\n";
            foreach ($data as $key => $val) {
                if ($val !== null && $val !== '' && $val !== "\x00") {
                    $msg .= "{$key}: {$this->formatExifValue($val)}\n";
                }
            }
            $msg .= "\n";
        }

        // ── Truncate if too long ────────────────────────────────────────
        if (mb_strlen($msg) > 4000) {
            $msg = mb_substr($msg, 0, 3990)."\n\n<i>... data terpotong (batas 4096 karakter)</i>";
        }

        return $msg;
    }

    private function gpsToDecimal(array $coord, string $ref): float
    {
        $degrees = count($coord) >= 1 ? $this->rationalToFloat($coord[0]) : 0;
        $minutes = count($coord) >= 2 ? $this->rationalToFloat($coord[1]) : 0;
        $seconds = count($coord) >= 3 ? $this->rationalToFloat($coord[2]) : 0;

        $decimal = $degrees + ($minutes / 60.0) + ($seconds / 3600.0);

        if (in_array(strtoupper($ref), ['S', 'W'])) {
            $decimal *= -1;
        }

        return round($decimal, 6);
    }

    private function rationalToFloat(mixed $value): float
    {
        if (is_array($value)) {
            return $this->rationalToFloat($value[0] ?? '0');
        }
        if (is_numeric($value)) {
            return (float) $value;
        }
        if (is_string($value) && str_contains($value, '/')) {
            $parts = explode('/', $value);
            if (count($parts) === 2 && is_numeric($parts[0]) && is_numeric($parts[1]) && (float) $parts[1] !== 0.0) {
                return (float) $parts[0] / (float) $parts[1];
            }
        }

        return 0.0;
    }

    private function formatGpsTime(array $time): string
    {
        $h = $this->rationalToFloat($time[0] ?? 0);
        $m = $this->rationalToFloat($time[1] ?? 0);
        $s = $this->rationalToFloat($time[2] ?? 0);

        return sprintf('%02d:%02d:%02d', (int) $h, (int) $m, (int) $s);
    }

    private function formatExifValue(mixed $value): string
    {
        if ($value === null) {
            return 'N/A';
        }
        if (is_bool($value)) {
            return $value ? 'Yes' : 'No';
        }
        if (is_array($value)) {
            return implode(', ', array_map([$this, 'formatExifValue'], $value));
        }
        if (is_string($value)) {
            $value = str_replace("\x00", '', $value);
            $value = trim($value);

            return $value;
        }

        return (string) $value;
    }

    private function formatFileSize(int $bytes): string
    {
        if ($bytes >= 1048576) {
            return round($bytes / 1048576, 1).' MB';
        }
        if ($bytes >= 1024) {
            return round($bytes / 1024, 1).' KB';
        }

        return $bytes.' B';
    }

    public function reverseGeocode(float $lat, float $lng): ?array
    {
        $key = config('services.locationiq.key');
        if (! $key) {
            return null;
        }

        try {
            $response = Http::timeout(10)->get('https://us1.locationiq.com/v1/reverse', [
                'key' => $key,
                'lat' => $lat,
                'lon' => $lng,
                'format' => 'json',
                'addressdetails' => 1,
            ]);

            if (! $response->successful()) {
                return null;
            }

            $data = $response->json();
            $address = $data['address'] ?? [];

            $roadName = $address['road']
                ?? $address['path']
                ?? $address['pedestrian']
                ?? $address['street']
                ?? $data['display_name']
                ?? '';

            $district = $address['county']
                ?? $address['city_district']
                ?? $address['suburb']
                ?? $address['state_district']
                ?? '';

            $district = $this->matchKecamatan($district);

            if (! $district) {
                $district = $address['county']
                    ?? $address['city_district']
                    ?? $address['suburb']
                    ?? $address['state_district']
                    ?? 'Sidoarjo';
                $district = $this->matchKecamatan($district) ?: 'Sidoarjo';
            }

            return [
                'road_name' => $roadName,
                'district' => $district,
                'display_name' => $data['display_name'] ?? '',
            ];
        } catch (\Exception $e) {
            Log::warning('DeltaJalan: Reverse geocode gagal.', [
                'error' => $e->getMessage(),
                'lat' => $lat,
                'lng' => $lng,
            ]);

            return null;
        }
    }

    public function validatePhotoDate(array $exif, string $filePath): array
    {
        $rawDate = $exif['EXIF']['DateTimeOriginal']
            ?? $exif['EXIF']['DateTimeDigitized']
            ?? $exif['IFD0']['DateTime']
            ?? null;

        if (! $rawDate) {
            $rawDate = $exif['COMPUTED']['DateTimeOriginal']
                ?? $exif['COMPUTED']['DateTime']
                ?? null;
        }

        if (! $rawDate) {
            return [
                'status' => 'no_exif_date',
                'message' => 'Foto tidak memiliki metadata tanggal.',
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

        $photoDateOnly = clone $photoDate;
        $photoDateOnly->modify('midnight');
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

        if ($diffDays > 7) {
            return [
                'status' => 'too_old',
                'message' => 'Foto diambil pada '.$photoDate->format('d/m/Y')
                    ." ({$diffDays} hari yang lalu). "
                    .'Sistem hanya menerima foto maksimal 7 hari terakhir.',
                'photo_date' => $photoDate->format('Y-m-d'),
            ];
        }

        return [
            'status' => 'valid',
            'message' => 'Tanggal foto valid.',
            'photo_date' => $photoDate->format('Y-m-d'),
        ];
    }

    public function createOrFindUser(int|string $chatId, array $telegramUser): User
    {
        $email = "telegram_{$chatId}@telegram.jalankita.lokal";
        $name = trim(($telegramUser['first_name'] ?? '').' '.($telegramUser['last_name'] ?? ''));

        if (empty($name)) {
            $name = "Warga {$chatId}";
        }

        return User::firstOrCreate(
            ['email' => $email],
            [
                'name' => $name,
                'password' => bcrypt(Str::random(32)),
                'role' => 'warga',
                'registration_ip' => 'telegram',
            ]
        );
    }

    public function submitReport(array $data): ?Report
    {
        try {
            return DB::transaction(function () use ($data) {
                $photoPath = $data['photo_path'];
                $fullPath = storage_path("app/public/{$photoPath}");

                if (! file_exists($fullPath)) {
                    throw new \RuntimeException("File foto tidak ditemukan: {$fullPath}");
                }

                $year = date('Y');
                $lastReport = Report::where('report_code', 'like', "LP-{$year}-%")
                    ->orderBy('report_code', 'desc')
                    ->first();

                $nextNumber = $lastReport
                    ? ((int) substr($lastReport->report_code, -5)) + 1
                    : 1;

                $reportCode = sprintf('LP-%s-%05d', $year, $nextNumber);

                $ext = pathinfo($photoPath, PATHINFO_EXTENSION) ?: 'jpg';
                $newFilename = Str::uuid()->toString().'-'.time().'.'.$ext;
                $destDir = storage_path('app/public/reports/originals');

                if (! is_dir($destDir)) {
                    mkdir($destDir, 0755, true);
                }

                $copied = copy($fullPath, $destDir.'/'.$newFilename);
                if (! $copied) {
                    throw new \RuntimeException('Gagal menyalin foto ke direktori laporan.');
                }

                $newPath = 'reports/originals/'.$newFilename;

                $report = Report::create([
                    'user_id' => $data['user_id'],
                    'report_code' => $reportCode,
                    'reporter_name' => $data['reporter_name'],
                    'road_name' => $data['road_name'],
                    'district' => $data['district'],
                    'latitude' => $data['latitude'],
                    'longitude' => $data['longitude'],
                    'image_original_path' => $newPath,
                    'status' => 'Menunggu Verifikasi',
                    'source' => 'telegram',
                    'description' => $data['description'] ?? null,
                    'kerusakan_panjang' => $data['kerusakan_panjang'] ?? null,
                    'kerusakan_lebar' => $data['kerusakan_lebar'] ?? null,
                    'priority' => 'Sedang',
                ]);

                ReportPhoto::create([
                    'report_id' => $report->id,
                    'reporter_name' => $data['reporter_name'],
                    'image_original_path' => $newPath,
                    'latitude' => $data['latitude'],
                    'longitude' => $data['longitude'],
                    'koordinat_sumber' => 'telegram_location',
                    'sort_order' => 0,
                    'mobileclip_score' => $data['mobileclip_score'] ?? null,
                    'mobileclip_label' => $data['mobileclip_label'] ?? null,
                    'quality_scores' => $data['quality_scores'] ?? null,
                ]);

                StatusLog::create([
                    'report_id' => $report->id,
                    'old_status' => null,
                    'new_status' => 'Menunggu Verifikasi',
                    'actor_name' => $data['reporter_name'],
                    'actor_role' => 'warga',
                    'notes' => 'Laporan dari Telegram Bot',
                ]);

                return $report;
            });
        } catch (\Exception $e) {
            Log::error('DeltaJalan: Gagal submit report dari Telegram.', [
                'error' => $e->getMessage(),
                'chat_id' => $data['chat_id'] ?? null,
                'photo_path' => $data['photo_path'] ?? null,
                'mobileclip_score' => $data['mobileclip_score'] ?? null,
                'quality_scores' => $data['quality_scores'] ?? null,
            ]);

            return null;
        }
    }

    private function matchKecamatan(string $name): string
    {
        $kecamatan = [
            'Sidoarjo', 'Buduran', 'Gedangan', 'Sedati', 'Waru', 'Taman',
            'Krian', 'Balongbendo', 'Wonoayu', 'Sukodono', 'Candi', 'Porong',
            'Krembung', 'Tulangan', 'Tanggulangin', 'Jabon', 'Tarik', 'Prambon',
        ];

        foreach ($kecamatan as $kec) {
            if (str_contains(strtolower($name), strtolower($kec))) {
                return $kec;
            }
        }

        return '';
    }

    private function post(string $method, array $data = []): ?array
    {
        try {
            $response = Http::timeout(self::TIMEOUT)
                ->asJson()
                ->post("{$this->apiUrl}/{$method}", $data);

            if (! $response->successful()) {
                Log::warning('DeltaJalan: Telegram API error.', [
                    'method' => $method,
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

                return null;
            }

            $body = $response->json();

            if (! ($body['ok'] ?? false)) {
                Log::warning('DeltaJalan: Telegram API response not ok.', [
                    'method' => $method,
                    'description' => $body['description'] ?? 'unknown',
                ]);

                return null;
            }

            return $body['result'] ?? null;
        } catch (\Exception $e) {
            Log::warning('DeltaJalan: Telegram API exception.', [
                'method' => $method,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }
}
