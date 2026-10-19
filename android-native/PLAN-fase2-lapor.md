# PLAN — Fase 2 "Alur Lapor" (android-native)

**Tanggal:** 2026-09-29
**Sumber scope:** `docs/rencana-native-android.md` §8 butir 2
**Kriteria terima resmi:** *"lolos `PHOTO_TOO_OLD`, `DUPLICATE_IMAGE`, `gps_mismatch` dengan foto EXIF asli."*

---

## 0. Crosscheck Plan vs Kode (WAJIB dibaca)

Semua klaim di bawah sudah diverifikasi langsung ke kode, bukan asumsi.

| # | Klaim / Asumsi | Verifikasi (file:line) | Status |
|---|---|---|---|
| 1 | Fase 2 = "alur lapor" | `docs/rencana-native-android.md:62` | ✅ |
| 2 | android-native BELUM punya fitur lapor | `find app/src/main/java -name "*.kt"` → hanya auth + theme + ui (23 file) | ✅ belum ada |
| 3 | Endpoint `POST /api/analyze` ada | `routes/api.php:39` → `ReportController@analyze` | ✅ |
| 4 | `analyze` terima `file` (wajib), maks 5MB, mime jpeg/jpg/png | `ReportController.php:90-92` | ✅ |
| 5 | `POST /api/reports` (single) ada | `routes/api.php:45` → `ReportController@store` | ✅ |
| 6 | `store` butuh: `reporter_name, road_name, district, latitude, longitude, image, kerusakan_panjang, kerusakan_lebar` | `ReportController.php:451-480` | ✅ |
| 7 | `error_code=PHOTO_TOO_OLD` (422) bila EXIF > 2 hari | `ReportController.php:503-509` + `MAX_PHOTO_AGE_DAYS=2` L72 | ✅ |
| 8 | `error_code=PHOTO_FUTURE_DATE`, `PHOTO_NO_EXIF_DATE`, `PHOTO_EXIF_READ_ERROR` (422) | `ReportController.php:512-536` | ✅ |
| 9 | `error_code=DUPLICATE_IMAGE` (422) + `existing_report` | `ReportController.php:544-562` | ✅ |
| 10 | `gps_mismatch` **bukan error** — hanya `system_notes` peringatan bila jarak EXIF vs form > **500 m** | `ReportController.php:624-633` | ✅ **KOREKSI PENTING** |
| 11 | `error_code=KOORDINAT_DILUAR_WILAYAH` (422) bila di luar Sidoarjo | `ReportController.php:490-496` | ✅ |
| 12 | Response sukses store = `{success, message, data:{report_code, id, ...}}` 201 | `ReportController.php:760-790` | ✅ |
| 13 | Validasi tanggal EXIF di frontend pakai `exifr` + `DateTimeOriginal`, MAX_AGE_DAYS=2 | `lib/validatePhotoDate.ts:23,129-236` | ✅ |
| 14 | Frontend tolak foto tanpa GPS EXIF (`no_gps`) sebelum upload | `upload.tsx:229-240` | ✅ |
| 15 | Alur frontend: pilih foto → validasi EXIF (tanggal+GPS) → kompres → analyze → ai-result → form (nama jalan, kecamatan, dimensi) → submit | `upload.tsx:194-260, 473-556` | ✅ |
| 16 | Deps Room/CameraX/WorkManager/ExifInterface sudah dideklarasikan di build.gradle | `app/build.gradle.kts:80-92` | ✅ bisa dipakai |
| 17 | `gps_mismatch` = `system_notes` di DB, TIDAK memblokir submit | `ReportController.php:640-643, 693` | ✅ |

### ⚠️ Koreksi kritis terhadap asumsi awal plan
- **`gps_mismatch` BUKAN penolakan (422).** Ia hanya menulis `system_notes` peringatan
  bila jarak GPS EXIF vs koordinat form > 500 m, lalu **laporan tetap tersimpan (201)**.
  Jadi kriteria terima "lolos gps_mismatch" = **laporan tersimpan dengan `system_notes`
  berisi `[PERINGATAN]`**, bukan "mendapat error 422".
- **`PHOTO_NO_EXIF_DATE` & `no_gps`**: frontend menolak foto tanpa GPS EXIF **di klien**
  (sebelum kirim). Server juga menolak `no_exif_date` (tanggal) dengan 422. Dua hal beda:
  no-GPS = penolakan klien; no-date = penolakan server.

---

## 1. Scope Fase 2 (yang dikerjakan)

**Masuk:**
1. Layar **Lapor** — pilih foto dari galeri/kamera (CameraX atau Photo Picker).
2. **Validasi EXIF di klien**: tanggal (≤2 hari, bukan future, ada EXIF) + GPS ada.
   Menampilkan modal peringatan (replikasi `fraudModal` frontend).
