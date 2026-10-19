# ANALISIS + PLAN — Error `bbox` (BEGIN_OBJECT) & Penanda Kecamatan Cek Rutin

> Status: **analisis selesai; planning komprehensif; belum dieksekusi**.
> Dua masalah: (A) crash parsing `$$.detections[0].bbox`; (B) penanda kecamatan cek rutin belum lengkap.

---

## BAGIAN A — Error `expected BEGIN_ARRAY but was BEGIN_OBJECT at $$.detections[0].bbox`

### A.1 Akar masalah (terverifikasi baris-per-baris)

Rantai data saat petugas menekan **"Analisis Foto"**:

```
FastAPI /analyze  →  ReportController::analyze()  →  ApiService.analyze()
   bbox: {x1,y1,x2,y2}      (TANPA transformasi)        AnalyzeResponse.detections
                                                          bbox: List<Double>  ← MISMATCH
```

**Bukti 1 — FastAPI mengirim bbox OBJEK** (`backend_AI/server.py:513`):
```python
detections.append({
    "class": name, "severity": sev, "confidence": round(conf,3),
    "confidence_pct": f"{conf:.0%}",
    "bbox": {"x1": x1, "y1": y1, "x2": x2, "y2": y2},   # ← OBJEK
    "area_px": area_px,
})
```

**Bukti 2 — `ReportController::analyze()` mengembalikan mentah** (`ReportController.php:104-107`):
```php
$aiData = $this->callFastApiAnalyze(...);
if ($aiData['success']) {
    return response()->json($aiData['data'], 200);   // apa adanya, TANPA konversi bbox
}
```
`callFastApiAnalyze()` (`:1389-1447`) juga tidak menyentuh `bbox`.

**Bukti 3 — DTO native mengharapkan ARRAY** (`Models.kt:118-124`):
```kotlin
data class DetectionDto(
    @Json(name="type") val type: String? = null,
    @Json(name="class") val className: String? = null,
    val severity: String? = null,
    val confidence: Double? = null,
    val bbox: List<Double>? = null,   // ← ARRAY
)
```
Moshi (`AnalyzeResponse.detections[0].bbox`) → **`expected BEGIN_ARRAY but was BEGIN_OBJECT`**.

### A.2 Kenapa AIController batch TIDAK kena (inkonsistensi backend)

`AIController::analyzeBatch` (`:191-197`) sudah mengonversi:
```php
'bbox' => isset($d['bbox']) ? [$d['bbox']['x1'], $d['bbox']['y1'], $d['bbox']['x2'], $d['bbox']['y2']] : [],
```
→ **Hanya `ReportController::analyze` (single, endpoint `/api/analyze`) yang belum dikonversi.**
Inkonsistensi ini murni backend, tapi **aturan repo: jangan ubah backend** → perbaikan di native.

### A.3 Kenapa warga tidak kena

`grep` membuktikan `WargaLaporViewModel`/`WargaRepository` **tidak** memakai `AnalyzeResponse`
atau parse `detections`. Warga mengirim foto langsung untuk dianalisis server-side.
→ Bug ini **eksklusif alur petugas** (satu-satunya yang mem-parse `AnalyzeResponse.detections`).

### A.4 Dampak sekunder (ditemukan saat analisis)

Response FastAPI punya `class` (bukan `type`) + `confidence_pct` + `area_px`:
- `DetectionDto.type` **selalu null** (FastAPI tak kirim `type`) → sebaiknya fallback `class`.
- `confidence_pct`/`area_px` diabaikan Moshi (aman, tanpa `failOnUnknown`).
- Saat submit, native **menyerialkan ulang** `detections` (ReportRepository:81) jadi `ai_raw_output`
  dgn bentuk `bbox` array — konsisten dgn yg diharapkan backend PciService (`bbox['x1']`)?? **TIDAK**:
  PciService membaca `bbox['x1']` (objek). Perlu dicek: apakah `ai_raw_output` dari native (bbox array)
  merusak PciService. → **lihat A.5**.

### A.5 Temuan tambahan — TERVERIFIKASI (bug kedua, nyata)

`PciService::coverageDeduction` (`:113-120`):
```php
$bbox = $d['bbox'] ?? null;
$w = ($bbox['x2'] ?? 0) - ($bbox['x1'] ?? 0);   // ← mengharapkan OBJEK
$h = ($bbox['y2'] ?? 0) - ($bbox['y1'] ?? 0);
$totalArea += max(0, $w * $h);
```
`PciService::calculateFromReport` (`:...`) membaca `$report->ai_raw_output` lalu memanggil `coverageDeduction`.
Native **menyerialkan ulang** detections (`ReportRepository.kt:81` `detectionsAdapter.toJson`)
dengan `bbox` **array** → `$bbox['x1']` = null → `w=0, h=0` → **coverage 0 → PCI salah** saat
laporan petugas disimpan. **Bug kedua yang tersembunyi di balik crash bbox.**

