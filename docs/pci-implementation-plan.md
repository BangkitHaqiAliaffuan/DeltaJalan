# Rencana Implementasi PCI (Pavement Condition Index) Otomatis

**Proyek:** DeltaJalan / JalanKita — Dinas PU Bina Marga Kabupaten Sidoarjo  
**Dokumen:** v1.0 — 20 Juli 2026  
**Status:** Draf Perencanaan

---

## Daftar Isi

1. [Latar Belakang](#1-latar-belakang)
2. [Apa itu PCI](#2-apa-itu-pci)
3. [Tujuan](#3-tujuan)
4. [Data yang Sudah Tersedia](#4-data-yang-sudah-tersedia)
5. [Arsitektur PCI DeltaJalan](#5-arsitektur-pci-deltajalan)
6. [Perubahan yang Diperlukan](#6-perubahan-yang-diperlukan)
   - [A. Database](#a-database)
   - [B. Backend — Service Baru](#b-backend--service-baru)
   - [C. Backend — Controller Integration](#c-backend--controller-integration)
   - [D. API Endpoints Baru](#d-api-endpoints-baru)
   - [E. Artisan Command — Backfill](#e-artisan-command--backfill)
   - [F. Frontend](#f-frontend)
   - [G. Tidak Perlu Diubah](#g-tidak-perlu-diubah)
7. [Flow Perhitungan PCI](#7-flow-perhitungan-pci)
8. [Manfaat untuk Dinas PU Bina Marga](#8-manfaat-untuk-dinas-pu-bina-marga)
9. [Roadmap Implementasi](#9-roadmap-implementasi)
10. [Risiko dan Mitigasi](#10-risiko-dan-mitigasi)

---

## 1. Latar Belakang

Dinas PU Bina Marga Kabupaten Sidoarjo saat ini mengelola pemeliharaan jalan
kabupaten melalui sistem DeltaJalan. AI yang sudah berjalan mampu mendeteksi
4 jenis kerusakan (Lubang, Retak Kulit Buaya, Retak Memanjang, Retak Melintang)
dengan 4 tingkat severity (Baik, Rusak Ringan, Rusak Sedang, Rusak Berat).

Namun, output AI saat ini hanya berupa label kualitatif. Untuk perencanaan
anggaran dan prioritisasi pemeliharaan, diperlukan **indikator kuantitatif**
yang terstandarisasi secara nasional. PCI (Pavement Condition Index) adalah
standar yang digunakan oleh Direktorat Jenderal Bina Marga dalam pedoman
**09/P/BM/2024** tentang pemanfaatan AI untuk pemantauan kondisi permukaan
jalan.

Saat ini Bina Marga melakukan survey manual 2 kali setahun untuk mendapatkan
data PCI g keperluan programming anggaran. Dengan otomatisasi PCI dari
DeltaJalan, data bisa tersedia secara real-time, objektif, dan lebih granular.

---

## 2. Apa itu PCI

PCI adalah indeks numerik 0–100 yang mengukur kondisi perkerasan jalan,
distandarisasi oleh ASTM D6433.

### Skala Kondisi PCI

| Rentang | Kondisi | Warna Indikator |
|---------|---------|-----------------|
| 86–100  | Baik (Excellent) | Hijau tua |
| 71–85   | Rusak Ringan (Good) | Hijau muda |
| 56–70   | Rusak Sedang (Fair) | Kuning |
| 41–55   | Rusak Sedang (Poor) | Oranye |
| 26–40   | Rusak Berat (Very Poor) | Merah |
| 0–25    | Rusak Berat (Failed) | Merah tua |

### Perhitungan PCI Standar (ASTM D6433)

1. **Survey** perkerasan per segmen jalan
2. Hitung **density** per jenis kerusakan per severity:
   - `density = (luas kerusakan × 100) / luas segmen`
3. Ambil **Deduct Value (DV)** dari kurva standar tiap jenis + severity
4. Hitung **Total Deduct Value (TDV)**
5. Koreksi untuk multiple distress → **Corrected Deduct Value (CDV)**
6. **PCI = 100 − CDV**

### Adaptasi untuk DeltaJalan

Karena laporan DeltaJalan berasal dari foto titik kerusakan (bukan survey
segmen), perhitungan PCI diadaptasi menggunakan data yang tersedia:

- **Density** dihitung dari **coverage bounding box** terhadap luas gambar
  (koordinat normalized 0-1), bukan luas fisik
- **Deduct Value** diganti dengan bobot langsung dari `severity_score`
- Hasilnya adalah **PCI per-titik laporan**, bukan per segmen utuh

Ini memberikan gambaran kondisi yang cukup akurat untuk prioritisasi dan
trend analysis, meskipun tidak setara dengan PCI survey formal ASTM.

---

## 3. Tujuan

1. **Menghitung PCI otomatis** untuk setiap laporan yang sudah dianalisis AI
2. **Menyediakan data agregat** PCI per kecamatan, per status jalan, per wilayah
3. **Heatmap visual** kondisi jalan di peta Sidoarjo
4. **Trend analysis** — bagaimana kondisi jalan berubah dari waktu ke waktu
5. **Decision support** — prioritisasi perbaikan berdasarkan skor kuantitatif

---

## 4. Data yang Sudah Tersedia

### Dari AI Lambda (handler.py)

| Data | Tipe | Sumber | Status |
|------|------|--------|--------|
| `severity_score` | float 0.0–4.0 | `compute_severity_new()` | ✅ Ada di `ai_raw_output` |
| `detections[]` | array | Output ONNX + WBF | ✅ Ada di `ai_raw_output` |
| `-- class` | string | 4 class labels | ✅ |
| `-- severity` | string | Baik/Ringan/Sedang/Berat | ✅ |
| `-- confidence` | float 0-1 | Model confidence | ✅ |
| `-- bbox {x1,y1,x2,y2}` | float 0-1 | Normalized coordinates | ✅ |
| `-- area_px` | int | Pixel area (scaled) | ✅ |
| `coverage` | float 0-1 | `total_area / (w * h)` | ✅ Dihitung di Lambda |
| `max_area_ratio` | float 0-1 | Bbox terbesar relatif ke gambar | ✅ Dihitung di Lambda |
| `total` | int | Jumlah deteksi | ✅ Juga di kolom `total_detections` |
| `overall_severity` | enum | 4 level | ✅ Juga di kolom sendiri |

### Dari Database (tabel reports)

| Kolom | Tipe | Untuk PCI |
|-------|------|-----------|
| `ai_raw_output` | jsonb | ✅ Sumber utama — mengandung severity_score + detections |
| `total_detections` | integer | ✅ Jumlah bounding box |
| `overall_severity` | severity_enum | ✅ Cross-check |
| `severity_score` | — | ❌ **Tidak ada kolom khusus** — hanya di dalam JSONB |

### Celah Data

| Data | Ada? | Dampak |
|------|------|--------|
| Luas fisik kerusakan (m²) | ❌ | Tidak bisa hitung density ASTM murni |
| Ukuran gambar asli (px) | ❌ | Tidak bisa hitung coverage ratio dari penyimpanan — **tapi** bounding box normalized sudah cukup |
| Road segment boundaries | ❌ | Tidak bisa agregasi per segmen jalan — agregasi per kecamatan sebagai gantinya |

---

## 5. Arsitektur PCI DeltaJalan

```
[AI Lambda]
  │  Response: severity_score, detections[], coverage
  ▼
[Laravel Controller]
  │  Saat simpan laporan: hitung PCI via PciService
  │  Simpan pci_score + pci_calculated_at di reports
  ▼
[(New) PciService.php]
  │  calculateReportPci(ai_raw_output) → float|null
  │  Formula: 100 - (severity + coverage + count + diversity)
  ▼
[(New) API Endpoints]
  │  /api/pci/overview      → agregat per kecamatan
  │  /api/pci/trend         → tren per jalan
  │  /api/pci/reports       → daftar laporan dengan PCI
  ▼
[Frontend]
  │  Map heatmap layer
  │  Report detail → tampilkan PCI
  │  Dashboard → statistik PCI
```

### Formula PCI per Laporan

```
severityDeduction  = (severityScore / 4.0) × 50     // 0–50 poin
coverageDeduction  = min(coverageRatio × 100, 30)   // 0–30 poin
countDeduction     = min(totalDetections × 2, 10)   // 0–10 poin
diversityDeduction = min(uniqueClasses × 5, 10)     // 0–10 poin

pci = max(0, 100 - (severityDeduction + coverageDeduction + countDeduction + diversityDeduction))
```

**Contoh kasus:**
```
severityScore = 2.5, totalDetections = 4, coverageRatio = 0.18, 3 class unik

severityDeduction  = (2.5/4) × 50  = 31.25
coverageDeduction  = min(0.18 × 100, 30) = 18
countDeduction     = min(4 × 2, 10) = 8
diversityDeduction = min(3 × 5, 10) = 10

pci = 100 - (31.25 + 18 + 8 + 10) = 32.75  → "Rusak Berat"
```

---

## 6. Perubahan yang Diperlukan

### A. Database

**Migration 1: `add_pci_to_reports.php`**

```php
Schema::table('reports', function (Blueprint $table) {
    $table->decimal('pci_score', 5, 2)->nullable()->after('ai_analysis_count');
    $table->timestamp('pci_calculated_at')->nullable()->after('pci_score');
});
```

**Migration 2: (opsional) `add_pci_to_report_photos.php`**  
Untuk menyimpan PCI per-foto jika ingin granularitas lebih tinggi.

```php
Schema::table('report_photos', function (Blueprint $table) {
    $table->decimal('pci_score', 5, 2)->nullable()->after('ai_analysis_count');
    $table->timestamp('pci_calculated_at')->nullable()->after('pci_score');
});
```

**Catatan:**
- Kedua kolom nullable → backward compatible
- Tidak ada perubahan ENUM atau constraint
- `pci_score` disimpan sebagai `decimal(5,2)` → range 0.00–100.00

### B. Backend — Service Baru

**File: `app/Services/PciService.php`**

```php
<?php

namespace App\Services;

use App\Models\Report;

class PciService
{
    /**
     * Hitung PCI untuk satu laporan dari ai_raw_output.
     * Mengembalikan float 0-100 atau null jika data tidak tersedia.
     */
    public function calculateReportPci(Report $report): ?float
    {
        $raw = $report->ai_raw_output;

        if (! $raw || ! isset($raw['severity_score'])) {
            return null;
        }

        $severityScore = (float) $raw['severity_score'];
        $detections = $raw['detections'] ?? [];
        $total = $report->total_detections ?? count($detections);

        if ($total === 0) {
            return 100.00; // tidak ada kerusakan
        }

        // 1. Severity deduction — dari severity_score
        $severityDeduction = ($severityScore / 4.0) * 50;

        // 2. Coverage deduction — dari bounding box normalized
        $coverageRatio = $this->calcCoverageRatio($detections);
        $coverageDeduction = min($coverageRatio * 100, 30);

        // 3. Count deduction — semakin banyak titik, semakin parah
        $countDeduction = min($total * 2, 10);

        // 4. Diversity deduction — semakin beragam jenis, semakin parah
        $classes = array_unique(array_column($detections, 'class'));
        $diversityDeduction = min(count($classes) * 5, 10);

        $pci = 100 - ($severityDeduction + $coverageDeduction + $countDeduction + $diversityDeduction);

        return round(max(0, $pci), 2);
    }

    /**
     * Hitung coverage ratio dari bounding box normalized.
     * Nilai 0.0 - 1.0.
     */
    private function calcCoverageRatio(array $detections): float
    {
        $total = 0.0;

        foreach ($detections as $d) {
            $b = $d['bbox'] ?? [];
            if (! isset($b['x1'], $b['y1'], $b['x2'], $b['y2'])) {
                continue;
            }
            $width = max(0, $b['x2'] - $b['x1']);
            $height = max(0, $b['y2'] - $b['y1']);
            $total += $width * $height;
        }

        return min($total, 1.0);
    }

    /**
     * Dapatkan label kondisi dari skor PCI.
     */
    public function getConditionLabel(float $pci): string
    {
        return match (true) {
            $pci >= 86 => 'Baik',
            $pci >= 71 => 'Rusak Ringan',
            $pci >= 56 => 'Rusak Sedang',
            $pci >= 41 => 'Rusak Sedang',
            $pci >= 26 => 'Rusak Berat',
            default    => 'Rusak Berat',
        };
    }

    /**
     * Dapatkan warna indikator untuk skor PCI.
     */
    public function getConditionColor(float $pci): string
    {
        return match (true) {
            $pci >= 86 => '#22c55e',  // green
            $pci >= 71 => '#86efac',  // light green
            $pci >= 56 => '#eab308',  // yellow
            $pci >= 41 => '#f97316',  // orange
            $pci >= 26 => '#ef4444',  // red
            default    => '#991b1b',  // dark red
        };
    }
}
```

### C. Backend — Controller Integration

Tambahkan 1–3 baris di setiap titik di mana AI analysis selesai dan
`ai_raw_output` tersimpan.

**1. `WargaReportController.php` — setelah Report::create() (line ~1014)**

```php
$report = Report::create([...]);

// ── Hitung PCI ──
$pciScore = app(PciService::class)->calculateReportPci($report);
if ($pciScore !== null) {
    $report->updateQuietly([
        'pci_score' => $pciScore,
        'pci_calculated_at' => now(),
    ]);
}
```

**2. `ReportController.php` — di `store()` setelah AI analysis**

Lokasi: setelah `$report->save()` atau setelah penyimpanan `ai_raw_output`.

**3. `ReportController.php` — di `analyzeReport()` (line ~2135)**

Setelah `$report->update(['ai_raw_output' => ...])`.

**4. `ReportController.php` — di `approveAndAssign()`**

Setelah AI analysis selesai dan hasil disimpan.

### D. API Endpoints Baru

**1. `GET /api/pci/overview`**

```php
// PCI per kecamatan
$overview = Report::whereNotNull('pci_score')
    ->select('district', DB::raw('COUNT(*) as total'),
             DB::raw('ROUND(AVG(pci_score), 2) as avg_pci'),
             DB::raw('MIN(pci_score) as min_pci'),
             DB::raw('MAX(pci_score) as max_pci'))
    ->groupBy('district')
    ->orderBy('avg_pci')
    ->get();
```

Response:
```json
{
  "districts": [
    {"district": "Waru", "total": 45, "avg_pci": 38.5, "min_pci": 12.0, "max_pci": 82.0},
    {"district": "Candi", "total": 28, "avg_pci": 72.1, "min_pci": 35.0, "max_pci": 95.0}
  ],
  "kabupaten": {"avg_pci": 62.3, "total_laporan": 312, "kritis": 45}
}
```

**2. `GET /api/pci/trend`**

Query params: `road_name`, `district`, `days` (default 90)

```php
// Tren PCI untuk satu ruas jalan
$trend = Report::where('road_name', $request->road_name)
    ->whereNotNull('pci_score')
    ->where('created_at', '>=', now()->subDays($days))
    ->orderBy('created_at')
    ->get(['pci_score', 'created_at', 'overall_severity']);
```

**3. `GET /api/pci/kritis`**

Menampilkan laporan dengan PCI rendah untuk prioritas.

```php
$kritis = Report::where('pci_score', '<=', 40)
    ->whereNotIn('status', ['Selesai', 'Dibatalkan'])
    ->orderBy('pci_score')
    ->limit(50)
    ->get();
```

### E. Artisan Command — Backfill

**File: `app/Console/Commands/PciRecalculate.php`**

```php
<?php

namespace App\Console\Commands;

use App\Models\Report;
use App\Services\PciService;
use Illuminate\Console\Command;

class PciRecalculate extends Command
{
    protected $signature = 'pci:recalculate {--chunk=100}';
    protected $description = 'Hitung ulang PCI untuk semua laporan yang sudah dianalisis AI';

    public function handle(PciService $pci): void
    {
        $query = Report::whereNotNull('ai_raw_output')
            ->whereNull('pci_score');

        $total = $query->count();
        $bar = $this->output->createProgressBar($total);

        $query->chunk((int) $this->option('chunk'), function ($reports) use ($pci, $bar) {
            foreach ($reports as $report) {
                $score = $pci->calculateReportPci($report);
                if ($score !== null) {
                    $report->updateQuietly([
                        'pci_score' => $score,
                        'pci_calculated_at' => now(),
                    ]);
                }
                $bar->advance();
            }
        });

        $bar->finish();
        $this->newLine();
        $this->info("✅ PCI berhasil dihitung untuk {$total} laporan.");
    }
}
```

Registrasi di `app/Console/Kernel.php`:
```php
protected $commands = [
    \App\Console\Commands\PciRecalculate::class,
];
```

Opsional: cron job untuk update berkala
```php
// app/Console/Kernel.php — schedule
$schedule->command('pci:recalculate --chunk=200')
    ->hourly()
    ->withoutOverlapping();
```

### F. Frontend

Semua perubahan frontend bersifat aditif (tidak mengubah flow existing).

**1. Map View — Layer PCI**

Di komponen Leaflet map yang sudah ada:

```tsx
// Tambah layer overlay: "Kondisi Jalan (PCI)"
// Warms based on pci_score
const pciColor = (score: number) => {
  if (score >= 86) return '#22c55e';
  if (score >= 71) return '#86efac';
  if (score >= 56) return '#eab308';
  if (score >= 41) return '#f97316';
  if (score >= 26) return '#ef4444';
  return '#991b1b';
};

// Circle markers di posisi laporan dengan warna PCI
// Ukuran (radius) berdasarkan severity atau konstan
<CircleMarker
  center={[lat, lng]}
  radius={8}
  pathOptions={{ color: pciColor(pciScore), fillOpacity: 0.7 }}
/>
```

**Layer control:**
- "Semua Laporan" (default)
- "Heatmap PCI" (warna berdasarkan PCI)
- Filter: "Kritis (PCI ≤ 40)" → tampilkan yang merah saja

**2. Report Detail**

Di halaman detail laporan, tambahkan kartu:

```
┌─────────────────────────────┐
│  Kondisi Jalan (PCI)        │
│                             │
│  ●●●●●●●○○○○  32.8          │
│  Rusak Berat                │
│                             │
│  Breakdown:                 │
│  Severity         ██████ 31 │
│  Coverage         ████  18 │
│  Jumlah titik     ██     8 │
│  Keragaman        ██    10 │
└─────────────────────────────┘
```

**3. Dashboard Supervisor**

Di halaman dashboard/statistik yang sudah ada, tambahkan:

```tsx
// Kartu ringkasan PCI
<Card title="Indeks Kondisi Jalan (PCI)">
  <Stat label="Rata-rata Kabupaten" value={avgPci} color={pciColor(avgPci)} />
  <Stat label="Segmen Kritis (PCI ≤ 40)" value={kritisCount} color="red" />
  <Stat label="Kecamatan Terparah" value={worstDistrict} />
</Card>

// Tabel kecamatan
<table>
  <thead>
    <tr><th>Kecamatan</th><th>PCI Rata-rata</th><th>Jumlah</th><th>Kritis</th></tr>
  </thead>
  <tbody>
    {districts.map(d => (
      <tr key={d.district}>
        <td>{d.district}</td>
        <td style={{color: pciColor(d.avg_pci)}}>{d.avg_pci}</td>
        <td>{d.total}</td>
        <td>{d.kritis}</td>
      </tr>
    ))}
  </tbody>
</table>
```

**4. Filter Laporan**

Di halaman daftar laporan (supervisor/petugas):
- Filter: PCI 0-40 (Kritis), 41-70 (Sedang), 71-100 (Baik)
- Sortir: PCI ascending (prioritas)
- Kolom PCI di tabel daftar

### G. Tidak Perlu Diubah

| Komponen | Alasan |
|----------|--------|
| **AI Lambda (handler.py)** | Tidak perlu retrain. Semua data sudah dihasilkan |
| **Model ML** | Tidak perlu tambah class atau ubah arsitektur |
| **Tabel users** | Tidak ada perubahan relasi user |
| **Auth / middleware** | PCI tidak mengubah flow autentikasi |
| **Mobile app** | PCI hanya backend + web frontend (mobile bisa menyusul) |
| **Report form** | Tidak ada input baru untuk pelapor |
| **Existing API response** | Perubahan aditif — tidak ada field yang dihapus/diubah |

---

## 7. Flow Perhitungan PCI

### Flow Laporan Baru

```
[Warga/Petugas submit laporan]
  │
  ▼
[Upload foto + data laporan]
  │
  ▼
[AI Lambda: analyze photo]
  │  → severity_score, detections[], overall_severity
  ▼
[Controller: store report]
  │  1. Report::create(...)
  │  2. Simpan ai_raw_output
  │  3. Panggil PciService::calculateReportPci()
  │  4. Simpan pci_score + pci_calculated_at
  ▼
[Report tersimpan dengan PCI]
```

### Flow Backfill Data Historis

```
[Terminal] php artisan pci:recalculate
  │
  ▼
[Query: reports WHERE ai_raw_output IS NOT NULL AND pci_score IS NULL]
  │
  ▼
[Chunk 100 → loop tiap report]
  │  → PciService::calculateReportPci()
  │  → updateQuietly pci_score
  ▼
[Selesai — semua laporan lama punya PCI]
```

---

## 8. Manfaat untuk Dinas PU Bina Marga

### 8.1 Perencanaan Anggaran (Planning & Programming)

**Kondisi sekarang:**
- Survey manual 2x/tahun
- Hasil berupa laporan tebal
- Rapat penentuan anggaran seringkali berdasarkan estimasi subjektif

**Dengan PCI:**
```
Contoh data real-time:

| Kecamatan   | ∑ Laporan | PCI Rata-rata | Segmen Kritis | Estimasi Biaya |
|-------------|-----------|---------------|---------------|-----------------|
| Waru        | 45        | 38.5          | 28            | Rp 1,2 M        |
| Sedati      | 32        | 52.1          | 15            | Rp 750 Jt       |
| Candi       | 28        | 72.1          | 3             | Rp 200 Jt       |
| ...         | ...       | ...           | ...           | ...             |
```

- Data bisa dijadikan lampiran **Nota Dinas** ke Bupati / DPRD
- Bukti kuantitatif untuk **advokasi tambahan anggaran**
- Tidak perlu nunggu survey semesteran

### 8.2 Prioritisasi Satgas

**Kondisi sekarang:**
- Satgas kerja berdasarkan instruksi supervisor
- Prioritas seringkali berdasarkan laporan terbanyak, bukan urgensi teknis

**Dengan PCI:**
```sql
SELECT road_name, district, pci_score
FROM reports
WHERE pci_score <= 40 AND status NOT IN ('Selesai', 'Dibatalkan')
ORDER BY pci_score ASC
LIMIT 10;
```

Supervisor langsung dapat daftar: **"10 prioritas hari ini"**

### 8.3 Monitoring Kinerja Perbaikan

**Kondisi sekarang:**
- Laporan selesai → dianggap selesai
- Kualitas perbaikan tidak terukur

**Dengan PCI:**
```
Jalan Raya Candi:
  ┌─ Sebelum perbaikan: PCI 32  (Rusak Berat)
  ├─ Setelah perbaikan:  PCI 68  (Rusak Sedang)   ↑ +36 ✅
  └─ 3 bulan kemudian:   PCI 55  (Rusak Sedang)   ↓ -13 ⚠️
```

- Perbaikan efektif jika PCI naik signifikan
- Jika PCI cepat turun lagi → kualitas perbaikan kurang atau beban
  lalu lintas terlalu tinggi untuk metode perbaikan yang dipilih

### 8.4 Transparansi & Akuntabilitas

- Skor PCI objektif dari AI — tidak bisa dimanipulasi petugas
- Setiap laporan warga menghasilkan skor yang bisa diverifikasi
- Data bisa diaudit oleh Inspektorat atau BPK
- Masyarakat bisa lihat skor kondisi jalan di wilayahnya

### 8.5 Standar Nasional

Pedoman Bina Marga **09/P/BM/2024** secara eksplisit menyebutkan bahwa AI
untuk pemantauan kondisi jalan harus digunakan untuk:

> "...pemantauan jalan rutin maupun survei PCI (Pavement Condition Index)
> guna keperluan planning and programming."

Implementasi ini menempatkan Dinas PU Bina Marga Kabupaten Sidoarjo sebagai
**pioneer** penerapan amanat pedoman tersebut di tingkat kabupaten.

### 8.6 Dampak Langsung

| Metrik | Sekarang | Dengan PCI |
|--------|----------|------------|
| Frekuensi data kondisi jalan | 2x/tahun | Real-time |
| Objektivitas | Subjektif (petugas) | Objektif (AI) |
| Granularitas | Per segmen survey | Per titik laporan |
| Waktu olah data programming | ~2 minggu | 0 (langsung jadi) |
| Dasar advokasi anggaran | Estimasi verbal | Data kuantitatif |

---

## 9. Roadmap Implementasi

### Tahap 1: Foundation (Hari 1-2)

| Task | File | Estimasi |
|------|------|----------|
| Migration: tambah `pci_score` ke `reports` | `database/migrations/...add_pci_to_reports.php` | 15 menit |
| Service: `PciService.php` | `app/Services/PciService.php` | 1 jam |
| Command: `pci:recalculate` | `app/Console/Commands/PciRecalculate.php` | 30 menit |
| Controller integration: WargaReportController | `app/Http/Controllers/WargaReportController.php` | 15 menit |
| Controller integration: ReportController (3 titik) | `app/Http/Controllers/ReportController.php` | 30 menit |
| Backfill data lama | `php artisan pci:recalculate` | 5 menit |

### Tahap 2: API & Data (Hari 3-4)

| Task | File | Estimasi |
|------|------|----------|
| Endpoint: `GET /api/pci/overview` | Route + Controller baru | 1 jam |
| Endpoint: `GET /api/pci/trend` | Route + Controller baru | 30 menit |
| Endpoint: `GET /api/pci/kritis` | Route + Controller baru | 15 menit |

### Tahap 3: Frontend (Hari 5-7)

| Task | File | Estimasi |
|------|------|----------|
| Map: PCI color layer | Komponen map | 2 jam |
| Report detail: PCI card | Halaman detail laporan | 1 jam |
| Dashboard: PCI stats | Dashboard supervisor | 2 jam |
| Filter: PCI range | Daftar laporan | 1 jam |

### Total Estimasi

**3-5 hari kerja** untuk backend + API.  
**+2-3 hari** untuk frontend.

---

## 10. Risiko dan Mitigasi

### Risiko Teknis

| Risiko | Dampak | Mitigasi |
|--------|--------|----------|
| `ai_raw_output` format tidak konsisten antar controller | PCI gagal dihitung untuk sebagian data | Command `pci:recalculate` skip yang invalid. Format distandarisasi ke depan |
| Coverage dari bbox normalized tidak mewakili coverage fisik | Skor PCI kurang akurat | Validasi dengan 50 sample manual → kalibrasi weight coverage_deduction |
| Foto bukan permukaan jalan (misal: foto jauh) | PCI terlalu rendah karena coverage kecil | Tidak ada mitigasi khusus — laporan sudah melalui MobileCLIP relevance filter |
| Laporan tanpa deteksi (false positif) | PCI yang seharusnya 100 jadi rendah | `total = 0` → return `100.00` (Baik) |
| Banyak data null pci_score setelah backfill | Dashboard kosong | Backfill berurutan per chunk, ada progress bar |

### Risiko Non-Teknis

| Risiko | Mitigasi |
|--------|----------|
| PCI dari foto tidak setara PCI survey formal | Dokumentasikan metodologi perbedaan. Label: "PCI Estimasi (DeltaJalan)" |
| Over-reliance: dinas menganggap ini sama dengan survey ASTM | Edukasi pengguna. PCI DeltaJalan untuk prioritisasi, bukan pengganti survey formal |
| Kecamatan dengan sedikit laporan punya PCI tidak representatif | Tampilkan jumlah sampel. Agregasi hanya jika n >= 5 |

### Keterbatasan yang Didokumentasikan

1. PCI DeltaJalan adalah **PCI estimasi per titik foto**, bukan per segmen
2. Tidak menggantikan survey PCI formal ASTM D6433
3. Coverage dihitung dari bounding box normalized, bukan luas fisik
4. Akurasi bergantung pada kualitas foto yang diupload
5. Kecamatan dengan sedikit sampel mungkin tidak representatif

---

## Lampiran: Perbandingan PCI ASTM vs PCI DeltaJalan

| Aspek | ASTM D6433 | DeltaJalan (Estimasi) |
|-------|-----------|----------------------|
| Unit analisis | Sample unit (segmen 100-500 m²) | Per foto laporan |
| Metode survey | Inspeksi berjalan / kendaraan | Crowdsourced / petugas |
| Density | `(luas kerusakan / luas segmen) × 100` | `coverage_bbox / luas_gambar` (normalized) |
| Deduct Value | Dari kurva standar per jenis+severity | Bobot langsung dari severity_score |
| Koreksi | CDV untuk multiple distress | Implicit via diversity + count penalty |
| Frekuensi | 2x / tahun (semester) | Real-time (setiap laporan) |
| Akurasi | Referensi | ~75-85% dari nilai ASTM (estimasi) |
| Tujuan | Programming anggaran nasional | Prioritisasi + monitoring harian |

Tujuan PCI DeltaJalan bukan menggantikan ASTM, melainkan **menyediakan data
indikatif real-time** di antara siklus survey formal untuk membantu
keputusan operasional sehari-hari.
