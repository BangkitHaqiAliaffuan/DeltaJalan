# JalanKita — Konteks Proyek & Analisis Keamanan

> Dokumen ini mendeskripsikan arsitektur sistem, celah keamanan yang ditemukan,
> dan rekomendasi perbaikan. Dibuat berdasarkan audit kode sumber per Mei 2026.

---

## 1. Konteks Proyek

### 1.1 Deskripsi

**JalanKita** adalah aplikasi web internal pelaporan kerusakan jalan untuk
**Dinas PU Bina Marga Kabupaten Sidoarjo**. Bukan aplikasi publik — hanya
diakses oleh pegawai dinas dengan tiga role yang sudah terdefinisi.

### 1.2 Stack Teknis

| Layer | Teknologi |
|---|---|
| Frontend | React 18 + TypeScript, TanStack Router, Vite, Tailwind CSS |
| Backend API | Laravel 11 (PHP 8.2+), Sanctum token auth |
| AI Server | FastAPI + YOLOv8s (deteksi 4 kelas kerusakan jalan) |
| Database | PostgreSQL (JSONB, native ENUM, UUID PK) |
| Peta / Geocoding | LocationIQ (autocomplete + reverse geocoding) |
| Storage | Laravel disk `public` (file fisik di `storage/app/public`) |

### 1.3 Role Pengguna

| Role | Akses |
|---|---|
| `petugas` | Upload foto, buat laporan, lihat laporan sendiri |
| `supervisor` | Review semua laporan, approve / tolak / disposisi |
| `admin` | Kelola data master (user, ruas jalan) — belum diimplementasi |

### 1.4 Alur Utama

```
Petugas di lapangan
    │
    ├─ Ambil foto (kamera langsung) → GPS live dari browser
    │   atau
    └─ Pilih dari galeri → baca GPS EXIF → validasi tanggal EXIF
            │
            ▼
    Upload ke /api/analyze (single) atau /api/analyze-batch (batch)
            │
            ▼
    Laravel → FastAPI YOLOv8 → deteksi kerusakan + severity
            │
            ▼
    Simpan laporan ke PostgreSQL
    (trust score dihitung otomatis: 0–100)
            │
            ▼
    Supervisor review di dashboard
    (lihat trust score, approve / tolak / disposisi)
```

### 1.5 Fitur yang Sudah Diimplementasi

- **Single upload**: 1 foto → analisis AI → simpan laporan
- **Batch upload**: hingga 20 foto sekaligus → analisis AI per foto → 1 laporan utama + sub-laporan
- **Trust score** (0–100): dihitung dari GPS EXIF, nama jalan vs koordinat, AI deteksi, konteks visual, fake GPS
- **Validasi EXIF tanggal**: tolak foto > 2 hari atau tanggal masa depan (single upload)
- **Duplicate check**: spasial (radius 15m Haversine) + tekstual (ILIKE)
- **Image hash** (MD5): cegah upload foto identik
- **Reverse geocoding**: isi nama jalan otomatis dari koordinat GPS
- **Autocomplete nama jalan**: LocationIQ bounded ke Sidoarjo

---

## 2. Celah Keamanan yang Masih Terbuka

### 2.1 KRITIS — Batch Upload Tidak Validasi EXIF Sama Sekali

**Lokasi**: `Frontend/src/routes/upload.tsx` → `handleGalleryChange()`

```typescript
if (files.length > 1) {
  // Mode batch: tambahkan semua file ke selectedFiles (skip validasi EXIF per-file)
  handleFilesSelected(files);
  return;  // ← LANGSUNG RETURN, tidak ada validasi apapun
}
```

**Dampak**: Petugas bisa upload 20 foto lama dari Google Maps, foto tahun lalu,
atau foto yang sama dengan nama berbeda. Tidak ada pemeriksaan tanggal, tidak ada
pemeriksaan GPS EXIF, tidak ada pemeriksaan duplikasi per file sebelum dikirim.

**Skenario exploit**:
1. Petugas download 20 foto jalan rusak dari Google Street View
2. Pilih semua sekaligus via galeri → batch upload
3. Sistem menerima semua, AI mendeteksi kerusakan (foto memang jalan rusak)
4. 20 laporan tersimpan dengan koordinat dari road search (bukan lokasi foto asli)
5. Trust score bisa tetap tinggi jika nama jalan dipilih dari autocomplete

