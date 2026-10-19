# Analisis Mendalam: Cek EXIF GPS di Android Native — MENGAPA MASIH GAGAL

Tanggal: 2026-10-01 (sesi lanjutan)
Device target: Samsung SM-A217F (A21s), **Android 12 / API 31**
Build yang diuji user: `app-debug.apk` (2026-10-01 11:30)
Sumber keluhan: *"Cek EXIF GPS tidak berhasil walau pakai `Image For Testing/fresh` yang punya EXIF GPS."*

---

## TL;DR (jawaban singkat)

Kode rantai 4-attempt SUDAH di-port ke `ExifValidator.kt` (berbeda dari doc 2026-10-01 pagi).
Tetapi **masih ada 3 bug nyata** yang membuatnya gagal di perangkat, dan **1 bug test-regresi
yang menyembunyikan kegagalan**:

| # | Bug | Dampak | Terbukti dari |
|---|---|---|---|
| **A** | `GalleryPicker.kt:28` callback izin **KOSONG** | Tap pertama → dialog izin → picker **tidak pernah terbuka**. GPS tak pernah dibaca. | Baca kode langsung |
| **B** | `ImageCompressor.copyGpsExif()` membaca **stream mentah** (`openInputStream(srcUri)`) | GPS di-**redact** di stream → GPS **tidak tersalin** ke file upload. Server `gps_mismatch` mati. | Baca kode; file uji GPS hanya di GPS IFD |
| **C** | Picker = `PickVisualMedia()` → di API 31 fallback ke `ACTION_OPEN_DOCUMENT` | URI `com.android.providers.media.documents` (file `Download/`) **tidak terindeks MediaStore** → Attempt D & B gugur; hanya A/C yang jalan, keduanya butuh `ACCESS_MEDIA_LOCATION`. | Dekompilasi ActivityX 1.9.3 |
| **D** | `ExifGpsRegressionTest` pakai `assumeTrue` + hanya file **terindeks MediaStore** | Tes **di-SKIP** (bukan gagal) → "semua hijau" padahal skenario `Download/` (yang dipakai user) tidak diuji. | Baca test |

**Kesimpulan:** fungsi "cek EXIF GPS" secara logika 4-attempt **benar**, TAPI gate izin
(`ACCESS_MEDIA_LOCATION`) tidak pernah benar-benar dilewati karena Bug A, dan file uji
(di `Download/`, tak terindeks) hanya bisa lolos lewat Attempt A/C yang mensyaratkan izin itu.
Jadi secara praktis **di device user: gagal**.

---

## 1. Bukti file uji BENAR-BENAR punya GPS (bukan masalah file)

Semua 5 file `Image For Testing/fresh/*.jpg` diverifikasi byte-level (PIL/piexif):

| File | DateTimeOriginal | GPSLatitudeRef | GPS lat, lng | GPSAltitude |
|---|---|---|---|---|
| edited-20260525_120623 (1)_fresh.jpg | 2026:10:01 05:12:59 | S | 7°26'31.5" , 112°43'38.2" | 39 m |
| edited-20260525_120638 (1)_fresh.jpg | 2026:10:01 05:12:59 | S | 7°26'36.1" , 112°43'37.6" | 56 m |
| edited-20260526_120048_fresh.jpg      | 2026:10:01 05:12:59 | S | 7°26'28.9" , 112°43'36.3" | 46 m |
| edited-20260526_120255_fresh.jpg      | 2026:10:01 05:12:59 | S | 7°26'40.5" , 112°43'37.4" | 19 m |
| edited-20260526_120300 (1)_fresh.jpg  | 2026:10:01 05:12:59 | S | 7°26'40.5" , 112°43'37.4" | 19 m |

- Semua lat ≈ **-7.442**, lng ≈ **112.727** → **di dalam** `SidoarjoBounds` (`-7.65..-7.25`, `112.50..112.95`). ✓
- Tanggal `2026:10:01 05:12:59` vs hari ini `2026-10-01 13:39 WIB` → umur ~8 jam → **lolos** `MAX_AGE_DAYS` (=2) maupun `MAX_AGE_DAYS_WARGA` (=7). ✓
- **Tidak ada duplikat GPS** di XMP / UserComment (dicek) — GPS **hanya** di GPS IFD.
  → Konsekuensi: begitu GPS IFD di-redact / dibuang saat re-encode bitmap, GPS **hilang total**.

**Jadi file uji sempurna. Kegagalan murni di sisi aplikasi.**

---

## 2. Bug A — Callback izin kosong (paling mungkin penyebab langsung)