→ Jadi perbaikan HARUS: parse bbox objek/array (A-a) **DAN** saat serialize `ai_raw_output`
kembalikan `bbox` sebagai **objek** `{x1,y1,x2,y2}` agar `PciService` benar.

### A.6 Opsi perbaikan (native, tanpa ubah backend)

| Opsi | Cara | Catatan |
|---|---|---|
| **A-a** | Tambah **custom Moshi adapter** `BboxAdapter` yang menerima objek `{x1..}` ATAU array | Paling tahan-banting; 1 titik |
| **A-b** | Ubah `bbox: List<Double>?` → `Any?` lalu normalisasi di pemakaian | Kalah type-safe |
| **A-c** | `DetectionDto` punya 2 field: `bbox_obj: BboxObj?` + `bbox: List<Double>?` | Berisik |

**Rekomendasi: A-a** — adapter `BboxAdapter` menerima kedua bentuk, selalu keluar `List<Double>?`.
Plus: `type` fallback ke `class`; **dan** saat serialize `ai_raw_output`, **kembalikan ke bentuk objek**
`{x1,y1,x2,y2}` (agar `PciService` benar) — perlu adapter serialize khusus (fase R1).

---

## BAGIAN B — Penanda kecamatan "sedang cek rutin" belum lengkap

### B.1 Di mana kecamatan ditampilkan SAAT INI (native)

| Layar | File | Status |
|---|---|---|
| Daftar sesi (tab Tugas) | `Tabs.kt` `PatrolSessionRow` | ✅ tampil "Kec. X" |
| Detail sesi | `PatrolSessionScreen.kt:138` | ✅ `InfoRow(Map, "Kec. X")` |
| **Pilih foto** | `LaporScreen.kt` `PatrolContextBanner` | ✅ banner + Kec. (baru saya tambah) |
| **Form + submit** | `AiResultScreen.kt` | ❌ **TIDAK ADA** — hanya `KecamatanDropdown` biasa |

**Kesimpulan B.1:** layar yang **menjelaskan kecamatan cek rutin saat laporan dibuat** = 
`PatrolSessionScreen` (detail sesi) + banner `LaporScreen`. Tapi **`AiResultScreen`** — layar
terakhir sebelum submit, tempat kecamatan dikonfirmasi — **belum menampilkan** konteks sesi.
Inilah "component yang menjelaskan kecamatan yang sedang dicek rutin lalu dibuat laporannya" yang kurang.

### B.2 Yang dilakukan web (referensi)

Web `upload.tsx` menampilkan banner **"Upload laporan untuk: {road_name} / Kec. {kecamatan}"**
di **3 tahap** alur `taskId`: pilih foto (`:1136`), preview batch (`:907`), form+submit (`:1041`).
Native baru meniru tahap 1 (`LaporScreen`) — belum tahap form (`AiResultScreen`).

### B.3 Perbaikan

- `AiResultScreen`: bila `vm.surveyTaskId != null`, tampilkan banner konteks sesi
  (reuse `PatrolContextBanner` → pindah ke komponen bersama `ui/components`).
- Kunci `KecamatanDropdown` ke kecamatan sesi (prefill sudah dilakukan VM) + beri label
  "Dari sesi patroli" agar petugas tahu kecamatan tak boleh diubah bebas.
  *(Web mengunci `kecamatan = activeTask.kecamatan`; native saat ini masih bisa diubah.)*

---

## C. RENCANA EKSEKUSI

| Fase | Isi | Verifikasi |
|---|---|---|
| **R0** | Verifikasi `PciService` + `store` menerima bentuk `bbox` apa utk `ai_raw_output` | baca kode |
| **R1** | `BboxAdapter` (Moshi) — parse objek/array → `List<Double>`; serialize → **objek** (utk PciService) | compile + unit-ish |
| **R2** | `DetectionDto.type` fallback ke `class`; daftar deteksi di `AiResultScreen`/ringkasan aman | compile |
| **R3** | Pindahkan `PatrolContextBanner` ke `ui/components`; pakai di `AiResultScreen` | compile |
| **R4** | Kunci `KecamatanDropdown` dari sesi + label "Dari sesi patroli" | compile |
| **R5** | `assembleDebug` + verifikasi ad-hoc + (izin) uji device | build hijau |

## D. RISIKO

1. **Mengubah bentuk `ai_raw_output`** bisa memengaruhi `PciService` (score) → R0 wajib dulu.
2. Kunci kecamatan bisa membingungkan bila sesi multi-kecamatan → tampilkan sebagai info + tetap non-editabel.
3. Adapter baru harus **tidak** meregresi jalur `analyzeBatch` (bbox sudah array) → adapter terima keduanya.

## E. Pertanyaan konfirmasi
1. `ai_raw_output`: kirim `bbox` **objek** (agar PciService benar) atau array (format native sekarang)?
   → default usulan: **objek** (samakan dgn ekspektasi PciService).
2. Kecamatan di `AiResultScreen`: **dikunci** (ikut web) atau tetap bisa diubah?
   → default usulan: **dikunci + label** saat dari sesi.