3. **Analyze** — `POST /analyze` (multipart `file`) → dapat `{detections, total, overall_severity, image_result}`.
4. Layar **Hasil AI + form** — nama jalan, kecamatan (dropdown 18 kecamatan Sidoarjo),
   dimensi (panjang×lebar), catatan, pratinjau gambar dengan bbox.
5. **Submit** — `POST /reports` (multipart) → tangani `error_code` (PHOTO_TOO_OLD,
   DUPLICATE_IMAGE, dsb.) sebagai pesan UI; sukses → tampilkan `report_code`.

**Tetap di luar (fase lain):** batch (Fase 3), peta/cluster (Fase 3), tracking WorkManager
(Fase 3), notifikasi/version-check (Fase 4).

---

## 2. Kontrak API yang dipakai (terverifikasi)

| Endpoint | Method | Body | Sukses | Error yang ditangani |
|---|---|---|---|---|
| `/api/analyze` | POST multipart | `file` (+`latitude`,`longitude` opsional) | 200 `{detections, total, overall_severity, image_result}` | 422 (`message`), 500 |
| `/api/reports` | POST multipart | `reporter_name, road_name, district, latitude, longitude, image, kerusakan_panjang, kerusakan_lebar, catatan?, image_result?, ai_raw_output?, total_detections?, overall_severity?` | 201 `{success, message, data{report_code,...}}` | 422 + `error_code` |

**Nama 18 kecamatan** diambil dari `ReportController::getKecamatanList()` — **TERVERIFIKASI**
(`ReportController.php:3617-3639`), urutan persis:
`Sidoarjo, Buduran, Gedangan, Sedati, Waru, Taman, Krian, Balongbendo, Wonoayu, Sukodono, Candi, Porong, Krembung, Tulangan, Tanggulangin, Jabon, Tarik, Prambon` (18 entri).

**Bounding box Sidoarjo** (`isInSidoarjo`, `ReportController.php:3650-3654`):
lat `-7.65..-7.25`, lng `112.50..112.95` — dipakai untuk pre-check koordinat di klien.

---

## 3. Perubahan yang Dibutuhkan

### 3.1 Dependency
- **ExifInterface** (`androidx.exifinterface`) — sudah ada (`build.gradle.kts:89`).
- **CameraX** — sudah ada (`:85-88`). Untuk ambil foto.
- **Coil** — sudah ada (`:74`). Untuk tampilkan gambar.
- **Room** — SUDAH ada, TAPI **tidak dipakai Fase 2** (dipakai Fase 3 antrian offline).
- Tambahan: **`androidx.activity:activity-compose`** sudah ada (Fase 1).
- **Izin**: `CAMERA`, `READ_MEDIA_IMAGES` (sudah di manifest), + runtime request.

### 3.2 File baru
```
core/util/ExifValidator.kt        # replikasi validatePhotoDate.ts (tanggal + GPS)
core/util/ImageCompressor.kt      # kompres gambar sebelum upload (mirip compressImage)
core/network/ReportApi.kt         # endpoint analyze + reports (Retrofit)
core/data/ReportRepository.kt      # panggil API, petakan error_code → pesan
feature/lapor/LaporViewModel.kt    # state: foto, validasi, analyze, form, submit
feature/lapor/LaporScreen.kt       # UI utama (pilih foto + pratinjau)
feature/lapor/AiResultScreen.kt    # hasil AI + form (nama jalan, kecamatan, dimensi)
feature/lapor/components/FraudModal.kt   # modal peringatan EXIF (replikasi fraudModal)
feature/lapor/components/KecamatanDropdown.kt
```

### 3.3 File dimodifikasi
- `core/network/ApiService.kt` — tambah `analyze(@Part)` + `createReport(@Multipart)`.
- `core/network/Models.kt` — tambah DTO analyze + report + error.
- `MainActivity.kt` — tambah state `Lapor`/`AiResult` setelah `Authenticated`.
- `feature/auth/HomeScreen.kt` — tombol "Lapor Kerusakan" → masuk alur.

---

## 4. Detail Implementasi (kunci)

### 4.1 ExifValidator.kt (replikasi `validatePhotoDate.ts`)
- Prioritas field: `DateTimeOriginal` → `DateTimeDigitized` → `CreateDate` → `DateTime`.
- `ageDays` = selisih **tanggal kalender** (strip jam), `MAX_AGE_DAYS = 2`.
- Status: `valid | no_exif_date | too_old | future_date | exif_read_error`.
- GPS: baca `TAG_GPS_LATITUDE/LONGITUDE` + ref → kalau null → status `no_gps`.
- **Pesan & judul modal identik** dengan `validatePhotoDate.ts` (Indonesia).

