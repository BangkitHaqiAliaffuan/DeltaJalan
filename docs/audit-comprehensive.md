# Audit DeltaJalan — Comprehensive Review

**Tanggal:** 22 Juli 2026  
**Auditor:** OpenCode AI  
**Scope:** Backend (Laravel), Frontend (React/TanStack), Infrastructure, CI/CD, Security, Documentation

---

## 🔴 Kritis (Harus Segera)

### 1. Production Secrets Tercommit ke Git

**Severity:** Critical  
**Area:** Security  
**File:** `backend_POSTGRESQL/.env`, `backend_POSTGRESQL/.env.production`, `scripts/backup-jalankita`, `Frontend-stable/.env`

**Temuan:** 9+ production secrets ter-commit dan ter-push ke repository:

| Secret | Lokasi |
|--------|--------|
| Production DB password (`HaqiGoesToRomania1!`) | `.env.production`, `backup-jalankita` |
| Gmail SMTP password | `.env`, `.env.production` |
| Telegram Bot Token | `.env`, `.env.production` |
| Telegram Webhook Secret | `.env`, `.env.production` |
| LocationIQ API Key | `.env`, `.env.production`, `Frontend-stable/.env` |
| VAPID Private Key | `.env`, `.env.production` |
| reCAPTCHA Secret + Site Key | `.env.production`, `Frontend-stable/.env` |
| APP_KEY (sama untuk dev & production) | `.env`, `.env.production` |
| Stale ngrok URL | `.env` |

**Dampak:** Siapa pun dengan akses repo bisa connect ke production DB, kirim email sebagai `jalankita.sla@gmail.com`, kontrol Telegram bot, dan pakai LocationIQ API. APP_KEY yang sama antara dev dan production memungkinkan session/token encryption dibongkar.

**Fix:**
- Rotasi semua secret segera
- Hapus `.env` dan `.env.production` dari git history (`git rm --cached` + `.gitignore`)
- Gunakan environment variables di server, file hanya template dengan placeholder

---

### 2. Login Endpoint Tidak Punya Rate Limiting

**Severity:** Critical  
**Area:** Security — Backend  
**File:** `backend_POSTGRESQL/routes/api.php:55`

**Temuan:** `Route::post('/auth/login', ...)` tidak memiliki middleware `throttle`. AGENTS.md menyebut "throttled 10/min" tapi tidak diimplementasi.

**Dampak:** Brute-force password attack terhadap akun mana pun tidak terbatas.

**Fix:**
```php
Route::post('/auth/login', [AuthController::class, 'login'])
    ->middleware('throttle:10,1');
```

---

### 3. MySQL Syntax di PostgreSQL App

**Severity:** Critical  
**Area:** Backend  
**File:** `app/Http/Controllers/KecamatanController.php:21`

**Temuan:** `DB::raw('DATEDIFF(CURDATE(), MAX(survey_tasks.tanggal_patroli)) as hari_sejak_patroli')` — PostgreSQL tidak mengenali `CURDATE()` (MySQL function).

**Dampak:** Endpoint akan 500 jika route diaktifkan. Untungnya controller ini tidak memiliki route sama sekali (dead code).

**Fix:** Ganti dengan `EXTRACT(DAY FROM NOW() - MAX(survey_tasks.tanggal_patroli))` atau hapus controller jika tidak diperlukan.

---

### 4. CI/CD Workflows Tidak Ada

**Severity:** Critical  
**Area:** CI/CD  
**File:** `.github/workflows/` — direktori tidak ada

**Temuan:** AGENTS.md mendokumentasikan 3 workflow (deploy-backend, deploy-ai, health-check) tapi tidak ada satupun file di repo.

**Dampak:** Semua deploy manual via SSH. Tidak ada automated gate, testing, atau health check. Kode broken bisa langsung ke production.

**Fix:** Buat workflow yang sebenarnya atau hapus referensi dari AGENTS.md.

---

### 5. Health Check URLs Salah

