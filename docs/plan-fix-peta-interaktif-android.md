# Perbaikan Peta Interaktif Android Native — Hasil Crosscheck & Eksekusi

> **Status:** Dieksekusi (textureMode + fix error state petugas).  
> **Target:** `android-native/` (`com.jalankita.app`)  
> **Komponen:** `ReportMapScreen.kt`, `DashboardViewModel.kt`

---

## 1. Ringkasan

Tab **Peta** Warga/Petugas/Supervisor tidak menampilkan basemap (latar abu-abu,
overlay tetap terlihat). Akar masalah yang **terbukti** adalah cara render
MapLibre di dalam Compose, bukan parsing JSON.

Dokumen awal mencurigai dua akar masalah. Hasil crosscheck:

| Klaim awal | Verdict | Bukti |
|---|---|---|
| Parsing `latitude`/`longitude` string → `JsonDataException` | **SALAH** | Moshi 1.15.2 mengoersi string ter-quote ke Double (`JsonUtf8Reader.nextDouble()`), diuji langsung: `"−7.44208830"` → `−7.4420883` tanpa exception |
| `MapView` default (`GLSurfaceView`) tidak tampil di Compose/Scaffold | **BENAR (arah fix)** | MapLibre 11.11.0 default `GLSurfaceView`; `textureMode(true)` memakai `TextureView` |

Catatan mekanisme: `SurfaceView` sebenarnya berada di belakang window dan
normalnya mem-punch lubang transparan, jadi bukan sekadar "tertutup warna
Scaffold". Gejala blank/black-hole di dalam `Scaffold` adalah isu upstream
(maplibre-native #3836, maplibre-compose #1125) terkait sinkronisasi frame
pertama/z-order saat di-host Compose. Workaround yang dilaporkan adalah
`textureMode=true` — tetap sama, hanya penjelasannya dikoreksi.

Fakta backend tetap benar: `Report.php:129-130` meng-cast
`latitude`/`longitude` sebagai `decimal:8`, sehingga JSON berisi string
(terverifikasi live: `"-7.44208830"`, `"112.72728520"`). Ini **tidak** merusak
parsing karena Moshi melakukan coercion.

---

## 2. Perubahan yang Diterapkan

### 2.1 `ReportMapScreen.kt` — textureMode

`MapView(ctx)` diganti konstruktor ber-opsi:

```kotlin
val options = MapLibreMapOptions.createFromAttributes(ctx, null)
    .textureMode(true)
MapView(ctx, options).apply { ... }
```

`TextureView` ikut hierarki render Compose, sehingga peta tidak lagi hilang di
dalam `Scaffold` (`WargaScaffold.kt:207`, `SupervisorScaffold.kt:266`,
`MainActivity.kt:542`).

Trade-off: `textureMode` sedikit lebih mahal dari `GLSurfaceView`, tapi
diperlukan untuk interoperabilitas Compose.

### 2.2 `DashboardViewModel.kt` — error state petugas

Sebelumnya `loadMap()` menulis error ke `errorMessage` (snackbar), sementara
`PetugasPetaScreen.kt:25` membaca `vm.mapError` → overlay "Coba Lagi" petugas
tidak pernah muncul. Sekarang `loadMap()` mengisi `mapError` (dan meresetnya di
awal), konsisten dengan `WargaViewModel.loadMap()`.

### 2.3 `LenientDoubleAdapter` — TIDAK dipakai

Tidak diperlukan: Moshi 1.15.2 sudah menerima string numerik untuk `Double`.
Menambahkannya hanya defense-in-depth yang tidak menyentuh `double` primitif,
dan tidak memperbaiki bug peta. Field decimal lain (`pci_score`,
`kerusakan_panjang/lebar`, `ai_confidence`) juga aman karena alasan yang sama.

---

## 3. Verifikasi

1. Kompilasi: `cd android-native && ./gradlew assembleDebug`.
2. Buka tab Peta sebagai Warga, Petugas, dan Supervisor.
3. Pastikan basemap CARTO Positron muncul, marker Berat/Sedang/Ringan tampil,
   dan marker bisa diketuk → kartu ringkasan → detail.
4. Uji jalur error: matikan jaringan → overlay "Peta gagal dimuat" + "Coba
   Lagi" harus muncul di ketiga role.
5. Diagnosis via logcat TAG `ReportMap` bila masih kosong:
   - `getMapAsync fire` / `Style ter-load` → render berjalan.
   - `Style gagal ter-load` → masalah jaringan/style.
   - `JsonDataException` → seharusnya tidak muncul lagi.

> Uji di device/emulator memerlukan izin device-testing per sesi (AGENTS.md).

---

## 4. Catatan / Upaya Lanjutan

- `@JsonClass(generateAdapter = true)` di DTO tidak menghasilkan adapter karena
  proyek tidak memasang `moshi-kotlin-codegen`/KSP Moshi; parsing berjalan via
  `KotlinJsonAdapterFactory` reflektif. Bukan bug, tapi jangan mengandalkan
  codegen saat menambah DTO.
- `DashboardViewModel.errorMessage` masih dipakai endpoint lain; hanya jalur
  peta yang dipindah ke `mapError`.
- Opsional (backend): `ReportController::mapData` bisa meng-cast `(float)`
  seperti yang sudah dilakukan `Report.php:475-476` agar kontrak JSON konsisten
  antar-endpoint.
