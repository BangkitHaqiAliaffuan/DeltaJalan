# Laporan Analisis Mendalam: Perbandingan Fitur Android Native vs Frontend Stable (DeltaJalan)

> **Revisi:** 2026-10-19 — Dokumen diperbarui dengan hasil crosscheck langsung ke source code.
> Beberapa item pada dokumen versi sebelumnya **sudah tidak akurat** (stale); semua koreksi dicantumkan pada bagian khusus di bawah.

Dokumen ini berisi hasil analisis mendalam terhadap kelengkapan fitur, kesamaan alur, serta audit cacat fungsi dan logika antara aplikasi **`android-native`** (Kotlin Jetpack Compose) dan **`Frontend-stable`** (React 19 + TanStack Start).

---

## 1. Ringkasan Eksekutif

| Role / Domain | Status Kelengkapan Native | Status Frontend Stable | Ringkasan Kesenjangan & Evaluasi |
| :--- | :---: | :---: | :--- |
| **Warga** | 🟢 **~92%** | 🟢 **100%** | Sangat lengkap. Multi-foto, EXIF 7 hari, reverse geocoding, peta GIS, rating bintang, riwayat. Belum ada: halaman Lacak Publik, autocomplete nama jalan (LocationIQ), duplicate check realtime, dan BeforeAfterSlider. |
| **Petugas** | 🟢 **~90%** | 🟢 **100%** | ✅ *Koreksi dari dokumen lama:* Tab Peta **sudah terhubung** ke `PetugasPetaScreen`, `DetailScreen.kt` **sudah memiliki** semua dialog eksekusi (Mulai, Progress, Selesai, Edit, Hapus). Kesenjangan tersisa: autocomplete jalan, duplicate check, SubmissionQueue Worker. |
| **Supervisor** | 🟢 **~88%** | 🟢 **100%** | Dashboard KPI, Triage, Detail, Peta GIS, Jadwal Patroli CRUD, NotifCenter sudah ada. Belum ada: Bulk Triage, Export PDF/Excel, SurveyDetailScreen dedicated. |
| **Admin** | 🔴 **0%** | 🟢 **100%** | Tidak ada UI Admin di Android Native. Sesi Admin jatuh ke `MainScaffold` Petugas. |
| **Fitur Lintas Role** | 🟡 **~70%** | 🟢 **100%** | Belum ada: Lacak Publik, Road Polyline, Duplicate Check realtime, SubmissionQueue offline Worker, BeforeAfterSlider. |

---

## 2. Koreksi Dokumen Versi Lama (Stale Items)

Tiga item berikut dinyatakan "belum ada" di dokumen sebelumnya namun ternyata **sudah diimplementasikan**:

