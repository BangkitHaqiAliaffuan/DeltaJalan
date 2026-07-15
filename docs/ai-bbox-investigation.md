# Investigasi: Bounding Box AI Tidak Muncul di Detail Report

**Audiens**: Antigravity / technical reviewer
**Konteks**: Saat toggle "Deteksi AI" di halaman detail report, foto yang
ditampilkan tetap sama dengan foto asli — bounding box (bbox) tidak terlihat,
padahal data deteksi (class, confidence, severity) muncul dengan benar di list
deteksi.

---

## 1. Arsitektur Aliran Data AI Detection

```
User upload foto
  ↓
Frontend → POST /api/analyze (Laravel)
  ↓
Laravel → forward ke AWS Lambda Function URL (ONNX runtime)
  ↓
Lambda proses 2 model ONNX:
  1. best.onnx       (~2.9 MB, model utama)
  2. best_stable.onnx (~11 MB, model ensemble)
  ↓
Weighted Box Fusion (WBF) — menggabungkan output 2 model
  ↓
Draw bounding box di atas foto (server-side, OpenCV)
  ↓
Response JSON:
  {
    "detections": [
      {
        "class": "Lubang",
        "bbox": {"x1": 0.45, "y1": 0.32, "x2": 0.62, "y2": 0.48},
        "confidence": 0.87,
        "severity": "Rusak Ringan"
      }
    ],
    "total": 3,
    "image_result": "/9j/4AAQ...base64...",   ← JPEG dengan bbox sudah digambar
    "overall_severity": "Rusak Ringan"
  }
  ↓
Laravel:
  - Simpan ai_raw_output (deteksi metadata)
  - Decode base64 image_result → simpan ke storage
  - Simpan path-nya di kolom image_result_path / image_result_url
  ↓
Frontend detail page:
  - Toggle "Deteksi AI" → load image_result_url
  - Toggle "Asli" → load image_original_url
```

### Key point

Ada **dua representasi** bounding box:

1. **Server-side JPEG** (`image_result` / `image_result_url`):
   Bbox sudah digambar permanen di pixel tertentu oleh OpenCV di Lambda.
   Frontend tinggal nampilin JPEG ini.

2. **Client-side overlay** (`detections[].bbox`):
   Bbox dalam format normalized [0,1] yang bisa di-render ulang sebagai
   `<div>` absolut di atas foto asli. Ini cuma dipakai di `ai-result.tsx`
   (halaman hasil upload, bukan detail report).

---

## 2. Akar Masalah #1: WBF `int()` Truncate (BUG UTAMA)

### Lokasi

`backend_AI/lambda/handler.py:274-277` (sebelum fix):

```python
# ❌ SEBELUM FIX
x1 = int(sum(b[0] * b[4] * b[6] for b in boxes) / total_w)
y1 = int(sum(b[1] * b[4] * b[6] for b in boxes) / total_w)
x2 = int(sum(b[2] * b[4] * b[6] for b in boxes) / total_w)
y2 = int(sum(b[3] * b[4] * b[6] for b in boxes) / total_w)
```

### Kenapa ini salah

- Input ke WBF adalah koordinat **normalized [0, 1]** (bukan pixel).
  Contoh: `0.45, 0.32, 0.62, 0.48` (artinya 45%-62% lebar gambar,
  32%-48% tinggi gambar).
- `int(0.45)` = `0`, `int(0.32)` = `0`, `int(0.62)` = `0`, `int(0.48)` = `0`.
- Semua nilai antara 0 dan 1 (kecuali 1.0 persis) jadi 0 setelah `int()`.
- Akibat: `x1=y1=x2=y2=0` → bbox 0 pixel.

### Dampak ke drawing function

Di `_draw_merged_detections` (handler.py:458-462):

```python
# Scale normalized (0-1) to pixel coordinates for drawing
x1 = int(x1n * w_img)   # x1n = 0 → x1 = 0
y1 = int(y1n * h_img)   # y1n = 0 → y1 = 0
x2 = int(x2n * w_img)   # x2n = 0 → x2 = 0
y2 = int(y2n * h_img)   # y2n = 0 → y2 = 0
```

