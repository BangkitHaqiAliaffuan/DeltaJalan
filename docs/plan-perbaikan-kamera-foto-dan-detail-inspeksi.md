# Rencana Perbaikan: Kamera Foto, Geolokasi, dan Detail Foto Inspeksi

Status: **rencana, belum dieksekusi**
Cakupan: `android-native/` + `backend_POSTGRESQL/` (tidak menyentuh `Frontend-stable/` dan `backend_AI/`)

---

## 1. Tiga masalah yang dilaporkan

| # | Laporan | Dampak |
|---|---|---|
| M1 | Tombol **Kamera** pada input foto kerusakan warga membuka **galeri** | Warga tidak bisa memotret langsung; foto dari galeri berisiko lama/berbeda lokasi |
| M2 | Detail tugas inspeksi hanya menampilkan **satu** foto warga, tidak bisa dibuka fullscreen | Petugas menilai kerusakan dari 1 dari 3 foto; tidak bisa memperbesar detail retak/lubang |
| M3 | Foto dari **kamera** pada form hasil inspeksi tidak punya EXIF/GPS walau lokasi HP menyala | Foto ditolak `ExifValidator` ("tidak memiliki metadata lokasi") → petugas gagal mengirim bukti |

---

## 2. Analisis akar masalah

### M1 — Tombol Kamera warga = galeri

**Bukti kode** — `feature/warga/WargaLaporScreen.kt:181-187`:

```kotlin
PhotoPlaceholder(
    onGallery = { pickSaf() },
    onCamera = {
        // TODO Fase 5: CameraX (EXIF GPS asli). Sementara galeri.
        pickSingle()
    },
)
```

`pickSingle` melempar `ActivityResultContracts.PickVisualMedia` (`WargaLaporScreen.kt:105-109`) — yaitu **photo picker sistem**. Jadi tombol "Kamera" memang tidak pernah membuka aplikasi kamera; ini tombol yang belum diimplementasikan (TODO lama), bukan salah deteksi perangkat.

Masalah yang sama ada di dua tempat lain:

- `feature/lapor/LaporScreen.kt:184` — form lapor **petugas**: `PickButton("Kamera", …) { pickFromGallery() }`.
- `WargaLaporScreen.kt:239-243` — `AddMoreButton` (tambah foto ke-2/3) hanya membuka galeri; tidak ada pilihan kamera saat daftar foto sudah berisi.

Artinya seluruh aplikasi **belum pernah** memotret langsung dari formulir pelaporan; hanya form hasil inspeksi yang punya jalur kamera (`PhotoCapture` + `TakePicture`, hasil kerja sebelumnya).

**Kesimpulan:** perbaikan = pakai jalur kamera yang sudah terbukti di form inspeksi (`PhotoCapture.newTarget()` + `ActivityResultContracts.TakePicture`) untuk warga dan petugas.

### M2 — Detail tugas inspeksi hanya 1 foto, tanpa fullscreen

**Bukti kode (server)** — `NativeInspectionController::show()` baris 154:

```php
$assignment->load(['report', 'session.team', 'result.photos']);
```

Relasi `report.photos` **tidak** dimuat, sehingga respons hanya membawa `image_original_path` / `image_original_url` (foto utama level `reports`). Warga bisa mengirim sampai `WARGA_MAX_PHOTOS = 3` (`WargaLaporViewModel.kt:42`); foto ke-2 dan ke-3 disimpan di tabel `report_photos` (`WargaReportController.php:1300-1336`) dan **tidak pernah** sampai ke aplikasi petugas.

**Bukti kode (klien)**:
- `core/network/InspectionModels.kt:191-212` — `InspectionReportDto` tidak punya field `photos`.
- `feature/home/InspectionScreens.kt:296-320` — layar hanya merender satu `ReportThumbnail` dari `imageOriginalUrl`.

**Fullscreen belum ada sama sekali**: `grep -rn "Fullscreen|Zoomable|PhotoViewer"` di seluruh `android-native` → kosong. Jadi ini komponen baru, bukan sekadar memasang handler klik.

Catatan penting: helper `Report::ensurePrimaryPhotoInPhotos()` (`app/Models/Report.php:461`) sudah menyatukan foto utama ke daftar `report_photos` saat dibaca — dipakai `WargaReportController` untuk detail warga. Kita pakai helper yang sama supaya urutan dan kelengkapan foto konsisten dengan yang dilihat warga.

### M3 — Foto kamera inspeksi tanpa EXIF GPS

**Alur sekarang** (`feature/home/InspectionResultScreen.kt:99-132`):

