# PLANNING: Aplikasi Native Android Kotlin — DeltaJalan (MVP Petugas)

> **Dokumen ini disinkronkan ulang dengan kode pada 2026-10-02** setelah crosscheck
> mendalam (lihat §11 Catatan koreksi). Beberapa klaim lama sudah tidak akurat —
> bagian yang dikoreksi diberi penanda. Sebelum mempercayai angka/klaim di sini,
> verifikasi ke kode; bagian yang mendua sudah ditandai ⚠️.

| Item | Isi |
|---|---|
| Status | **Fase 1 ✅ · Fase 2 🟡 (kode lengkap, menunggu uji perangkat) · Fase 3–5 ❌ belum** |
| Bonus di luar scope | Fitur **warga sudah native** (`feature/warga/`) — dokumen awal mengatakan "warga tetap web" |
| Keputusan terkunci | MVP petugas · MapLibre Native · endpoint version-check baru · sideload via endpoint existing |
| Backend | `https://api.deltajalan.web.id` (tidak diubah kecuali endpoint versi) |

## 1. Hasil crosscheck klaim investigasi (diverifikasi ulang 2026-10-02)

| # | Klaim | Verifikasi langsung | Status |
|---|---|---|---|
| 1 | `MainActivity` mendaftarkan `PhotoExifGpsPlugin` manual + channel `delta_jalan_general` | Channel `delta_jalan_general` **benar** dibuat di `MainActivity.kt:81-91` (`createNotificationChannel()`), meta-data manifest + `DeltaJalanMessagingService`. **Catatan:** deskripsi "`registerPlugin()` sebelum `super.onCreate()`" milik **versi Capacitor** (`Frontend-stable/capacitor-exif-gps`), bukan native. | ⚠️ Campur Capacitor/native |
| 2 | Plugin: `pickPhotos`, 2 permission alias, `ACTION_OPEN_DOCUMENT` multi | `PhotoExifGpsPlugin.java:26-80` cocok (alias `accessMediaLocation` + `readMediaImages`, `EXTRA_ALLOW_MULTIPLE`). Di-port native → `core/util/ExifValidator.kt` + `RawExifGps.kt`. | ✅ |
| 3 | `minSdk 24`, `compile/target 36`, FCM **25.0.1**, `google-services.json` ada | `minSdk 24` ✅ `compile/target 36` ✅ `google-services.json` ada ✅. **FCM BUKAN 25.0.1** — proyek memakai `firebase-bom 33.10.0` (`gradle/libs.versions.toml`). Angka "25.0.1" tampaknya dari versi Capacitor. | ⚠️ Sebagian salah (versi FCM) |
| 4 | Layar MVP ada (`upload`, `ai-result`, `detail-report`, `tugas-saya`, `lacak`, `notifications`) | Ada: **Lapor** (`feature/lapor/`), **AiResult**, **Detail**, **Tugas**, **Riwayat** (`feature/home/Tabs.kt`). **TIDAK ada:** layar **Lacak** (tracking publik) dan layar **Notifikasi** tersendiri — `PetaPlaceholderScreen` masih placeholder; push masuk tanpa UI inbox. | ⚠️ Sebagian salah (lacak & notifikasi) |
| 5 | Kontrak API lengkap di `routes/api.php` | Semua ditemukan: auth (login/register/logout/me), `analyze`, `analyze-batch`, `push/fcm-token` (POST/DELETE), `download-apk`, `v1/reverse-geocode`, `worker/location`, `notifications*`, **`app/version`**. | ✅ |
| 6 | osmdroid diarsipkan — jangan dipakai | Tidak dipakai; hanya MapLibre. | ✅ |
| 7 | MapLibre aktif, clustering + offline resmi | `org.maplibre.gl:android-sdk:11.11.0` (`gradle/libs.versions.toml`), dipakai di `feature/warga/WargaPetaScreen.kt:50-59`. | ✅ |
| 8 | Tile OSM melarang prefetch/offline, blokir tanpa pemberitahuan | Klaim kebijakan (bukan kode) — tetap berlaku sebagai aturan §7. | ✅ |

## 2. Tujuan & scope

Aplikasi Android benar-benar native (Kotlin, bukan WebView/Capacitor) untuk petugas lapangan, memakai API yang sudah ada.

**Masuk MVP (±12 layar):** Login → Home → Upload single/batch → Review AI + bbox → Detail report + progress/complete → Tugas Saya → Peta + cluster → Lacak publik (tanpa login) → Notifikasi + deep-link → Pengaturan/logout.

