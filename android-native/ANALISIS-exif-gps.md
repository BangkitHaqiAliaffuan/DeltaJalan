# Analisis: Fungsi Cek EXIF GPS Android Native TIDAK Berfungsi

Tanggal: 2026-10-01
Device uji: SM-A217F (Samsung A21s), **Android 12 / SDK 31**
File uji: `/sdcard/Download/20260525_1206*.jpg`, `20260526_1200*.jpg` (dan varian `edited-*_fresh.jpg`)

---

## TL;DR

GPS EXIF **ADA di file fisik** (diverifikasi byte-per-byte) tapi aplikasi **tidak bisa membacanya**.
Root cause: `ExifValidator.kt` **membuang rantai 4-attempt** yang ada di referensi
`PhotoExifGpsPlugin.java`. Padahal `docs/rencana-native-android.md` baris 49 secara eksplisit
meminta *"Rantai 4-attempt baca GPS EXIF dari `PhotoExifGpsPlugin.java` (port ke Kotlin)"* —
**belum pernah di-port**.

Ditambah 2 masalah pendukung: izin runtime tidak pernah diminta, dan `READ_EXTERNAL_STORAGE`
tidak dideklarasikan (Android ≤12).

---

## Bukti Empiris

### 1. File di device PUNYA EXIF GPS (bukan masalah file)

Dibaca langsung dari byte JPEG (parse TIFF/IFD manual):

| File | DateTimeOriginal | GPS IFD | lat, lng |
|---|---|---|---|
| 20260525_120623.jpg | 2026:08:03 05:42:30 | ADA | -7.442088, 112.727285 |
| 20260525_120638.jpg | 2026:08:03 05:41:32 | ADA | -7.443368, 112.727104 |
| 20260526_120048.jpg | 2026:08:03 05:43:02 | ADA | -7.441356, 112.726738 |
| 20260526_120255.jpg | 2026:08:03 05:43:52 | ADA | -7.444585, 112.727060 |
| 20260526_120300.jpg | 2026:08:03 05:41:33 | ADA | -7.444585, 112.727060 |
| edited-..._fresh.jpg | 2026:10:01 05:12:59 | ADA | (sama, di-edit ulang) |

→ **Semua koordinat berada di Sidoarjo** (±7.44 LS, 112.72 BT). File 100% valid.

### 2. Status izin di device

```
ACCESS_MEDIA_LOCATION: granted=false, flags=[USER_SENSITIVE_WHEN_GRANTED|USER_SENSITIVE_WHEN_DENIED]
appops: ACCESS_MEDIA_LOCATION: ignore
```

Aplikasi **tidak pernah** meminta `ACCESS_MEDIA_LOCATION` saat runtime —
`MainActivity.kt` hanya meminta `POST_NOTIFICATIONS` (baris 327-341).

### 3. File di `Download/` TIDAK terindeks MediaStore

```
content query --uri content://media/external/images/media --where "_display_name='20260525_120623.jpg'"
→ (0 rows)
```

File `Download/` di-side-load manual, jadi tidak muncul di MediaStore. Ini penting karena
**Attempt D** (query kolom LATITUDE/LONGITUDE) bergantung pada MediaStore — kalau file tidak
terindeks, Attempt D gagal juga.

### 4. Perilaku `ExifInterface.getLatLong()` 1.4.1 (dari bytecode)

`getLatLong()` mengembalikan **null** jika SALAH SATU dari 4 tag berikut hilang:
`GPSLatitude`, `GPSLatitudeRef`, `GPSLongitude`, `GPSLongitudeRef`.

Ketika Android meredaksi GPS dari stream (karena `ACCESS_MEDIA_LOCATION` tidak diberikan),
keempat tag dihapus → `latLong` = `null`. Inilah yang terjadi.

---

## Root Cause (3 lapis)

### Bug #1 — EXIF GPS ter-redaksi; jalur baca naif
`ExifValidator.readGps()` (baris 130-149) hanya:
```kotlin
context.contentResolver.openInputStream(uri)?.use { ExifInterface(it) }  // stream mentah
```
Pada Android 10+, `openInputStream()` mengembalikan stream **yang GPS-nya sudah dihapus** bila
`ACCESS_MEDIA_LOCATION` tidak diberikan. Tidak ada:
- `MediaStore.setRequireOriginal(uri)` (Attempt A/B di referensi)
- Query kolom MediaStore (Attempt D)
- Fallback DMS manual lengkap