**Perbaikan yang diperlukan**:
- Validasi EXIF tanggal per file di batch di backend (`AIController::analyzeBatch()`)
- Cek GPS EXIF per file — jika ada, bandingkan dengan koordinat yang diinput
- Hash check per file sebelum upload (bukan hanya di backend)

---

### 2.2 KRITIS — Koordinat Batch Tidak Terikat ke Foto

**Lokasi**: `handleSubmitBatch()` di `upload.tsx`

```typescript
// Satu koordinat untuk SEMUA foto dalam batch
fd2.append('latitude',  String(batchLat));
fd2.append('longitude', String(batchLng));
```

**Dampak**: Semua sub-laporan dalam satu batch mendapat koordinat yang sama —
koordinat dari road search atau GPS browser saat itu, bukan koordinat dari
masing-masing foto. Jika petugas upload 5 foto dari 5 lokasi berbeda dalam
satu batch, semua akan tercatat di satu titik koordinat.

**Perbaikan**: Batch upload seharusnya hanya diizinkan untuk foto-foto yang
diambil di lokasi yang sama (radius tertentu). Atau setiap foto harus punya
koordinat sendiri dari EXIF-nya yang diekstrak di backend.

---

### 2.3 TINGGI — `fake_gps_suspected` Selalu `false` di Batch

**Lokasi**: `handleSubmitBatch()` di `upload.tsx`

```typescript
fd2.append('fake_gps_suspected', '0');  // selalu false, hardcoded
```

**Dampak**: Komponen trust score untuk fake GPS selalu memberikan +15 poin
untuk semua laporan batch. Tidak ada deteksi fake GPS sama sekali untuk batch.

---

### 2.4 TINGGI — Endpoint `/api/analyze` dan `/api/reports` Tidak Butuh Auth

**Lokasi**: `backend_POSTGRESQL/routes/api.php`

```php
Route::post('/analyze', [ReportController::class, 'analyze']);   // publik
Route::post('/reports', [ReportController::class, 'store']);     // publik
```

**Dampak**:
- Siapapun yang tahu URL API bisa mengirim foto ke AI server tanpa login
- Siapapun bisa membuat laporan tanpa autentikasi
- Tidak ada rate limiting → bisa di-spam untuk menghabiskan storage dan quota AI

**Perbaikan**:
```php
Route::middleware(['auth:sanctum', 'throttle:60,1'])->group(function () {
    Route::post('/analyze', [ReportController::class, 'analyze']);
    Route::post('/reports', [ReportController::class, 'store']);
});
```

---

### 2.5 TINGGI — Image Hash Menggunakan MD5

**Lokasi**: `ReportController::calculateImageHash()`

```php
$hash = md5_file($filePath);
```

**Dampak**: MD5 rentan terhadap collision. Foto yang sedikit dimodifikasi
(resize, crop, ubah brightness) akan lolos karena hash-nya berbeda.

**Perbaikan**: Ganti ke SHA-256 untuk integritas, dan pertimbangkan perceptual
hash (`jenssegers/imagehash`) untuk deteksi foto yang "sama secara visual".

---

### 2.6 SEDANG — Token Disimpan di `localStorage`

**Lokasi**: `Frontend/src/lib/auth.ts`

```typescript
localStorage.setItem(TOKEN_KEY, token);
```

**Dampak**: Token di `localStorage` rentan terhadap serangan XSS.
`httpOnly cookie` lebih aman karena tidak bisa diakses JavaScript.

---

### 2.7 RENDAH — `APP_DEBUG=true` di Production

**Lokasi**: `backend_POSTGRESQL/.env.example`

Jika `.env` production mengikuti template ini, stack trace PHP akan terekspos
ke response API saat terjadi error. Set `APP_DEBUG=false` dan `APP_ENV=production`
sebelum deploy.

---

## 3. Analisis Kejujuran Petugas — Vektor Manipulasi

Ini adalah pertanyaan inti: **bagaimana memastikan petugas benar-benar jujur?**