`android-native/app/src/main/java/com/jalankita/app/ui/GalleryPicker.kt`:

```kotlin
val permissionLauncher = rememberLauncherForActivityResult(
    ActivityResultContracts.RequestMultiplePermissions(),
) { /* hasil apa pun: tetap buka picker — jalur 4-attempt tetap dicoba */ }  // ← BODY KOSONG!
...
if (missing.isEmpty()) {
    latestLaunch.value()                       // buka picker
} else {
    permissionLauncher.launch(missing.toTypedArray())   // minta izin… lalu TIDAK ADA lanjutan
}
```

Komentar menyatakan *"tetap buka picker"*, tetapi **badan lambda benar-benar kosong** —
setelah user menekan "Allow", **picker tidak dibuka**. Alur satu-tap rusak.

**Skenario nyata di A21s:**
1. Install baru → tap "Galeri".
2. `MediaPermissions.missing()` = `[READ_EXTERNAL_STORAGE, ACCESS_MEDIA_LOCATION]` → dialog muncul.
3. User "Allow" → callback kosong → **picker tidak muncul**. UI tampak "tidak berfungsi".
4. (Kalau user tap lagi) `missing` mungkin masih berisi `ACCESS_MEDIA_LOCATION`
   karena di banyak perangkat izin ini **tidak menampilkan dialog & tidak ikut ter-grant
   dari `RequestMultiplePermissions`** → loop minta izin, picker tetap tak terbuka.

Ini persis gejala *"sudah saya tes tidak berhasil"*.

### Faktaizinan ACCESS_MEDIA_LOCATION (Android 10–12)
- Ini permission runtime **tetapi tidak terlihat di Settings** dan **tidak menampilkan dialog**.
- Direkomendasikan diminta **terpisah** (`requestPermissions` tunggal), bukan digabung dengan
  `READ_EXTERNAL_STORAGE`. Bila digabung, hasil untuk `ACCESS_MEDIA_LOCATION` sering `false`
  tanpa interaksi user → `MediaPermissions.missing()` **tidak pernah kosong** → picker tak terbuka.

---

## 3. Bug C — Picker & bentuk URI di Android 12 (kenapa Attempt D/B gugur)

Dekompilasi `androidx.activity:activity:1.9.3` `PickVisualMedia.createIntent()` → fallback berurutan:

1. `android.provider.action.PICK_IMAGES` (photo picker API 33+)
2. `com.google.android.gms.provider.action.PICK_IMAGES` (backport GMS)
3. **`android.intent.action.OPEN_DOCUMENT`** ← **dipakai A21s Android 12**

Hasil: URI authority `com.android.providers.media.documents` (kalau via MediaProvider)
atau `com.android.providers.downloads.documents` (kalau file di `Download/`).

`ExifValidator.readGpsRobust()`:

```kotlin
mediaStoreColumnGps(context, uri)              // D: butuh _id MediaStore (terindeks)
readGpsFromStream(context, uri, true)          // A: setRequireOriginal (butuh izin)
convertToMediaStoreUri(uri) → readGpsFromStream(..., true)  // B: perlu authority media.documents + terindeks
readGpsFromExif(exif)                          // C: stream mentah (lemah)
```

- **Attempt D** (`extractMediaStoreId`): file `Download/` side-loaded → `docId` bukan `image:<id>`
  → **null**.
- **Attempt B** (`convertToMediaStoreUri`): sama → **null**.
- **Attempt A & C**: membaca EXIF dari stream. **Tanpa `ACCESS_MEDIA_LOCATION`, GPS IFD dihapus
  MediaProvider** → `latLong == null` DAN `TAG_GPS_* == null` → **null**.

→ Untuk skenario user (foto `Download/`, izin tak ter-grant karena Bug A), **semua attempt gagal**
→ `Status.NO_GPS` → modal *"Foto Tanpa Data Lokasi"*. **Ini kegagalan yang user lihat.**

Catatan: `MediaStore.setRequireOriginal()` hanya menambah query param `requireOriginal=1`
(tidak melempar exception untuk URI non-MediaStore), jadi bukan sumber crash — hanya no-op bila
provider tidak mengenalinya.

---

## 4. Bug B — GPS dibuang sebelum upload (server tidak bisa verifikasi)

`ImageCompressor.compressToFile()`:
```kotlin
val bitmap = decodeSampled(...)        // buang semua metadata (hanya piksel)
rotated.compress(JPEG, 85, fos)        // tulis JPEG tanpa EXIF
copyGpsExif(context, uri, out)         // coba salin GPS kembali…
```

