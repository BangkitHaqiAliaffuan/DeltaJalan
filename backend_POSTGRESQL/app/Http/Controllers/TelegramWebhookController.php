<?php

namespace App\Http\Controllers;

use App\Models\Report;
use App\Models\TelegramSession;
use App\Models\User;
use App\Services\ImageQualityService;
use App\Services\MobileClipService;
use App\Services\TelegramService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class TelegramWebhookController extends Controller
{
    private TelegramService $telegram;

    private const DAILY_LIMIT = 3;

    private const STATES = [
        'idle',
        'awaiting_photo',
        'awaiting_location',
        'awaiting_description',
        'awaiting_dimension',
        'confirming',
    ];

    public function __construct(TelegramService $telegram)
    {
        $this->telegram = $telegram;
    }

    public function handle(Request $request): JsonResponse
    {
        $secret = $request->header('X-Telegram-Bot-Api-Secret-Token');
        $expected = config('services.telegram.webhook_secret');

        if ($expected && $secret !== $expected) {
            Log::warning('DeltaJalan: Telegram webhook secret mismatch.', [
                'received' => $secret,
            ]);

            return response()->json(['ok' => false], 403);
        }

        $update = $request->json()->all() ?: $request->all() ?: json_decode($request->getContent(), true) ?? [];

        if (empty($update)) {
            return response()->json(['ok' => true]);
        }

        Log::info('DeltaJalan: Telegram update diterima.', [
            'update_id' => $update['update_id'] ?? null,
            'has_callback' => isset($update['callback_query']),
            'has_message' => isset($update['message']),
        ]);

        // ── Callback Query ────────────────────────────────────────────────
        if (isset($update['callback_query'])) {
            return $this->handleCallbackQuery($update['callback_query']);
        }

        $message = $update['message'] ?? [];
        $chatId = $message['chat']['id'] ?? null;

        if (! $chatId) {
            return response()->json(['ok' => true]);
        }

        Log::info('DeltaJalan: Pesan dari chat.', [
            'chat_id' => $chatId,
            'has_text' => isset($message['text']),
            'has_photo' => isset($message['photo']),
            'has_document' => isset($message['document']),
            'has_location' => isset($message['location']),
        ]);

        $session = TelegramSession::firstOrCreate(['chat_id' => $chatId]);
        $from = $message['from'] ?? [];

        // ── Text Messages ──────────────────────────────────────────────
        if (isset($message['text'])) {
            $text = trim($message['text']);

            // /batal — reset from any state
            if (str_starts_with($text, '/batal')) {
                return $this->resetSession($session, $chatId, 'Laporan dibatalkan.');
            }

            // /start
            if (str_starts_with($text, '/start')) {
                return $this->handleStart($session, $chatId);
            }

            // /lapor
            if (str_starts_with($text, '/lapor')) {
                return $this->handleLapor($session, $chatId);
            }

            // /status
            if (str_starts_with($text, '/status')) {
                return $this->handleStatus($session, $chatId);
            }

            // /bantuan
            if (str_starts_with($text, '/bantuan')) {
                return $this->handleBantuan($chatId);
            }

            // Description (awaiting_description state)
            if ($session->state === 'awaiting_description') {
                return $this->handleDescription($session, $chatId, $text);
            }

            // Dimension input (awaiting_dimension state)
            if ($session->state === 'awaiting_dimension') {
                return $this->handleDimensionInput($session, $chatId, $text);
            }

            // Unexpected text
            $msg = match ($session->state) {
                'awaiting_photo' => 'Silakan kirim <b>foto kerusakan jalan</b> (bukan teks). Ketik /batal untuk membatalkan.',
                'awaiting_location' => 'Silakan <b>bagikan lokasi</b> kerusakan melalui tombol di bawah. Ketik /batal untuk membatalkan.',
                'awaiting_dimension' => 'Silakan masukkan angka (contoh: 2.5) atau pilih tombol di atas. Ketik /batal untuk membatalkan.',
                'confirming' => 'Silakan pilih <b>Konfirmasi</b> atau <b>Batalkan</b> di atas. Ketik /batal untuk membatalkan.',
                default => 'Maaf, perintah tidak dikenal. Gunakan /bantuan untuk melihat daftar perintah.'
            };
            $this->telegram->sendMessage($chatId, $msg);

            return response()->json(['ok' => true]);
        }

        // ── Photo ──────────────────────────────────────────────────────
        if (isset($message['photo'])) {
            if ($session->state !== 'awaiting_photo') {
                $this->telegram->sendMessage($chatId,
                    'Foto diterima, tapi Anda belum memulai laporan. Ketik /lapor untuk memulai.'
                );

                return response()->json(['ok' => true]);
            }

            return $this->handlePhoto($session, $chatId, $message['photo'], $from);
        }

        // ── Document ──────────────────────────────────────────────────
        if (isset($message['document'])) {
            if ($session->state !== 'awaiting_photo') {
                $this->telegram->sendMessage($chatId,
                    'Dokumen diterima, tapi Anda belum memulai laporan. Ketik /lapor untuk memulai.'
                );

                return response()->json(['ok' => true]);
            }

            return $this->handleDocument($session, $chatId, $message['document'], $from);
        }

        // ── Location ──────────────────────────────────────────────────
        if (isset($message['location'])) {
            if ($session->state !== 'awaiting_location') {
                $this->telegram->sendMessage($chatId,
                    'Lokasi diterima, tapi Anda belum memulai laporan. Ketik /lapor untuk memulai.'
                );

                return response()->json(['ok' => true]);
            }

            return $this->handleLocation($session, $chatId, $message['location']);
        }

        // ── Unsupported media types ───────────────────────────────────
        $unsupportedTypes = [
            'video' => 'Video',
            'animation' => 'GIF',
            'voice' => 'Voice note',
            'video_note' => 'Video note',
            'audio' => 'Audio',
            'sticker' => 'Stiker',
        ];

        foreach ($unsupportedTypes as $key => $label) {
            if (isset($message[$key])) {
                $this->telegram->sendMessage($chatId,
                    "{$label} tidak didukung.\n\n"
                    .'Silakan kirim <b>foto kerusakan jalan</b> menggunakan kamera asli perangkat Anda.'
                );

                return response()->json(['ok' => true]);
            }
        }

        // ── Unknown ───────────────────────────────────────────────────
        $this->telegram->sendMessage($chatId,
            'Maaf, jenis pesan tidak didukung. Kirim foto atau gunakan perintah /bantuan.'
        );

        return response()->json(['ok' => true]);
    }

    // ──── Callback Query ─────────────────────────────────────────────────────

    private function handleCallbackQuery(array $callback): JsonResponse
    {
        $chatId = $callback['message']['chat']['id'] ?? null;
        $callbackId = $callback['id'] ?? '';
        $data = $callback['data'] ?? '';
        $messageId = $callback['message']['message_id'] ?? null;

        if (! $chatId) {
            return response()->json(['ok' => true]);
        }

        $session = TelegramSession::firstOrCreate(['chat_id' => $chatId]);

        // Parallel: answer callback + remove keyboard from message
        if ($messageId) {
            $this->telegram->answerAndRemoveKeyboard($callbackId, $chatId, $messageId);
        } else {
            $this->telegram->answerCallbackQuery($callbackId, 'Sedang diproses...');
        }

        if ($data === 'confirm_report' && $session->state === 'confirming') {
            return $this->handleConfirm($session, $chatId);
        }

        if ($data === 'cancel_report') {
            return $this->resetSession($session, $chatId, 'Laporan dibatalkan.');
        }

        if ($data === 'add_dimension' && $session->state === 'awaiting_dimension') {
            return $this->handleDimensionDecision($session, $chatId, true);
        }

        if ($data === 'skip_dimension' && $session->state === 'awaiting_dimension') {
            return $this->handleDimensionDecision($session, $chatId, false);
        }

        if ($data === 'start_lanjut') {
            return $this->handleLapor($session, $chatId);
        }

        if ($data === 'start_bantuan') {
            return $this->sendComprehensiveHelp($chatId);
        }

        // Expired / invalid callback
        $this->telegram->sendMessage($chatId,
            'Sesi laporan sudah tidak aktif. Ketik /lapor untuk memulai laporan baru.'
        );

        return response()->json(['ok' => true]);
    }

    // ──── Command Handlers ──────────────────────────────────────────────────

    private function handleStart(TelegramSession $session, int|string $chatId): JsonResponse
    {
        $user = $this->telegram->createOrFindUser($chatId, [
            'first_name' => '',
            'last_name' => '',
        ]);

        $session->update(['state' => 'idle', 'data' => null]);

        $this->telegram->sendMessage($chatId,
            "Selamat datang di <b>DeltaJalan — Laporan Warga</b>!\n\n"
            ."Bot ini membantu Anda melaporkan kerusakan jalan di Kabupaten Sidoarjo.\n\n"
            ."Sebelum memulai, pastikan:\n"
            ."📸 Foto diambil dengan <b>KAMERA HP</b> (bukan screenshot)\n"
            ."📍 Anda berada di lokasi kerusakan jalan\n"
            ."📎 Foto dikirim sebagai <b>FILE/DOKUMEN</b> (agar data tanggal & lokasi terbaca)\n\n"
            .'<i>Dengan menggunakan bot ini, Anda menyetujui bahwa data (foto, lokasi, '
            .'dan informasi Telegram) akan digunakan oleh Dinas PU Bina Marga Kab. Sidoarjo '
            .'untuk penanganan laporan kerusakan jalan.</i>',
            [
                'inline_keyboard' => [
                    [
                        ['text' => 'Lanjut', 'callback_data' => 'start_lanjut'],
                        ['text' => 'Bantuan', 'callback_data' => 'start_bantuan'],
                    ],
                ],
            ]
        );

        return response()->json(['ok' => true]);
    }

    private function handleLapor(TelegramSession $session, int|string $chatId): JsonResponse
    {
        if ($session->state !== 'idle') {
            $this->telegram->sendMessage($chatId,
                'Anda sedang dalam proses laporan. Ketik /batal untuk membatalkan laporan saat ini.'
            );

            return response()->json(['ok' => true]);
        }

        $limitCheck = $this->checkDailyLimit($chatId);
        if ($limitCheck) {
            return $limitCheck;
        }

        $session->update([
            'state' => 'awaiting_photo',
            'data' => ['chat_id' => $chatId],
        ]);

        $this->telegram->sendMessage($chatId,
            "Silakan kirim <b>foto kerusakan jalan</b>.\n\n"
            ."📎 <b>Cara kirim foto:</b>\n"
            ."• Klik ikon 📎 (attachment)\n"
            ."• Pilih <b>\"Dokumen\"</b> atau <b>\"File\"</b>\n"
            ."• Jangan pilih \"Foto/Galeri\" atau \"Kamera\"\n\n"
            .'Foto harus asli dari kamera (bukan screenshot). '
            ."Maksimal 7 hari sejak pengambilan.\n\n"
            .'Ketik /batal kapan saja untuk membatalkan.',
            ['remove_keyboard' => true]
        );

        return response()->json(['ok' => true]);
    }

    private function handleStatus(TelegramSession $session, int|string $chatId): JsonResponse
    {
        $session->update(['state' => 'idle', 'data' => null]);

        $user = User::where('email', "telegram_{$chatId}@telegram.jalankita.lokal")->first();

        if (! $user) {
            $this->telegram->sendMessage($chatId,
                'Anda belum memiliki laporan. Ketik /lapor untuk membuat laporan baru.'
            );

            return response()->json(['ok' => true]);
        }

        $reports = Report::where('user_id', $user->id)
            ->orderBy('created_at', 'desc')
            ->limit(3)
            ->get();

        if ($reports->isEmpty()) {
            $this->telegram->sendMessage($chatId,
                'Anda belum memiliki laporan. Ketik /lapor untuk membuat laporan baru.'
            );

            return response()->json(['ok' => true]);
        }

        $msg = "<b>Laporan Terakhir Anda</b>\n\n";
        foreach ($reports as $r) {
            $status = $r->status;
            $road = htmlspecialchars($r->road_name ?: '-', ENT_QUOTES, 'UTF-8');
            $date = $r->created_at ? $r->created_at->format('d/m/Y') : '-';
            $msg .= "{$r->report_code}\n";
            $msg .= "Jalan: {$road}\n";
            $msg .= "Status: {$status}\n";
            $msg .= "Tanggal: {$date}\n\n";
        }
        $msg .= 'Ketik /lapor untuk laporan baru.';

        $this->telegram->sendMessage($chatId, $msg);

        return response()->json(['ok' => true]);
    }

    private function handleBantuan(int|string $chatId): JsonResponse
    {
        $this->telegram->sendMessage($chatId,
            "<b>Bantuan DeltaJalan Bot</b>\n\n"
            ."/lapor — Laporkan kerusakan jalan\n"
            ."/status — Cek status laporan\n"
            ."/bantuan — Tampilkan ini\n"
            ."/batal — Batalkan laporan saat ini\n\n"
            ."Laporkan kerusakan jalan dengan 3 langkah mudah:\n"
            ."1. Kirim foto kerusakan\n"
            ."2. Bagikan lokasi\n"
            ."3. Ketik deskripsi\n\n"
            .'Butuh bantuan lebih lanjut? Hubungi Dinas PU Bina Marga Kab. Sidoarjo.',
            ['remove_keyboard' => true]
        );

        return response()->json(['ok' => true]);
    }

    private function sendComprehensiveHelp(int|string $chatId): JsonResponse
    {
        $this->telegram->sendMessage($chatId,
            "<b>📸 LAPORAN KERUSAKAN JALAN — PANDUAN LENGKAP</b>\n\n"
            ."━━━━━━━━━━━━━━━━━━━━━━━━\n"
            ."<b>1. AMBIL FOTO</b>\n"
            ."━━━━━━━━━━━━━━━━━━━━━━━━\n"
            ."• Buka aplikasi Kamera HP Anda\n"
            ."• Arahkan ke kerusakan jalan dari jarak yang menunjukkan kondisi sekitar\n"
            ."• Pastikan pencahayaan cukup dan fokus jelas\n"
            ."• Foto otomatis menyimpan data lokasi & tanggal (EXIF)\n\n"
            ."━━━━━━━━━━━━━━━━━━━━━━━━\n"
            ."<b>2. KIRIM FOTO KE BOT</b>\n"
            ."━━━━━━━━━━━━━━━━━━━━━━━━\n"
            ."• Klik tombol <b>Mulai Lapor</b> di bawah\n"
            ."• Klik ikon 📎 (attachment)\n"
            ."• Pilih <b>\"Dokumen\"</b> atau <b>\"File\"</b>\n"
            ."• Pilih foto yang sudah diambil\n"
            ."• Tunggu hingga terkirim\n\n"
            ."⚠️ <b>Penting:</b> Jangan kirim dari galeri langsung atau kamera "
            ."Telegram — data lokasi & tanggal akan hilang!\n\n"
            ."━━━━━━━━━━━━━━━━━━━━━━━━\n"
            ."<b>3. BAGIKAN LOKASI</b>\n"
            ."━━━━━━━━━━━━━━━━━━━━━━━━\n"
            ."• Setelah foto diterima, klik tombol \"Kirim Lokasi Saya\"\n"
            ."• Pastikan GPS HP Anda AKTIF\n"
            ."• Anda WAJIB berada di lokasi kerusakan\n\n"
            ."━━━━━━━━━━━━━━━━━━━━━━━━\n"
            ."<b>4. DESKRIPSI</b>\n"
            ."━━━━━━━━━━━━━━━━━━━━━━━━\n"
            ."• Ketik deskripsi kerusakan (contoh: \"Lubang besar di tengah jalan\")\n"
            ."• Konfirmasi data laporan\n"
            ."• Selesai! Laporan akan diverifikasi petugas.\n\n"
            ."━━━━━━━━━━━━━━━━━━━━━━━━\n"
            ."Perintah lain:\n"
            ."/status — Cek status laporan\n"
            ."/bantuan — Tampilkan panduan ini\n"
            ."/batal — Batalkan laporan",
            [
                'inline_keyboard' => [
                    [
                        ['text' => 'Mulai Lapor', 'callback_data' => 'start_lanjut'],
                    ],
                ],
            ]
        );

        return response()->json(['ok' => true]);
    }

    // ──── Photo Handler ─────────────────────────────────────────────────────

    private function handlePhoto(TelegramSession $session, int|string $chatId, array $photoArray, array $from): JsonResponse
    {
        $this->telegram->sendMessage($chatId,
            '⚠️ Foto yang dikirim langsung lewat chat akan diturunkan kualitasnya, '
            .'dan data <b>tanggal</b> serta <b>lokasi GPS</b> tidak bisa diambil dari foto tersebut.'."\n\n"
            .'Silakan kirim ulang foto kerusakan jalan sebagai <b>dokumen/file</b> '
            .'dengan menekan ikon 📎 (attachment) lalu pilih <b>"Dokumen"</b> atau <b>"File"</b>, '
            .'bukan "Foto" atau "Kamera".'."\n\n"
            .'State laporan tetap tersimpan — cukup kirim file tanpa perlu /lapor lagi.'
        );

        return response()->json(['ok' => true]);
    }

    // ──── Document Handler ──────────────────────────────────────────────────

    private function handleDocument(TelegramSession $session, int|string $chatId, array $doc, array $from): JsonResponse
    {
        $mime = $doc['mime_type'] ?? '';

        if (! str_starts_with($mime, 'image/')) {
            $this->telegram->sendMessage($chatId,
                "Dokumen yang diterima bukan gambar (MIME: {$mime}).\n\n"
                .'Silakan kirim foto kerusakan jalan.'
            );

            return response()->json(['ok' => true]);
        }

        $fileId = $doc['file_id'];
        $fileName = $doc['file_name'] ?? 'unknown';

        $path = $this->telegram->downloadFile($fileId);

        if (! $path) {
            $this->telegram->sendMessage($chatId, 'Gagal mengunduh foto. Silakan coba lagi.');

            return response()->json(['ok' => true]);
        }

        $exif = $this->telegram->readExifData($path);

        if (! $exif) {
            $this->telegram->sendMessage($chatId,
                'Foto tidak memiliki metadata EXIF. '
                ."Gunakan foto asli dari kamera perangkat Anda.\n\n"
                ."Silakan kirim ulang foto. State laporan tetap tersimpan — cukup kirim file baru."
            );

            return response()->json(['ok' => true]);
        }

        $dateCheck = $this->telegram->validatePhotoDate($exif, storage_path("app/public/{$path}"));

        if ($dateCheck['status'] === 'no_exif_date') {
            $this->telegram->sendMessage($chatId,
                'Foto tidak memiliki metadata tanggal. '
                ."Gunakan foto asli dari kamera perangkat Anda.\n\n"
                ."Silakan kirim ulang foto. State laporan tetap tersimpan — cukup kirim file baru."
            );

            return response()->json(['ok' => true]);
        }

        if ($dateCheck['status'] === 'future_date' || $dateCheck['status'] === 'too_old') {
            $this->telegram->sendMessage($chatId,
                $dateCheck['message']."\n\n"
                .'Silakan kirim ulang foto. State laporan tetap tersimpan — cukup kirim file baru.'
            );

            return response()->json(['ok' => true]);
        }

        // ── MobileCLIP relevance check at upload ──
        $fullPath = storage_path("app/public/{$path}");
        $mobileclip = app(MobileClipService::class)->checkBlocking(
            $fullPath,
            basename($path)
        );

        if ($mobileclip !== null && $mobileclip['blocked']) {
            $this->telegram->sendMessage($chatId,
                'Foto tidak relevan dengan kerusakan jalan. Silakan kirim foto yang menunjukkan kondisi jalan, seperti lubang, retak, atau kerusakan infrastruktur jalan lainnya.'."\n\nSilakan kirim ulang foto. State laporan tetap tersimpan — cukup kirim file baru."
            );

            return response()->json(['ok' => true]);
        }

        // ── Image quality check at upload ──
        $quality = app(ImageQualityService::class)->checkBlocking(
            $fullPath,
            basename($path)
        );

        if ($quality !== null && $quality['blocked']) {
            $this->telegram->sendMessage($chatId,
                'Foto terlalu '.($quality['status'] === 'blurry' ? 'kabur' : 'gelap').'. Silakan kirim ulang foto dengan pencahayaan dan fokus yang baik.'."\n\nSilakan kirim ulang foto. State laporan tetap tersimpan — cukup kirim file baru."
            );

            Log::info('[Telegram] handleDocument — quality check blocked', [
                'chat_id' => $chatId,
                'status' => $quality['status'],
                'blurScore' => $quality['blurScore'],
                'meanBrightness' => $quality['meanBrightness'],
            ]);

            return response()->json(['ok' => true]);
        }

        if ($quality === null) {
            Log::warning('[Telegram] handleDocument — quality check bypassed (FastAPI unreachable)', [
                'chat_id' => $chatId,
                'photo_path' => $path,
            ]);
        } else {
            Log::info('[Telegram] handleDocument — quality check passed', [
                'chat_id' => $chatId,
                'status' => $quality['status'],
                'blurScore' => $quality['blurScore'],
                'meanBrightness' => $quality['meanBrightness'],
            ]);
        }

        $data = $session->data ?? [];
        $data['photo_path'] = $path;
        $data['reporter_name'] = trim(($from['first_name'] ?? '').' '.($from['last_name'] ?? '')) ?: "Warga {$chatId}";
        $data['mobileclip_score'] = $mobileclip['score'] ?? null;
        $data['mobileclip_label'] = $mobileclip['label'] ?? null;
        if ($quality !== null) {
            $data['quality_scores'] = json_encode([
                'status' => $quality['status'],
                'blurScore' => $quality['blurScore'],
                'meanBrightness' => $quality['meanBrightness'],
                'brightnessStdDev' => $quality['brightnessStdDev'],
            ]);
        }

        $session->update([
            'state' => 'awaiting_location',
            'data' => $data,
        ]);

        $keyboard = [
            'keyboard' => [
                [
                    ['text' => 'Kirim Lokasi Saya', 'request_location' => true],
                ],
            ],
            'resize_keyboard' => true,
            'one_time_keyboard' => true,
        ];

        $this->telegram->sendMessage($chatId,
            'Foto diterima, tetapi <b>tidak mengandung data GPS</b>.'."\n\n"
            .'Silakan bagikan lokasi kerusakan melalui tombol di bawah.'."\n\n"
            .'<b>Penting:</b> Anda WAJIB berada tepat di lokasi kerusakan jalan — sistem mengambil lokasi Anda.',
            $keyboard
        );

        return response()->json(['ok' => true]);
    }

    // ──── Location Handler ──────────────────────────────────────────────────

    private function handleLocation(TelegramSession $session, int|string $chatId, array $location): JsonResponse
    {
        $lat = $location['latitude'];
        $lng = $location['longitude'];

        // Validate Sidoarjo bounds
        if ($lat < -7.65 || $lat > -7.25 || $lng < 112.50 || $lng > 112.95) {
            $this->telegram->sendMessage($chatId,
                'Lokasi berada di luar wilayah Kabupaten Sidoarjo.'."\n\n"
                .'Pastikan Anda melaporkan kerusakan di wilayah Sidoarjo.',
                ['remove_keyboard' => true]
            );

            return response()->json(['ok' => true]);
        }

        // Reverse geocode
        $geocode = $this->telegram->reverseGeocode($lat, $lng);

        $data = $session->data ?? [];
        $data['latitude'] = $lat;
        $data['longitude'] = $lng;
        $data['road_name'] = $geocode['road_name'] ?? '';
        $data['district'] = $geocode['district'] ?? '';

        $session->update([
            'state' => 'awaiting_description',
            'data' => $data,
        ]);

        $roadInfo = $data['road_name']
            ? "Nama jalan: <b>{$data['road_name']}</b>"
            : 'Lokasi telah diterima.';

        $this->telegram->sendMessage($chatId,
            'Lokasi diterima!'."\n\n"
            .$roadInfo."\n\n"
            .'Sekarang ketik <b>deskripsi kerusakan</b>.'."\n\n"
            .'Contoh: "Lubang besar di tengah jalan, hampir menabrak motor"'."\n\n"
            .'Ketik /batal untuk membatalkan.',
            ['remove_keyboard' => true]
        );

        return response()->json(['ok' => true]);
    }

    // ──── Description Handler ───────────────────────────────────────────────

    private function handleDescription(TelegramSession $session, int|string $chatId, string $text): JsonResponse
    {
        if (mb_strlen($text) > 2000) {
            $this->telegram->sendMessage($chatId,
                'Deskripsi terlalu panjang (maksimal 2000 karakter). Silakan ketik ulang.'
            );

            return response()->json(['ok' => true]);
        }

        $data = $session->data ?? [];
        $data['description'] = $text;

        $session->update([
            'state' => 'awaiting_dimension',
            'data' => $data,
        ]);

        $keyboard = [
            'inline_keyboard' => [
                [
                    ['text' => 'Ya, masukkan dimensi', 'callback_data' => 'add_dimension'],
                ],
                [
                    ['text' => 'Tidak, lanjutkan', 'callback_data' => 'skip_dimension'],
                ],
            ],
        ];

        $this->telegram->sendMessage($chatId,
            'Apakah Anda mengetahui <b>dimensi kerusakan</b> (panjang & lebar)?'."\n\n"
            .'Ini membantu petugas mempersiapkan perbaikan.',
            $keyboard
        );

        return response()->json(['ok' => true]);
    }

    // ──── Dimension Decision Handler ─────────────────────────────────────────

    private function handleDimensionDecision(TelegramSession $session, int|string $chatId, bool $addDimension): JsonResponse
    {
        if (! $addDimension) {
            return $this->showConfirmation($session, $chatId);
        }

        $data = $session->data ?? [];
        $data['dimension_step'] = 'panjang';
        $session->update(['data' => $data]);

        $this->telegram->sendMessage($chatId,
            'Masukkan <b>panjang</b> kerusakan (meter).'."\n\n"
            .'Contoh: <code>2.5</code> (dua setengah meter)'."\n\n"
            .'Ketik /batal untuk membatalkan.'
        );

        return response()->json(['ok' => true]);
    }

    // ──── Dimension Input Handler ───────────────────────────────────────────

    private function handleDimensionInput(TelegramSession $session, int|string $chatId, string $text): JsonResponse
    {
        $data = $session->data ?? [];
        $step = $data['dimension_step'] ?? 'panjang';

        $value = $this->validateDimensionInput($text);

        if ($value === null) {
            $label = $step === 'panjang' ? 'panjang' : 'lebar';
            $this->telegram->sendMessage($chatId,
                "Masukkan angka yang valid untuk {$label} (0.01 - 100 meter)."."\n"
                .'Contoh: <code>2.5</code>'
            );

            return response()->json(['ok' => true]);
        }

        if ($step === 'panjang') {
            $data['kerusakan_panjang'] = $value;
            $data['dimension_step'] = 'lebar';
            $session->update(['data' => $data]);

            $this->telegram->sendMessage($chatId,
                "Panjang: {$value} m"."\n\n"
                .'Sekarang masukkan <b>lebar</b> kerusakan (meter).'."\n\n"
                .'Contoh: <code>1.5</code>'
            );
        } else {
            $data['kerusakan_lebar'] = $value;
            unset($data['dimension_step']);
            $session->update(['data' => $data]);

            return $this->showConfirmation($session, $chatId);
        }

        return response()->json(['ok' => true]);
    }

    // ──── Confirmation Display ──────────────────────────────────────────────

    private function showConfirmation(TelegramSession $session, int|string $chatId): JsonResponse
    {
        $data = $session->data ?? [];

        $session->update([
            'state' => 'confirming',
            'data' => $data,
        ]);

        $roadName = htmlspecialchars($data['road_name'] ?: '(tidak terdeteksi)', ENT_QUOTES, 'UTF-8');
        $district = htmlspecialchars($data['district'] ?: '(tidak terdeteksi)', ENT_QUOTES, 'UTF-8');
        $lat = $data['latitude'] ?? '-';
        $lng = $data['longitude'] ?? '-';
        $desc = htmlspecialchars($data['description'] ?? '-', ENT_QUOTES, 'UTF-8');

        $msg = "<b>Konfirmasi Laporan</b>\n\n"
            ."Jalan: {$roadName}\n"
            ."Kecamatan: {$district}\n"
            ."Koordinat: {$lat}, {$lng}\n";

        if (isset($data['kerusakan_panjang']) && isset($data['kerusakan_lebar'])) {
            $msg .= "Dimensi: {$data['kerusakan_panjang']}m x {$data['kerusakan_lebar']}m\n";
        }

        $msg .= "Deskripsi: {$desc}\n\n"
            .'Apakah data di atas sudah benar?';

        $keyboard = [
            'inline_keyboard' => [
                [
                    ['text' => 'Konfirmasi', 'callback_data' => 'confirm_report'],
                ],
                [
                    ['text' => 'Batalkan', 'callback_data' => 'cancel_report'],
                ],
            ],
        ];

        $this->telegram->sendMessage($chatId, $msg, $keyboard);

        return response()->json(['ok' => true]);
    }

    private function handleConfirm(TelegramSession $session, int|string $chatId): JsonResponse
    {
        $data = $session->data ?? [];

        $required = ['photo_path', 'latitude', 'longitude', 'reporter_name'];
        foreach ($required as $field) {
            if (empty($data[$field])) {
                $this->telegram->sendMessage($chatId,
                    "Data tidak lengkap ({$field} hilang). Ketik /lapor untuk memulai ulang."
                );
                $session->update(['state' => 'idle', 'data' => null]);

                return response()->json(['ok' => true]);
            }
        }

        // Ensure user exists
        $user = $this->telegram->createOrFindUser($chatId, [
            'first_name' => $data['reporter_name'],
        ]);

        $data['user_id'] = $user->id;
        $data['chat_id'] = $chatId;

        if (empty($data['district'])) {
            $data['district'] = 'Sidoarjo';
        }

        if (empty($data['road_name'])) {
            $data['road_name'] = 'Jalan di Sidoarjo';
        }

        $report = $this->telegram->submitReport($data);

        if (! $report) {
            $this->telegram->sendMessage($chatId,
                'Gagal menyimpan laporan. Silakan coba lagi dengan mengetik /lapor.'
            );
            $session->update(['state' => 'idle', 'data' => null]);

            return response()->json(['ok' => true]);
        }

        $session->update(['state' => 'idle', 'data' => null]);

        $this->telegram->sendMessage($chatId,
            'Laporan berhasil dikirim!'."\n\n"
            .'Kode laporan: <b>'.htmlspecialchars($report->report_code, ENT_QUOTES, 'UTF-8').'</b>'."\n\n"
            .'Laporan Anda akan diverifikasi oleh petugas.'."\n"
            .'Gunakan /status untuk mengecek status laporan.'
        );

        return response()->json(['ok' => true]);
    }

    // ──── Helpers ───────────────────────────────────────────────────────────

    private function resetSession(TelegramSession $session, int|string $chatId, string $message): JsonResponse
    {
        $session->update(['state' => 'idle', 'data' => null]);

        $this->telegram->sendMessage($chatId,
            $message."\n\nKetik /lapor untuk memulai laporan baru.",
            ['remove_keyboard' => true]
        );

        return response()->json(['ok' => true]);
    }

    private function validateDimensionInput(string $input): ?float
    {
        $input = str_replace(',', '.', trim($input));

        if (! is_numeric($input)) {
            return null;
        }

        $value = (float) $input;

        if ($value < 0.01 || $value > 100) {
            return null;
        }

        return round($value, 2);
    }

    private function checkDailyLimit(int|string $chatId): ?JsonResponse
    {
        $user = User::where('email', "telegram_{$chatId}@telegram.jalankita.lokal")->first();

        if (! $user) {
            return null;
        }

        $todayCount = Report::where('user_id', $user->id)
            ->whereDate('created_at', today())
            ->count();

        if ($todayCount >= self::DAILY_LIMIT) {
            $this->telegram->sendMessage($chatId,
                'Batas laporan harian ('.self::DAILY_LIMIT.' laporan) telah tercapai. Silakan coba lagi besok.'
            );

            return response()->json(['ok' => true]);
        }

        return null;
    }
}