- `cv2.rectangle(img, (0,0), (0,0), ...)` = rectangle dengan **lebar 0,
  tinggi 0** → tidak terlihat.
- JPEG `image_result` yang disimpan di storage secara visual identik
  dengan foto asli.

### Kenapa `ai-result.tsx` tetap menampilkan bbox dengan benar?

Halaman `ai-result.tsx` (upload flow) punya **fallback client-side overlay**:

```tsx
// ai-result.tsx:220-242
{detections.map((det, i) => (
  <div
    className="absolute border-2 rounded-sm pointer-events-none"
    style={{
      left: `${det.bbox.x1 * 100}%`,
      top: `${det.bbox.y1 * 100}%`,
      width: `${Math.max((det.bbox.x2 - det.bbox.x1) * 100, 1)}%`,
      height: `${Math.max((det.bbox.y2 - det.bbox.y1) * 100, 1)}%`,
    }}
  >
    <span>...</span>
  </div>
))}
```

- Karena `det.bbox = {x1:0, y1:0, x2:0, y2:0}`, nilai `0 * 100% = 0%`.
- Tapi ada `Math.max(..., 1)` yang memastikan **width/height minimal 1%**.
- Jadi meskipun bbox 0 pixel di server, client-side overlay tetap
  menampilkan kotak 1% × 1% di pojok kiri atas — yang mungkin terlihat
  seperti titik kecil, bukan bbox sebenarnya.

> **Catatan**: Sebelum fix, `ai-result.tsx` juga tidak menampilkan bbox yang
> benar (hanya kotak 1% di pojok). Perbedaannya dengan detail page adalah
> bahwa `ai-result.tsx` punya overlay, sedangkan detail page tidak.

### Fix

```python
# ✅ SESUDAH FIX
x1 = sum(b[0] * b[4] * b[6] for b in boxes) / total_w
y1 = sum(b[1] * b[4] * b[6] for b in boxes) / total_w
x2 = sum(b[2] * b[4] * b[6] for b in boxes) / total_w
y2 = sum(b[3] * b[4] * b[6] for b in boxes) / total_w
```

Koordinat tetap dalam float normalized [0,1]. Drawing function di
`_draw_merged_detections` yang bertanggung jawab scaling ke pixel
(line 458-462: `int(x1n * w_img)`) — dan kode drawing ini sudah benar.

### File yang sama di development server

Bug yang identik ada di `backend_AI/server.py:292-295` (FastAPI dev server).
Sudah diperbaiki dengan perubahan yang sama.

---

## 3. Akar Masalah #2: Key Name `total_detections` vs `total`

### Lokasi

`backend_POSTGRESQL/app/Http/Controllers/ReportController.php`

### Sebelum fix

```php
$aiData['total_detections']  // ← key ini TIDAK ADA di response Lambda
```

Lambda response punya struktur:
```json
{
  "total": 3,
  "detections": [...],
  "image_result": "...",
  "overall_severity": "...",
  "status": "success"
}
```

Key `total_detections` tidak pernah dikeluarkan oleh Lambda. Jadi:
- `$aiData['total_detections']` → `null` → `total_detections` di DB = 0.
- Data deteksi yang benar (`$aiData['total']`) tidak pernah dibaca.

### Sesudah fix

```php
$aiData['total']  // ← key yang benar
```

### File yang diperbaiki

| File | Baris |
|---|---|
| `ReportController.php` | 2180, 2189, 2382, 2400 |
| `WargaReportController.php` | 973 (sudah benar sebelumnya) |

---

## 4. Akar Masalah #3: Cache Response Tidak Menyertakan `image_result`

### Lokasi

`backend_AI/lambda/handler.py:601` — cache hit response:

```python
# ❌ SEBELUM FIX
resp = {k: cached[k] for k in (
    "detections", "total", "overall_severity",
    "severity_score", "severity_detail", "status"
)}
# image_result TIDAK termasuk → cache hit return image_result = null
```

### Dampak