`ImageCompressor.copyGpsExif()`:
```kotlin
val source = context.contentResolver.openInputStream(srcUri)?.use { ExifInterface(it) }  // ← STREAM MENTAH!
val ll = source.latLong                                                                 // ← null bila redacted
```

`openInputStream(srcUri)` **tanpa `setRequireOriginal`** = stream yang GPS-nya dihapus Android 10+.
→ `source.latLong == null` → GPS **tidak tersalin** ke file kompres.
(Fallback `GPS_TAGS` di bawahnya juga membaca `source` yang sama → tetap null.)

Konsekuensi: file yang di-POST ke server **tidak punya GPS**. Server
(`WargaReportController::extractExifGps`, `ReportController`) tidak bisa menghitung
`gps_mismatch`. Koordinat tetap terkirim lewat **form field** `latitude/longitude`, jadi laporan
tetap tersimpan — tetapi verifikasi foto-vs-koordinat di server **mati**.

Ini juga persis yang diperingatkan komentar sendiri di `ImageCompressor.kt:17-18`.

---

## 5. Bug D — Test regresi menutupi kegagalan (false green)

`ExifGpsRegressionTest.kt`:
```kotlin
private fun indexedImageWithGps(): Pair<Long,String>?  // hanya query MediaStore terindeks
...
assumeTrue("Tidak ada gambar ber-GPS terindeks MediaStore — uji di-skip", hit != null)
```
- Hanya menguji gambar **terindeks MediaStore** (`_id` valid) → memaksa Attempt D/B.
- Bila tidak ada → **di-skip** (hijau), bukan gagal.
- **Tidak ada** test untuk file `Download/` (skenario user) maupun untuk memverifikasi
  `ACCESS_MEDIA_LOCATION` benar-benar ter-grant lewat alur picker nyata.

→ Test bisa "lulus" sementara fitur gagal di HP.

---

## 6. Yang sudah BENAR (jangan diutak-atik)

- Port 4-attempt A/B/C/D di `readGpsRobust()` **struktur & urutannya benar** (sama referensi).
- Fallback DMS manual (`parseDms`/`parseDmsPair`) benar; menangani `S/W` → negatif.
- `isUsableCoord` (tolak 0,0) benar.
- Manifest sudah punya `READ_EXTERNAL_STORAGE maxSdkVersion=32` + `ACCESS_MEDIA_LOCATION`. ✓
- Validasi tanggal (`parseExifDate`, `diffCalendarDays`) benar & cocok server.

---

## 7. Rekomendasi perbaikan (berurut prioritas)

### P1 — Perbaiki Bug A (WAJIB, penyebab langsung)
`GalleryPicker.kt`: buka picker **setelah** hasil izin diterima; minta
`ACCESS_MEDIA_LOCATION` **terpisah** (tanpa dialog) dari `READ_EXTERNAL_STORAGE`.

```kotlin
val permLauncher = rememberLauncherForActivityResult(
    ActivityResultContracts.RequestMultiplePermissions(),
) { /* BARU DISINI buka picker */ pendingLaunch?.invoke() }
```
- Pisahkan: panggil `ACCESS_MEDIA_LOCATION` lewat `RequestPermission` tunggal (silent grant),
  lalu `READ_EXTERNAL_STORAGE`/`READ_MEDIA_IMAGES` lewat launcher lain; **baru** picker.
- Tampilkan pesan bila izin media-location GAGAL (agar user tahu GPS tak akan terbaca).

### P2 — Perbaiki Bug B (WAJIB untuk verifikasi server)
`ImageCompressor.copyGpsExif()` harus membaca sumber **dengan hak original**, atau lebih baik:
**terima `lat`/`lng` yang sudah tervalidasi dari ViewModel** dan tulis langsung:
```kotlin
fun compressToFile(context, uri, lat: Double?, lng: Double?, outName=...)
...
if (lat != null && lng != null) { target.setLatLong(lat, lng); target.saveAttributes() }
```
(Tulis dari koordinat hasil validasi → kebal redaksi.) Alternatif: baca via
`MediaStore.setRequireOriginal(uri)` saat `hasMediaLocationPermission`.

### P3 — Ganti/standarkan picker (opsional tapi disarankan)
Ganti `PickVisualMedia()` → `ActivityResultContracts.OpenDocument()` dengan
`EXTRA_MIME_TYPES = [image/jpeg,image/png,image/webp]` (identik plugin referensi).
Lebih dapat diprediksi untuk `setRequireOriginal` pada API < 33.

