# Manual Testing — DeltaJalan (JalanKita)

## Daftar Isi

1. [Konfigurasi & Prasyarat](#1-konfigurasi--prasyarat)
2. [Arsitektur & Alur Data](#2-arsitektur--alur-data)
3. [Role & Akun Testing](#3-role--akun-testing)
4. [Status Flow Diagram](#4-status-flow-diagram)
5. [Source: Warga (Web)](#5-source-warga-web)
6. [Source: Telegram Bot](#6-source-telegram-bot)
7. [Source: Petugas Satgas (Web)](#7-source-petugas-satgas-web)
8. [Source: Supervisor (Web)](#8-source-supervisor-web)
9. [Source: Petugas Eksekusi](#9-source-petugas-eksekusi)
10. [Source: Admin](#10-source-admin)
11. [Cross-Cutting: Foto & EXIF Validation](#11-cross-cutting-foto--exif-validation)
12. [Cross-Cutting: Duplicate Detection](#12-cross-cutting-duplicate-detection)
13. [Cross-Cutting: AI Analysis](#13-cross-cutting-ai-analysis)
14. [Cross-Cutting: Notifikasi](#14-cross-cutting-notifikasi)
15. [Edge Cases & Negative Tests](#15-edge-cases--negative-tests)

---

## 1. Konfigurasi & Prasyarat

### 1.1 Services (jalankan semua)

| Service | Port | Cara Jalankan |
|---|---|---|
| Laravel API | 8080 | `cd backend_POSTGRESQL && php artisan serve --port=8080` |
| Laravel Queue | — | `cd backend_POSTGRESQL && php artisan queue:work` (di terminal terpisah) |
| FastAPI AI | 8000 | `cd backend_AI && python server.py` |
| Vite Frontend | 5173 | `cd Frontend-stable && npm run dev` |

### 1.2 Telegram Bot Webhook

Setelah Laravel running, set webhook (cukup sekali):

```bash
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -d "url=https://<tunnel>/telegram/webhook" \
  -d "secret_token=<WEBHOOK_SECRET>" \
  -d "allowed_updates=[\"message\",\"callback_query\"]"
```

Verifikasi:

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getWebhookInfo"
```

**Untuk development lokal**, gunakan ngrok/playit/tunnel di port 8080, lalu set webhook ke URL tunnel + `/telegram/webhook`.

### 1.3 File Storage

```bash
cd backend_POSTGRESQL
php artisan storage:link
```

Pastikan folder `storage/app/public/reports/photos/` writable.

### 1.4 Environment Variables

File `.env` di `backend_POSTGRESQL/`:

```
TELEGRAM_BOT_TOKEN=...
TELEGRAM_WEBHOOK_SECRET=...
LOCATIONIQ_KEY=...
APP_URL=http://localhost:5173
```

---

## 2. Arsitektur & Alur Data

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Telegram     │────▶│  Laravel API  │────▶│  PostgreSQL  │
│  Bot         │     │  :8080        │     │              │
└──────────────┘     └──────┬───────┘     └──────────────┘
                            │
┌──────────────┐            │             ┌──────────────┐
│  Vite        │◀───proxy───┤             │  FastAPI AI  │
│  Frontend    │  /api/*    │             │  :8000       │
│  :5173       │            │◀────────────│              │
└──────────────┘            │  /analyze    └──────────────┘
                            │
                    ┌───────┴────────┐
                    │  LocationIQ    │
                    │  reverse-geo   │
                    └────────────────┘
```

### 2.1 Entry Points (3 Sources)

| Source | Entry | Autentikasi |
|---|---|---|
| **Warga (Web)** | `POST /api/warga/reports` (via React form) | Sanctum token (role: warga) |
| **Telegram** | `POST /telegram/webhook` (via Telegram webhook) | Public (secret token header) |
| **Petugas (Web)** | `POST /api/reports` (via React form atau patroli) | Sanctum token (role: petugas/supervisor) |

### 2.2 Report Status Lifecycle

```
WARGA / TELEGRAM:

  [Menunggu Review] ──▶ [Ditinjau] ──▶ [Disetujui] ──▶ [Ditugaskan] ──▶ [Sedang Diperbaiki] ──▶ [Selesai]
        │                     │              │               │                    │
        └── [Ditolak]         └── [Ditolak]  └── [Ditolak]   └── [Ditolak]        └── [reopen] ──▶ [Sedang Diperbaiki]

PETUGAS:

  [Menunggu Review] ──▶ [mulai-edit] ──▶ [Diedit]
        │                                    │
        └── [Ditolak]               [batal-edit] ──▶ [Menunggu Review]
                                    [update]    ──▶ [Menunggu Review]

  [Menunggu Review] ──▶ [Ditinjau] ──▶ [Disetujui] ──▶ [Ditugaskan] ──▶ [Sedang Diperbaiki] ──▶ [Selesai]
```

### 2.3 AI Analysis Flow

```
  [Menunggu Review] ──▶ [Hasil AI] ──▶ [Menunggu Verifikasi] ──▶ [Disetujui]
         ^                   │                                         │
         └─── [tolak]        └── /analyze-ai (trigger manual)         └── /confirm-ai

  Catatan: Alur "Hasil AI" hanya untuk source warga/telegram.
  Source petugas tidak perlu AI — langsung supervisor review.
```

### 2.4 File Storage Convention

```
storage/app/public/reports/photos/
  <report_id>/
    (original files)
  <report_id>_result/
    (annotated AI result images)
```

---

## 3. Role & Akun Testing

### 3.1 Login URLs

| Role | URL |
|---|---|
| Warga | `http://localhost:5173/` |
| Petugas / Supervisor | `http://localhost:5173/login-petugas` |
| Admin | `http://localhost:5173/admin/login` |

### 3.2 Akun Testing

Semua password: `password123`

| Role | Nama | Email | Tim |
|---|---|---|---|
| `warga` | (register sendiri) | — | — |
| `petugas` | Agus Setiawan | agus.setiawan@dispu.binamarga.go.id | Tim Satgas Utara |
| `petugas` | Rizky Firmansyah | rizky.firmansyah@dispu.binamarga.go.id | Tim Satgas Pusat |
| `petugas` | Dewi Rahayu | dewi.rahayu@dispu.binamarga.go.id | Tim Satgas Barat |
| `petugas` | Bambang Eko | bambang.eko@dispu.binamarga.go.id | Tim Satgas Selatan |
| `petugas` | Dodi Kurniawan | dodi.kurniawan@dispu.binamarga.go.id | Tim Satgas Timur |
| `supervisor` | Budi Santoso | budi.santoso@dispu.binamarga.go.id | — |
| `supervisor` | Siti Marlina | siti.marlina@dispu.binamarga.go.id | — |
| `supervisor` | Hendra Kusuma | hendra.kusuma@dispu.binamarga.go.id | — |
| `supervisor` | Fajar Nugroho | fajar.nugroho@dispu.binamarga.go.id | — |
| `admin` | Admin Utama | admin@dispu.binamarga.go.id | — |

### 3.3 Telegram Bot

Username: `@DeltaJalanBot` (atau sesuai deploy)

---

## 4. Status Flow Diagram (Detail)

### 4.1 Warga/Telegram → Supervisor Review

```
┌──────────────┐
│ Menunggu     │  Laporan baru masuk (warga/telegram)
│ Review       │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Ditinjau     │  Supervisor klik "Mulai Review"
└──────┬───────┘
       │
       ├──────────────────┐
       ▼                  ▼
┌──────────────┐  ┌──────────────┐
│ Disetujui    │  │ Ditolak      │
│ (approve)    │  │ (tolak)      │
└──────┬───────┘  └──────────────┘
       │
       ▼
┌──────────────┐
│ Ditugaskan   │  Auto-assign to team based on kecamatan
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Sedang       │  Petugas klik "Mulai"
│ Diperbaiki   │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Selesai      │  Petugas klik "Selesai" + upload after_photo
└──────────────┘
```

### 4.2 Warga/Telegram → AI Analysis

```
┌──────────────┐
│ Menunggu     │
│ Review       │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Hasil AI     │  Supervisor klik "Analisis AI"
└──────┬───────┘
       │
       ├──────────────────┐
       ▼                  ▼
┌──────────────┐  ┌──────────────┐
│ Menunggu     │  │ Ditolak      │
│ Verifikasi   │  │ (tolak)      │
│ (confirm-ai) │  └──────────────┘
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Disetujui    │  Supervisor klik "Konfirmasi AI"
│ (approve)    │  → auto-assign team
└──────────────┘
```

### 4.3 Petugas → Edit Flow

```
┌──────────────┐
│ Menunggu     │
│ Review       │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Diedit       │  Petugas klik "Edit"
└──────┬───────┘
       │
       ├──────────────────┐
       ▼                  ▼
┌──────────────┐  ┌──────────────┐
│ Menunggu     │  │ Menunggu     │
│ Review       │  │ Review       │
│ (update)     │  │ (batal-edit) │
└──────────────┘  └──────────────┘
```

---

## 5. Source: Warga (Web)

### 5.1 Flow: Register

**Precondition:** Browser di `http://localhost:5173/`

| # | Langkah | Expected Result |
|---|---|---|
| 1 | Klik "Daftar" atau buka `/daftar` | Form register tampil |
| 2 | Isi nama, email, nomor telepon, password, konfirmasi password | — |
| 3 | Klik "Daftar" | Redirect ke halaman login, notifikasi sukses |
| 4 | Cek database: `users` table → role = `warga` | Verified |

### 5.2 Flow: Login → Dashboard

| # | Langkah | Expected Result |
|---|---|---|
| 1 | Buka `http://localhost:5173/` | Form login warga |
| 2 | Isi email & password yang sudah didaftarkan | — |
| 3 | Klik "Masuk" | Redirect ke `/warga/lapor` atau `/warga/laporan` |
| 4 | Dashboard warga tampil | Stats cards (total, proses, selesai, ditolak) |
| 5 | Ada tombol "Laporkan Kerusakan Jalan" | Between stats and Laporan Terbaru |

### 5.3 Flow: Lapor (Single Report)

| # | Langkah | Expected Result |
|---|---|---|
| 1 | Klik "Laporkan Kerusakan Jalan" | Form lapor terbuka |
| 2 | Isi nama pelapor (optional, default dari user) | — |
| 3 | Pilih foto (klik area upload) | File picker terbuka |
| 4 | Pilih foto dari kamera/gallery (JPEG/PNG, <5MB) | Preview foto tampil |
| 5 | Klik "Ambil dari Peta" atau deteksi lokasi otomatis | Map picker atau GPS detection |
| 6 | Pilih lokasi di peta (Sidoarjo area) | Lat/lng terisi |
| 7 | Cari nama jalan — ketik minimal 3 huruf | Autocomplete road suggestions |
| 8 | Pilih nama jalan dari autocomplete | Road name terisi |
| 9 | Isi deskripsi kerusakan | Textarea terisi |
| 10 | Isi dimensi (panjang × lebar, optional) | Input angka |
| 11 | Klik "Kirim Laporan" | Loading, lalu redirect ke `/warga/laporan` |
| 12 | Cek di halaman daftar laporan | Laporan baru muncul dengan status "Menunggu Review" |
| 13 | Cek database: `reports` → `source='warga'`, `status='Menunggu Review'` | Verified |

### 5.4 Flow: Batch Upload

| # | Langkah | Expected Result |
|---|---|---|
| 1 | Di form lapor, centang "Laporan Berganda" atau klik "Upload Berganda" | Mode batch aktif |
| 2 | Pilih 3-5 foto sekaligus (max 20) | Preview semua foto |
| 3 | Atur koordinat lokasi (berlaku untuk semua sub-report) | — |
| 4 | Isi deskripsi untuk setiap foto (optional) | — |
| 5 | Klik "Kirim Semua" | Masing-masing foto jadi Report terpisah dengan `batch_id` sama |
| 6 | Cek database: semua report punya `batch_id` sama, `source='warga'` | Verified |

### 5.5 Flow: Lacak Laporan (Public, tanpa login)

| # | Langkah | Expected Result |
|---|---|---|
| 1 | Buka `/lacak` | Form tracking |
| 2 | Masukkan kode laporan (contoh: LP-2026-000001) | — |
| 3 | Klik "Lacak" | Detail laporan tampil + timeline status |

### 5.6 Flow: Lihat Laporan Saya

| # | Langkah | Expected Result |
|---|---|---|
| 1 | Login sebagai warga | — |
| 2 | Buka `/warga/laporan` | Daftar semua laporan milik user (source=warga + telegram) |
| 3 | Search bar bekerja | Filter laporan by keyword |
| 4 | Filter chips bekerja | Filter by status (semua/proses/selesai/ditolak) |
| 5 | Klik salah satu laporan | Detail laporan: foto, timeline status, lokasi di peta |

### 5.7 Flow: Lihat Peta

| # | Langkah | Expected Result |
|---|---|---|
| 1 | Buka `/warga/peta` | Peta interaktif dengan marker laporan |
| 2 | Klik marker | Info laporan muncul |

### 5.8 Validation: Foto Tanpa EXIF

| # | Langkah | Expected Result |
|---|---|---|
| 1 | Download foto dari internet (Pinterest, Google Images) | — |
| 2 | Upload foto tersebut di form lapor | Error: "Foto tidak memiliki metadata tanggal" |
| 3 | Cek server log: `WargaReportController: EXIF date missing` | Log tercatat |

### 5.9 Validation: Foto >7 Hari

| # | Langkah | Expected Result |
|---|---|---|
| 1 | Cari foto dengan EXIF date >7 hari yang lalu | — |
| 2 | Upload di form lapor | Error: "Foto diambil pada ... (lebih dari 7 hari)" |

### 5.10 Validation: Foto Duplikat

| # | Langkah | Expected Result |
|---|---|---|
| 1 | Buat laporan dengan foto A | Berhasil |
| 2 | Buat laporan baru dengan foto A yang sama | Warning: "Foto sudah pernah digunakan" atau di-skip |

### 5.11 Validation: Koordinat di Luar Sidoarjo

| # | Langkah | Expected Result |
|---|---|---|
| 1 | Pilih lokasi di luar Sidoarjo (misal Surabaya) | Error: "Lokasi di luar wilayah Sidoarjo" |

### 5.12 Validation: Nama Jalan Manual (Tanpa Autocomplete)

| # | Langkah | Expected Result |
|---|---|---|
| 1 | Ketik nama jalan manual tanpa pilih autocomplete | API tetap menerima, tapi supervisor bisa review mismatch |

---

## 6. Source: Telegram Bot

### 6.1 Prasyarat

- Bot sudah di-set webhook ke Laravel
- User sudah chat dengan bot (@DeltaJalanBot)
- Foto uji: (a) foto kamera asli, (b) screenshot, (c) foto dari Pinterest, (d) foto >7 hari, (e) video, (f) GIF, (g) dokumen non-gambar

### 6.2 Flow: /start

| # | Langkah | Expected Result |
|---|---|---|
| 1 | Ketik `/start` | Bot reply: "Selamat datang... Laporkan kerusakan jalan dengan /lapor" |
| 2 | Cek database: `telegram_sessions` → `chat_id` tersimpan | State: `idle` |

### 6.3 Flow: /lapor → Kirim Foto

| # | Langkah | Expected Result |
|---|---|---|
| 1 | Ketik `/lapor` | Bot reply: "Silakan kirim foto kerusakan jalan" + state → `awaiting_photo` |
| 2 | Kirim foto dari kamera (via "Gallery" → pilih foto) | Bot download foto, EXIF check |
| 3 | EXIF valid (date ≤7 hari) | Bot reply: "Foto diterima..." + keyboard "Kirim Lokasi Saya" |
| 4 | State berubah ke `awaiting_location` | Verified di database |

### 6.4 Flow: Kirim Lokasi

| # | Langkah | Expected Result |
|---|---|---|
| 1 | Klik "Kirim Lokasi Saya" | Bot terima lokasi, reverse geocode via LocationIQ |
| 2 | Lokasi di Sidoarjo | Bot reply: "Lokasi diterima! Nama jalan: ... Sekarang ketik deskripsi kerusakan" |
| 3 | State berubah ke `awaiting_description` | Verified |

### 6.5 Flow: Kirim Deskripsi

| # | Langkah | Expected Result |
|---|---|---|
| 1 | Ketik deskripsi (contoh: "Lubang besar di tengah jalan") | Bot reply: "Deskripsi diterima." + inline keyboard "Ya/Tidak" untuk dimensi |
| 2 | State berubah ke `awaiting_dimension` | Verified |

### 6.6 Flow: Dimensi (Optional)

#### Opsi A: Ya, masukkan dimensi

| # | Langkah | Expected Result |
|---|---|---|
| 1 | Klik "Ya, masukkan dimensi" | Bot reply: "Masukkan panjang kerusakan (meter)" |
| 2 | Ketik `2.5` | Bot reply: "Masukkan lebar kerusakan (meter)" |
| 3 | Ketik `1.5` | Bot tampilkan ringkasan laporan + inline keyboard "Konfirmasi / Batalkan" |
| 4 | State → `confirming` | Verified |

#### Opsi B: Tidak, lanjutkan

| # | Langkah | Expected Result |
|---|---|---|
| 1 | Klik "Tidak, lanjutkan" | Bot tampilkan ringkasan tanpa dimensi + Konfirmasi/Batalkan |

### 6.7 Flow: Konfirmasi & Submit

| # | Langkah | Expected Result |
|---|---|---|
| 1 | Klik "Konfirmasi" | Bot reply: "Laporan berhasil dikirim! Kode: LP-2026-XXXXX" |
| 2 | Cek database: `reports` → `source='telegram'`, `status='Menunggu Review'` | Verified |
| 3 | Cek `report_photos` → foto tersimpan di storage | Verified |
| 4 | Cek `status_logs` → ada entry `Menunggu Review` | Verified |
| 5 | State → `idle` | Verified |

### 6.8 Flow: /batal (Cancel Anytime)

| # | Langkah | Expected Result |
|---|---|---|
| 1 | Di state `awaiting_photo`, ketik `/batal` | Bot reply: "Laporan dibatalkan." + state → `idle` |
| 2 | Ulangi test di `awaiting_location`, `awaiting_description`, `confirming` | Sama |

### 6.9 Flow: /status (Cek Riwayat)

| # | Langkah | Expected Result |
|---|---|---|
| 1 | Setelah pernah submit laporan via Telegram, ketik `/status` | Bot reply: "Riwayat Laporan Terbaru:" + max 3 laporan terakhir |

### 6.10 Flow: Kirim sebagai Document (File)

| # | Langkah | Expected Result |
|---|---|---|
| 1 | Kirim foto sebagai document (bukan compressed photo) | Sama seperti photo — EXIF check, location step, submit |
| 2 | Kirim dokumen non-gambar (PDF, ZIP, MP4) sebagai document | Ditolak: "Dokumen yang diterima bukan gambar" |

### 6.11 Negative: Kirim Video

| # | Langkah | Expected Result |
|---|---|---|
| 1 | Kirim video ke chat | Bot reply: "Video tidak didukung" |

### 6.12 Negative: Kirim GIF (Animation)

| # | Langkah | Expected Result |
|---|---|---|
| 1 | Kirim GIF/animation ke chat | Bot reply: "GIF tidak didukung" |

### 6.13 Negative: Kirim Sticker

| # | Langkah | Expected Result |
|---|---|---|
| 1 | Kirim sticker ke chat | Bot reply: "Stiker tidak didukung" |

### 6.14 Negative: Kirim Voice Note

| # | Langkah | Expected Result |
|---|---|---|
| 1 | Kirim voice note ke chat | Bot reply: "Voice note tidak didukung" |

### 6.15 Negative: Kirim Foto dari Pinterest (No EXIF)

| # | Langkah | Expected Result |
|---|---|---|
| 1 | Download foto dari Pinterest | — |
| 2 | Kirim foto ke bot | Bot reply: "Foto tidak memiliki metadata EXIF. Gunakan foto asli dari kamera perangkat Anda." |
| 3 | State tetap `awaiting_photo` | Verified |

### 6.16 Negative: Kirim Screenshot (No EXIF Date)

| # | Langkah | Expected Result |
|---|---|---|
| 1 | Ambil screenshot | — |
| 2 | Kirim screenshot ke bot | Bot reply: "Foto tidak memiliki metadata tanggal." (karena EXIF ada tapi tanpa DateTimeOriginal) ATAU "tidak memiliki metadata EXIF" (tergantung OS) |

### 6.17 Negative: Kirim Foto >7 Hari

| # | Langkah | Expected Result |
|---|---|---|
| 1 | Cari foto lama dengan EXIF date valid tapi >7 hari | — |
| 2 | Kirim ke bot | Bot reply: "Foto diambil pada ... (lebih dari 7 hari yang lalu)" |

### 6.18 Negative: Kirim Foto dengan Date Masa Depan

| # | Langkah | Expected Result |
|---|---|---|
| 1 | Edit EXIF date foto ke masa depan | — |
| 2 | Kirim ke bot | Bot reply: "Tanggal foto ... adalah tanggal di masa depan" |

### 6.19 Negative: Kirim Lokasi Sebelum Kirim Foto

| # | Langkah | Expected Result |
|---|---|---|
| 1 | Ketik `/lapor` → state `awaiting_photo` | — |
| 2 | Langsung kirim location (tanpa foto) | Bot reply: "Silakan kirim foto kerusakan jalan..." |

### 6.20 Negative: Kirim Foto di Luar Sesi /lapor

| # | Langkah | Expected Result |
|---|---|---|
| 1 | State `idle`, kirim foto | Bot reply: "Foto diterima, tapi Anda belum memulai laporan. Ketik /lapor untuk memulai." |

### 6.21 Flow: Kirim Foto via Document dengan GPS EXIF

| # | Langkah | Expected Result |
|---|---|---|
| 1 | Kirim foto (via document) yang memiliki GPS EXIF (misal dari kamera desktop) | Bot detek GPS, skip location step, langsung minta deskripsi |

### 6.22 Flow: Kirim Foto → Kirim Ulang (Retry Jika Gagal EXIF)

| # | Langkah | Expected Result |
|---|---|---|
| 1 | Kirim foto tanpa EXIF → ditolak | — |
| 2 | Kirim foto asli kamera | Diterima, lanjut ke location step |

### 6.23 Flow: Kirim Lokasi di Luar Sidoarjo

| # | Langkah | Expected Result |
|---|---|---|
| 1 | Setelah foto diterima, kirim location di Surabaya | Bot reply: "Lokasi berada di luar wilayah Kabupaten Sidoarjo." |
| 2 | State tetap `awaiting_location` | Bisa coba lagi |

---

## 7. Source: Petugas Satgas (Web)

### 7.1 Login

| # | Langkah | Expected Result |
|---|---|---|
| 1 | Buka `/login-petugas` | Form login petugas |
| 2 | Login sebagai Agus Setiawan (petugas, Tim Satgas Utara) | Redirect ke `/home` |

### 7.2 Dashboard Petugas

| # | Langkah | Expected Result |
|---|---|---|
| 1 | Setelah login, buka `/home` | Dashboard: stats tugas, laporan terbaru |
| 2 | Tab "Laporan Perlu Ditinjau" | Laporan dengan status `Menunggu Review` (source petugas) |
| 3 | Tab "Tugas Saya" / `tugas-saya` | Laporan yang ditugaskan ke tim petugas |

### 7.3 Flow: Buat Laporan (Single)

| # | Langkah | Expected Result |
|---|---|---|
| 1 | Buka `/upload` atau `/reports` | Form laporan petugas |
| 2 | Pilih foto (kamera/gallery) | Preview |
| 3 | Pilih lokasi di peta | Lat/lng + reverse geocode |
| 4 | Isi deskripsi, nama jalan, dimensi | — |
| 5 | Klik "Kirim" | Report terbuat, `source='petugas'`, `status='Menunggu Review'` |

### 7.4 Flow: Buat Laporan Berganda (Batch Patroli)

| # | Langkah | Expected Result |
|---|---|---|
| 1 | Mode batch upload | Pilih banyak foto |
| 2 | Atur lokasi umum atau per-foto | — |
| 3 | Submit | Masing-masing foto jadi report terpisah, `batch_id` sama |

### 7.5 Flow: Mulai Perbaikan

**Precondition:** Ada laporan dengan status `Ditugaskan` ke tim petugas

| # | Langkah | Expected Result |
|---|---|---|
| 1 | Buka detail laporan | Detail + timeline |
| 2 | Klik "Mulai Perbaikan" | Confirm dialog |
| 3 | Konfirmasi | Status → `Sedang Diperbaiki`, `perbaikan_dimulai_at` terisi |

### 7.6 Flow: Upload Progress

| # | Langkah | Expected Result |
|---|---|---|
| 1 | Di laporan `Sedang Diperbaiki`, klik "Update Progress" | Modal upload foto + catatan |
| 2 | Upload foto progress + isi catatan | Tersimpan di `report_progress_updates` |

### 7.7 Flow: Selesaikan Perbaikan

| # | Langkah | Expected Result |
|---|---|---|
| 1 | Klik "Selesai" | Form: upload foto setelah perbaikan |
| 2 | Upload foto + isi catatan | Status → `Selesai`, `perbaikan_selesai_at` terisi |

### 7.8 Flow: Edit Laporan (Sebelum Direview)

| # | Langkah | Expected Result |
|---|---|---|
| 1 | Buka laporan dengan status `Menunggu Review` | — |
| 2 | Klik "Edit" | Status → `Diedit`, form edit terbuka |
| 3 | Ubah data, klik "Simpan" | Status → `Menunggu Review` lagi |
| 4 | Atau klik "Batal Edit" | Status → `Menunggu Review` |

### 7.9 Flow: Hapus Laporan Sendiri

| # | Langkah | Expected Result |
|---|---|---|
| 1 | Buka laporan punya sendiri (`source=petugas`) dengan status `Menunggu Review` | — |
| 2 | Klik "Hapus" | Report + photos terhapus |

### 7.10 Flow: Lihat Peta & Tugas

| # | Langkah | Expected Result |
|---|---|---|
| 1 | Buka `/map` | Peta dengan marker laporan + tugas tim |
| 2 | Buka `/tugas-saya` | Daftar laporan ditugaskan ke tim |
| 3 | Buka `/my-reports` | Daftar laporan yang dibuat sendiri |

### 7.11 Validation: Foto >2 Hari (Petugas)

| # | Langkah | Expected Result |
|---|---|---|
| 1 | Upload foto dengan EXIF date >2 hari | Error: "Foto diambil pada ... (lebih dari 2 hari)" |

**Catatan:** Batas 2 hari hanya untuk petugas. Warga/Telegram punya batas 7 hari.

---

## 8. Source: Supervisor (Web)

### 8.1 Login & Dashboard

| # | Langkah | Expected Result |
|---|---|---|
| 1 | Login sebagai Budi Santoso (supervisor) | Redirect ke `/supervisor` |
| 2 | Dashboard supervisor | Stats: total, perlu review, ditugaskan, selesai |

### 8.2 Flow: Review Laporan Warga/Telegram

**Precondition:** Ada laporan dari warga/telegram dengan status `Menunggu Review`

| # | Langkah | Expected Result |
|---|---|---|
| 1 | Buka `/review` atau tab "Perlu Review" | Daftar laporan `Menunggu Review` |
| 2 | Klik salah satu laporan | Detail laporan: foto, lokasi, deskripsi, info pelapor |
| 3 | Klik "Mulai Review" | Status → `Ditinjau` |

### 8.3 Flow: Approve Laporan (Setelah Review)

| # | Langkah | Expected Result |
|---|---|---|
| 1 | Setelah `Ditinjau`, klik "Setujui" | Confirm dialog |
| 2 | Konfirmasi | Status → `Disetujui` → auto-assign ke team berdasarkan kecamatan |
| 3 | Cek: `assigned_team_id` terisi, status log tercatat | Verified |

### 8.4 Flow: AI Analysis

**Precondition:** Laporan warga/telegram dengan status `Menunggu Review`

| # | Langkah | Expected Result |
|---|---|---|
| 1 | Buka `/ai-result` atau detail laporan | — |
| 2 | Klik "Analisis AI" | Loading, AI server dipanggil (FastAPI :8000) |
| 3 | Hasil AI tampil: detections, severity, annotated image | — |
| 4 | Status → `Hasil AI` | Verified |
| 5 | Klik "Konfirmasi AI" | Status → `Menunggu Verifikasi` |
| 6 | Klik "Setujui" | Status → `Disetujui` + auto-assign team |

### 8.5 Flow: Tolak Laporan

| # | Langkah | Expected Result |
|---|---|---|
| 1 | Di detail laporan, klik "Tolak" | Modal alasan |
| 2 | Isi alasan penolakan | Status → `Ditolak`, alasan tersimpan |

### 8.6 Flow: Update Triage (Severity & Priority)

| # | Langkah | Expected Result |
|---|---|---|
| 1 | Di detail laporan, ubah severity/priority | Tersimpan, deadline otomatis dihitung ulang |

### 8.7 Flow: Bulk Approve / Bulk Tolak

| # | Langkah | Expected Result |
|---|---|---|
| 1 | Di daftar review, centang multiple laporan | — |
| 2 | Klik "Setujui Semua" atau "Tolak Semua" | Semua laporan terproses |

### 8.8 Flow: Patrol Schedule

| # | Langkah | Expected Result |
|---|---|---|
| 1 | Buka `/supervisor/patrol-schedule` | Daftar jadwal patroli |
| 2 | Buat jadwal baru | Pilih team, hari, kecamatan, frekuensi |
| 3 | Generate tugas patroli | `SurveyTask` dibuat sesuai jadwal |

### 8.9 Flow: Overview Peta

| # | Langkah | Expected Result |
|---|---|---|
| 1 | Buka `/map` (sebagai supervisor) | Peta dengan semua laporan + marker tim |

### 8.10 Flow: Statistik

| # | Langkah | Expected Result |
|---|---|---|
| 1 | Buka `/stats` | Grafik: laporan per bulan, per status, per tim |

---

## 9. Source: Petugas Eksekusi

### 9.1 Login & Dashboard

| # | Langkah | Expected Result |
|---|---|---|
| 1 | Login sebagai akun dengan role `petugas_eksekusi` | Redirect ke `/petugas-eksekusi` |
| 2 | Dashboard | Daftar tugas perbaikan yang ditugaskan |

### 9.2 Flow: Update Progress & Selesaikan

| # | Langkah | Expected Result |
|---|---|---|
| 1 | Klik tugas | Detail laporan |
| 2 | "Mulai" → "Progress" → "Selesai" | Sama seperti flow petugas satgas |

---

## 10. Source: Admin

### 10.1 Login & Dashboard

| # | Langkah | Expected Result |
|---|---|---|
| 1 | Buka `/admin/login` | Form login admin |
| 2 | Login sebagai Admin Utama | Redirect ke `/admin/dashboard` |

### 10.2 Admin: Manage Users

| # | Langkah | Expected Result |
|---|---|---|
| 1 | Buka `/admin/users` | CRUD users: create, edit, delete, change role |
| 2 | Buat user baru dengan role petugas | User tersimpan |

### 10.3 Admin: Manage Teams

| # | Langkah | Expected Result |
|---|---|---|
| 1 | Buka `/admin/teams` | CRUD teams |
| 2 | Assign members ke team | Berhasil |
| 3 | Assign roads ke team | Berhasil |

### 10.4 Admin: Force Status Change

| # | Langkah | Expected Result |
|---|---|---|
| 1 | Buka detail report → "Ubah Status" | Paksa perubahan status (untuk recovery) |

### 10.5 Admin: Hapus Report

| # | Langkah | Expected Result |
|---|---|---|
| 1 | Hapus report apapun (termasuk milik user lain) | Report terhapus + cascade ke photos |

### 10.6 Admin: Export

| # | Langkah | Expected Result |
|---|---|---|
| 1 | Buka `/admin/export` | Export PDF/Excel per bulan |

---

## 11. Cross-Cutting: Foto & EXIF Validation

### 11.1 Guard Matrix

| Scenario | Web (Warga) | Web (Petugas) | Telegram |
|---|---|---|---|
| Foto asli kamera (<7 hari) | ✅ Accepted | ✅ Accepted (max 2 hari) | ✅ Accepted |
| Screenshot (no EXIF date) | ❌ Rejected | ❌ Rejected | ❌ Rejected |
| Foto internet (no EXIF) | ❌ Rejected | ❌ Rejected | ❌ Rejected |
| Foto >7 hari | ❌ Rejected | ❌ Rejected | ❌ Rejected |
| Foto >2 hari (petugas) | N/A | ❌ Rejected | N/A |
| Foto masa depan | ❌ Rejected | ❌ Rejected | ❌ Rejected |
| Foto duplikat (hash) | ❌ Warning | ❌ Warning | ❌ Skip |
| Video/GIF | N/A | N/A | ❌ Rejected |
| Dokumen non-gambar | N/A | N/A | ❌ Rejected |

### 11.2 EXIF Validation Detail

Web (Warga/Petugas) menggunakan method `validatePhotoDateExif()` di controller masing-masing:

```
no_exif_date  → "Foto tidak memiliki metadata tanggal"
future_date   → "Tanggal foto adalah tanggal di masa depan"
too_old       → "Foto diambil pada ... (lebih dari N hari)"
ok            → Lanjut
```

Telegram menggunakan method `validatePhotoDate()` di `TelegramService.php`:

```
no_exif_date  → "Foto tidak memiliki metadata tanggal"
future_date   → "Tanggal foto adalah tanggal di masa depan"
too_old       → "Foto diambil pada ... (lebih dari 7 hari)"
ok            → Lanjut
```

Tambahan guard Telegram: jika `readExifData()` return `null` (file tanpa EXIF sama sekali):

```
"Foto tidak memiliki metadata EXIF. Gunakan foto asli dari kamera perangkat Anda."
```

### 11.3 Test: File EXIF Guard (Web)

| # | Langkah | Expected Result |
|---|---|---|
| 1 | Buka inspect element → Console → cari error | Tidak ada CORS/ORB error untuk gambar di `/storage/*` |
| 2 | Upload file non-gambar (PDF) di form lapor | File picker biasanya sudah filter, tapi backend juga nolak |

### 11.4 Test: EXIF Guard Gambar dari Facebook/Instagram

| # | Langkah | Expected Result |
|---|---|---|
| 1 | Download foto dari Facebook/Instagram | Biasanya EXIF distrip |
| 2 | Upload via web warga | Ditolak: tidak ada metadata tanggal |
| 3 | Kirim via Telegram | Ditolak: tidak ada metadata EXIF |

---

## 12. Cross-Cutting: Duplicate Detection

### 12.1 3-Tier Dedup

| Tier | Method | Radius/Criteria |
|---|---|---|
| Spatial (1) | Haversine distance (SQL `acos`) | 15 meter dari koordinat existing report |
| Textual (2) | `ILIKE` on `district` + `road_name` | Fuzzy match |
| Image Hash (3) | SHA-256 of file content | Exact match |

### 12.2 Test: Spatial Duplicate

| # | Langkah | Expected Result |
|---|---|---|
| 1 | Buat report di koordinat A | Berhasil |
| 2 | Buat report baru di koordinat dalam 15m dari A | Warning: "Laporan serupa ditemukan dalam radius 15m" |

### 12.3 Test: Image Hash Duplicate

| # | Langkah | Expected Result |
|---|---|---|
| 1 | Buat report dengan foto X | Berhasil |
| 2 | Buat report baru dengan foto X yang sama | Warning: "Foto sudah pernah digunakan" (web) atau silent skip (telegram batch) |

---

## 13. Cross-Cutting: AI Analysis

### 13.1 Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `POST /analyze` | FastAPI | Single photo analysis |
| `POST /api/analyze` | Laravel (proxy) | Single photo → FastAPI |
| `POST /api/analyze-batch` | Laravel | Max 20 photos → FastAPI (parallel) |
| `POST /api/reports/{id}/analyze-ai` | Laravel | Trigger AI on existing report |

### 13.2 Response Format (FastAPI)

```json
{
  "detections": [
    {
      "class": "Lubang",
      "confidence": 0.89,
      "bbox": [x1, y1, x2, y2]
    }
  ],
  "total": 3,
  "overall_severity": "Rusak Berat",
  "severity_score": 85,
  "status": "success",
  "image_result": "base64_encoded_annotated_image"
}
```

### 13.3 Damage Classes & Severity

| Class | Severity Default |
|---|---|
| Lubang | Rusak Berat |
| Retak Kulit Buaya | Rusak Sedang |
| Retak Memanjang | Rusak Ringan |
| Retak Melintang | Rusak Ringan |

### 13.4 Test: AI Analysis

| # | Langkah | Expected Result |
|---|---|---|
| 1 | Upload foto jalan berlubang via web warga | Report created |
| 2 | Login sebagai supervisor, buka report | — |
| 3 | Klik "Analisis AI" | Loading → hasil tampil: deteksi 1+ lubang, severity "Rusak Berat" |
| 4 | Klik "Konfirmasi AI" | Status → `Menunggu Verifikasi` |
| 5 | Klik "Setujui" | Status → `Disetujui`, auto-assign team |

### 13.5 Test: Batch AI

| # | Langkah | Expected Result |
|---|---|---|
| 1 | Upload 5 foto via patroli petugas (batch) | Semua report terbuat |
| 2 | Buka `/reports` → filter batch | — |

---

## 14. Cross-Cutting: Notifikasi

### 14.1 Notification Types

| Event | Channel | Penerima |
|---|---|---|
| Report approved | Web Push / FCM | Petugas terkait |
| Team assigned | Web Push / FCM | Anggota team |
| Progress update | Web Push / FCM | Supervisor |
| Repair completed | Web Push / FCM | Supervisor |
| Report rejected | Web Push / FCM | Pelapor (jika warga) |

### 14.2 Test: Notifikasi

| # | Langkah | Expected Result |
|---|---|---|
| 1 | Login sebagai supervisor + petugas (browser berbeda) | — |
| 2 | Supervisor approve laporan | Petugas terima notifikasi |
| 3 | Klik notifikasi | Redirect ke detail laporan |

### 14.3 Test: Push Subscription

| # | Langkah | Expected Result |
|---|---|---|
| 1 | Buka app, izinkan notifikasi | `push_subscriptions` table terisi |
| 2 | Trigger event yang menghasilkan notifikasi | Notifikasi muncul di browser |

---

## 15. Edge Cases & Negative Tests

### 15.1 Network & Concurrency

| # | Skenario | Langkah | Expected Result |
|---|---|---|---|
| 1 | Submit double-click | Klik "Kirim" 2x cepat | Hanya 1 report terbuat (idempotent) |
| 2 | Offline submission | Matikan internet, submit laporan | Queue menyimpan, submit saat online |
| 3 | Concurrent same report | 2 petugas buka report yg sama | Tidak conflict |

### 15.2 Data Limits

| # | Skenario | Langkah | Expected Result |
|---|---|---|---|
| 1 | Foto >5MB | Upload foto 10MB | Error: "Maksimal 5MB" |
| 2 | Deskripsi >2000 chars | Ketik deskripsi 3000 karakter | Error / terpotong |
| 3 | Batch >20 foto | Upload 25 foto batch | Error: "Maksimal 20 foto" |
| 4 | Warga >5 laporan/hari | Buat 6 laporan dalam sehari | Error: "Batas laporan harian tercapai" |
| 5 | Nama jalan >255 chars | — | Validasi length |

### 15.3 Security

| # | Skenario | Langkah | Expected Result |
|---|---|---|---|
| 1 | Akses tanpa token | Hit API tanpa Authorization header | 401 Unauthorized |
| 2 | Akses role salah | Warga akses `/api/reports` (petugas) | 403 Forbidden |
| 3 | XSS di deskripsi | Ketik `<script>alert('xss')</script>` | Tersimpan sebagai teks (escaped) |
| 4 | SQL injection | Ketik `' OR 1=1 --` di input | Ditolak (parameterized query) |
| 5 | Akses report milik orang lain | Warga A akses report milik Warga B | 403 atau data tidak muncul |

### 15.4 Telegram-Specific

| # | Skenario | Langkah | Expected Result |
|---|---|---|---|
| 1 | Kirim teks random di state `awaiting_photo` | Ketik "halo" | Bot reply: "Silakan kirim foto..." |
| 2 | Kirim foto 2x berturut-turut | Kirim foto, lalu kirim foto lagi tanpa lokasi | Foto pertama di-save, foto kedua ganti? (cek implementasi — seharusnya foto ke-2 replace) |
| 3 | Bot webhook timeout | Kirim foto besar (>20MB) | Telegram retry, bot proses |
| 4 | Kirim location without photo | Langsung kirim location tanpa `/lapor` | Bot reply: "Silakan kirim foto dulu" |
| 5 | Kirim command tidak dikenal | Ketik `/foobar` | Bot reply: "Maaf, perintah tidak dikenal" |
| 6 | Kirim foto dari telegram desktop (file) | Drag & drop foto as document | Sama seperti mobile — EXIF check + GPS |
| 7 | Chat dengan bot dari multiple device | Buka Telegram Web + HP, kirim dari HP | Bot proses, reply ke chat |
| 8 | Bot mati (Laravel down) | Kirim pesan saat Laravel mati | Telegram will retry (max 3x) |
| 9 | Kirim foto dengan karakter unik nama file | Foto bernama "foto (1).jpg" | Path handling aman |
| 10 | Kirim foto lalu /batal, kirim foto lagi | /lapor, kirim foto, /batal, /lapor, kirim foto lagi | Session reset, state await_photo, foto diterima |

### 15.5 GPS & Location

| # | Skenario | Langkah | Expected Result |
|---|---|---|---|
| 1 | Browser tolak GPS | Klik "Tolak" saat browser minta izin lokasi | Manual pick di peta |
| 2 | GPS tidak akurat | GPS mengembalikan koordinat dengan akurasi rendah | Tetap diterima (no accuracy filter) |
| 3 | Reverse geocode gagal | Lokasi di area tanpa data LocationIQ | `road_name` tetap null, lanjut |

### 15.6 File Storage

| # | Skenario | Langkah | Expected Result |
|---|---|---|---|
| 1 | Storage full | Upload saat disk penuh | Error 500 |
| 2 | Symlink broken | `storage` symlink tidak ada | 403 Forbidden → fallback route `/storage/*` handle |
| 3 | Image corruption | Upload file gambar yang corrupt | Error: file tidak bisa diproses |

### 15.7 Cross-Browser

| Browser | Catatan |
|---|---|
| Chrome 120+ | ✅ Full support |
| Firefox 120+ | ✅ Full support |
| Safari 17+ | ✅ Full support |
| Chrome Android | ✅ Full support |
| Samsung Internet | ✅ Full support |
| Opera | ✅ Full support |

---

## Appendix A: Quick Reference — API Endpoints

### Public

```
POST /api/auth/login
POST /api/auth/register
POST /api/reports/track
GET  /api/v1/reports/check-duplicate
POST /telegram/webhook
GET  /api/ping
```

### Warga (role: warga)

```
POST /api/warga/reports
GET  /api/warga/reports
GET  /api/warga/reports/{id}
```

### Authenticated (role: petugas/supervisor/admin)

```
POST /api/reports
POST /api/reports/batch
GET  /api/reports
GET  /api/reports/{id}
POST /api/reports/{id}/approve
POST /api/reports/{id}/tolak
POST /api/reports/{id}/mulai
POST /api/reports/{id}/complete
POST /api/reports/{id}/progress
```