1. `PhotoCapture.newTarget()` membuat berkas kosong di `cacheDir/kamera/` + URI FileProvider.
2. `ActivityResultContracts.TakePicture` membuka **aplikasi kamera pihak ketiga**.
3. Setelah kamera menutup, berkas diteruskan ke `vm.addPhotos(...)`.
4. `ExifValidator.validate(requireGps = true)` membaca EXIF → bila tidak ada GPS, foto **ditolak**.

**Akar masalah:** langkah 2 sepenuhnya bergantung pada aplikasi kamera untuk menulis tag GPS. Banyak aplikasi kamera hanya menulis GPS bila pengaturan "tag lokasi" milik **aplikasi kamera itu** aktif — pengaturan lokasi sistem menyala tidak menjaminnya. Aplikasi kita tidak pernah membaca lokasi perangkat sendiri sebagai cadangan, sehingga EXIF kosong = foto ditolak (dan walau lolos, `InspectionPhotoGuard` di server akan kehilangan titik pembanding).

Bukti pendukung:
- `PhotoCapture.kt` tidak mengandung pembacaan lokasi sama sekali (hanya membuat berkas + URI).
- Satu-satunya kode lokasi runtime ada di `core/worker/LocationWorker.kt` (`freshestLocation()`, `requestCurrentLocation()`) dan bersifat `private` untuk worker — tidak bisa dipakai UI.
- Izin `ACCESS_FINE_LOCATION` diminta di awal aplikasi (`MainActivity.kt:833-874`) untuk tracking petugas, jadi **izinnya biasanya sudah ada**, hanya tidak dipakai untuk foto.
- `ImageCompressor.compressToFileWithExif(context, uri, lat, lng)` menulis GPS ke JPEG hasil kompres, tetapi `lat/lng` diambil dari EXIF asli (`InspectionResultViewModel.kt:151-164`) → kalau EXIF kosong, hasil kompres juga kosong. Jadi stempel harus dilakukan **sebelum** validasi/kompresi.

**Kesimpulan:** kita harus membaca lokasi perangkat saat foto diambil, lalu **menstempel** EXIF GPS (dan tanggal bila hilang) ke berkas hasil kamera bila kamera tidak menuliskannya.

---

## 3. Rencana perbaikan

### Fase 1 — Jalur kamera nyata untuk laporan warga & petugas (M1)

1. **`core/util/PhotoCapture.kt`** — tambah dua fungsi murni:
   - `stampLocation(file: File, lat: Double, lng: Double, takenAt: Long = now): Boolean` — menulis `TAG_GPS_LATITUDE/LONGITUDE` + ref + `TAG_DATETIME_ORIGINAL` bila belum ada (`ExifInterface.setLatLong()` + `TAG_GPS_VERSION_ID`), lalu `saveAttributes()`.
   - `needsStamp(file: File): Boolean` — `true` bila GPS EXIF kosong (dipakai untuk memutuskan stempel dan untuk pesan diagnostik).
2. **`core/util/DeviceLocation.kt`** (baru) — `suspend fun current(context, timeoutMs = 8_000): Pair<Double, Double>?`, memakai kerangka yang sudah terbukti di `LocationWorker` (fix aktif API 30+ → fallback `getLastKnownLocation` GPS/Network maks 30 menit), ditambah `fun hasPermission(context): Boolean`. `LocationWorker` tetap seperti sekarang (tidak direfaktor, agar tracking tidak berisiko).
3. **`WargaLaporScreen.kt`** — ganti `onCamera = { pickSingle() }` dengan `TakePicture` + `PhotoCapture`, sama seperti form inspeksi:
   - minta izin `CAMERA` (dan `ACCESS_FINE_LOCATION` bila belum) → buka kamera → bila tersimpan, ambil lokasi → `stampLocation` bila perlu → `laporVm.addPhotos(context, listOf(target.uri))`; bila batal, `PhotoCapture.discard(target)`.
   - `AddMoreButton` diberi dua tombol (Galeri / Kamera) alih-alih satu.
4. **`feature/lapor/LaporScreen.kt:184`** — perbaikan identik untuk form lapor petugas (masalah sama persis).
5. **Uji**: `KameraLangsungTest.kt` (source-guard) memastikan tidak ada lagi `onCamera = { … pickSingle()/pickFromGallery() }`, kedua form memakai `PhotoCapture.newTarget`, dan `stampLocation` dipanggil tepat sekali per hasil kamera; unit test `PhotoCaptureStampTest` untuk `needsStamp` (fixture JPEG tanpa GPS).

### Fase 2 — Geolokasi otomatis pada foto kamera (M3)

