# PLANNING: Aplikasi Native Android Kotlin — DeltaJalan (MVP Petugas)

| Item | Isi |
|---|---|
| Status | Fase 1 berjalan (scaffold + endpoint version) |
| Keputusan terkunci | MVP petugas · MapLibre Native · endpoint version-check baru · sideload via endpoint existing |
| Backend | `https://api.deltajalan.web.id` (tidak diubah kecuali endpoint versi) |

## 1. Hasil crosscheck klaim investigasi

| # | Klaim | Verifikasi langsung | Status |
|---|---|---|---|
| 1 | `MainActivity` mendaftarkan `PhotoExifGpsPlugin` manual + channel `delta_jalan_general` | `registerPlugin()` sebelum `super.onCreate()` | ✅ |
| 2 | Plugin: `pickPhotos`, 2 permission alias, `ACTION_OPEN_DOCUMENT` multi | `PhotoExifGpsPlugin.java:26-80` cocok | ✅ |
| 3 | `minSdk 24`, `compile/target 36`, FCM 25.0.1, `google-services.json` ada | `variables.gradle` + file ada | ✅ |
| 4 | Layar MVP ada (`upload`, `ai-result`, `detail-report`, `tugas-saya`, `lacak`, `notifications`) | Semua file routes ada | ✅ |
| 5 | Kontrak API lengkap di `routes/api.php` | Auth, analyze, batch, fcm-token, download-apk, reverse-geocode, worker/location ditemukan | ✅ |
| 6 | osmdroid diarsipkan — jangan dipakai | Pengumuman arsip GitHub `osmdroid/osmdroid` | ✅ |
| 7 | MapLibre aktif, clustering + offline resmi | Release `android-v13.6.0` (Agu 2026); dipakai Wikipedia & StreetComplete | ✅ |
| 8 | Tile OSM melarang prefetch/offline, blokir tanpa pemberitahuan | `operations.osmfoundation.org/policies/tiles`; kasus blokir Feb 2026 | ✅ |

## 2. Tujuan & scope

Aplikasi Android benar-benar native (Kotlin, bukan WebView/Capacitor) untuk petugas lapangan, memakai API yang sudah ada.

**Masuk MVP (±12 layar):** Login → Home → Upload single/batch → Review AI + bbox → Detail report + progress/complete → Tugas Saya → Peta + cluster → Lacak publik (tanpa login) → Notifikasi + deep-link → Pengaturan/logout.
**Tetap web:** supervisor, admin, warga, landing page.

## 3. Arsitektur

```
android-native/                    ← proyek Gradle di root repo
  app/                             applicationId: com.jalankita.app (SAMA agar menimpa
                                   versi Capacitor; versionCode dilanjutkan)
  ├─ core-network   Retrofit/OkHttp + AuthInterceptor (Bearer) + Coil-header
  ├─ core-map       MapLibre + clustering + User-Agent khusus
  ├─ core-data      DataStore (token) + Room (antrian offline)
  └─ feature-*      lapor, tracking, notifikasi (Compose + ViewModel + Hilt)
```

Stack: Kotlin + Compose Material3 · Retrofit/OkHttp · Coil · Hilt · DataStore · Room · CameraX + Photo Picker + ExifInterface · FCM · WorkManager · MapLibre Native (`org.maplibre.gl:android-sdk:11.11.0`, sumber: Context7 `/maplibre/maplibre-native` + README upstream).

## 4. Kontrak API yang dipakai (`backend_POSTGRESQL/routes/api.php`)

Auth: `POST /auth/{login,register,logout}`, `GET /auth/me` (Bearer Sanctum, tanpa refresh — 401 = login ulang; login throttle 10/mnt). Lapor: `POST /analyze` (`file`), `POST /analyze-batch` (`files[]` 1–20), `POST /reports` (`image` + geo + dimensi), `POST /reports/batch` (`batch_id` UUID tanpa upload ulang). Aturan server: file ≤5 MB, EXIF date ≤2 hari (422 `PHOTO_TOO_OLD` dkk), dedup SHA-256 (422 `DUPLICATE_IMAGE`), koordinat dalam Sidoarjo, kuota harian. Utilitas: `…/check-duplicate`, `POST …/extract-exif-gps` (fallback), `GET /v1/reverse-geocode`, `POST /worker/location` (15 mnt jam kerja via WorkManager), `POST/DELETE /push/fcm-token`, `GET /notifications*`, `GET /public/download-apk`.

## 5. Yang dipakai ulang

Rantai 4-attempt baca GPS EXIF dari `PhotoExifGpsPlugin.java` (port ke Kotlin) · permission set + `FileProvider` · channel `delta_jalan_general` · proyek Firebase + `google-services.json` · ikon/splash · `error_code` server sebagai pesan UI.

## 6. Perubahan backend

`GET /api/app/version?platform=android` → `{min_version_code, latest_version_code, apk_url, force_update}` (config-based, tanpa migrasi). Cek saat startup; di bawah minimum = layar update paksa via sideload.

## 7. Aturan peta (wajib hari-1)

MapLibre + User-Agent `DeltaJalan-Android/<version>` + atribusi OSM visible + URL style di BuildConfig (bukan hardcode). MVP boleh raster OSM; siapkan migrasi ke tile vektor/self-hosted bila armada membesar atau butuh offline.

## 8. Fase + kriteria terima

1. **Fondasi** — terima: login/logout, push masuk, 401 → login ulang.
2. **Alur lapor** — terima: lolos `PHOTO_TOO_OLD`, `DUPLICATE_IMAGE`, `gps_mismatch` dengan foto EXIF asli.
3. **Batch + peta + tracking** — terima: 20 foto, cluster ratusan pin, GPS 15 mnt via WorkManager.
4. **Notifikasi + version-check + update sideload** — terima: tap notif → detail; versi tua → update paksa; `deploy-apk.sh` tetap jalan.
5. **Beta 5 HP Android 10–15** — terima: termasuk `lat=null` DocumentsProvider Android 14+.

## 9. Risiko & estimasi

(1) blokir tile OSM → §7; (2) EXIF ter-strip → fallback server §4; (3) throttle login → backoff. Estimasi agen tunggal: fondasi 1–2 mgg, tiap fase fitur 1–3 mgg.

## 10. Batasan eksekusi agen

Dilarang: menjalankan `gradlew`/build APK (user yang build), `migrate:fresh`, commit/push tanpa kata eksplisit. Endpoint versi config-based agar tanpa migrasi.