### Bug #2 — Izin `ACCESS_MEDIA_LOCATION` tidak pernah diminta runtime
Dideklarasikan di manifest (baris 11) tapi tidak ada kode `RequestPermission`.

### Bug #3 — `READ_EXTERNAL_STORAGE` tidak dideklarasikan
Manifest hanya punya `READ_MEDIA_IMAGES` (Android 13+/API 33+). Device target adalah
**Android 12 (API 31)**, yang butuh `READ_EXTERNAL_STORAGE` untuk MediaStore picker.

### Bug #4 (bonus) — Endpoint fallback server tidak dipakai
`ApiService.extractExifGps()` (baris 86-87) dan `Models.kt` (baris 170) sudah dibuat,
tapi **tidak pernah dipanggil** dari mana pun. Padahal server punya ekstraksi 2-tier
(`exif_read_data` + PEL raw-bytes) yang kebal redaksi.

### Bug #5 — Kompresi membuang EXIF sebelum upload
`LaporViewModel.submit()` meng-upload `photoFile` hasil `ImageCompressor.compressToFile()`
(Bitmap re-encode → `Bitmap.compress(JPEG,85)`) — proses ini **membuang seluruh APP1/EXIF**,
termasuk GPS. Konsisten dengan komentar di `ImageCompressor.kt` baris 16
*"Panggil SETELAH validasi EXIF (kompresi membuang EXIF)"*.

Konsekuensi: server **tidak pernah bisa** memverifikasi GPS dari foto yang di-upload
(semua pemeriksaan `gps_mismatch` / EXIF server jadi mati). Koordinat laporan masih terkirim
lewat **form field** `latitude`/`longitude`, jadi laporan tetap jalan — tapi verifikasi
foto-vs-koordinat di server tidak berfungsi. Endpoint `extract-exif-gps` pun mustahil
berguna bila dipanggil dengan file terkompres ini.


---

## Perbandingan dengan Referensi (yang BERFUNGSI)

`Frontend-stable/capacitor-exif-gps/.../PhotoExifGpsPlugin.java` — rantai 4-attempt:

| Attempt | Cara | Kapan berhasil |
|---|---|---|
| **D** | Query langsung kolom `MediaStore.Images.Media.LATITUDE/LONGITUDE` | File terindeks; **bypass redaksi total** |
| **A** | `MediaStore.setRequireOriginal(uri)` + stream | `ACCESS_MEDIA_LOCATION` granted |
| **B** | Konversi DocumentsProvider → MediaStore URI + `setRequireOriginal` | Seperti A, URI hasil konversi |
| **C** | Raw stream (naif) | Jarang; kalau tidak ada redaksi |

`ExifValidator.kt` hanya mengimplementasikan **Attempt C** (jalur paling lemah).

---

## Rekomendasi Perbaikan

### Prioritas 1 — Port rantai 4-attempt + izin (wajib)

1. **`ExifValidator.readGps()`**: tambah parameter `Uri` dan implementasikan A/B/C/D.
2. **`MainActivity.kt` / sebelum pick**: minta `ACCESS_MEDIA_LOCATION` + (`READ_EXTERNAL_STORAGE`
   bila SDK ≤ 32) sebelum membuka picker.
3. **`AndroidManifest.xml`**: tambah `<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"
   android:maxSdkVersion="32" />`.

### Prioritas 2 — Ganti picker ke `ACTION_OPEN_DOCUMENT`
`ActivityResultContracts.PickVisualMedia()` di Android 12 Samsung memakai
`ACTION_OPEN_DOCUMENT` ke DocumentsProvider; URI-nya `com.android.providers.media.documents`
yang **wajib** `setRequireOriginal` + konversi (Attempt B). Kode referensi sudah pakai ini.

### Prioritas 3 — Fallback server
Panggil `POST /v1/reports/extract-exif-gps` bila GPS lokal tetap null, sebelum menampilkan
modal "Foto Tanpa Data Lokasi".

### Prioritas 4 — Test regresi
`ExifGpsProbeTest.kt` / `ExifGpsProbe2Test.kt` (sudah dibuat) bisa diubah jadi test regresi
permanen dengan `GrantPermissionRule`.

---

## Catatan Lingkungan

- Device SM-A217F sangat lambat untuk `adb install` (71 MB APK, >6 menit). Pertimbangkan
  build APK split-per-ABI atau `assembleDebug --no-native` untuk iterasi cepat.
- Verifikasi GPS ter-redaksi bisa dicek via logcat tag `ExifGpsProbe`.
