# Manual Uji Coba — DeltaJalan (Publik)

Aplikasi pelaporan kerusakan jalan untuk warga **Kabupaten Sidoarjo** melalui **Dinas PU Bina Marga**.

## Platform

DeltaJalan adalah **website** yang bisa diakses via browser dan APK:

| Platform | Browser | APK (Capacitor) |
|----------|---------|-----------------|
| **Android** | Kamera (`capture="environment"`) + Galeri | Kamera native + Galeri native |
| **Desktop** | Galeri (file picker) | — |

## Cara Lapor

Ada 2 cara melapor **tanpa login**:

| Source | Akses | Route / Bot |
|--------|-------|-------------|
| **Warga via Web** | Browser / APK | `/lapor` |
| **Warga via Telegram** | Telegram app | `@DeltaJalanBot` |

---

## 1. Source: Warga via Web (`/lapor`)

**URL:** `http://localhost:5173/lapor`

**Prasyarat:** Tidak perlu login. Buka langsung di browser atau APK.

### 1.1 Flow Positif

| # | Test | Langkah | Expected Result |
|---|------|---------|-----------------|
| 1 | **Mobile — kamera** | Buka `/lapor` di HP Android → tap area foto | Kamera belakang terbuka otomatis (`capture="environment"`) |
| 2 | **Desktop — galeri** | Buka `/lapor` di PC → tap area foto → pilih file | File picker terbuka untuk pilih foto |
| 3 | **APK — kamera** | Buka APK → tap area foto | Kamera native terbuka |
| 4 | **APK — galeri** | Buka APK → tap area foto → pilih dari galeri | Galeri native terbuka |
| 5 | **Submit lengkap (setelah foto)** | Foto lolos EXIF + GPS → road name + kecamatan terisi otomatis → isi Nama + Telepon valid → pilih kecamatan (jika belum) → klik **Kirim Laporan** | ✅ Halaman sukses: "Laporan Terkirim!" + kode laporan `LP-2026-XXXXX` |
| 6 | **Lacak laporan** | Dari halaman sukses klik **Lacak Laporan** | Redirect ke `/lacak?report_code=LP-2026-XXXXX` — lihat foto, status, timeline |

### 1.2 Validasi Nama

| # | Input | Pemicu | Expected Result |
|---|-------|--------|-----------------|
| 7 | Kosong | Submit | Error "Lengkapi field berikut: Nama Lengkap" |
| 8 | "A" | Blur | Error "Nama lengkap minimal 2 karakter." |
| 9 | "123!!!" | Blur | Error "Nama lengkap hanya boleh mengandung huruf, spasi, titik, dan tanda hubung." |
| 10 | "Budi Santoso" | Blur | ✅ valid, otomatis trim spasi |

### 1.3 Validasi Telepon

| # | Input | Pemicu | Expected Result |
|---|-------|--------|-----------------|
| 11 | Kosong | Submit | Error "Nomor Telepon" |
| 12 | "+6281234567890" | Blur | ✅ normalisasi ke "081234567890" |
| 13 | "081234567890" | Blur | ✅ valid |
| 14 | "12345" | Blur | Error "Format nomor telepon tidak valid." |

### 1.4 EXIF Date Validation

| # | Skenario | Expected Result |
|---|----------|-----------------|
| 15 | Foto asli kamera (≤7 hari) | ✅ Lolos, lanjut GPS extraction |
| 16 | Foto >7 hari (EXIF date lama) | FraudWarningModal: badge **"FOTO KADALUARSA"** — blokir, tidak bisa submit |
| 17 | EXIF date di masa depan | FraudWarningModal: badge **"TANGGAL TIDAK VALID"** — blokir |
| 18 | Screenshot / download Pinterest (tanpa EXIF) | FraudWarningModal: badge **"TANPA METADATA"** — blokir |

### 1.5 GPS

| # | Skenario | Expected Result |
|---|----------|-----------------|
| 19 | Foto memiliki GPS EXIF | Koordinat + Nama Jalan + Kecamatan terisi otomatis. Label: "dari foto" |
| 20 | Desktop, foto tanpa GPS EXIF | Error merah: "Foto yang diunggah tidak memiliki data GPS." Wajib isi koordinat manual atau ganti foto |
| 21 | Mobile, foto tanpa GPS EXIF | Fallback ke geolocation browser. Label: "dari perangkat" |

### 1.6 Upload Limit & Error

| # | Skenario | Expected Result |
|---|----------|-----------------|
| 22 | Upload >5 kali dalam sehari (localStorage) | Halaman "Batas Upload Tercapai" — "Maksimal 5 laporan per hari" |
| 23 | Koordinat kosong → submit | Error "Koordinat lokasi" |
| 24 | Semua field kosong → submit | Error "Lengkapi field berikut: Nama Lengkap, Nomor Telepon, Nama Jalan, Kecamatan, Koordinat lokasi, Foto Kerusakan" |

---

## 2. Source: Warga via Telegram

**Prasyarat:**
- Chat dengan bot `@DeltaJalanBot`
- Webhook bot sudah aktif (POST ke `/api/telegram/webhook`)
- Bot sudah diset dengan `/setwebhook`

### 2.1 Memulai

| # | Langkah | Expected Result |
|---|---------|-----------------|
| 1 | Ketik `/start` | Bot reply: "Selamat datang... Laporkan kerusakan jalan dengan /lapor" |

### 2.2 Flow Positif — /lapor