⚠️ **Koreksi:** dokumen awal menulis "**Tetap web:** supervisor, admin, warga". Realita: **warga sudah diimplementasikan native** (`feature/warga/`, endpoint `warga/*` dengan `role:warga`). Supervisor masih web; `PLAN-supervisor.md` merencanakan migrasi supervisor ke native (status: planning, S1+S2).

## 3. Arsitektur

⚠️ **Koreksi penting — arsitektur BUKAN multi-module.** `settings.gradle.kts` hanya `include(":app")`; seluruh kode berada di satu modul di bawah `app/src/main/java/com/jalankita/app/`:

```
android-native/                    ← proyek Gradle di root repo
  settings.gradle.kts              ← include(":app")  (satu modul)
  app/                             applicationId: com.jalankita.app (SAMA agar menimpa
                                   versi Capacitor; versionCode lanjut: 2 / versionName 1.1.0)
  └─ src/main/java/com/jalankita/app/
     ├─ core/network   Retrofit/OkHttp + AuthInterceptor (Bearer) + Coil-header
     ├─ core/data      DataStore (token) + FcmRepository + AuthRepository
     ├─ core/notify    DeltaJalanMessagingService (FCM)
     ├─ core/util      ExifValidator · RawExifGps · ImageCompressor · ReverseGeocoder ·
     │                 MediaPermissions · ImageUrl
     ├─ feature/auth   Login/Register (Compose + ViewModel + Hilt)
     ├─ feature/home   Dashboard/Tugas/Riwayat/Peta(placeholder)/Profil/Detail
     ├─ feature/lapor  Lapor + AiResult (+ FraudModal, KecamatanDropdown)
     ├─ feature/warga  Dashboard/Riwayat/Detail/Peta/Lapor/Scaffold warga
     └─ ui/            theme + components (Common, TextField, MessageBox, AppIcon, GalleryPicker)
```

**Belum ada:** modul `core-map` terpisah (peta ada di `feature/warga/WargaPetaScreen.kt`), Room (`@Entity/@Dao`) untuk antrian offline, dan WorkManager (`CoroutineWorker`) untuk tracking. Dependensi Room/CameraX/WorkManager **sudah dideklarasikan** (disiapkan Fase 3/5, diberi komentar penanda di `app/build.gradle.kts`).

Stack: Kotlin 2.0.21 + Compose BOM 2024.12.01 Material3 · Retrofit 2.11 / OkHttp 4.12 (Moshi) · Coil 2.6 · Hilt 2.55 · DataStore 1.1.1 · Room 2.6.1 (deps, belum dipakai) · CameraX 1.4.2 (deps, belum dipakai) + Photo Picker + ExifInterface 1.3.7 · FCM (BOM 33.10.0) · WorkManager 2.9.1 (deps, belum dipakai) · MapLibre Native 11.11.0 · AGP 8.13.0 · KSP 2.0.21-1.0.28.

## 4. Kontrak API yang dipakai (`backend_POSTGRESQL/routes/api.php`)

Auth: `POST /auth/{login,register,logout}`, `GET /auth/me` (Bearer Sanctum, tanpa refresh — 401 = login ulang; login throttle 10/mnt). Lapor: `POST /analyze` (`file`), `POST /analyze-batch` (`files[]` 1–20), `POST /reports` (`image` + geo + dimensi), `POST /reports/batch` (`batch_id` UUID tanpa upload ulang). Aturan server: file ≤5 MB (`max:5120`), EXIF date ≤2 hari (422 `PHOTO_TOO_OLD` dkk), dedup SHA-256 (422 `DUPLICATE_IMAGE`), koordinat dalam Sidoarjo (bbox lat `-7.65..-7.25`, lng `112.50..112.95`), kuota harian. Utilitas: `…/check-duplicate`, `POST …/extract-exif-gps` (fallback), `GET /v1/reverse-geocode`, `POST /worker/location` (15 mnt jam kerja via WorkManager), `POST/DELETE /push/fcm-token`, `GET /notifications*`, `GET /public/download-apk`, **`GET /app/version`**.

