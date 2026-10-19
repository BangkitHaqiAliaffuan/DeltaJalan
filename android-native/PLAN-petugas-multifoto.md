# PLAN — Laporan Petugas Multi-Foto (Batch) maks 10 Foto

> Status: analisis selesai; eksekusi.
> Permintaan: petugas punya maksimal **10 foto** per laporan (multi-foto penuh/batch meniru web).

## Kontrak backend (terverifikasi)

### 1) `POST /api/analyze-batch` (AIController:49)
- Body multipart: `files[]` (min1, **max:20**), `latitude` (required), `longitude` (required).
- Response:
```json
{ "batch_id":"uuid", "total_files":N, "photos_with_exif_gps":n, "photos_rejected":m,
  "analyses":[ {"file_index":0,"file_name":"...","detections":[{"type","confidence","bbox":[x1,y1,x2,y2]}],
               "severity","context_valid","confidence","image_result","exif_lat","exif_lng",
               "exif_invalid","exif_reason","error",...} ],
  "latitude":.., "longitude":.. }
```
- Catatan: tiap foto divalidasi EXIF tanggal di server; yang gagal → `exif_invalid:true`.

### 2) `POST /api/reports/batch` (ReportController:1617)
- Body (JSON/multipart):
```
batch_id (uuid, WAJIB — dari analyze-batch),
road_name, district (harus salah 18 kecamatan), latitude, longitude,
koordinat_sumber ("exif"|"browser_gps"|"manual"),
kerusakan_panjang[] (array,min1), kerusakan_lebar[] (array,min1),
catatan?, duplicate_of_id?, survey_task_id?,
files[] (opsional — hanya fallback bila photo_paths tak ada)
```
- Analisis diambil dari `batch_analyses` (tak perlu upload ulang). → hemat payload.

## Kondisi native sekarang
- Petugas **single-foto**: `LaporViewModel.photoFile: File?`, satu `previewUri`, SAF `OpenDocument`.
- Belum ada `analyze-batch` / `reports/batch` di `ApiService`.
- Warga punya pola multi (maks 3) tapi submit loop single, bukan batch.

## Rancangan

### DTO/endpoint (B1)
- `core/network/BatchModels.kt`: `AnalyzeBatchResponse`, `BatchAnalysisDto`(=DetectionDto + file_index/severity/exif_*), `StoreBatchResponse`.
- `ApiService`: `analyzeBatch(files[], lat, lng)`, `storeBatch(...)`.

### ViewModel (B2)
Ubah `LaporViewModel` dari single→multi:
- `photos: List<PetugasPhoto>` (`PetugasPhoto(file, uri, lat, lng, detections)`)
- `MAX_PETUGAS_PHOTOS = 10`
- `addPhotos(context, uris)` — validasi EXIF + fallback server per foto, batasi 10, set `fraudAlert` utk foto pertama gagal (pola warga).
- `analyzeBatch()` → isi detections per foto.
- `submitBatch()` → `storeBatch`.
- Simpan kompatibilitas: bila hanya 1 foto → tetap boleh (batch dengan 1 file juga sah).

### Layar (B3)
- `LaporScreen`: picker **multi** (`OpenMultipleDocuments`) + grid thumbnail + counter `n/10` + tombol tambah/hapus.
- `AiResultScreen`: tampilkan **galeri per-foto** (foto + bbox overlay + deteksi) + form dimensi.
  Catatan: backend batch butuh `kerusakan_panjang[]`/`lebar[]` **per foto** → form dimensi per foto.
- Autofill reverse-geocode: pakai GPS foto **pertama** (pola warga).

### Navigasi (B4)
Tetap `LAPOR → AI_RESULT`; `MainActivity` tak perlu state baru (cukup VM).

## Fase eksekusi
| Fase | Isi |
|---|---|
| **B1** | DTO + `ApiService.analyzeBatch/storeBatch` + `ReportRepository` |
| **B2** | `LaporViewModel` multi-foto (state, addPhotos, analyzeBatch, submitBatch, batas 10) |
| **B3** | `LaporScreen` picker multi + grid + counter 10 |
| **B4** | `AiResultScreen` galeri per-foto + form dimensi per foto |
| **B5** | build + verifikasi ad-hoc |

## Risiko
1. **Payload besar** (10×~1MB) → endpoint batch memang dirancang utk ini (analisis disimpan server-side).
2. **Form dimensi per-foto** menambah kompleksitas UI — ikuti web (grid panjang/lebar per foto).
3. **EXIF per foto**: server validasi tanggal; native fallback GPS per foto.
4. **Kompatibilitas**: jalur single (`/analyze` + `/reports`) tetap dipakai bila 1 foto? → usulan: SELALU batch (1 file pun lewat batch) agar satu jalur. *Perlu konfirmasi.*

## Keputusan
- Batas keras **10** (client). Backend izinkan 20 → aman.
- Kecamatan terkunci bila dari sesi patroli (sudah ada).