| # | Langkah | Expected Result |
|---|---------|-----------------|
| 1 | Ketik `/lapor` | Bot reply: "Silakan kirim foto kerusakan jalan" — state → `awaiting_photo` |
| 2 | Kirim foto (dari kamera / galeri) | Bot download foto, EXIF check |
| 3 | EXIF valid (date ≤7 hari) | Bot reply: "Foto diterima..." + keyboard "Kirim Lokasi Saya" — state → `awaiting_location` |
| 4 | Kirim lokasi via "Kirim Lokasi Saya" | Bot reverse geocode → reply: "Lokasi diterima! Nama jalan: ... Sekarang ketik deskripsi kerusakan" — state → `awaiting_description` |
| 5 | Ketik deskripsi | Bot reply: "Deskripsi diterima." + inline keyboard "Ya masukkan dimensi / Tidak" — state → `awaiting_dimension` |
| 6a | Klik "Tidak, lanjutkan" | Bot tampilkan ringkasan + "Konfirmasi / Batalkan" — state → `confirming` |
| 6b | Atau klik "Ya masukkan dimensi" → ketik panjang (m) → ketik lebar (m) | Bot tampilkan ringkasan dengan dimensi + "Konfirmasi / Batalkan" |
| 7 | Klik "Konfirmasi" | ✅ Bot reply: "Laporan berhasil dikirim! Kode: LP-2026-XXXXX" — state → `idle` |

### 2.3 Dokumen dengan GPS EXIF

| # | Langkah | Expected Result |
|---|---------|-----------------|
| 1 | Kirim foto sebagai **document** (file, bukan compressed photo) | Bot detek GPS EXIF, **skip location step**, langsung minta deskripsi |

### 2.4 Batal

| # | Langkah | Expected Result |
|---|---------|-----------------|
| 1 | Di state mana pun (`awaiting_photo` / `awaiting_location` / `awaiting_description` / `confirming`) ketik `/batal` | Bot reply: "Laporan dibatalkan." — state → `idle` |

### 2.5 Riwayat

| # | Langkah | Expected Result |
|---|---------|-----------------|
| 1 | Setelah pernah submit, ketik `/status` | Bot reply: "Riwayat Laporan Terbaru:" + maks 3 laporan terakhir |

### 2.6 Negative — Media Tidak Didukung

| # | Kirim | Expected Result |
|---|-------|-----------------|
| 1 | Video | Bot reply: "Video tidak didukung" |
| 2 | GIF / Animation | Bot reply: "GIF tidak didukung" |
| 3 | Sticker | Bot reply: "Stiker tidak didukung" |
| 4 | Voice note | Bot reply: "Voice note tidak didukung" |

### 2.7 Negative — EXIF

| # | Kirim | Expected Result |
|---|-------|-----------------|
| 1 | Foto dari Pinterest (tanpa EXIF) | Bot reply: "Foto tidak memiliki metadata EXIF." — state tetap `awaiting_photo` |
| 2 | Screenshot (tanpa EXIF date) | Bot reply: "Foto tidak memiliki metadata tanggal." — state tetap `awaiting_photo` |
| 3 | Foto >7 hari | Bot reply: "Foto diambil pada ... (lebih dari 7 hari yang lalu)" |
| 4 | Foto dengan EXIF date masa depan | Bot reply: "Tanggal foto ... adalah tanggal di masa depan" |

### 2.8 Negative — Lokasi

| # | Langkah | Expected Result |
|---|---------|-----------------|
| 1 | Setelah `/lapor`, kirim location sebelum kirim foto | Bot reply: "Silakan kirim foto kerusakan jalan terlebih dahulu" |
| 2 | Kirim location di luar Sidoarjo (misal Surabaya) | Bot reply: "Lokasi berada di luar wilayah Kabupaten Sidoarjo." — state tetap `awaiting_location` |

---

## 3. Supervisor — Review Laporan Warga/Telegram

Setelah laporan masuk, supervisor akan memproses:

| # | Langkah | Expected Result |
|---|---------|-----------------|
| 1 | Login supervisor → tab **Perlu Review** | Laporan warga muncul dengan badge **"Warga"** (purple/border-purple-200). Laporan Telegram dengan badge **"Telegram"** (sky blue/border-sky-200) |
| 2 | Klik **Detail** → `/review?reportId=X` | Tombol: **"Setujui & Analisis AI"** (bukan "Setujui & Tugaskan Tim") |
| 3 | Klik **Setujui & Analisis AI** | Status → **"Hasil AI"** + AI analysis otomatis dijalankan |
| 4 | Supervisor buka laporan setelah AI selesai | Lihat hasil deteksi AI (bounding box, severity, confidence). Klik **Konfirmasi Hasil AI** → status → **"Disetujui"** |
| 5 | Supervisor klik **Mulai Pengerjaan** → pilih UPR | Status → **"Sedang Diperbaiki"** |

---

## 4. Diagram Status (Publik)

```
Warga / Telegram submit
          │
          ▼
  ┌──────────────────┐
  │ Menunggu          │
  │ Verifikasi        │
  └────────┬─────────┘
           │ Supervisor approve
           ▼
  ┌──────────────────┐
  │    Hasil AI       │──► AI analyze otomatis
  └────────┬─────────┘
           │ Supervisor konfirmasi AI
           ▼
  ┌──────────────────┐
  │   Disetujui       │
  └────────┬─────────┘
           │ Supervisor/UPR klik Mulai
           ▼
  ┌──────────────────┐
  │ Sedang            │
  │ Diperbaiki        │
  └────────┬─────────┘
           │ Upload foto after
           ▼
  ┌──────────────────┐
  │    Selesai        │
  └──────────────────┘
```

---

## 5. Route Map (Publik)

```
/                           Landing page publik
/lapor                      Form laporan publik (no login required)
/lacak?report_code=X        Tracking laporan via kode (no login)
/masuk                      Login akun warga
/daftar                     Daftar akun warga baru

└─ Telegram
   @DeltaJalanBot           Bot Telegram untuk lapor
```