**Severity:** Critical  
**Area:** CI/CD  
**File:** `.github/workflows/health-check.yml` (tidak ada — lihat #4)

**Temuan:** URL yang direferensi (`app.jalankita.sidoarjo.go.id`, `api.jalankita.sidoarjo.go.id`) tidak pernah ada. Domain aktual: `api.deltajalan.web.id`.

**Fix:** Perbaiki URL atau buat workflow baru dengan URL yang benar.

---

### 6. Auth Guard Hilang di 8+ Frontend Routes

**Severity:** Critical  
**Area:** Frontend — Security  
**Files:**
- `src/routes/home.tsx` — tidak ada role check
- `src/routes/my-reports.tsx`
- `src/routes/map.tsx`
- `src/routes/notifications.tsx`
- `src/routes/edit-report.tsx`
- `src/routes/complete-report.tsx`
- `src/routes/detail-report.tsx`
- `src/routes/detail-patroli.tsx`

**Temuan:** Hanya mengandalkan token presence, tidak verifikasi role user. Warga bisa mengakses halaman petugas, API call akan gagal tapi UI tetap render. Informasi leakage.

**Fix:** Tambahkan role guard di setiap route (contoh: redirect jika role tidak sesuai).

---

### 7. Response API Inkonsisten

**Severity:** Critical  
**Area:** Backend  
**Files:**
- `app/Http/Controllers/ReportController.php:3012,3017` — `reopen()` return `{"message": "..."}` tanpa `success: false`
- `app/Http/Controllers/SurveyTaskController.php` — seluruh response tanpa field `success`

**Temuan:** Semua endpoint lain konsisten return `{"success": true/false, "data": ...}`. Dua controller ini melanggar kontrak.

**Fix:** Tambahkan `'success' => false` di error response.

---

### 8. Tiga Dokumen Kritis Tidak Ada

**Severity:** Critical  
**Area:** Documentation

| Dokumen | Direferensi Oleh |
|---------|------------------|
| `SECURITY_ANALYSIS.md` | AGENTS.md, supervisor-approval-considerations.md |
| `solution.md` | AGENTS.md |
| `docs/reactivate-trust-score.md` | AGENTS.md, supervisor-approval-considerations.md |

**Fix:** Buat dokumen atau hapus semua referensi dari file lain.

---

### 9. Backup Script Hardcode Password DB

**Severity:** Critical  
**Area:** Security — Infrastructure  
**File:** `scripts/backup-jalankita:6`

**Temuan:** `PGPASSWORD='HaqiGoesToRomania1!' pg_dump ...` — password DB dalam plaintext di script.

**Fix:** Gunakan `~/.pgpass` file dengan permission 0600.

---

### 10. Zero Test Coverage

**Severity:** Critical  
**Area:** Quality

**Temuan:**
- **Backend:** Hanya 2 skeleton test (ExampleTest) — 0 test untuk controller, auth, CRUD, AI, dll. Padahal ada 80+ migration, 21 controller, 17 model.
- **Frontend:** Tidak ada test framework terkonfigurasi.

**Fix:** Minimal integration test untuk core business logic (report CRUD, auth, duplicate check).

---

### 11. APP_KEY Sama untuk Dev & Production

**Severity:** Critical  
**Area:** Security  
**File:** `backend_POSTGRESQL/.env:3`, `.env.production:3`

**Fix:** Generate APP_KEY terpisah untuk production (`php artisan key:generate`).

---

### 12. trustProxies(at: '*') Terlalu Permisif

**Severity:** Critical  
**Area:** Security  
**File:** `bootstrap/app.php:48`

**Fix:** Restrict ke IP proxy yang dikenal.

---

## 🟠 Major

### 13. DuplicateCheck Image Hash Tidak Aktif

**Severity:** Major  
**Area:** Backend

**Temuan:** `DuplicateCheckService` sudah diimplementasi tapi image hash check dimatikan. `config('app.dedup_enabled')` kemungkinan `null` karena tidak terdefinisi di `config/app.php`.

---

### 14. MobileCLIP Relevance Guard Hanya di Dev

**Severity:** Major  
**Area:** Backend — AI  
**Files:** `app/Services/MobileClipService.php`, `app/Services/ImageQualityService.php`

**Temuan:** AGENTS.md menyatakan "No MobileCLIP relevance guard — too heavy for Lambda, hardcoded `relevant: true`". Di production (Lambda), endpoint `/analyze-relevance` tidak ada. Telegram bot gagal diam-diam.

---

### 15. ~300 Line EXIF Code Duplikasi

**Severity:** Major  
**Area:** Backend — Code Quality  
**Files:**
- `app/Http/Controllers/ReportController.php`
- `app/Http/Controllers/AIController.php`
- `app/Http/Controllers/WargaReportController.php`

**Temuan:** `validatePhotoDateExif`, `extractExifGps`, dan fungsi EXIF lainnya di-copy-paste di 3 controller. Bug fix harus patch 3 tempat.

**Fix:** Ekstrak ke trait `HasExifValidation` atau service `ExifService`.

---

### 16. TrustScoreService Mati Total (NONAKTIF)

**Severity:** Major  
**Area:** Backend — Dead Code  
**File:** `app/Services/TrustScoreService.php`

**Temuan:** 94 line implementasi + kolom DB (`trust_score`, `trust_breakdown`) tidak terpakai. Semua call site dikomentari dengan marker `// ── TRUST SCORE [NONAKTIF] ──`. Dokumentasi reaktivasi tidak ada.

---

### 17. full_address Plan Belum Diimplementasi

**Severity:** Major  
**Area:** Backend — Feature  
**File:** `docs/add-full_address-plan.md`

**Temuan:** Migration, model, controller (3 tempat), backfill command, frontend — semua masih pending.

---

### 18. AnalyzeReportJob Tidak Pernah Dispatch

**Severity:** Major  
**Area:** Backend — AI  
**File:** `app/Jobs/AnalyzeReportJob.php`

**Temuan:** Job class ada tapi tidak terintegrasi di `processAndCreateReport()`. Jika sync AI call gagal, tidak ada async fallback.

---

### 19. Stale Closure di 6+ useEffect

**Severity:** Major  
**Area:** Frontend

**Files:**
- `src/routes/edit-report.tsx:52-58` — `useEffect([], [])`
- `src/routes/lacak.tsx:55-59`
- `src/routes/stats.tsx:95-100`
- `src/routes/laporan.$reportCode.tsx:51-53`
- `src/routes/my-reports.tsx:54-58`
- `src/routes/notifications.tsx:59-61`

**Dampak:** Data basi, handler tidak pernah re-run meskipun dependencies berubah.

---

### 20. /stats Pakai Mock Data Fallback

**Severity:** Major  
**Area:** Frontend  
**File:** `src/routes/stats.tsx:131-132`

**Temuan:** Jika API return data kosong, halaman diam-diam pakai `getMockStats()` — data palsu. Supervisor bisa lihat angka虚构.

---

### 21. /warga/peta Filter Tidak Bisa Berubah

**Severity:** Major  
**Area:** Frontend  
**File:** `src/routes/warga/peta.tsx:31`

**Temuan:** `const [filters] = useState<MapFilters>(defaultFilters)` — `setFilters` tidak pernah dipanggil. Map warga permanently unfiltered.

---

### 22. Nginx Port 80 Only — No HSTS/CSP

**Severity:** Major  
**Area:** Infrastructure — Security  
**File:** `scripts/deltajalan.nginx.conf`

**Temuan:** `listen 80;` — tidak ada SSL termination, tidak ada HSTS, tidak ada CSP. Hanya 4 dari 7 recommended security headers terpasang.

---

### 23. Docker Pakai php artisan serve

**Severity:** Major  
**Area:** Infrastructure  
**File:** `backend_POSTGRESQL/Dockerfile:35`

**Temuan:** `CMD ["php", "artisan", "serve", ...]` — PHP built-in server single-threaded, blocking, tidak untuk production.

---

### 24. No Opcache

**Severity:** Major  
**Area:** Infrastructure — Performance  
**Files:** `backend_POSTGRESQL/Dockerfile`, `scripts/php-fpm-optimized.conf`

**Temuan:** PHP jalan tanpa opcode caching.

---

### 25. Queue Worker stopwaitsecs=3600

**Severity:** Major  
**Area:** Infrastructure  
**File:** `scripts/deltajalan-worker.conf:12`

**Temuan:** Supervisor tunggu 1 jam sebelum SIGKILL stuck job. Default 10 detik.

---

### 26. Logrotate Group Mismatch

**Severity:** Major  
**Area:** Infrastructure  
**File:** `scripts/logrotate-jalankita:8`

**Temuan:** `create 0640 www-data adm` — Nginx butuh `www-data` group, bukan `adm`.

---

### 27. AGENTS-opencode.md Outdated

**Severity:** Major  
**Area:** Documentation

**Temuan:** Deskripsi arsitektur lama, kurang role `admin`/`warga`, referensi file yang tidak ada.

---

### 28. README Root Deskripsi Dev Outdated

**Severity:** Major  
**Area:** Documentation

**Temuan:** Masih bilang Vite proxy → Laravel lokal, padahal dev sekarang langsung API production.

---

### 29. PCI Status Draft Tapi Kode Sudah Di-commit

**Severity:** Major  
**Area:** Backend — Feature

**Temuan:** `docs/pci-implementation-plan.md` status "Draf Perencanaan" tapi commit `3d472c0` sudah mengandung kode PCI. Migration, service, command, API endpoint, frontend belum ada.

---

## 🟡 Minor

| # | Temuan | File | Detail |
|---|--------|------|--------|
| 30 | File temp di root | `temp_check.php`, `temp_verify.php`, `test_cache_direct.php` | Hapus atau gitignore |
| 31 | 23 console command — banyak one-time backfill | `app/Console/Commands/` | Risiko accidental re-execute |
| 32 | Dead service — 0 references | `GeographicService.php`, `SupervisorRouterService.php` | Hapus atau dokumentasikan |
| 33 | Meta tag salah departemen | `__root.tsx:82` — "Dishub Sidoarjo" | Seharusnya "Dinas PU Bina Marga" |
| 34 | Route stub masih ada | `/detail-survei`, `/review`, `/petugas-eksekusi`, `/tugas-survei` | Hapus jika tidak diperlukan |
| 35 | og:image imperatif tidak di-cleanup | `laporan.$reportCode.tsx:72-79` | Meta tag bocor antar navigasi |
| 36 | Lambda update script skip silent | `scripts/update-lambda.sh:40-49` | Jika MobileCLIP conversion gagal |
| 37 | Dua backup script berbeda | `backup-jalankita` vs `backup.sh` | Retensi 7 vs 30 hari |
| 38 | Tidak ada `.env.example` frontend | `Frontend-stable/` | |
| 39 | Tidak ada git tags / PR templates | Root | |
| 40 | Manual testing 1073 line — no E2E | `docs/manual-testing.md` | |

---

## Summary

| Severity | Count | Action |
|----------|-------|--------|
| **🔴 Kritis** | 12 | Rotasi secret, rate limit login, hapus .env dari git, perbaiki CI/CD, auth guard frontend |
| **🟠 Major** | 17 | Fix duplicate check config, refactor EXIF, update docs, HSTS/CSP, selesaikan PCI |
| **🟡 Minor** | 11 | Bersihkan file temp, hapus dead code/route, update meta tag |

**Prioritas #1:** Rotasi semua secret dan hapus dari git history.
**Prioritas #2:** Rate limiting di login endpoint.
**Prioritas #3:** Tambah auth guard di frontend routes yang belum terproteksi.