1. **`InspectionResultScreen.kt`** — pada callback `TakePicture`: sebelum `vm.addPhotos`, jalankan `DeviceLocation.current(context)`; bila dapat → `PhotoCapture.stampLocation(file, lat, lng)`. Bila EXIF kamera **sudah** punya GPS (kasus kamera Samsung dengan tag lokasi aktif) → **jangan ditimpa** (EXIF kamera lebih presisi/berisi arah).
2. Bila lokasi tidak didapat: pesan spesifik di `photoError` — "Lokasi perangkat belum terkunci. Nyalakan GPS dan coba lagi, atau pilih foto dari Galeri." (bukan pesan generik "foto tidak punya EXIF").
3. Izin: bila `ACCESS_FINE_LOCATION` ditolak, minta sekali saat tombol Kamera ditekan; ditolak → arahkan ke Galeri (form Galeri tetap jalan karena EXIF file asli).
4. Server tidak diubah: `InspectionPhotoGuard` tetap bekerja karena sekarang foto membawa GPS.
5. **Uji**: `InspectionCameraStampTest.kt` — (a) kamera menulis GPS → tidak distempel ulang; (b) kamera tanpa GPS + lokasi tersedia → distempel, lolos `ExifValidator`; (c) lokasi null → pesan khusus, foto tidak ditambahkan.

### Fase 3 — Semua foto warga + penampil fullscreen (M2)

**Server**
1. `NativeInspectionController::show()`: `load(['report.photos', 'session.team', 'result.photos'])`, lalu
   `report->setAttribute('photos', Report::ensurePrimaryPhotoInPhotos($report->photos->map(...)->all(), $report))` agar payload memuat **seluruh** foto warga (urut `sort_order`, foto utama di depan), masing-masing dengan `id`, `image_original_url`, `latitude`, `longitude`, `taken_at`.
2. Tanpa migrasi, tanpa kolom baru.

**Klien**
3. `InspectionModels.kt` — `InspectionReportDto` tambah `photos: List<InspectionReportPhotoDto>?`; DTO baru `InspectionReportPhotoDto(id, imageOriginalUrl, latitude, longitude, takenAt)`.
4. **`ui/components/PhotoViewer.kt`** (baru) — dialog layar penuh:
   - `Dialog(properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false))`, latar hitam, `SystemUiVisibility` aman via `InsetSafe`.
   - `HorizontalPager` (Compose Foundation, sudah tersedia di BOM 2024.12.01) untuk geser antar foto, pinch-zoom + pan `detectTransformGestures` (tanpa dependency baru), indikator "2/3", tombol tutup, dukungan back.
5. `InspectionScreens.kt` — bagian **"Bukti Laporan Awal Warga"** menjadi grid/`LazyRow` semua foto + label "1/3" dan ketuk → `PhotoViewer(photos, initialIndex)`. Bila `photos` kosong, tetap pakai `imageOriginalUrl` lama (kompatibel dengan backend lama sebelum deploy).
6. Opsional (P3): tampilkan juga foto bukti inspeksi yang **sudah** dikirim (`item.result.photos`) memakai viewer yang sama.
7. **Uji**: `DetailFotoInspeksiTest.kt` (kontrak payload: `photos` dibaca, fallback ke `imageOriginalUrl` bila null), `PhotoViewerKontrakTest.kt` (ada `HorizontalPager`, zoom, tombol tutup, indikator), backend `InspectionDetailPhotosTest.php` (payload `show()` memuat 3 foto termasuk foto utama).

### Urutan eksekusi yang disarankan
Fase 2 (paling menyakitkan bagi petugas) → Fase 1 (regresi UI kecil) → Fase 3 (perlu deploy backend + APK).

---

## 4. Keputusan desain

| # | Keputusan | Alasan |
|---|---|---|
| D1 | Sumber GPS cadangan = **lokasi perangkat saat itu**, bukan EXIF kamera | Persis yang diminta; juga membuat `InspectionPhotoGuard` punya titik pembanding yang jujur |
| D2 | EXIF kamera **tidak ditimpa** bila sudah berisi GPS | Data kamera lebih kaya (akurasi/arah); stempel hanya penambal |
| D3 | `DateTimeOriginal` ikut distempel bila hilang | Server menolak foto tanpa tanggal (`PHOTO_TOO_OLD`/`NO_DATE`); kamera yang tidak menulis GPS biasanya juga tidak menulis tanggal |
| D4 | Izin lokasi ditolak → foto kamera tidak ditambahkan, arahkan ke Galeri | Laporan tanpa GPS tetap ditolak server; lebih baik gagal di layar dengan pesan jelas |
| D5 | Penampil fullscreen dibuat sendiri (Compose), bukan library | Menghindari dependency baru; kebutuhan hanya geser + zoom + tutup |
| D6 | Foto utama tetap di depan daftar foto | Konsisten dengan detail warga (`ensurePrimaryPhotoInPhotos`) |
| D7 | Tombol Kamera petugas (`LaporScreen.kt:184`) ikut diperbaiki | Bug identik; meninggalkannya membuat dua perilaku berbeda di satu aplikasi |

