# Plan: Laporan Warga (Public User Reporting)

> **DeltaJalan (JalanKita)** — Fitur baru: warga masyarakat bisa melaporkan kerusakan jalan tanpa harus login sebagai petugas.
> **Peran:** Kabid Dinas PU Bina Marga Sidoarjo.
> **Tanggal:** Juli 2026.

---

## Daftar Isi

1. [Tujuan & Batasan](#1-tujuan--batasan)
2. [Alur Laporan Warga](#2-alur-laporan-warga)
3. [Database Migration](#3-database-migration)
4. [Backend API](#4-backend-api)
5. [Frontend Halaman Baru](#5-frontend-halaman-baru)
6. [EXIF & Fraud Guards](#6-exif--fraud-guards)
7. [Verification Workflow](#7-verification-workflow)
8. [Risk & Mitigation](#8-risk--mitigation)
9. [Urutan Implementasi](#9-urutan-implementasi)

---

## 1. Tujuan & Batasan

### Tujuan

Warga masyarakat dapat:
- Registrasi akun sendiri (tanpa melalui admin)
- Login dan submit laporan kerusakan jalan
- Melacak status laporan yang sudah dibuat

### Batasan

| Aspek | Keputusan |
|---|---|
| **AI Analyze** | Tidak ada — warga hanya upload foto + deskripsi. Petugas trigger AI manual saat verifikasi. |
| **Batch upload** | Tidak ada — warga cukup 1 foto per laporan. |
| **EXIF Date** | Max **7 hari** (diperpanjang dari 2 hari untuk petugas). |
| **EXIF GPS** | **Wajib** — sama seperti petugas. Foto tanpa GPS ditolak. |
| **GPS mismatch tolerance** | 1 km (lebih longgar dari 500m petugas). |
| **Role baru** | `warga` — ditambahkan ke CHECK constraint users.role. |
| **Status baru** | `Menunggu Verifikasi` — laporan baru sebelum diverifikasi petugas. |
| **Source** | Kolom `source` di reports: `'petugas'` atau `'warga'`. |

### Tidak Berubah

- ❌ AI server (FastAPI) — tidak dipanggil dari flow warga
- ❌ Batch upload — hanya single photo
- ❌ Trust score — tetap NONAKTIF
- ❌ Route guards existing petugas/supervisor/admin
- ❌ Report flow existing (approve, disposisi, eksekusi, selesai)

---

## 2. Alur Laporan Warga

```
WARGA:
  Buka app → Landing Page (/)
     ↓
  Registrasi (/daftar) → Login (/login)
     ↓
  Lapor Kerusakan (/lapor)
     ├─ Pilih/ambil foto (camera/gallery)
     ├─ EXIF date valid (max 7 hari)
     ├─ EXIF GPS wajib ada
     ├─ Pilih titik lokasi di peta (opsional, pakai GPS EXIF)
     ├─ Pilih nama jalan (autocomplete LocationIQ)
     ├─ Pilih kecamatan
     ├─ Tulis deskripsi kerusakan
     └─ Submit
         ↓

SISTEM:
  Validasi EXIF date (7 hari) + GPS (wajib)
  Cek duplikat spatial (15m)
  INSERT report → status: 'Menunggu Verifikasi', source: 'warga'
     ↓

PETUGAS (Dashboard):
  Filter: source='warga', status='Menunggu Verifikasi'
  Lihat foto + deskripsi
     │
     ├─ VERIFIKASI
     │   ├─ [Opsional] Trigger AI analyze → isi ai_raw_output
     │   ├─ Set severity & jenis kerusakan (manual atau hasil AI)
     │   ├─ Set status → 'Menunggu Review'
     │   └─ Laporan masuk antrian supervisor
     │
     └─ TOLAK
         ├─ Tulis alasan penolakan
         ├─ Set status → 'Ditolak'
         └─ Warga dapat notifikasi (via lacak laporan)

SUPERVISOR:
  Laporan masuk antrian review normal (seperti laporan petugas)
     ├─ Setuju → 'Disetujui' → disposisi → eksekusi → selesai
     └─ Tolak → 'Ditolak'

WARGA:
  Lacak laporan (/lacak) via kode laporan atau login
  Lihat timeline status
```

---

## 3. Database Migration

### 3.1 Migration 1: `add_role_warga_to_users_check_constraint`

```php
// Tambah role 'warga' ke CHECK constraint
// PostgreSQL tidak bisa ALTER CHECK, jadi perlu re-create
DB::statement('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check');
DB::statement("
    ALTER TABLE users ADD CONSTRAINT users_role_check
    CHECK (role IN ('petugas', 'supervisor', 'petugas_eksekusi', 'admin', 'warga'))
");
```

### 3.2 Migration 2: `add_phone_address_to_users_table`

```php
Schema::table('users', function (Blueprint $table) {
    $table->string('phone', 20)->nullable()->after('email');
    $table->string('address')->nullable()->after('nip');
    $table->string('registration_ip', 45)->nullable()->after('address');
});
```

### 3.3 Migration 3: `add_menunggu_verifikasi_to_status_enum`

```php
DB::statement("ALTER TYPE status_enum ADD VALUE IF NOT EXISTS 'Menunggu Verifikasi'");
```

### 3.4 Migration 4: `add_source_column_to_reports`

```php
Schema::table('reports', function (Blueprint $table) {
    $table->string('source', 20)->default('petugas')->after('status');
    $table->index('source');
});
```

Juga tambahkan kolom untuk laporan warga:
```php
Schema::table('reports', function (Blueprint $table) {
    $table->text('description')->nullable()->after('catatan_petugas');
    // description = deskripsi kerusakan dari warga (wajib)
});
```

### 3.5 Summary Perubahan DB

| Tabel | Kolom Baru | Tipe |
|---|---|---|
| `users` | `phone` | string(20) nullable |
| `users` | `address` | text nullable |
| `users` | `registration_ip` | string(45) nullable |
| `users` | `role` CHECK | + `'warga'` |
| `reports` | `source` | string(20) default 'petugas' |
| `reports` | `description` | text nullable |
| `status_enum` | + `'Menunggu Verifikasi'` | ENUM value |

---

## 4. Backend API

### 4.1 Endpoint Baru

| Method | Endpoint | Auth | Throttle | Fungsi |
|---|---|---|---|---|
| `POST` | `/api/auth/register` | Public | 3/IP/jam | Registrasi warga |
| `POST` | `/api/warga/reports` | Sanctum (warga) | 5/user/hari | Submit laporan warga |
| `GET` | `/api/warga/reports` | Sanctum (warga) | — | List laporan sendiri |
| `GET` | `/api/warga/reports/{id}` | Sanctum (warga) | — | Detail + tracking |
| `GET` | `/api/reports/track/{code}` | Public | 30/IP/menit | Cek status via kode |
| `POST` | `/api/reports/{id}/verify` | Sanctum (petugas/supervisor) | — | Verifikasi laporan warga |

### 4.2 Register (`POST /api/auth/register`)

**Request:**
```json
{
    "name": "Budi Hartono",
    "email": "budi@gmail.com",
    "phone": "08123456789",
    "password": "password123",
    "password_confirmation": "password123"
}
```

**Validasi:**
- `name` required, string, max 100
- `email` required, email, unique users.email
- `phone` required, string, regex Indonesia (/^08[0-9]{8,13}$/)
- `password` required, string, min 8, confirmed

**Response:**
```json
{
    "success": true,
    "message": "Registrasi berhasil. Silakan login.",
    "data": {
        "id": "...",
        "name": "Budi Hartono",
        "email": "budi@gmail.com",
        "role": "warga"
    }
}
```

**Catatan:**
- `email_verified_at` = now (skip verifikasi dulu, bisa ditambahkan nanti)
- `role` = 'warga'
- `registration_ip` = request IP
- Tidak generate token — user harus login setelah register

### 4.3 Submit Laporan Warga (`POST /api/warga/reports`)

**Request (multipart/form-data):**
```
image: File (jpeg/jpg/png, max 5MB)        ← WAJIB
road_name: string                           ← WAJIB (autocomplete)
district: string                            ← WAJIB (salah satu dari 18 kecamatan)
latitude: numeric                           ← WAJIB (dari EXIF GPS atau peta)
longitude: numeric                          ← WAJIB
description: string max 1000                ← WAJIB (deskripsi kerusakan)
```

**Validasi khusus (di controller):**
1. EXIF date — max 7 hari (konstanta terpisah dari petugas)
2. EXIF GPS — wajib ada, bandingkan dengan form lat/lng (toleransi 1 km)
3. Image hash — cek duplikat SHA-256
4. Duplicate spatial — cek 15m dari laporan aktif lain
5. Sidoarjo bounds — validasi koordinat

**Proses:**
```php
// Bedanya dengan petugas store():
// 1. Tidak ada AI analysis
// 2. ai_raw_output = null
// 3. total_detections = 0
// 4. overall_severity = 'Baik' (default)
// 5. status = 'Menunggu Verifikasi'
// 6. source = 'warga'
// 7. description diisi dari request
```

**Response:**
```json
{
    "success": true,
    "message": "Laporan berhasil dikirim. Status: Menunggu Verifikasi.",
    "data": {
        "id": "uuid",
        "report_code": "LP-2026-00068",
        "status": "Menunggu Verifikasi",
        "tracking_url": "/lacak/LP-2026-00068"
    }
}
```

### 4.4 Track Laporan Public (`GET /api/reports/track/{code}`)

**Response:**
```json
{
    "success": true,
    "data": {
        "report_code": "LP-2026-00068",
        "reporter_name": "Budi Hartono",
        "road_name": "Jl. Pahlawan",
        "district": "Sidoarjo",
        "status": "Menunggu Verifikasi",
        "created_at": "2026-07-01T10:00:00Z",
        "timeline": [
            {"status": "Menunggu Verifikasi", "timestamp": "...", "note": "Laporan baru"},
            {"status": "...", "timestamp": "...", "note": "..."}
        ]
    }
}
```

**Catatan:** Endpoint ini PUBLIC — tidak perlu login. Cukup dengan kode laporan. Tidak menampilkan data sensitif (foto hanya thumbnail, tidak ada koordinat eksak).

### 4.5 Verify Laporan Warga (`POST /api/reports/{id}/verify`)

**Akses:** petugas, supervisor

**Request:**
```json
{
    "action": "verify",           // "verify" | "reject"
    "rejection_reason": "",       // wajib jika action = "reject"
    "run_ai": true,               // optional: trigger AI analyze
    "ai_jenis_kerusakan": "",     // optional: isi manual (jika run_ai = false)
    "ai_severity": ""             // optional: isi manual
}
```

**Proses jika verify:**
- Jika `run_ai = true`: call `POST /api/analyze` dengan foto laporan → isi `ai_raw_output`, `total_detections`, `overall_severity`
- Jika `run_ai = false` dan `ai_jenis_kerusakan` diisi: set manual
- `status` → `'Menunggu Review'`
- `system_notes` — catat siapa yang verifikasi + timestamp

**Proses jika reject:**
- `status` → `'Ditolak'`
- `system_notes` — catat alasan penolakan + timestamp

### 4.6 Modifikasi Endpoint Existing

**`GET /api/reports` (list reports)** — tambahkan filter `source`:
- Petugas: lihat `source = 'petugas'` DAN `source = 'warga'`
- Filter baru: `?source=warga` untuk lihat hanya laporan warga
- Filter baru: `?unverified=true` untuk `status='Menunggu Verifikasi'`

**`GET /api/reports/{id}` (detail)** — pastikan warga bisa lihat laporan miliknya sendiri. Tambahkan guard: user `warga` hanya bisa lihat report dengan `user_id = auth()->id()`.

### 4.7 AuthController — Modifikasi Login

Login endpoint existing tetap sama. Setelah login untuk role `warga`:
- Redirect ke `/warga` (dashboard warga) — frontend handle
- Response sudah include `role: 'warga'`

---

## 5. Frontend Halaman Baru

### 5.1 Route Structure

```
src/routes/
├── index.tsx                    # DIUBAH — Landing page publik (bukan login petugas)
│                                # - Hero section "Laporkan Kerusakan Jalan"
│                                # - Tombol "Lapor Sekarang" → /daftar atau /login
│                                # - Tombol "Cek Status Laporan" → /lacak
│                                # - Info Dinas PU Bina Marga Sidoarjo
│
├── login.tsx                    # BARU — Login page (dipisah dari landing)
├── daftar.tsx                   # BARU — Registrasi warga
├── lapor.tsx                    # BARU — Form laporan kerusakan (simplified)
├── lacak.tsx                    # BARU — Input kode laporan → lihat status
├── warga.tsx                    # BARU — Layout dashboard warga (Outlet)
│   ├── index.tsx                # BARU — Dashboard warga (riwayat laporan)
│   └── laporan.$id.tsx          # BARU — Detail laporan warga + tracking
│
├── login.tsx                    # (file baru, route /login, untuk warga & petugas)
└── ... (routes existing tidak berubah)
```

### 5.2 Landing Page (`/` — diubah)

**Komponen:**
- Hero section: ilustrasi + tagline "Bersama Membangun Jalan Sidoarjo"
- Statistik cepat: jumlah laporan, jumlah selesai, jumlah diperbaiki
- Tombol CTA:
  - "Laporkan Kerusakan" → jika guest → `/daftar`, jika login → `/lapor`
  - "Cek Status Laporan" → `/lacak`
- Footer: alamat Dinas PU Bina Marga Sidoarjo, kontak

**Catatan:** Halaman login petugas yang sebelumnya di `/` pindah ke `/login`.

### 5.3 Register (`/daftar`)

**Form:**
- Nama lengkap (required)
- Email (required, valid email)
- No. Telepon (required, format Indonesia 08xx)
- Password + confirm password (min 8)
- Centang "Saya setuju dengan syarat & ketentuan"

**Flow:**
```
Submit → POST /api/auth/register
  ├─ Sukses: toast + redirect ke /login (atau langsung login otomatis)
  └─ Error: tampilkan pesan error
```

### 5.4 Login (`/login`)

Halaman login unified:
- Warga login → role `warga` → redirect `/warga`
- Petugas login → redirect `/home`
- Supervisor login → redirect `/supervisor`
- Admin login → redirect `/admin/dashboard`

### 5.5 Form Laporan Warga (`/lapor`)

**Simplified form** (tanpa AI, tanpa batch):

```
┌──────────────────────────────────────┐
│  📸 Foto Kerusakan                   │
│  ┌──────────────────────────────────┐│
│  │  [Ambil Foto / Pilih dari Galeri] ││
│  │  (tampilkan preview)              ││
│  └──────────────────────────────────┘│
│  (max 1 foto, jpeg/png, max 5MB)     │
│                                       │
│  📍 Lokasi                            │
│  ┌──────────────────────────────────┐│
│  │ Nama Jalan: [_______________] 🔍  ││
│  │ Kecamatan: [Dropdown ▼]          ││
│  │ (Peta mini: titik lokasi)        ││
│  └──────────────────────────────────┘│
│                                       │
│  📝 Deskripsi                         │
│  ┌──────────────────────────────────┐│
│  │ Jelaskan kondisi kerusakan...     ││
│  │ (min 10 karakter)                 ││
│  └──────────────────────────────────┘│
│                                       │
│  [KIRIM LAPORAN]                      │
└──────────────────────────────────────┘
```

**Flow submit:**
```
1. User pilih/ambil foto
2. EXIF date validasi (client-side, max 7 hari)
3. EXIF GPS ekstrak (client-side)
4. Jika GPS tdk ada → "Foto tidak memiliki data lokasi" → blokir
5. Autocomplete jalan (LocationIQ)
6. Pilih kecamatan
7. Isi deskripsi
8. Submit → POST /api/warga/reports
   ├─ Sukses: "Laporan berhasil! Kode: LP-2026-XXXXX"
   │          + link /lacak/LP-2026-XXXXX
   └─ Error: tampilkan pesan
```

**Perbedaan dari upload petugas:**
| Aspek | Petugas (`/upload`) | Warga (`/lapor`) |
|---|---|---|
| AI analysis | ✅ Ada | ❌ **Tidak ada** |
| Batch | ✅ Bisa | ❌ 1 foto saja |
| Kerusakan dimensi | ✅ Wajib (panjang x lebar) | ❌ **Tidak perlu** |
| Deskripsi | Opsional (catatan) | ✅ **Wajib** |
| Status awal | Menunggu Review | **Menunggu Verifikasi** |

### 5.6 Lacak Laporan (`/lacak`)

**Input:**
```
┌──────────────────────────────────────┐
│  Cek Status Laporan                  │
│                                       │
│  Masukkan kode laporan:               │
│  ┌──────────────────────────────────┐│
│  │ LP-2026-█████                    ││
│  └──────────────────────────────────┘│
│                                       │
│  [CARI]                               │
└──────────────────────────────────────┘
```

**Hasil (jika ditemukan):**
```
┌──────────────────────────────────────┐
│  Status: Menunggu Verifikasi  🟡     │
│                                       │
│  Timeline:                            │
│  ✅ 1 Jul 2026 10:00 — Laporan dibuat │
│  🟡 1 Jul 2026 10:00 — Menunggu      │
│       verifikasi petugas              │
│                                       │
│  Detail:                              │
│  Nama Pelapor: Budi Hartono           │
│  Jalan: Jl. Pahlawan                 │
│  Kecamatan: Sidoarjo                  │
│  Foto: [thumbnail]                    │
└──────────────────────────────────────┘
```

### 5.7 Dashboard Warga (`/warga`)

**Setelah login:**
- Nama & salam
- List laporan yang sudah dibuat (table/cards)
- Tombol "Buat Laporan Baru" → `/lapor`
- Setiap laporan: kode, status, tanggal, link detail

**Detail laporan (`/warga/laporan/{id}`):**
- Foto
- Lokasi
- Deskripsi
- Timeline status lengkap
- Tombol "Lacak" / bagikan kode laporan

### 5.8 Komponen Baru

| Komponen | File | Fungsi |
|---|---|---|
| `LandingHero` | `components/warga/LandingHero.tsx` | Hero section landing |
| `ReportFormWarga` | `components/warga/ReportFormWarga.tsx` | Form laporan simplified |
| `ReportTracker` | `components/warga/ReportTracker.tsx` | Tracking status + timeline |
| `WargaLayout` | `components/warga/WargaLayout.tsx` | Layout dashboard warga |

### 5.9 Auth Guard untuk Warga

**WargaLayout** (`warga.tsx`):
```tsx
useEffect(() => {
    if (!isLoggedIn()) {
        navigate({ to: "/" });
    } else if (getCurrentUser()?.role !== "warga") {
        navigate({ to: "/" });
    }
}, []);
```

---

## 6. EXIF & Fraud Guards

### 6.1 Perbandingan Guard

| Guard | Petugas | Warga |
|---|---|---|
| **EXIF Date** | Max **2 hari** | Max **7 hari** |
| EXIF date masa depan | ✅ Tolak | ✅ Tolak |
| Tanpa EXIF date | ✅ Tolak | ✅ Tolak |
| **EXIF GPS** | ✅ **Wajib** | ✅ **Wajib** |
| GPS mismatch tolerance | 500m | **1 km** |
| Tanpa EXIF GPS | ✅ Blokir | ✅ Blokir |
| **Image hash dedup** | ✅ Cek | ✅ Cek |
| **Duplicate spatial** | ✅ 15m | ✅ 15m |
| **Rate limit** | — | 5 laporan/hari/user |

### 6.2 Implementasi Backend

**Konstanta terpisah** (di `ReportController` atau `ReportService`):
```php
public const MAX_PHOTO_AGE_DAYS_PETUGAS = 2;
public const MAX_PHOTO_AGE_DAYS_WARGA = 7;
public const GPS_MISMATCH_METERS_PETUGAS = 500;
public const GPS_MISMATCH_METERS_WARGA = 1000;
```

Pengecekan dilakukan berdasarkan `$request->user()->role`.

### 6.3 Frontend EXIF Guard (Warga)

- **Date:** `validatePhotoDate.ts` — parameter `MAX_AGE_DAYS = 7` untuk warga
- **GPS:** `useLocationFromPhoto.ts` — sama, tapi pesan error disesuaikan (lebih ramah)
- **Poin penting:** Warga mungkin ambil foto dari galeri (EXIF stripped oleh Android "Remove location"). Tangani dengan pesan yang jelas: "Aktifkan lokasi kamera, atau gunakan tombol ambil foto langsung."

---

## 7. Verification Workflow

### 7.1 Petugas Dashboard — Tab "Verifikasi Laporan Warga"

Tambah tab/filter di halaman laporan petugas:
```
[ Semua Laporan ] [ Laporan Saya ] [ ⏳ Verifikasi Warga (5) ]
```
Tab "Verifikasi Warga" menampilkan:
- Laporan dengan `source = 'warga'` dan `status = 'Menunggu Verifikasi'`
- Urut: terlama di atas (FIFO)

### 7.2 Kartu Verifikasi

Setiap laporan warga di tab verifikasi menampilkan:

```
┌──────────────────────────────────────────────────────────┐
│  👤 Budi Hartono  •  LP-2026-00068  •  2 jam lalu        │
│  📍 Jl. Pahlawan, Kec. Sidoarjo                          │
│  📝 "Lubang besar di tengah jalan, sering kecelakaan"    │
│  ┌──────────────────────────────┐                        │
│  │      [FOTO LAPORAN]         │                        │
│  └──────────────────────────────┘                        │
│                                                           │
│  [ ✅ VERIFIKASI ]   [ ❌ TOLAK ]   [ 🤖 AI Analyze ]    │
│                                                           │
│  -- Panel verifikasi (klik ✅) --                        │
│  ☐ Jalankan AI analyze (deteksi otomatis)                │
│  Atau isi manual:                                         │
│  Jenis Kerusakan: [Dropdown ▼]                           │
│  Tingkat Keparahan: [Dropdown ▼]                         │
│                                                           │
│  -- Panel tolak (klik ❌) --                              │
│  Alasan: [_______________] (wajib)                        │
└──────────────────────────────────────────────────────────┘
```

### 7.3 AI Analyze Saat Verifikasi

Ketika petugas klik "AI Analyze" atau centang "Jalankan AI analyze":
1. Panggil `POST /api/analyze` dengan foto warga
2. Simpan `ai_raw_output`, `total_detections`, `overall_severity`
3. Tampilkan hasil deteksi ke petugas untuk dikonfirmasi

**Hemat resource:** AI hanya dipanggil SEKALI per laporan (saat verifikasi), bukan setiap submit.

### 7.4 Notifikasi ke Warga

Karena belum ada push notification atau email otomatis:
- **Via tracking page:** Warga cek `/lacak/LP-2026-XXXXX` untuk lihat status
- **Via dashboard:** Warga login → lihat timeline di `/warga`

**Phase 2:** Email notification (sudah ada kolom `email_verified_at`, tinggal integrasi mail).

---

## 8. Risk & Mitigation

| Risk | Dampak | Mitigasi |
|---|---|---|
| **Spam/laporan palsu** | Petugas buang waktu verifikasi | Rate limit 5/hari/user + CAPTCHA (Phase 2) |
| **Duplikat laporan** | Data redundant, bingung prioritas | Check spatial 15m + info "Laporan serupa sudah ada" |
| **Warga upload foto bukan milik sendiri** | Laporan tidak valid | EXIF date + GPS verify (+ edukasi ambil foto langsung) |
| **Beban petugas verifikasi** | Petugas kewalahan | Prioritaskan FIFO, limit 30 verifikasi/hari/petugas? |
| **Warga lupa password** | Gagal login, lapor lewat jalur lain | Reset password via email (infra existing) |
| **Foto tanpa GPS** | Lokasi tidak akurat | Blokir dengan pesan jelas + panduan cara ambil foto dengan lokasi |
| **Warga lapor di luar Sidoarjo** | Di luar wilayah wewenang | Validasi koordinat Sidoarjo bounds (existing) |

### 8.1 Strategi Tambahan

**Anti-spam di register:**
- Rate limit: 3 registrasi/IP/jam
- Email unique + regex valid
- Nomor telepon unique + format Indonesia

**Verifikasi bertahap:**
- Phase 1: Register langsung aktif (tanpa verifikasi)
- Phase 2: Tambahkan verifikasi email atau OTP WhatsApp

**Prioritas verifikasi:**
- Laporan dengan foto jelas + GPS akurat + deskripsi detail → verifikasi cepat
- Laporan dengan foto buram/GPS tidak akurat → perlu dicek lebih teliti

---

## 9. Urutan Implementasi

### Phase 1: Backend MVP (Estimasi: 2-3 hari)

| # | Task | File |
|---|---|---|
| 1 | Buat migration: role warga + kolom phone/address | `database/migrations/` |
| 2 | Buat migration: status 'Menunggu Verifikasi' + source | `database/migrations/` |
| 3 | Buat `POST /api/auth/register` | `AuthController@register` |
| 4 | Buat `POST /api/warga/reports` (controller baru) | `WargaReportController.php` |
| 5 | Buat `GET /api/reports/track/{code}` | ReportController (atau controller baru) |
| 6 | Buat `POST /api/reports/{id}/verify` | `ReportController@verify` |
| 7 | Modifikasi `GET /api/reports` — filter source, unverified | `ReportController@index` |
| 8 | EXIF guard: konstanta 7 hari + 1 km untuk warga | `ReportController` atau service |

### Phase 2: Frontend MVP (Estimasi: 2-3 hari)

| # | Task | File |
|---|---|---|
| 1 | Landing page baru (`/`) | `routes/index.tsx` |
| 2 | Register page (`/daftar`) | `routes/daftar.tsx` |
| 3 | Login page (`/login`) | `routes/login.tsx` |
| 4 | Form laporan warga (`/lapor`) | `routes/lapor.tsx` + `components/warga/ReportFormWarga.tsx` |
| 5 | Tracking page (`/lacak`) | `routes/lacak.tsx` |
| 6 | Dashboard warga (`/warga`) | `routes/warga.tsx` + `routes/warga/index.tsx` |
| 7 | Detail laporan warga (`/warga/laporan/$id`) | `routes/warga/laporan.$id.tsx` |

### Phase 3: Verifikasi Petugas (Estimasi: 1-2 hari)

| # | Task | File |
|---|---|---|
| 1 | Tab "Verifikasi Warga" di halaman laporan petugas | `routes/my-reports.tsx` atau komponen baru |
| 2 | Kartu verifikasi + trigger AI | Komponen baru |
| 3 | Integrasi AI analyze ke flow verifikasi | Backend + Frontend |
| 4 | Log aktivitas verifikasi | `system_notes` |

### Phase 4: Polish (Opsional)

| # | Task | Prioritas |
|---|---|---|
| 1 | Email notification saat status berubah | Medium |
| 2 | CAPTCHA di register / submit laporan | Medium |
| 3 | WhatsApp OTP untuk verifikasi nomor | Low |
| 4 | Halaman FAQ / panduan lapor | Low |
| 5 | Dark mode untuk warga | Low |

---

## Lampiran: Perubahan File

### Backend

| File | Tindakan |
|---|---|
| `app/Models/User.php` | Tambah `phone`, `address` ke `$fillable` |
| `app/Models/Report.php` | Tambah `source`, `description` ke `$fillable` |
| `app/Http/Controllers/AuthController.php` | Tambah method `register()` |
| `app/Http/Controllers/WargaReportController.php` | **BARU** — handle warga reports |
| `app/Http/Controllers/ReportController.php` | Tambah method `verify()`, `track()`; modifikasi `index()` |
| `routes/api.php` | Tambah 6 endpoint baru |
| `app/Providers/AppServiceProvider.php` | Tambah throttle config? |

### Frontend

| File | Tindakan |
|---|---|
| `src/routes/index.tsx` | **UBAH** — landing page publik |
| `src/routes/login.tsx` | **BARU** — unified login |
| `src/routes/daftar.tsx` | **BARU** — register |
| `src/routes/lapor.tsx` | **BARU** — form laporan warga |
| `src/routes/lacak.tsx` | **BARU** — tracking |
| `src/routes/warga.tsx` | **BARU** — layout warga |
| `src/routes/warga/index.tsx` | **BARU** — dashboard warga |
| `src/routes/warga/laporan.$id.tsx` | **BARU** — detail laporan warga |
| `src/lib/auth.ts` | Tambah role `warga` ke `UserRole` type |
| `src/lib/api.ts` | — (tidak perlu diubah, generic) |
| `src/lib/validatePhotoDate.ts` | Parameter `MAX_AGE_DAYS` jadi configurable |
| `src/components/warga/` | **BARU** — komponen warga |