| Item Lama (Salah) | Kenyataan Saat Ini | Bukti Kode |
| :--- | :--- | :--- |
| "Tab Peta Petugas Menggunakan Placeholder" | ✅ **Tab PETA sudah terhubung ke `PetugasPetaScreen`** | [`MainActivity.kt:567-571`](file:///home/marcille/Tugas/DeltaJalan/android-native/app/src/main/java/com/jalankita/app/MainActivity.kt#L567-L571) — `MainScreen.PETA -> PetugasPetaScreen(...)` |
| "`DetailScreen.kt` masih read-only, tidak ada alur eksekusi" | ✅ **`DetailScreen.kt` sudah lengkap** dengan `MulaiDialog`, `ProgressDialog`, `SelesaiDialog`, `EditFormDialog`, dan `DeleteConfirm` | [`DetailScreen.kt:353-424`](file:///home/marcille/Tugas/DeltaJalan/android-native/app/src/main/java/com/jalankita/app/feature/home/DetailScreen.kt#L353-L424) |
| "Belum ada In-App Notification Center" | ✅ **`NotifScreen.kt` sudah ada** dan terpasang di ketiga scaffold (Petugas, Supervisor, Warga) | [`MainActivity.kt:492`](file:///home/marcille/Tugas/DeltaJalan/android-native/app/src/main/java/com/jalankita/app/MainActivity.kt#L492) (Petugas), [`MainActivity.kt:229`](file:///home/marcille/Tugas/DeltaJalan/android-native/app/src/main/java/com/jalankita/app/MainActivity.kt#L229) (Supervisor), [`MainActivity.kt:169-183`](file:///home/marcille/Tugas/DeltaJalan/android-native/app/src/main/java/com/jalankita/app/MainActivity.kt#L169-L183) (Warga) |

---

## 3. Matriks Perbandingan Fitur Detail per Role

### A. Role Warga

| Fitur / Modul | Frontend Stable | Android Native | Status |
| :--- | :---: | :---: | :--- |
| **Autentikasi & Registrasi** | `daftar.tsx`, `masuk.tsx` | `RegisterScreen.kt`, `LoginScreen.kt` | ✅ **Lengkap** |
| **Dashboard / Beranda** | `warga/index.tsx` | `WargaDashboardScreen.kt` | ✅ **Lengkap** |
| **Form Lapor Kerusakan** | `warga/lapor.tsx` | `WargaLaporScreen.kt` | ✅ **Lengkap**: Multi-foto maks 3, EXIF 7 hari, GPS fallback server. |
| **Autocomplete Nama Jalan** | `useRoadSearch.ts` (LocationIQ) | ❌ Input teks biasa | ⚠️ **Belum Ada**: Android hanya input teks manual tanpa autocomplete LocationIQ. |
| **Duplicate Check Realtime** | `useDuplicateCheck.ts`, `DuplicateChecker.tsx` | ❌ Tidak ada | ⚠️ **Belum Ada**: Web menampilkan peringatan duplikat saat koordinat mirip laporan yang ada. |
| **Riwayat Laporan** | `warga/laporan/index.tsx` | `WargaRiwayatScreen.kt` | ✅ **Lengkap** |
| **Detail Laporan & Timeline** | `warga/laporan/$id.tsx` | `WargaDetailScreen.kt` | ✅ **Lengkap** |
| **Before/After Slider** | `BeforeAfterSlider.tsx` (di detail) | Toggle biasa (Foto Awal / Foto Sesudah) | ⚠️ **Fungsional tapi Berbeda**: Web punya slider interaktif drag; Android pakai toggle biasa. |
| **Rating & Feedback** | Ada di detail laporan | `submitRating` (`WargaViewModel.kt`) | ✅ **Lengkap**: Rating 1–5 bintang + komentar opsional. |
| **Peta Sebaran GIS** | `warga/peta.tsx` | `WargaPetaScreen.kt` + `ReportMapScreen.kt` | ✅ **Lengkap** (tapi ada bug parsing — lihat Bug #1) |
| **Road Polyline di Peta** | `useRoadPolyline.ts` | ❌ Tidak ada | ⚠️ **Belum Ada**: Web menampilkan garis ruas jalan pada peta; Android hanya marker titik. |
| **Lacak Laporan Publik** | `/lacak`, `/laporan.$reportCode` | ❌ Tidak ada | ❌ **Belum Ada**: `POST /reports/track` tanpa login tidak ada di Android. |

---

### B. Role Petugas

| Fitur / Modul | Frontend Stable | Android Native | Status |
| :--- | :---: | :---: | :--- |
| **Dashboard Utama** | `home.tsx` | `DashboardScreen.kt` | ✅ **Lengkap** |
| **Lapor Kerusakan (Batch AI)** | `upload.tsx`, `ai-result.tsx` | `LaporScreen.kt`, `AiResultScreen.kt` | ✅ **Lengkap**: Multi-foto maks 10, EXIF 2 hari, analisis AI batch. |
| **Autocomplete Nama Jalan** | `useRoadSearch.ts` (LocationIQ) | ❌ Input teks biasa | ⚠️ **Belum Ada** |
| **Tugas Saya** | `tugas-saya.tsx` | `TugasScreen` (`Tabs.kt`) | ✅ **Lengkap** |
| **Sesi Patroli Lapangan** | `detail-patroli.tsx` | `PatrolSessionScreen.kt` | ✅ **Lengkap** |
| **Riwayat Laporan Lapangan** | `my-reports.tsx` | `RiwayatScreen` (`Tabs.kt`) | ✅ **Lengkap** |
| **Peta Sebaran Laporan** | `map.tsx` | `PetugasPetaScreen.kt` | ✅ **Lengkap** *(koreksi dari dokumen lama — sudah terhubung)* |
| **Detail Laporan (Read)** | `detail-report.tsx` | `DetailScreen.kt` | ✅ **Lengkap** |
| **Aksi Mulai Pengerjaan** | `POST /reports/{id}/mulai` | `MulaiDialog` di `DetailScreen.kt:353+` | ✅ **Ada** *(koreksi dari dokumen lama)* |
| **Aksi Update Progress** | `POST /reports/{id}/progress` | `ProgressDialog` di `DetailScreen.kt` | ✅ **Ada** *(koreksi dari dokumen lama)* |
| **Aksi Selesaikan Laporan** | `complete-report.tsx` | `SelesaiDialog` di `DetailScreen.kt` | ✅ **Ada** *(koreksi dari dokumen lama)* |
| **Edit Laporan Sendiri** | `edit-report.tsx` | `EditFormDialog` di `DetailScreen.kt` | ✅ **Ada** *(koreksi dari dokumen lama)* |
| **Hapus Laporan Sendiri** | `DELETE /reports/{id}` | `DeleteConfirm` di `DetailScreen.kt` | ✅ **Ada** *(koreksi dari dokumen lama)* |
| **Duplicate Check Realtime** | `useDuplicateCheck.ts` | ❌ Tidak ada | ⚠️ **Belum Ada** |
| **SubmissionQueue Offline** | `SubmissionQueue.tsx` | Room disiapkan, tapi **tidak ada WorkManager/CoroutineWorker** | ⚠️ **Parsial**: DB lokal ada, antrian proses ulang saat offline tidak ada. |
| **In-App Notification Center** | `/notifications` | `NotifScreen.kt` | ✅ **Ada** *(koreksi dari dokumen lama)* |

---

### C. Role Supervisor

| Fitur / Modul | Frontend Stable | Android Native | Status |
| :--- | :---: | :---: | :--- |
| **Dashboard KPI & Wilayah** | `supervisor/index.tsx` | `SupervisorDashboardScreen.kt` | ✅ **Lengkap** |
| **Review Cepat Antrean** | `supervisor/review.tsx` | `SupervisorReviewScreen.kt` | ✅ **Lengkap** |
| **Approval & Auto-Assign** | `POST /approve`, `POST /approve-and-assign` | `SupervisorRepository.approve` | ✅ **Lengkap** |
| **Tolak Laporan Berargumen** | `POST /reports/{id}/tolak` | `TolakFormDialog.kt` | ✅ **Lengkap** |
| **Konfirmasi Hasil AI** | `POST /reports/{id}/confirm-ai` | `SupervisorViewModel.confirmAi` | ✅ **Lengkap** |
| **Detail Laporan Supervisor** | `detail-report.tsx` | `SupervisorDetailScreen.kt` | ✅ **Lengkap** |
| **Jadwal Patroli Rutin** | `supervisor/patrol-schedule/` | `PatrolListScreen.kt`, `PatrolDetailScreen.kt` | ✅ **Lengkap** |
| **Peta Sebaran Supervisor** | `supervisor/peta.tsx` | `SupervisorPetaScreen.kt` | ✅ **Lengkap** (ada bug parsing — lihat Bug #1) |
| **Survey Detail Screen** | `detail-patroli.tsx` (supervisor view) | Repository + ViewModel ada (`loadSurveyDetail`), tapi **tidak ada composable screen** | ⚠️ **Parsial**: Logic backend ada, UI belum. |
| **Bulk Triage (Massal)** | `bulk-approve`, `bulk-tolak` | ❌ Tidak ada | ❌ **Belum Ada** |
| **Export PDF/Excel** | `exportMonthlyPdf`, `exportMonthlyExcel` | ❌ Tidak ada | ❌ **Belum Ada** |
| **In-App Notification Center** | `/notifications` | `NotifScreen.kt` | ✅ **Ada** *(koreksi dari dokumen lama)* |

---

### D. Role Admin

| Fitur / Modul | Frontend Stable | Android Native | Status |
| :--- | :---: | :---: | :--- |
| **Admin Dashboard** | `admin/dashboard.tsx` | ❌ Tidak Ada | ❌ **0%** |
| **Manajemen Pengguna (CRUD & Ban)** | `admin/users.tsx` | ❌ Tidak Ada | ❌ **0%** |
| **Manajemen Tim & Wilayah Ruas** | `admin/teams.tsx` | ❌ Tidak Ada | ❌ **0%** |
| **Manajemen Laporan & Override Status** | `admin/reports.tsx` | ❌ Tidak Ada | ❌ **0%** |
| **Konfigurasi Sistem & Audit Log** | `admin/config.tsx`, `activity.tsx` | ❌ Tidak Ada | ❌ **0%** |

> **Catatan:** Saat ini sesi Admin jatuh ke `MainScaffold` Petugas karena `else -> MainScaffold(...)` di [`MainActivity.kt`](file:///home/marcille/Tugas/DeltaJalan/android-native/app/src/main/java/com/jalankita/app/MainActivity.kt#L161-L193).

---

## 4. Temuan Bug & Cacat Logika

### 🔴 Bug #1 — Peta Tidak Menampilkan Marker (Kritis, Semua Role)

- **File Terkait:** [`WargaModels.kt`](file:///home/marcille/Tugas/DeltaJalan/android-native/app/src/main/java/com/jalankita/app/core/network/WargaModels.kt#L200-L216), [`NetworkModule.kt`](file:///home/marcille/Tugas/DeltaJalan/android-native/app/src/main/java/com/jalankita/app/core/network/NetworkModule.kt#L22-L28), [`ReportMapScreen.kt`](file:///home/marcille/Tugas/DeltaJalan/android-native/app/src/main/java/com/jalankita/app/ui/map/ReportMapScreen.kt#L262-L282)
- **Root Cause Terverifikasi:** Backend Laravel menggunakan cast `decimal:8` pada kolom `latitude`/`longitude` ([`Report.php:129-130`](file:///home/marcille/Tugas/DeltaJalan/backend_POSTGRESQL/app/Models/Report.php#L129-L130)), yang menyebabkan nilai selalu di-serialize sebagai **String** (`"-7.44208830"`) di JSON, bukan Number. Moshi strict mode melempar `JsonDataException` saat mencoba parse String ke `Double?`, sehingga seluruh respons gagal dan `mapReports = emptyList()`.
- **Root Cause Kedua:** `MapView(ctx)` default menggunakan `GLSurfaceView` yang tertutup oleh `containerColor` Scaffold solid. Harus menggunakan `MapLibreMapOptions.textureMode(true)`.
- **Dampak:** **Semua tab PETA** (Warga, Petugas, Supervisor) tidak menampilkan satu pun marker laporan.
- **Rencana Perbaikan:** Lihat [`docs/plan-fix-peta-interaktif-android.md`](file:///home/marcille/Tugas/DeltaJalan/docs/plan-fix-peta-interaktif-android.md).

---

### 🟡 Bug #2 — Ikon Navigasi Terbalik di `SupervisorReviewScreen.kt`

- **File Terkait:** [`SupervisorReviewScreen.kt:354-360`](file:///home/marcille/Tugas/DeltaJalan/android-native/app/src/main/java/com/jalankita/app/feature/supervisor/SupervisorReviewScreen.kt#L354-L360)
- **Deskripsi:** Tombol "Sebelumnya" (Previous) dan "Selanjutnya" (Next) di `ReviewActionSheet` sama-sama menggunakan ikon `AppIcon.ChevronRight`. Tombol "Sebelumnya" seharusnya menggunakan `AppIcon.ChevronLeft`.
- **Dampak:** Visual membingungkan saat supervisor melakukan review antrean.
- **Fix:** Ganti `AppIcon.ChevronRight` pada tombol `onPrev` menjadi `AppIcon.ChevronLeft`.

---

### 🟡 Bug #3 — Fallback Role Admin ke Antarmuka Petugas

- **File Terkait:** [`MainActivity.kt:161-193`](file:///home/marcille/Tugas/DeltaJalan/android-native/app/src/main/java/com/jalankita/app/MainActivity.kt#L161-L193)
- **Deskripsi:** Seleksi role `else -> MainScaffold(...)` menyebabkan admin login ke tampilan petugas lapangan. Karena akun admin tidak punya `team_id`, data dashboard petugas akan kosong.
- **Fix Sementara:** Arahkan `UserRole.ADMIN -> SupervisorScaffold(...)` sebagai fallback operasional yang lebih relevan.

---

## 5. Kesenjangan Fitur yang Belum Diimplementasikan (Nyata)

| Fitur | Frontend Stable | Prioritas | Catatan |
| :--- | :--- | :---: | :--- |
| **Lacak Laporan Publik** | `/lacak`, `/laporan.$reportCode` | 🔴 Tinggi | Endpoint `POST /reports/track` tersedia. Tidak butuh login. |
| **Autocomplete Nama Jalan** | `useRoadSearch.ts` (LocationIQ) | 🟡 Sedang | Perlu API key LocationIQ di BuildConfig. Fallback input manual masih bisa digunakan. |
| **Duplicate Check Realtime** | `useDuplicateCheck.ts`, `DuplicateChecker.tsx` | 🟡 Sedang | Mencegah laporan ganda saat input koordinat. |
| **BeforeAfterSlider** | `BeforeAfterSlider.tsx` | 🟢 Rendah | Android menggunakan toggle tab biasa; fungsional meski kurang interaktif. |
| **Road Polyline di Peta** | `useRoadPolyline.ts` | 🟢 Rendah | Visualisasi ruas jalan sebagai polyline di peta. |
| **SubmissionQueue Offline Worker** | `SubmissionQueue.tsx` | 🟡 Sedang | Room DB sudah ada di Android. Perlu tambahkan `CoroutineWorker` / `WorkManager` untuk proses ulang laporan saat offline. |
| **Bulk Triage Supervisor** | `bulk-approve`, `bulk-tolak` | 🟡 Sedang | Multi-select dan aksi massal di antrean review. |
| **Export PDF/Excel Supervisor** | `exportMonthlyPdf/Excel` | 🟢 Rendah | Bisa diimplementasikan via `DownloadManager` Android + Intent browser. |
| **SurveyDetailScreen Supervisor** | (lihat detail patroli supervisor) | 🟢 Rendah | Repository & ViewModel `loadSurveyDetail` sudah ada; perlu composable screen. |
| **Admin UI Lengkap** | Semua halaman `admin/` | 🔴 Tinggi | Tidak ada satu pun halaman admin di Android. |

---

## 6. Rekomendasi Rencana Aksi (Roadmap Prioritas)

### Prioritas 1 — Kritis (Fungsionalitas Inti Rusak)

1. **Perbaiki Peta Interaktif (Bug #1)** — Semua role terdampak. Ikuti instruksi di [`docs/plan-fix-peta-interaktif-android.md`](file:///home/marcille/Tugas/DeltaJalan/docs/plan-fix-peta-interaktif-android.md):
   - Buat `LenientDoubleAdapter.kt` untuk Moshi.
   - Daftarkan di `NetworkModule.kt`.
   - Ubah `MapView(ctx)` → `MapView(ctx, options)` dengan `textureMode(true)`.
2. **Lacak Laporan Publik** — Tambahkan halaman pra-login via `POST /reports/track`.
3. **Penanganan Role Admin** — Minimal arahkan `UserRole.ADMIN` ke `SupervisorScaffold` (Bug #3).

### Prioritas 2 — Perbaikan UI & Fitur Pendukung

1. **Perbaiki Ikon Navigasi (Bug #2)** — Ubah ikon "Sebelumnya" di `SupervisorReviewScreen.kt` menjadi `ChevronLeft`.
2. **Autocomplete Nama Jalan** — Integrasikan `LocationIQ Autocomplete API` di `LaporScreen.kt` dan `WargaLaporScreen.kt`.
3. **Duplicate Check Realtime** — Tambahkan pengecekan duplikat saat koordinat di-input.

### Prioritas 3 — Fitur Lanjutan

1. Implementasikan `SubmissionQueue` Worker (WorkManager) untuk antrian laporan offline.
2. Tambahkan `Bulk Triage` (checklist multi-select) untuk Supervisor.
3. Tambahkan `Export PDF/Excel` via `DownloadManager`.
4. Buat `SurveyDetailScreen` composable untuk Supervisor.