## 5. Risiko & mitigasi

| Risiko | Mitigasi |
|---|---|
| Stempel GPS memakai lokasi *terakhir* yang basi (mis. perjalanan jauh) | Batas 30 menit seperti `LocationWorker`; bila lebih tua → anggap gagal, tampilkan pesan |
| Foto jadi "ber-GPS palsu" bila lokasi salah | Nilai EXIF asli kamera diprioritaskan (D2); stempel hanya bila kosong dan tetap di dalam `sidoarjoBounds` |
| Petugas di luar Sidoarjo saat uji | `SidoarjoBounds` menolak; pesan sudah ada ("Lokasi foto berada di luar wilayah Kabupaten Sidoarjo") |
| `setLatLong` gagal pada JPEG tertentu | `stampLocation` mengembalikan `false` → jalur pesan gagal yang sama, tidak crash |
| Payload `show()` membesar (3 foto) | Hanya URL + koordinat, bukan base64 |
| Backend lama + APK baru | Klien fallback ke `imageOriginalUrl` saat `photos` null |

## 6. Uji manual setelah perbaikan

1. Warga: tombol **Kamera** membuka aplikasi kamera (bukan galeri), foto langsung masuk daftar dengan koordinat tampil di bawahnya.
2. Warga: tambah foto ke-2 lewat Kamera dari state sudah-ada-foto.
3. Petugas: tombol Kamera di form lapor juga membuka kamera.
4. Form inspeksi: matikan "tag lokasi" di aplikasi kamera HP → foto hasil kamera tetap lolos validasi dan terekam GPS.
5. Form inspeksi: matikan GPS perangkat → pesan "Lokasi perangkat belum terkunci…", bukan pesan EXIF generik.
6. Detail tugas inspeksi: tampil 3 foto warga; ketuk → fullscreen, geser antar foto, pinch zoom, tutup.
7. Kirim hasil inspeksi dengan 3 foto dari lokasi laporan → tidak ada 422 penjaga jarak.

## 7. Tidak termasuk

- KameraX in-app (kamera kustom) — tetap memakai aplikasi kamera sistem.
- Fitur duplikat lokasi (masih di luar cakupan).

---

## 8. Hasil crosscheck ke seluruh layar (audit menyeluruh)

Audit dilakukan dengan pemindaian sistematis: semua `TODO/FIXME`, semua lambda `onClick` kosong, semua pemanggilan kamera/galeri (`TakePicture`, `PhotoCapture`, `PickVisualMedia`, `OpenDocument`, `pickFromGallery`), semua titik render foto (`AsyncImage`, `ReportThumbnail`, `ImageUrl.resolve`), serta semua pemakaian `ExifValidator`. Hasil: **146 berkas Kotlin**.

### 8.1 Jumlah stub di seluruh aplikasi

| Temuan | Hasil |
|---|---|
| `TODO/FIXME/XXX/HACK` | **1** saja: `WargaLaporScreen.kt:184` (kamera warga) |
| `onClick` kosong / mati | **0** (semua lambda berisi aksi) |
| Tombol berlabel "Kamera" yang membuka galeri | **2**: `WargaLaporScreen.kt:181-187` dan `LaporScreen.kt:184` |
| Form yang punya kamera sungguhan | **2**: form hasil inspeksi (`INS`) dan form temuan (`TMW`) — keduanya di `InspectionResultScreen.kt` |

### 8.2 Peta kemampuan melihat foto per layar

| Layar | Semua foto ditampilkan? | Zoom / fullscreen? | Berkas |
|---|---|---|---|
| Detail tugas inspeksi (petugas) | **Tidak** — hanya foto utama (1 dari maks 3) | Tidak | `InspectionScreens.kt:296-320` |
| Detail laporan (petugas) | Ya (satu kartu per foto) | Tidak | `DetailSections.kt:98-140`, `DetailScreen.kt:200` |
| Detail laporan (warga) | Ya (carousel + penghitung) | Tidak (hanya crop 4:3) | `WargaDetailScreen.kt:449-505` |
| Detail laporan (supervisor) | Ya (kartu per foto + toggle AI) | Tidak | `SupervisorDetailScreen.kt:401-450` |
| Hasil inspeksi di detail supervisor | Ya (thumbnail 96 dp) | Tidak | `SupervisorDetailScreen.kt:611-630` |
| Review inspeksi (supervisor) | Ya (thumbnail 72–100 dp) | Tidak | `InspectionReviewScreen.kt:158-172, 300-322` |
| Foto setelah perbaikan (petugas) | Ya | **Lightbox ad-hoc ada** — tanpa zoom, tinggi tetap 320 dp | `DetailSections.kt:296-378` |
| Antrean Kirim | 1 thumbnail per item (memadai) | Tidak perlu | `QueueScreen.kt:305` |