### 3.1 Vektor Manipulasi yang Mungkin

| Skenario | Cara | Deteksi Saat Ini | Gap |
|---|---|---|---|
| Foto lama dari galeri | Upload foto > 2 hari | ✅ Validasi EXIF tanggal (single) | ❌ Tidak ada di batch |
| Foto dari internet | Download foto jalan rusak | ⚠️ Tidak ada GPS EXIF → trust score -30 | Masih bisa lolos jika koordinat diisi manual |
| Koordinat palsu | Isi koordinat dari tempat lain | ⚠️ Validasi nama jalan vs koordinat (LocationIQ) | Bisa diakali jika nama jalan generik |
| Foto yang sama dikirim ulang | Upload foto identik | ✅ MD5 hash check | ❌ MD5 bisa diakali dengan resize/crop |
| Foto dari lokasi berbeda dalam satu batch | Upload batch dari berbagai lokasi | ❌ Tidak ada | Semua dapat koordinat yang sama |
| Fake GPS app | Gunakan mock location | ⚠️ Deteksi di `useGPS` hook | ❌ Tidak aktif di batch, mudah diakali |
| Laporan fiktif | Buat laporan tanpa foto asli | ⚠️ AI harus mendeteksi kerusakan | AI bisa tertipu foto jalan rusak dari internet |

### 3.2 Kelemahan Fundamental

**Masalah utama**: Sistem mempercayai data yang dikirim dari client.
Koordinat, nama jalan, dan bahkan `fake_gps_suspected` semuanya bisa dimanipulasi
di sisi client sebelum dikirim ke server.

**Prinsip yang harus dipegang**: Satu-satunya data yang tidak bisa dipalsukan
adalah **foto itu sendiri** dan **metadata EXIF yang tertanam di dalamnya**.
Semua data lain (koordinat browser, nama jalan dari autocomplete) bisa dimanipulasi.

---

## 4. Rekomendasi Perbaikan yang Tersisa

### 4.1 PRIORITAS TINGGI — Validasi EXIF di Batch (Backend)

Tambahkan validasi EXIF tanggal untuk setiap foto dalam batch di `AIController::analyzeBatch()`.
Ini tidak bisa di-bypass dari frontend karena dilakukan di server.

```php
foreach ($request->file('files') as $idx => $file) {
    $exifCheck = $this->validatePhotoDateExif($file->getPathname());

    if (in_array($exifCheck['status'], ['too_old', 'future_date'])) {
        $analyses[] = [
            'file_index'    => $idx,
            'file_name'     => $file->getClientOriginalName(),
            'detections'    => [],
            'severity'      => 'ringan',
            'context_valid' => false,
            'confidence'    => 0.0,
            'exif_invalid'  => true,
            'exif_reason'   => $exifCheck['status'],
            'error'         => $exifCheck['message'],
        ];
        continue;
    }
    // Lanjut ke FastAPI...
}
```

### 4.2 PRIORITAS TINGGI — Ekstrak GPS EXIF per Foto di Batch

Setiap foto dalam batch harus diperiksa GPS EXIF-nya di backend.
Jika koordinat EXIF jauh dari koordinat yang diinput (> 500m), tandai sebagai suspicious.

```php
$exifGps = $this->extractExifGps($file->getPathname());

$analyses[] = [
    // ...
    'exif_lat'  => $exifGps['lat'] ?? null,
    'exif_lng'  => $exifGps['lng'] ?? null,
    'exif_gps_distance_from_input' => $exifGps
        ? $this->haversineDistance($exifGps['lat'], $exifGps['lng'], $lat, $lng)
        : null,
];
```

### 4.3 PRIORITAS TINGGI — Lindungi Endpoint `/api/analyze` dan `/api/reports`

```php
Route::middleware(['auth:sanctum', 'throttle:60,1'])->group(function () {
    Route::post('/analyze', [ReportController::class, 'analyze']);
    Route::post('/reports', [ReportController::class, 'store']);
});
```

### 4.4 PRIORITAS SEDANG — Ganti MD5 dengan SHA-256