### P4 — Fallback server (defense-in-depth)
Panggil `POST /v1/reports/extract-exif-gps` bila GPS lokal null, sebelum tampilkan modal
"Tanpa Lokasi". Server punya ekstraksi 2-tier yang kebal redaksi (bila file tidak dikompres).
Catatan: tak berguna bila file sudah dikompres tanpa GPS → **selesaikan P2 dulu**.

### P5 — Perbaiki test (agar tidak false-green)
- Tambah test **wajib** (bukan `assumeTrue`) yang menyalin 1 file `fresh` ke `Downloads/`,
  mengambil URI via `ACTION_OPEN_DOCUMENT` semu, dan **assert** GPS terbaca.
- Tambah assert `AccessMediaLocation` benar-benar GRANTED.
- Tambah test: setelah `compressToFile`, file hasil **masih punya GPS** (regresi Bug B).

---

## 8. Langkah verifikasi di device (checklist)

```bash
# 1. Build & install
cd android-native && ./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk

# 2. Cek status izin SETELAH tap "Galeri"
adb shell dumpsys package com.jalankita.app | grep -A2 ACCESS_MEDIA_LOCATION
adb shell cmd appops get com.jalankita.app ACCESS_MEDIA_LOCATION

# 3. Log jalur attempt yang dipakai
adb logcat -s ExifValidator:V ImageCompressor:V

# 4. (Bukti redaksi) cek file upload tersimpan di cache punya GPS atau tidak
adb shell run-as com.jalankita.app ls cache/
```

Ekspektasi bila diperbaiki: `ExifValidator: GPS attempt D/A/B → …` muncul, dan
`ImageCompressor: EXIF GPS disalin…` muncul.

---

## 9. Ringkas: mengapa user melihat "tidak berhasil"

1. Tap "Galeri" → dialog izin → **picker tak terbuka** (Bug A: callback kosong;
   `ACCESS_MEDIA_LOCATION` tak ikut ter-grant dari bundle).
2. Bila picker terbuka → `ACCESS_MEDIA_LOCATION` belum granted → MediaProvider
   **menghapus GPS IFD** dari stream.
3. File di `Download/` **tidak terindeks MediaStore** → Attempt D & B gugur;
   Attempt A & C mengembalikan `null` karena redaksi.
4. `validate()` → `Status.NO_GPS` → modal "Foto Tanpa Data Lokasi".
5. Seandainya lolos pun, `copyGpsExif` (Bug B) membuang GPS dari file upload.

Diperbaiki lewat **P1 + P2** (dan P5 untuk mencegah regresi diam).

---

## 10. STATUS PERBAIKAN (2026-10-01, sesi ini) — sudah diterapkan & build sukses

| Fix | File | Perubahan |
|---|---|---|
| **P1 (Bug A)** | `ui/GalleryPicker.kt` | Callback izin TIDAK kosong lagi: picker selalu dibuka setelah izin selesai. `ACCESS_MEDIA_LOCATION` diminta pada **launcher terpisah** (silent grant), `READ_EXTERNAL_STORAGE`/`READ_MEDIA_IMAGES` pada launcher berdialog. |
| **P2 (Bug B)** | `core/util/ImageCompressor.kt` | `compressToFile(..., lat, lng)` — GPS ditulis dari **koordinat hasil validasi** (kebal redaksi). `copyGpsExif` → `writeGpsExif` + `openSourceExif` (pakai `setRequireOriginal`). |
| — | `feature/lapor/LaporViewModel.kt` | Kirim `lat/lng` hasil validasi ke `compressToFile`. |
| — | `feature/warga/WargaLaporViewModel.kt` | idem. |
| — | `androidTest/.../ExifGpsRegressionTest.kt` | Sesuaikan signature `compressToFile`. |

**Verifikasi build:** `./gradlew compileDebugKotlin compileDebugAndroidTestKotlin` → EXIT 0;
`assembleDebug` → EXIT 0 (`app-debug.apk` 2026-10-01 13:42).

### Belum dikerjakan (disarankan sesi berikutnya)
- **P3**: ganti `PickVisualMedia()` → `OpenDocument()` (paritas penuh dengan plugin referensi).
- **P4**: fallback `POST /v1/reports/extract-exif-gps` saat GPS lokal null.
- **P5**: test wajib (tanpa `assumeTrue`) untuk file `Download/` + assert `ACCESS_MEDIA_LOCATION` GRANTED.
- **Uji ulang di HP** dengan `Image For Testing/fresh/*.jpg` (lihat §8) & cek logcat `ExifValidator`/`GalleryPicker`.