- Analisis pertama: `image_result` ada (base64 besar).
- Analisis kedua (cache hit): `image_result = null`.
- Laravel menyimpan `image_result_path = null` karena `image_result` dari
  cache tidak ada.
- Detail page tidak bisa menampilkan toggle Deteksi AI karena
  `image_result_url = null`.

### Sesudah fix

```python
# ✅ SESUDAH FIX
resp = {k: cached[k] for k in (
    "detections", "total", "overall_severity",
    "severity_score", "severity_detail", "status",
    "image_result"  // ← ditambahkan
)}
```

---

## 5. Akar Masalah #4: `image_result_path` Overwrite dengan Null

### Lokasi

`backend_POSTGRESQL/app/Http/Controllers/ReportController.php`

### Sebelum fix

```php
$updateData['image_result_path'] = $resultPath;
```

Ketika AI response `image_result = null` (misalnya dari cache yang belum
diperbaiki, atau error), `$resultPath` jadi `null`, dan kolom
`image_result_path` di DB berubah dari path yang valid menjadi `null`.

### Sesudah fix

```php
$updateData['image_result_path'] = $resultPath ?? $report->image_result_path;
```

Menggunakan null coalescing: jika `$resultPath` null, gak usah overwrite.

---

## 6. Ringkasan Timeline

| Waktu | Kejadian | Dampak |
|---|---|---|
| Sebelum fix | WBF `int()` pada normalized coords | Bbox 0 pixel di JPEG → bbox invisible |
| Sebelum fix | `$aiData['total_detections']` (key salah) | `total_detections` DB selalu 0 |
| Sebelum fix | Cache missing `image_result` | Cache hit kirim null → path di DB di-overwrite null |
| **Fix #1** | Hapus `int()` di WBF | Bbox sekarang digambar di pixel yang benar |
| **Fix #2** | `total_detections` → `total` | Total deteksi sekarang tersimpan dengan benar |
| **Fix #3** | Cache include `image_result` | Cache hit sekarang return base64 JPEG |
| **Fix #4** | `$resultPath ?? $report->image_result_path` | Path tidak di-null-kan oleh response error |

---

## 7. Detail Page vs Upload Page: Perbedaan Arsitektur

### `detail-report.tsx` (halaman detail report)

```
Load photo.image_result_url
  → Tampilkan di <SafeImage>
  → Tidak ada overlay client-side
  → Sepenuhnya bergantung pada kualitas JPEG dari server
```

### `ai-result.tsx` (halaman upload, hasil AI)

```
Coba load displayImage (base64 dari image_result)
  → Jika ada + tidak error: tampilkan JPEG server
  → Jika kosong / error:
      Tampilkan foto asli
      + Overlay <div> untuk setiap bbox (client-side)
```

### Kenapa detail page tidak pakai overlay client-side

Detail page sudah punya foto final (`image_result_url`) dari server.
Idealnya foto ini sudah mengandung bbox. Tidak perlu overlay client-side
karena:

1. Overhead komputasi: parsing `ai_raw_output`, mapping koordinat, render
   ulang.
2. Konsistensi: server yang handle rendering, hasilnya sama di semua
   platform (web, mobile).
3. Cache: JPEG bisa di-cache CDN/browser, sedangkan overlay harus
   di-render tiap kali.

Kelemahannya: kalau server-side rendering error (seperti WBF `int()`),
tidak ada fallback.

---

## 8. File yang Berubah

### Backend AI (Lambda + Dev)

| File | Perubahan |
|---|---|
| `backend_AI/lambda/handler.py:274-277` | Hapus `int()` di WBF |
| `backend_AI/lambda/handler.py:601` | Cache response include `image_result` |
| `backend_AI/server.py:292-295` | Hapus `int()` di WBF (dev server) |

### Backend Laravel

| File | Perubahan |
|---|---|
| `ReportController.php:2180,2189,2382,2400` | `total_detections` → `total` |
| `ReportController.php` (multiple) | `$resultPath ?? $report->image_result_path` |

### Frontend

| File | Perubahan |
|---|---|
| `warga/lapor.tsx:618` | Race condition fix: `{!success && isBlocked ?` |
