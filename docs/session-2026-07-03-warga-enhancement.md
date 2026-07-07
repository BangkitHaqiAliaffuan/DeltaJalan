# Session: Warga Portal Enhancement — AI Analysis & Team Assignment

**Date:** 2026-07-03
**Objective:** Menyelesaikan pipeline laporan warga dari submit sampai AI analysis, termasuk kompresi foto, team picker di approve, dan background job.

---

## Changes Made

### 1. Frontend — Kompresi Foto di Upload Warga

**File:** `Frontend-stable/src/routes/warga/lapor.tsx`

- Tambah state `processing` untuk indikator kompresi
- Panggil `compressImage(file)` dari `@/lib/compressImage` di `handlePhotoChange()`
- Flow: user pilih foto → kompresi (resize 2048px, target 0.8MB, preserve EXIF) → EXIF GPS read → auto-fill lokasi
- Sama persis dengan fungsi kompresi di `upload.tsx` milik petugas
- Tampilkan spinner "Kompresi dan validasi foto..." selama proses

### 2. Frontend — Belum Dianalisis Badge

**File:** `Frontend-stable/src/lib/format.ts`

- `getSeverityLabel()` sudah handle null/undefined → `"Belum Dianalisis"` (tidak diubah, sudah benar)

**File:** `Frontend-stable/src/types/laporan.ts`

- `overall_severity?: string | null` (tambah nullable)

### 3. Backend — Background AI Analysis Job

**File (new):** `backend_POSTGRESQL/app/Jobs/AnalyzeReportJob.php`

- Class `AnalyzeReportJob` implements `ShouldQueue`
- Property: `public string $reportId`
- `handle()`:
  1. Load Report by ID
  2. Ambil foto pertama dari `ReportPhoto`
  3. Cek file exists di storage
  4. Panggil FastAPI `POST /analyze` via HTTP Client
  5. Update report: `ai_jenis_kerusakan`, `ai_severity`, `overall_severity`, `ai_confidence`, `total_detections`, `ai_raw_output`, `image_result_path`
- Timeout 120 detik
- Logging di setiap step (success, connection error, unexpected error)

### 4. Backend — Approve Warga Reports

**File:** `backend_POSTGRESQL/app/Http/Controllers/ReportController.php`

**`approve()` method:**

- Accept status `Menunggu Verifikasi` untuk laporan warga (petugas tetap `Menunggu Review`/`Ditinjau`)
- **Warga flow:**
  - `team_id` required dari request
  - Validasi team exists
  - Assign `assigned_team_id` ke team pilihan supervisor
  - Dispatch `AnalyzeReportJob::dispatch($report->id)`
  - Notifikasi ke pelapor warga + anggota team
- **Petugas flow:**
  - Auto-assign ke `$reporter->team_id` (tidak berubah)
  - Notifikasi ke pelapor + anggota tim lain

**`show()` method:**

- Tambah `source` dan `description` di response detail

### 5. Backend — Migration: overall_severity nullable

**File (new):** `backend_POSTGRESQL/database/migrations/2026_07_03_002634_make_overall_severity_nullable_for_warga.php`

```sql
ALTER TABLE reports ALTER COLUMN overall_severity DROP NOT NULL;
ALTER TABLE reports ALTER COLUMN overall_severity DROP DEFAULT;
```

**Alasan:** Warga reports belum dianalisis AI, jadi `overall_severity` harus null. Sebelumnya column `NOT NULL DEFAULT 'Baik'`.

**File:** `backend_POSTGRESQL/app/Models/Report.php`

- Hapus `'overall_severity' => 'Baik'` dari `$attributes` (default sekarang null implicit)

**File:** `backend_POSTGRESQL/app/Http/Controllers/WargaReportController.php`

- Tambah `'overall_severity' => null` di `Report::create()` store

### 6. Frontend — Modal Approve dengan Team Picker

**File:** `Frontend-stable/src/routes/detail-report.tsx`

- State: `teams`, `selectedTeamId`
- Fetch `/api/teams` saat approve modal terbuka (untuk warga reports)
- Dropdown "Pilih Tim Satgas" hanya muncul jika `report.source === "warga"`
- Tombol "Setujui & Tugaskan" disabled sampai tim dipilih
- Kirim `{ priority, team_id }` ke approve endpoint

---

## Problems & Resolutions

### Problem 1: `overall_severity` Default 'Baik' untuk Warga

**Masalah:** Model Report memiliki `$attributes = ['overall_severity' => 'Baik']`. Saat warga submit laporan, `overall_severity` otomatis 'Baik' — membuat frontend menampilkan "Baik" bukan "Belum Dianalisis".

**Solusi:**
1. Migration: `ALTER COLUMN overall_severity DROP NOT NULL` dan `DROP DEFAULT`
2. `WargaReportController@store`: set `'overall_severity' => null` eksplisit
3. Model: hapus default dari `$attributes`
4. Type: `overall_severity?: string | null`

**Catatan:** Perubahan ini tidak mempengaruhi laporan petugas existing (mereka tetap punya severity dari AI analysis di store).

### Problem 2: `callFastApiAnalyze()` Private Method

**Masalah:** `ReportController@callFastApiAnalyze()` adalah method `private`, tidak bisa dipanggil dari `AnalyzeReportJob`.

**Solusi:** Job memiliki logic sendiri untuk panggil FastAPI (HTTP Client) — tidak reuse method controller. Ini lebih bersih (Separation of Concerns) dan job bisa jalan tanpa controller context.

### Problem 3: Status Flow Warga — "Menunggu Verifikasi"

**Masalah:** Warga reports dibuat dengan status `Menunggu Verifikasi`, tapi `approve()` hanya menerima `Menunggu Review`/`Ditinjau`. Tidak ada endpoint yang mentransisikan `Menunggu Verifikasi` → `Menunggu Review`.

**Solusi:** `approve()` sekarang menerima `Menunggu Verifikasi` untuk laporan `source === 'warga'`. Supervisor bisa langsung approve dari status verifikasi — tidak perlu step perantara.

### Problem 4: Jobs Directory Tidak Ada

**Masalah:** `app/Jobs/` belum ada.

**Solusi:** Buat manual `New-Item -ItemType Directory`, tulis file PHP, lalu `composer dump-autoload`.

### Problem 5: PostgreSQL ENUM + NOT NULL

**Masalah:** Column `overall_severity` menggunakan custom type `severity_enum` dengan `NOT NULL DEFAULT 'Baik'`. PostgreSQL ENUM tidak bisa diubah via Schema Builder biasa.

**Solusi:** Pakai `DB::statement('ALTER TABLE ... ALTER COLUMN ... DROP NOT NULL')` — raw SQL, bukan Schema Builder. Aman karena hanya mengubah constraint, bukan tipe data.

---

## Files Changed/Added

```
Frontend-stable/src/
├── routes/warga/lapor.tsx              (modified — compressImage + processing state)
├── routes/detail-report.tsx            (modified — teams state + team picker modal)
├── types/laporan.ts                    (modified — overall_severity nullable)
└── lib/format.ts                       (unchanged — already handled)

backend_POSTGRESQL/
├── app/Jobs/AnalyzeReportJob.php       (NEW)
├── app/Http/Controllers/ReportController.php   (modified — approve + show)
├── app/Http/Controllers/WargaReportController.php (modified — overall_severity null)
├── app/Models/Report.php               (modified — hapus default)
└── database/migrations/
    └── 2026_07_03_002634_*.php         (NEW — nullable overall_severity)
```