```php
private function calculateImageHash(string $filePath): ?string
{
    try {
        return hash_file('sha256', $filePath);
    } catch (\Exception $e) {
        return null;
    }
}
```

Untuk deteksi foto yang "sama secara visual", pertimbangkan `jenssegers/imagehash`.

### 4.5 PRIORITAS RENDAH — Batasi Batch ke Foto dengan GPS EXIF Konsisten

Dalam satu batch, semua foto yang punya GPS EXIF harus berada dalam radius
tertentu (misalnya 200m) satu sama lain. Jika ada foto yang GPS-nya jauh,
tandai di `system_notes` dan kurangi trust score.

### 4.6 PRIORITAS RENDAH — Aktifkan `APP_DEBUG=false` di Production

```
APP_DEBUG=false
APP_ENV=production
```

---

## 5. Ringkasan Matriks Risiko

| # | Celah | Severity | Kemudahan Exploit | Status |
|---|---|---|---|---|
| 2.4 | Endpoint publik tanpa auth | Tinggi | Mudah | ❌ Belum diperbaiki |
| 2.3 | fake_gps hardcoded false | Tinggi | Mudah | ❌ Belum diperbaiki |
| 2.5 | MD5 untuk image hash | Tinggi | Sedang | ❌ Belum diperbaiki |
| 2.6 | Token di localStorage | Sedang | Sulit | ❌ Belum diperbaiki |
| 2.7 | APP_DEBUG=true | Rendah | Mudah | ❌ Belum diperbaiki (set saat production) |
| ~~2.1~~ | ~~Batch tidak validasi EXIF~~ | ~~Kritis~~ | — | ✅ Diperbaiki — validasi EXIF tanggal per foto di `AIController::analyzeBatch()` |
| ~~2.2~~ | ~~Koordinat batch tidak per-foto~~ | ~~Kritis~~ | — | ✅ Diperbaiki — GPS EXIF diekstrak per foto, koordinat per sub-laporan berbeda |
| ~~2.6~~ | ~~CORS ngrok hardcoded~~ | ~~Sedang~~ | — | ✅ Diperbaiki — dipindah ke `.env` |
| ~~2.8~~ | ~~Tidak ada rate limit login~~ | ~~Sedang~~ | — | ✅ Diperbaiki — `throttle:10,1` |
| ~~2.9~~ | ~~reporter_name dari form~~ | ~~Sedang~~ | — | ✅ Diperbaiki — ambil dari `auth()->user()->name` |
| ~~2.10~~ | ~~Koordinat tidak dibatasi Sidoarjo~~ | ~~Sedang~~ | — | ✅ Diperbaiki — `isInSidoarjo()` di store & storeBatch |
| ~~2.12~~ | ~~Inkonsistensi batas ukuran file~~ | ~~Rendah~~ | — | ✅ Diperbaiki — frontend disamakan ke 5MB |

---

## 6. Prinsip Desain untuk Kejujuran Petugas

Sistem tidak bisa memaksa kejujuran, tapi bisa membuat kecurangan **terdeteksi**
dan **tercatat** sehingga supervisor bisa mengambil keputusan yang tepat.

**Yang sudah benar**:
- Trust score sebagai triase, bukan gatekeeper — supervisor tetap pengambil keputusan
- Validasi nama jalan vs koordinat via LocationIQ
- Deteksi fake GPS (meski belum aktif di batch)
- Image hash untuk cegah foto identik
- Rate limiting login mencegah brute force
- Koordinat dibatasi ke wilayah Sidoarjo

**Yang perlu ditambahkan**:
1. **Audit trail per petugas** — berapa laporan per hari, berapa yang ditolak supervisor
2. **Anomaly detection** — petugas yang tiba-tiba upload 20 laporan dalam 5 menit
3. **GPS EXIF wajib untuk batch** — jika tidak ada GPS EXIF di mayoritas foto, trust score sangat rendah
4. **Perbandingan koordinat EXIF vs koordinat input** — jika beda > 100m, flag otomatis
5. **Supervisor bisa lihat metadata lengkap** — tanggal EXIF, GPS EXIF, device info

---

*Dokumen ini dibuat untuk keperluan internal tim pengembang JalanKita.*
*Jangan distribusikan ke luar tim.*