### 8.3 Koreksi terhadap rencana awal

1. **Lightbox sudah ada** (sempat saya tulis "tidak ada sama sekali"). Yang benar: ada satu lightbox lokal di `PetugasAfterGallery` — Dialog fullscreen, tombol ‹ ›, penghitung, tanpa zoom, tinggi gambar dipaku 320 dp. Rencana Fase 3 direvisi: buat `ui/components/PhotoViewer.kt` sebagai komponen bersama **dan migrasikan** lightbox itu ke sana, supaya tidak ada dua penampil yang perlahan berbeda. Uji penjaga: hanya satu implementasi penampil foto di seluruh aplikasi.
2. **M3 mengenai dua form**, bukan satu: `InspectionResultScreen` (`INS`) **dan** `DiscoveredReportScreen` (`TMW`, `InspectionResultScreen.kt:469-490`). Keduanya memakai `PhotoCapture.newTarget` dengan prefix berbeda dan sama-sama bergantung pada EXIF kamera. Stempel GPS harus dipasang di **kedua** jalur.
3. **Layar tanpa zoom lebih luas dari yang dilaporkan**: lima layar menampilkan foto berukuran kecil tanpa jalan memperbesar (tabel 8.2). Keluhan Anda di detail inspeksi adalah yang paling parah (hanya 1 dari 3 foto), tetapi `PhotoViewer` bersama akan memperbaiki semuanya sekaligus — dan itu justru alasan kuat memakai komponen bersama, bukan tambalan lokal.
4. **Dua dialog petugas hanya galeri**: `ProgressDialog` (foto progres) dan `SelesaiDialog` (foto setelah perbaikan) di `DetailScreen.kt:512-648` tidak punya pilihan kamera sama sekali. Ini **bukan** bug label (tidak ada tombol "Kamera" palsu), melainkan celah fitur. Keduanya memakai `ExifValidator(requireGps = false)` → tidak perlu stempel GPS. Masuk daftar opsional (Fase 1b), bukan wajib.
5. **Paritas izin**: jalur kamera mana pun wajib meminta `CAMERA` secara runtime (manifest sudah mendeklarasikannya; tanpa izin, intent kamera ditolak sistem). Jalur galeri memakai `rememberGalleryPickerLauncher` yang meminta `READ_MEDIA_IMAGES` + `ACCESS_MEDIA_LOCATION`. Jalur kamera + stempel GPS butuh `ACCESS_FINE_LOCATION` (biasanya sudah diberikan saat app start untuk tracking).

### 8.4 Risiko regresi dari perbaikan ini (dicek per titik sentuh)

| Perubahan | Layar lain yang mungkin terkena | Mitigasi |
|---|---|---|
| `PhotoCapture` ditambah fungsi (`stampLocation`, `hasGps`) | Dua form inspeksi yang sudah memakainya | `newTarget`/`discard` tidak diubah tanda tangannya; fungsi baru murni tambahan |
| Callback `TakePicture` dijadikan coroutine + stempel | Form `INS` dan `TMW` | Uji: stempel tepat sekali, `captureTarget` selalu direset, berkas dibuang bila gagal |
| `InspectionReportDto` tambah field `photos` | Detail inspeksi + (bila dipakai) layar lain yang mem-parse DTO ini | Field opsional `null`; fallback ke `imageOriginalUrl` saat backend lama belum deploy |
| `show()` memuat `report.photos` | Detail tugas inspeksi (supervisor & petugas) | Payload hanya URL + koordinat; uji PHPUnit memastikan 3 foto termuat dan urutan foto utama di depan |
| Lightbox `PetugasAfterGallery` dimigrasikan ke `PhotoViewer` | Detail laporan petugas | Uji penjaga: hanya satu implementasi penampil; uji manual buka/tutup/geser |

Tidak ada layar lain yang menulis EXIF, mengubah `PhotoCapture`, atau mem-parse `InspectionReportDto`, sehingga perubahan ini tidak menjangkau alur laporan warga, antrean kirim, maupun notifikasi.