### 4.2 Alur LaporScreen
```
[Pilih dari Galeri] [Ambil dari Kamera]
   ↓ pilih foto
ExifValidator.validate(file)
   ├─ status != valid → FraudModal (judul+pesan) → stop
   └─ valid → ImageCompressor.compress() → pratinjau
   ↓ tombol "Analisis"
ReportRepository.analyze(file, lat?, lng?)  → loading "Menganalisis…"
   ↓ sukses
AiResultScreen: gambar + bbox overlay, total deteksi, severity
   + form: Nama Jalan, Kecamatan (dropdown), Panjang, Lebar, Catatan
   ↓ tombol "Simpan Laporan"
ReportRepository.createReport(...)
   ├─ 422 error_code → tampilkan pesan UI (bukan crash)
   └─ 201 → layar sukses dengan report_code
```

### 4.3 Pemetaan `error_code` → pesan UI (server sudah kirim `message`, pakai itu)
| error_code | Aksi UI |
|---|---|
| `PHOTO_TOO_OLD` | modal/dialog merah, pesan server |
| `PHOTO_FUTURE_DATE` | idem |
| `PHOTO_NO_EXIF_DATE` | idem |
| `PHOTO_EXIF_READ_ERROR` | idem |
| `DUPLICATE_IMAGE` | dialog + tampilkan `existing_report.report_code`, tawaran bukti foto |
| `KOORDINAT_DILUAR_WILAYAH` | dialog merah |
| validasi 422 lain | tampilkan `errors` pertama |

### 4.4 gps_mismatch (PERINGATAN, bukan penolakan)
- Klien TIDAK bisa tahu peringatan ini sebelum submit (server yang menghitung).
- Setelah submit sukses, bila `system_notes` mengandung `[PERINGATAN]` → info banner
  "Lokasi foto berbeda >500 m dari koordinat — laporan tetap tersimpan & akan direview."
- **Ini yang memenuhi kriteria terima "lolos gps_mismatch".**

---

## 5. Urutan Pengerjaan
1. DTO + endpoint di `ApiService`/`Models` (analyze, reports, error).
2. `ReportRepository` (analyze, createReport, map error_code).
3. `ExifValidator` + `ImageCompressor` (+ unit-test kecil bila memungkinkan).
4. `LaporViewModel` (state machine: idle→validating→valid→analyzing→result→submitting→done).
5. `LaporScreen` + `FraudModal`.
6. `AiResultScreen` + form + `KecamatanDropdown`.
7. Wire `MainActivity` + tombol di `HomeScreen`.
8. **Build + install + uji di HP** dengan foto EXIF asli.

---

## 6. Checklist Verifikasi (kriteria terima)
- [ ] Pilih foto lama (>2 hari) → **`PHOTO_TOO_OLD`** ditolak (modal klien ATAU 422 server)
- [ ] Pilih foto yang sama 2× → **`DUPLICATE_IMAGE`** ditolak + tampil `report_code` lama
- [ ] Submit dengan foto EXIF asli & GPS jauh dari form → tersimpan (201) + banner `[PERINGATAN]` (gps_mismatch)
- [ ] Foto tanpa EXIF tanggal → **`PHOTO_NO_EXIF_DATE`**
- [ ] Foto tanggal future → **`PHOTO_FUTURE_DATE`**
- [ ] Foto luar Sidoarjo → **`KOORDINAT_DILUAR_WILAYAH`**
- [ ] Alur lengkap: pilih → analyze → form → submit → dapat `report_code`
- [ ] Validasi kecamatan = 18 kecamatan (cocok `getKecamatanList()`)
- [ ] Tidak ada crash di logcat; build sukses

## 7. Risiko
| Risiko | Mitigasi |
|---|---|
| `getKecamatanList()` banyak entri | Salin persis dari server, verifikasi count = 18 |
| EXIF ter-strip oleh kompresi | Validasi EXIF SEBELUM kompres (seperti frontend L216 vs L245) |
| `lat=null` DocumentsProvider Android 14+ | Fallback ke form GPS + izin lokasi; catat TODO (masuk Fase 5 beta) |
| Multipart Retrofit + file besar | Batasi 5MB, kompres; `@Multipart @Part MultipartBody.Part` |
| Server butuh `district` harus valid | Dropdown wajib, bukan free text |

## 8. Perubahan AGENTS.md
Sudah dilakukan (agent boleh `gradlew` di android-native + `adb install`) — tetap berlaku.

## 9. Determinasi & Batas Fase 2
- Fase 2 **berhenti** di laporan tunggal tersimpan dengan `report_code`.
- Batch, peta, tracking, notifikasi = **fase berikutnya** (jangan di-scope-creep).