**Aturan upload (terverifikasi kode, AGENTS.md §80):** EXIF ≤2 hari untuk **petugas**; **≤7 hari untuk warga** (`WargaReportController::MAX_PHOTO_AGE_DAYS` — pengecualian sengaja). `gps_mismatch` **bukan error 422** — hanya menulis `system_notes` `[PERINGATAN]` bila jarak GPS EXIF vs koordinat form >500 m, laporan tetap 201 (lihat `PLAN-fase2-lapor.md` §0 #10). Trust score **NONAKTIF** (kode di balik penanda `// ── TRUST SCORE [NONAKTIF] ──`).

## 5. Yang dipakai ulang

Rantai 4-attempt baca GPS EXIF dari `PhotoExifGpsPlugin.java` (port ke Kotlin `RawExifGps.kt`/`ExifValidator.kt`) · permission set + **`FileProvider`** (diotorisasi `${applicationId}.fileprovider`, path di `res/xml/file_paths.xml`) · channel `delta_jalan_general` · proyek Firebase + `google-services.json` · ikon/splash (mipmap + `drawable-nodpi/`) · `error_code` server sebagai pesan UI.

## 6. Perubahan backend

`GET /api/app/version?platform=android&version_code=N` → `{min_version_code, latest_version_code, apk_url, force_update}` (config-based via `config/mobile.php` + env `ANDROID_MIN_VERSION_CODE`/`ANDROID_LATEST_VERSION_CODE`, tanpa migrasi). **✅ endpoint sudah ada** (`ApkDownloadController::version`). Cek saat startup; di bawah minimum = layar update paksa via sideload. ⚠️ Sisi klien: `ApiService.appVersion()` + DTO `forceUpdate` **sudah ada**, tapi **belum dipanggil dari UI** → version-check belum diimplementasikan (Fase 4).

## 7. Aturan peta (wajib hari-1)

MapLibre + User-Agent `DeltaJalan-Android/<version>` + atribusi OSM visible + URL style di BuildConfig (`BuildConfig.MAP_STYLE_URL` / `MAP_USER_AGENT`, bukan hardcode — lihat `app/build.gradle.kts`). MVP boleh raster OSM; siapkan migrasi ke tile vektor/self-hosted bila armada membesar atau butuh offline.

## 8. Fase + kriteria terima

1. **Fondasi** — terima: login/logout, push masuk, 401 → login ulang. **✅ kode selesai.**
2. **Alur lapor** — terima: lolos `PHOTO_TOO_OLD`, `DUPLICATE_IMAGE`, `gps_mismatch` dengan foto EXIF asli. **🟡 kode lengkap (`feature/lapor/`), menunggu uji perangkat.**
3. **Batch + peta + tracking** — terima: 20 foto, cluster ratusan pin, GPS 15 mnt via WorkManager. **❌ belum** (peta = `PetaPlaceholderScreen`; WorkManager belum dipakai).
4. **Notifikasi + version-check + update sideload** — terima: tap notif → detail; versi tua → update paksa; `deploy-apk.sh` tetap jalan. **❌ belum** (deep-link menyusul; version-check belum di-wire).
5. **Beta 5 HP Android 10–15** — terima: termasuk `lat=null` DocumentsProvider Android 14+. **❌ belum.**

## 9. Risiko & estimasi

(1) blokir tile OSM → §7; (2) EXIF ter-strip → fallback server §4; (3) throttle login → backoff. Estimasi agen tunggal: fondasi 1–2 mgg, tiap fase fitur 1–3 mgg.

## 10. Batasan eksekusi agen

⚠️ **Diperbarui** — `AGENTS.md §23` **menimpa** larangan lama: agen **DIIZINKAN** menjalankan `./gradlew` di `android-native/` (mis. `assembleDebug`) dan `adb install` APK-nya. Yang **tetap dilarang**: `migrate:fresh`/`migrate:reset`/`db:wipe`/`DROP` (sekali pun), dan **commit/push tanpa kata eksplisit** ("commit"/"push") dari user. Build Capacitor (`build:mobile`, `npx cap`, `build.py`) tetap user-run. Endpoint versi config-based agar tanpa migrasi.

## 11. Catatan koreksi (crosscheck 2026-10-02)

Perubahan vs versi dokumen sebelumnya:

- §1#1 — dipisahkan: channel `delta_jalan_general` native ✅; detail `registerPlugin()`/`super.onCreate()` adalah perilaku Capacitor.
- §1#3 — **FCM bukan 25.0.1**; proyek pakai `firebase-bom 33.10.0`.
- §1#4 — layar **Lacak** dan **Notifikasi** belum ada; peta masih placeholder.
- §3 — arsitektur **single-module** (`:app`), bukan multi-module `core-map`/`feature-*`.
- §4/§6 — ditambahkan penegasan `app/version` sudah ada; klien belum memanggil.
- §5 — **FileProvider** ditambahkan ke manifest + `res/xml/file_paths.xml`.
- §8 — status fase disinkronkan (Fase 2 selesai di kode; warga sudah native).
- §10 — izin build agen diselaraskan dengan `AGENTS.md §23`.

## 12. Crosscheck #2 — konflik antar-fungsi & keputusan (2026-10-02)

Analisis mendalam fungsi-fungsi terkait menemukan konflik berikut. **Wajib dibaca
sebelum mengeksekusi fase berikutnya.**

| # | Konflik | Status | Keputusan |
|---|---|---|---|
| K1 | `ReportRepository` **tidak** melempar `UnauthorizedException` saat 401 (beda dari `DashboardRepository`/`WargaRepository`), dan `LaporViewModel` tak punya `sessionExpired` → petugas tetap macet di layar Lapor bila token dicabut. Melanggar kriteria terima Fase 1 ("401 → login ulang") di jalur Fase 2. | ✅ **DIPERBAIKI** | `runCatchingNetwork` kini `throw UnauthorizedException()` saat 401; `LaporViewModel` punya `sessionExpired` + `try/catch`; `MainScaffold` `LaunchedEffect(laporVm.sessionExpired) → authVm.refreshSession()`. |
| K2 | `PLAN-supervisor` §4 menunjuk `parseSubmitError` (`WargaRepository`) sebagai template 422 — benar — tapi bila meniru `ReportRepository` untuk aksi approve/tolak, bug K1 menular. | Keputusan | **Supervisor WAJIB mengikuti pola `WargaRepository`** (401 → `UnauthorizedException`, `sessionExpired`, `DashboardResult`), **bukan** `ReportRepository`. |
| K3 | `MainScaffold` + `WargaScaffold` (+ `SupervisorScaffold` mendatang) = 3 struktur navigasi nyaris identik (BackHandler, openDetail/returnTab, snackbar, topbar). | Keputusan | **Terima duplikasi sadar untuk sementara**; ekstrak `RoleScaffold` generik sebagai refactor tersendiri bila scaffold ketiga dibuat dan polanya stabil. Jangan over-abstract sebelum 3 contoh ada. |
| K4 | `ReportItemDto` dipakai bersama petugas & (nantinya) supervisor via `GET /reports`. Field supervisor (`assigned_team_name`, `duplicateOf`, `deadline_review`) mungkin belum ada. | **Perlu verifikasi saat eksekusi** | Sebelum Fase S1 supervisor: cek `DashboardModels.kt` `ReportItemDto`; tambah field supervisor bila kurang (Moshi `ignoreUnknownKeys` agar aman). |
| K5 | `DashboardViewModel.refresh()` memanggil 4 request paralel (stats/recent/teamTasks/patrol) — auto-refresh 30 dtk supervisor akan 4-call/30s. Pola auto-refresh warga 120 dtk lebih hemat. | Keputusan | Untuk supervisor: **auto-refresh 30 dtk hanya untuk list** (1 call), bukan full `refresh()`. Ikuti catatan risiko §8.3 `PLAN-supervisor`. |
| K6 | FCM `DeltaJalanMessagingService` mengirim `putExtra("report_id")`, tapi `MainActivity` tak membacanya → tap notif hanya buka app. | **Fase 4** | Saat Fase 4: `MainActivity` `launchMode="singleTask"` → intent baru masuk via `onNewIntent`, bukan `onCreate`; tangani keduanya untuk deep-link detail. |
| K7 | `FileProvider` (§5) belum dipakai kode mana pun. | Disengaja | Diverifikasi saat CameraX Fase 5; belum ada bukti runtime, jangan dianggap selesai. |
| K8 | WorkManager butuh wiring Hilt (`@HiltWorker` + `HiltWorkerFactory` + nonaktifkan `InitializationProvider` default di manifest). | **Prasyarat Fase 3** | Saat Fase 3 mulai: tambah wiring tsb, else worker tak ter-inject. |
| K9 | Tidak ada unit test (`app/src/test` kosong) → perubahan hanya bisa diverifikasi via lint + build. | Keterbatasan | Tambah unit test untuk logika murni (format tanggal, validasi) bila disepakati; instrumentasi EXIF butuh perangkat. |
