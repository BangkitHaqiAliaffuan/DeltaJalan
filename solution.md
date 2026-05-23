## BACA INI DULU SEBELUM MODIFIKASI APA PUN

Kamu sedang memodifikasi **JalanKita**, web app internal pelaporan
jalan rusak untuk **Dinas PU Bina Marga Kabupaten Sidoarjo**.

Stack teknis:
- Frontend  : React + TypeScript
- Backend   : Laravel PHP (REST API)
- AI Server : YOLOv8 (deteksi kerusakan + severity)
- Database  : MySQL
- Peta      : LocationIQ / Nominatim OpenStreetMap

Pengguna aplikasi (hanya tiga role, tidak ada role publik/warga):
- petugas    : Patroli lapangan, upload foto batch, input laporan
- supervisor : Review laporan, approve / tolak / disposisi
- admin      : Kelola data master (user, ruas jalan)

Prinsip yang tidak boleh dilanggar:
- Jangan hard-block laporan — gunakan trust score sebagai triase, bukan gatekeeper
- Jangan ubah struktur tabel yang sudah ada kecuali instruksi eksplisit
- Semua validasi kritis WAJIB ada di backend — frontend hanya UX layer
- Supervisor adalah pengambil keputusan final, bukan sistem

---

## KONTEKS MASALAH YANG HARUS DISELESAIKAN

### Masalah 1 — Celah Keamanan Input Nama Jalan

Saat ini user bisa ketik nama jalan manual tanpa validasi.
Skenario exploit:
  1. Download foto jalan dari Google Maps (tidak ada EXIF GPS)
  2. Koordinat diambil dari tempat lain / dikarang
  3. Nama jalan diketik manual (misal "Jl. Raya Porong" padahal foto dari tempat lain)
  4. Backend tidak bisa verifikasi karena reverse geocode hanya jalan jika GPS ada

Root cause: autocomplete LocationIQ hanya saran, bukan enforced.
Validasi nama jalan vs koordinat belum ada di backend.

### Masalah 2 — Workflow Upload Tidak Efisien

Saat ini: upload 1 foto → 1 laporan → 1 request AI.
Jika 5 lubang di satu jalan → 5 laporan terpisah, 5 request AI, data terfragmentasi.

Yang dibutuhkan:
  - Upload banyak foto sekaligus (batch, maks 20 foto)
  - Satu request ke AI server untuk semua foto
  - Satu laporan utama + beberapa sub-laporan per foto
  - Severity di-aggregate otomatis dari semua foto

### Masalah 3 — Tidak Ada Sistem Kepercayaan Laporan

Supervisor tidak punya indikator objektif untuk menilai kualitas laporan.
Perlu trust score (0-100) yang dihitung otomatis berdasarkan:
  - Ada tidaknya GPS EXIF (+30 poin)
  - Nama jalan cocok dengan koordinat reverse geocode (+20 poin)
  - AI berhasil mendeteksi kerusakan (+20 poin)
  - Konteks visual valid / ada elemen jalan di foto (+15 poin)
  - Tidak ada indikasi fake GPS (+15 poin)
  
  Threshold label:
  - Hijau  >= 75 : Kredibel, supervisor bisa langsung approve
  - Kuning 45-74 : Perlu review manual
  - Merah  < 45  : Sangat diragukan, notif petugas untuk kirim ulang

---

## DATABASE — MIGRATION YANG HARUS DIJALANKAN PERTAMA

Jalankan migration ini SEBELUM modifikasi kode lain:

```php
Schema::table('reports', function (Blueprint $table) {
    // Batch upload
    $table->uuid('batch_id')->nullable()->index()->after('id');
    $table->boolean('is_batch_main')->default(false)->after('batch_id');
    $table->boolean('is_batch_sub')->default(false)->after('is_batch_main');
    $table->unsignedBigInteger('parent_report_id')->nullable()->after('is_batch_sub');
    $table->foreign('parent_report_id')->references('id')->on('reports')->nullOnDelete();

    // Trust score
    $table->unsignedTinyInteger('trust_score')->default(0)->after('status');
    $table->enum('trust_label', ['hijau', 'kuning', 'merah'])->default('merah')->after('trust_score');
    $table->json('trust_breakdown')->nullable()->after('trust_label');

    // Koordinat source
    $table->enum('koordinat_sumber', ['exif', 'browser_gps', 'manual'])->default('manual');

    // AI results (tambahkan jika belum ada)
    $table->string('ai_jenis_kerusakan')->nullable();
    $table->enum('ai_severity', ['ringan', 'sedang', 'berat'])->nullable();
    $table->decimal('ai_confidence', 4, 3)->nullable();
    $table->string('image_hash', 64)->nullable()->index();
});
```

---

## BACKEND — TASK 1: TrustScoreService (BUAT FILE BARU)

Buat: app/Services/TrustScoreService.php

```php
<?php
namespace App\Services;

class TrustScoreService
{
    public function calculate(array $data): array
    {
        $score = 0;
        $breakdown = [];

        // GPS EXIF tersedia (+30)
        if (!empty($data['exif_lat']) && !empty($data['exif_lng'])) {
            $score += 30;
            $breakdown['exif_gps'] = ['nilai' => 30, 'status' => 'ada'];
        } else {
            $breakdown['exif_gps'] = ['nilai' => 0, 'status' => 'tidak_ada'];
        }

        // Nama jalan cocok dengan reverse geocode (+20)
        if (!empty($data['road_name_matched'])) {
            $score += 20;
            $breakdown['nama_jalan'] = ['nilai' => 20, 'status' => 'cocok'];
        } else {
            $breakdown['nama_jalan'] = ['nilai' => 0, 'status' => 'tidak_cocok'];
        }

        // AI deteksi kerusakan berhasil (+20)
        if (!empty($data['ai_detections']) && count($data['ai_detections']) > 0) {
            $score += 20;
            $breakdown['ai_deteksi'] = ['nilai' => 20, 'status' => 'berhasil'];
        } else {
            $breakdown['ai_deteksi'] = ['nilai' => 0, 'status' => 'gagal'];
        }

        // Konteks visual valid — ada elemen jalan di foto (+15)
        if (!empty($data['ai_context_valid'])) {
            $score += 15;
            $breakdown['konteks_visual'] = ['nilai' => 15, 'status' => 'valid'];
        } else {
            $breakdown['konteks_visual'] = ['nilai' => 0, 'status' => 'tidak_valid'];
        }

        // Tidak ada indikasi fake GPS (+15)
        if (empty($data['fake_gps_suspected'])) {
            $score += 15;
            $breakdown['fake_gps'] = ['nilai' => 15, 'status' => 'aman'];
        } else {
            $breakdown['fake_gps'] = ['nilai' => 0, 'status' => 'dicurigai'];
        }

        $label = match(true) {
            $score >= 75 => 'hijau',
            $score >= 45 => 'kuning',
            default      => 'merah',
        };

        return ['score' => $score, 'label' => $label, 'breakdown' => $breakdown];
    }
}
```

---

## BACKEND — TASK 2: Validasi Nama Jalan vs Koordinat

Tambahkan dua method ini ke ReportController yang sudah ada.
Jangan hapus method yang sudah ada.

```php
private function validateRoadNameVsCoordinate(string $namaJalan, float $lat, float $lng): array
{
    try {
        $response = Http::timeout(5)->get('https://us1.locationiq.com/v1/reverse', [
            'key'    => config('services.locationiq.key'),
            'lat'    => $lat,
            'lon'    => $lng,
            'format' => 'json',
        ]);

        if (!$response->ok()) {
            // LocationIQ tidak tersedia — jangan block laporan, catat saja
            return ['matched' => false, 'reason' => 'locationiq_unavailable'];
        }

        $data = $response->json();
        $geocodedRoad = $data['address']['road']
            ?? $data['address']['residential']
            ?? $data['display_name']
            ?? '';

        similar_text(strtolower(trim($namaJalan)), strtolower(trim($geocodedRoad)), $percent);

        return [
            'matched'       => $percent >= 80,
            'similarity'    => round($percent, 1),
            'geocoded_road' => $geocodedRoad,
            'reason'        => $percent >= 80 ? 'ok' : 'mismatch',
        ];
    } catch (\Exception $e) {
        return ['matched' => false, 'reason' => 'exception'];
    }
}

private function aggregateSeverity(array $severities): string
{
    $order = ['berat' => 3, 'sedang' => 2, 'ringan' => 1];
    $max = 0; $result = 'ringan';
    foreach ($severities as $s) {
        $val = $order[strtolower($s)] ?? 0;
        if ($val > $max) { $max = $val; $result = strtolower($s); }
    }
    return $result;
}
```

---

## BACKEND — TASK 3: Endpoint Batch Analysis

Tambahkan route baru ke api.php (jangan hapus route lama):

```php
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/analyze-batch',         [AIController::class,     'analyzeBatch']);
    Route::post('/reports/batch',         [ReportController::class, 'storeBatch']);
    Route::post('/reports/check-duplicate', [ReportController::class, 'checkDuplicate']);
});
```

Tambahkan method analyzeBatch ke AIController yang sudah ada:

```php
public function analyzeBatch(Request $request)
{
    $request->validate([
        'files'     => 'required|array|min:1|max:20',
        'files.*'   => 'required|file|mimes:jpeg,jpg,png|max:5120',
        'latitude'  => 'required|numeric|between:-11,6',
        'longitude' => 'required|numeric|between:95,141',
    ]);

    $batchId = (string) Str::uuid();
    $analyses = [];

    foreach ($request->file('files') as $idx => $file) {
        try {
            // Gunakan method sendToAIServer yang sudah ada
            $aiResult = $this->sendToAIServer($file);
            $analyses[] = [
                'file_index'    => $idx,
                'file_name'     => $file->getClientOriginalName(),
                'detections'    => $aiResult['detections']    ?? [],
                'severity'      => $aiResult['severity']      ?? 'ringan',
                'context_valid' => $aiResult['context_valid'] ?? true,
                'confidence'    => $aiResult['confidence']    ?? 0.0,
            ];
        } catch (\Exception $e) {
            // Jangan gagalkan seluruh batch karena satu foto error
            $analyses[] = [
                'file_index' => $idx,
                'file_name'  => $file->getClientOriginalName(),
                'detections' => [], 'severity' => 'ringan',
                'context_valid' => false, 'error' => $e->getMessage(),
            ];
        }
    }

    return response()->json([
        'batch_id'    => $batchId,
        'total_files' => count($analyses),
        'analyses'    => $analyses,
        'latitude'    => $request->latitude,
        'longitude'   => $request->longitude,
    ]);
}
```

---

## BACKEND — TASK 4: storeBatch di ReportController

Tambahkan method storeBatch ke ReportController yang sudah ada:

```php
public function storeBatch(Request $request)
{
    $validated = $request->validate([
        'batch_id'                 => 'required|uuid',
        'road_name'                => 'required|string|max:255',
        'district'                 => 'required|string|max:255',
        'latitude'                 => 'required|numeric',
        'longitude'                => 'required|numeric',
        'koordinat_sumber'         => 'required|in:exif,browser_gps,manual',
        'fake_gps_suspected'       => 'boolean',
        'analyses'                 => 'required|json',
        'files'                    => 'required|array|min:1',
        'files.*'                  => 'required|file|mimes:jpeg,jpg,png|max:5120',
    ]);

    $analyses = json_decode($validated['analyses'], true);

    // Validasi nama jalan vs koordinat (tidak bisa di-bypass dari frontend)
    $roadValidation = $this->validateRoadNameVsCoordinate(
        $validated['road_name'],
        $validated['latitude'],
        $validated['longitude']
    );

    // Hitung trust score
    $firstAnalysis = $analyses[0] ?? [];
    $trustResult = app(\App\Services\TrustScoreService::class)->calculate([
        'exif_lat'           => $validated['koordinat_sumber'] === 'exif' ? $validated['latitude']  : null,
        'exif_lng'           => $validated['koordinat_sumber'] === 'exif' ? $validated['longitude'] : null,
        'road_name_matched'  => $roadValidation['matched'],
        'ai_detections'      => $firstAnalysis['detections']    ?? [],
        'ai_context_valid'   => $firstAnalysis['context_valid'] ?? false,
        'fake_gps_suspected' => $validated['fake_gps_suspected'] ?? false,
    ]);

    // Buat laporan utama
    $severities = array_column($analyses, 'severity');
    $mainReport = Report::create([
        'report_code'      => $this->generateReportCode(),
        'road_name'        => $validated['road_name'],
        'district'         => $validated['district'],
        'latitude'         => $validated['latitude'],
        'longitude'        => $validated['longitude'],
        'koordinat_sumber' => $validated['koordinat_sumber'],
        'status'           => 'menunggu_review',
        'batch_id'         => $validated['batch_id'],
        'is_batch_main'    => true,
        'trust_score'      => $trustResult['score'],
        'trust_label'      => $trustResult['label'],
        'trust_breakdown'  => $trustResult['breakdown'],
        'ai_severity'      => $this->aggregateSeverity($severities),
        'user_id'          => auth()->id(),
    ]);

    // Buat sub-laporan per foto
    foreach ($analyses as $idx => $analysis) {
        $file      = $request->file('files')[$idx] ?? null;
        $photoPath = $file ? $file->store('reports', 'public') : null;
        $imageHash = $file ? hash_file('sha256', $file->getRealPath()) : null;

        Report::create([
            'report_code'        => $this->generateReportCode(),
            'road_name'          => $validated['road_name'],
            'district'           => $validated['district'],
            'latitude'           => $validated['latitude'],
            'longitude'          => $validated['longitude'],
            'koordinat_sumber'   => $validated['koordinat_sumber'],
            'status'             => 'menunggu_review',
            'batch_id'           => $validated['batch_id'],
            'is_batch_sub'       => true,
            'parent_report_id'   => $mainReport->id,
            'trust_score'        => $trustResult['score'],
            'trust_label'        => $trustResult['label'],
            'ai_jenis_kerusakan' => $analysis['detections'][0]['type'] ?? null,
            'ai_severity'        => $analysis['severity'],
            'ai_confidence'      => $analysis['confidence'] ?? null,
            'image_path'         => $photoPath,
            'image_hash'         => $imageHash,
            'user_id'            => auth()->id(),
        ]);
    }

    return response()->json([
        'success'           => true,
        'main_report_id'    => $mainReport->id,
        'main_report_code'  => $mainReport->report_code,
        'sub_reports_count' => count($analyses),
        'trust_score'       => $trustResult['score'],
        'trust_label'       => $trustResult['label'],
        'overall_severity'  => $mainReport->ai_severity,
        'road_matched'      => $roadValidation['matched'],
    ], 201);
}
```

---

## FRONTEND — TASK 1: Types (BUAT FILE BARU)

Buat: src/types/laporan.ts

```typescript
export type StatusLaporan =
  | 'draft' | 'menunggu_validasi' | 'menunggu_review'
  | 'disetujui' | 'ditolak' | 'dalam_pengerjaan' | 'selesai';

export type TrustLabel      = 'hijau' | 'kuning' | 'merah';
export type KoordinatSumber = 'exif' | 'browser_gps' | 'manual';
export type SeverityLevel   = 'ringan' | 'sedang' | 'berat';

export interface TrustBreakdown {
  exif_gps:       { nilai: number; status: 'ada' | 'tidak_ada' };
  nama_jalan:     { nilai: number; status: 'cocok' | 'tidak_cocok' };
  ai_deteksi:     { nilai: number; status: 'berhasil' | 'gagal' };
  konteks_visual: { nilai: number; status: 'valid' | 'tidak_valid' };
  fake_gps:       { nilai: number; status: 'aman' | 'dicurigai' };
}

export interface AIAnalysisResult {
  file_index:    number;
  file_name:     string;
  detections:    { type: string; confidence: number; bbox: number[] }[];
  severity:      SeverityLevel;
  context_valid: boolean;
  confidence:    number;
  error?:        string;
}

export interface BatchAnalysisResponse {
  batch_id:    string;
  total_files: number;
  analyses:    AIAnalysisResult[];
  latitude:    number;
  longitude:   number;
}
```

---

## FRONTEND — TASK 2: Hook GPS dengan Deteksi Fake GPS (BUAT FILE BARU)

Buat: src/hooks/useGPS.ts

```typescript
import { useState, useEffect, useRef } from 'react';

export type GPSStatus = 'idle' | 'waiting' | 'active' | 'error' | 'denied';

export interface GPSData {
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  status: GPSStatus;
  koordinat_sumber: 'browser_gps' | 'manual';
  fake_gps_suspected: boolean;
  fake_gps_reasons: string[];
}

export function useGPS() {
  const [gps, setGPS] = useState<GPSData>({
    lat: null, lng: null, accuracy: null, status: 'idle',
    koordinat_sumber: 'manual', fake_gps_suspected: false, fake_gps_reasons: [],
  });

  const accuracyHistory = useRef<number[]>([]);
  const watchId = useRef<number | null>(null);

  const detectFakeGPS = (pos: GeolocationPosition): string[] => {
    const reasons: string[] = [];
    const acc = pos.coords.accuracy;

    // Akurasi terlalu konstan — indikasi mock location app
    accuracyHistory.current.push(acc);
    if (accuracyHistory.current.length >= 5) {
      const recent = accuracyHistory.current.slice(-5);
      const spread = Math.max(...recent) - Math.min(...recent);
      if (spread < 0.5) reasons.push('akurasi_terlalu_konstan');
    }

    // Akurasi < 1 meter tidak wajar untuk GPS biasa
    if (acc < 1) reasons.push('akurasi_tidak_wajar');

    // Altitude null padahal device seharusnya support
    if (pos.coords.altitude === null && acc < 20) {
      reasons.push('altitude_tidak_ada');
    }

    return reasons;
  };

  const startWatching = () => {
    if (!navigator.geolocation) {
      setGPS(prev => ({ ...prev, status: 'error' }));
      return;
    }
    setGPS(prev => ({ ...prev, status: 'waiting' }));
    accuracyHistory.current = [];

    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const reasons = detectFakeGPS(pos);
        setGPS({
          lat: pos.coords.latitude, lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy, status: 'active',
          koordinat_sumber: 'browser_gps',
          fake_gps_suspected: reasons.length > 0,
          fake_gps_reasons: reasons,
        });
      },
      (err) => setGPS(prev => ({
        ...prev, status: err.code === 1 ? 'denied' : 'error',
      })),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
  };

  const stopWatching = () => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
  };

  useEffect(() => () => stopWatching(), []);
  return { gps, startWatching, stopWatching };
}
```

---

## FRONTEND — TASK 3: Komponen TrustBadge (BUAT FILE BARU)

Buat: src/components/TrustBadge.tsx

```tsx
import { TrustLabel, TrustBreakdown } from '../types/laporan';

interface Props {
  score:        number;
  label:        TrustLabel;
  breakdown?:   TrustBreakdown;
  showDetail?:  boolean;
}

const CONFIG = {
  hijau:  { bg: 'bg-green-100',  text: 'text-green-800',  border: 'border-green-300',  emoji: '🟢', desc: 'Kredibel'      },
  kuning: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300', emoji: '🟡', desc: 'Perlu review'  },
  merah:  { bg: 'bg-red-100',    text: 'text-red-800',    border: 'border-red-300',    emoji: '🔴', desc: 'Diragukan'     },
};

const LABELS: Record<string, string> = {
  exif_gps: 'GPS EXIF', nama_jalan: 'Nama jalan',
  ai_deteksi: 'Deteksi AI', konteks_visual: 'Konteks foto', fake_gps: 'Keaslian GPS',
};

export function TrustBadge({ score, label, breakdown, showDetail = false }: Props) {
  const c = CONFIG[label];
  return (
    <div className="inline-flex flex-col gap-1">
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full
                        text-xs font-medium border ${c.bg} ${c.text} ${c.border}`}>
        {c.emoji} {score}/100 — {c.desc}
      </span>
      {showDetail && breakdown && (
        <div className="mt-1 space-y-0.5">
          {Object.entries(breakdown).map(([key, val]) => (
            <div key={key} className="flex items-center justify-between text-xs text-gray-500">
              <span>{LABELS[key] ?? key}</span>
              <span className={val.nilai > 0 ? 'text-green-600 font-medium' : 'text-red-400'}>
                {val.nilai > 0 ? `+${val.nilai}` : '—'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## FRONTEND — TASK 4: Modifikasi Halaman Upload

Modifikasi halaman upload yang sudah ada.
Jangan buat ulang dari nol — tambahkan / ganti bagian-bagian berikut:

### 4A — Tambah state baru ke komponen upload yang sudah ada

```tsx
const [selectedFiles, setSelectedFiles]   = useState<File[]>([]);
const [previewUrls, setPreviewUrls]       = useState<string[]>([]);
const [roadNameSource, setRoadNameSource] = useState<'autocomplete' | 'manual' | null>(null);
const [uploadPhase, setUploadPhase]       = useState<
  'idle' | 'uploading' | 'analyzing' | 'validating' | 'done' | 'error'
>('idle');
const { gps, startWatching } = useGPS();

// Panggil startWatching() saat komponen mount
useEffect(() => { startWatching(); }, []);
```

### 4B — Ganti input file dengan live capture + multi

```tsx
<input type="file" accept="image/*" capture="environment" multiple
  className="hidden" id="camera-input"
  onChange={(e) => handleFilesSelected(e.target.files)} />

<input type="file" accept="image/*" multiple
  className="hidden" id="gallery-input"
  onChange={(e) => handleFilesSelected(e.target.files)} />

<div className="flex gap-2">
  <label htmlFor="camera-input"
    className="flex-1 flex items-center justify-center gap-2 py-3
               border-2 border-dashed border-gray-300 rounded-lg cursor-pointer
               hover:border-blue-400 hover:bg-blue-50 transition-colors">
    <span className="text-2xl">📷</span>
    <span className="text-sm font-medium">Ambil Foto</span>
  </label>
  <label htmlFor="gallery-input"
    className="flex-1 flex items-center justify-center gap-2 py-3
               border-2 border-dashed border-gray-300 rounded-lg cursor-pointer
               hover:border-gray-400 hover:bg-gray-50 transition-colors">
    <span className="text-2xl">🖼️</span>
    <span className="text-sm text-gray-500">Dari Galeri</span>
  </label>
</div>
```

### 4C — Handler files selected

```tsx
const handleFilesSelected = (files: FileList | null) => {
  if (!files) return;
  const valid: File[] = [];
  Array.from(files).forEach(file => {
    if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) return;
    if (file.size > 5 * 1024 * 1024) return;
    valid.push(file);
  });
  const merged = [...selectedFiles, ...valid].slice(0, 20);
  setSelectedFiles(merged);
  setPreviewUrls(prev => {
    prev.forEach(u => URL.revokeObjectURL(u));
    return merged.map(f => URL.createObjectURL(f));
  });
};

const removeFile = (idx: number) => {
  URL.revokeObjectURL(previewUrls[idx]);
  setSelectedFiles(prev => prev.filter((_, i) => i !== idx));
  setPreviewUrls(prev => prev.filter((_, i) => i !== idx));
};
```

### 4D — Preview grid foto

```tsx
{previewUrls.length > 0 && (
  <div className="space-y-2">
    <p className="text-xs text-gray-500">{selectedFiles.length} foto dipilih (maks 20)</p>
    <div className="grid grid-cols-3 gap-2">
      {previewUrls.map((url, idx) => (
        <div key={idx} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
          <img src={url} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
          <button type="button" onClick={() => removeFile(idx)}
            className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white
                       rounded-full text-xs flex items-center justify-center hover:bg-red-600">
            ✕
          </button>
        </div>
      ))}
    </div>
  </div>
)}
```

### 4E — Autocomplete nama jalan — wajib pilih dari saran

Cari autocomplete LocationIQ yang sudah ada di kode.
Tambahkan logika berikut TANPA mengubah logika autocomplete yang ada:

```tsx
// Saat user mengetik — tandai sebagai manual
onChange={(e) => {
  setNamaJalan(e.target.value);
  setRoadNameSource('manual');    // <-- TAMBAHKAN BARIS INI
  triggerAutocomplete(e.target.value); // fungsi autocomplete yang sudah ada
}}

// Saat user memilih dari dropdown saran — tandai sebagai autocomplete
onSelect={(suggestion) => {
  setNamaJalan(suggestion.roadName);
  setRoadNameSource('autocomplete'); // <-- TAMBAHKAN BARIS INI
  setRoadCoords({ lat: suggestion.lat, lng: suggestion.lng }); // yang sudah ada
}}

// Indikator visual di field input
className={`w-full px-3 py-2 border rounded-lg text-sm ${
  roadNameSource === 'manual' && namaJalan.length > 3
    ? 'border-red-400 bg-red-50'
    : 'border-gray-300'
}`}

// Warning jika manual
{roadNameSource === 'manual' && namaJalan.length > 3 && (
  <p className="text-xs text-red-600 mt-1">
    Pilih nama jalan dari saran di bawah, jangan ketik manual.
  </p>
)}
```

### 4F — Loading state bertahap

```tsx
{['uploading', 'analyzing', 'validating'].includes(uploadPhase) && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-white rounded-xl p-6 w-72 space-y-4 text-center">
      <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent
                      rounded-full animate-spin mx-auto" />
      {uploadPhase === 'uploading'  && <p className="font-medium">Mengupload foto...</p>}
      {uploadPhase === 'analyzing'  && (
        <div>
          <p className="font-medium">AI sedang menganalisis...</p>
          <p className="text-xs text-gray-500 mt-1">{selectedFiles.length} foto diproses sekaligus</p>
        </div>
      )}
      {uploadPhase === 'validating' && <p className="font-medium">Memvalidasi koordinat...</p>}
      <div className="flex justify-center gap-2">
        {['uploading', 'analyzing', 'validating'].map(phase => (
          <div key={phase} className={`w-2 h-2 rounded-full ${
            uploadPhase === phase ? 'bg-blue-500' : 'bg-gray-200'
          }`} />
        ))}
      </div>
    </div>
  </div>
)}
```

### 4G — Handler submit batch

```tsx
const handleSubmitBatch = async () => {
  if (selectedFiles.length === 0)    { setError('Pilih minimal 1 foto'); return; }
  if (roadNameSource !== 'autocomplete') { setError('Nama jalan harus dipilih dari saran'); return; }
  if (!gps.lat || !gps.lng)          { setError('Aktifkan GPS terlebih dahulu'); return; }

  try {
    // Fase 1: Kirim ke AI server
    setUploadPhase('uploading');
    const fd1 = new FormData();
    selectedFiles.forEach((f, i) => fd1.append(`files[${i}]`, f));
    fd1.append('latitude',  String(gps.lat));
    fd1.append('longitude', String(gps.lng));

    setUploadPhase('analyzing');
    const r1 = await fetch('/api/analyze-batch', {
      method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd1,
    });
    if (!r1.ok) throw new Error('Analisis AI gagal');
    const batchData: BatchAnalysisResponse = await r1.json();

    // Fase 2: Simpan laporan ke database
    setUploadPhase('validating');
    const fd2 = new FormData();
    fd2.append('batch_id',          batchData.batch_id);
    fd2.append('road_name',          namaJalan);
    fd2.append('district',           kecamatan);
    fd2.append('latitude',           String(gps.lat));
    fd2.append('longitude',          String(gps.lng));
    fd2.append('koordinat_sumber',   gps.koordinat_sumber);
    fd2.append('fake_gps_suspected', String(gps.fake_gps_suspected));
    fd2.append('analyses',           JSON.stringify(batchData.analyses));
    selectedFiles.forEach((f, i) => fd2.append(`files[${i}]`, f));

    const r2 = await fetch('/api/reports/batch', {
      method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd2,
    });
    if (!r2.ok) throw new Error('Simpan laporan gagal');
    const reportData = await r2.json();

    setUploadPhase('done');
    navigate('/laporan/hasil-batch', { state: { batchData, reportData } });
  } catch (err) {
    setUploadPhase('error');
    setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
  }
};
```

---

## FRONTEND — TASK 5: Modifikasi Dashboard Supervisor

Tambahkan ke halaman supervisor yang sudah ada:

### 5A — Kartu ringkasan di atas tabel

```tsx
<div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
  {[
    { label: 'Menunggu Review', value: stats?.menunggu_review, color: 'blue'   },
    { label: '🟢 Kredibel',    value: stats?.hijau,           color: 'green'  },
    { label: '🟡 Perlu Review', value: stats?.kuning,          color: 'yellow' },
    { label: '🔴 Diragukan',   value: stats?.merah,           color: 'red'    },
  ].map(({ label, value, color }) => (
    <div key={label} className={`rounded-lg p-3 text-center
      bg-${color}-50 border border-${color}-200`}>
      <p className={`text-2xl font-bold text-${color}-700`}>{value ?? '—'}</p>
      <p className={`text-xs text-${color}-600 mt-0.5`}>{label}</p>
    </div>
  ))}
</div>
```

### 5B — Kolom trust score di tabel

```tsx
// Di header tabel — tambahkan setelah kolom yang sudah ada
<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
  Trust Score
</th>

// Di setiap baris tabel
<td className="px-4 py-3">
  <TrustBadge score={row.trust_score} label={row.trust_label} />
</td>
```

### 5C — Tombol aksi + modal tolak

```tsx
{/* Tombol aksi per baris */}
<div className="flex gap-1.5">
  <button onClick={() => handleApprove(row.id)}
    disabled={row.status !== 'menunggu_review'}
    className="px-2.5 py-1 bg-green-600 text-white text-xs rounded-lg
               hover:bg-green-700 disabled:opacity-40">
    ✓ Approve
  </button>
  <button onClick={() => setTolakTarget(row.id)}
    disabled={row.status !== 'menunggu_review'}
    className="px-2.5 py-1 bg-red-100 text-red-700 text-xs rounded-lg
               hover:bg-red-200 disabled:opacity-40">
    ✕ Tolak
  </button>
  <button onClick={() => handleDisposisi(row.id)}
    disabled={row.status !== 'disetujui'}
    className="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs rounded-lg
               hover:bg-blue-200 disabled:opacity-40">
    → Disposisi
  </button>
</div>

{/* Modal tolak — render di luar tabel, di level komponen */}
{tolakTarget && (
  <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
    <div className="bg-white rounded-xl p-6 w-96 space-y-4">
      <h3 className="font-semibold text-gray-900">Tolak Laporan</h3>
      <select value={tolakAlasan} onChange={e => setTolakAlasan(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
        <option value="">-- Pilih alasan --</option>
        <option value="koordinat_tidak_valid">Koordinat tidak valid</option>
        <option value="foto_tidak_jelas">Foto tidak jelas</option>
        <option value="bukan_kerusakan_jalan">Bukan kerusakan jalan</option>
        <option value="duplikat">Duplikat laporan lain</option>
        <option value="lainnya">Lainnya</option>
      </select>
      <textarea value={tolakCatatan} onChange={e => setTolakCatatan(e.target.value)}
        placeholder="Catatan tambahan untuk petugas (opsional)"
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none h-20" />
      <div className="flex gap-2">
        <button onClick={() => handleTolak(tolakTarget, tolakAlasan, tolakCatatan)}
          disabled={!tolakAlasan}
          className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm
                     hover:bg-red-700 disabled:opacity-40">
          Konfirmasi Tolak
        </button>
        <button onClick={() => setTolakTarget(null)}
          className="flex-1 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
          Batal
        </button>
      </div>
    </div>
  </div>
)}
```

---

## CHECKLIST — URUTAN PENGERJAAN

Kerjakan dalam urutan ini untuk menghindari dependency error:

```
[ ] 1. Jalankan migration database
[ ] 2. Buat TrustScoreService.php
[ ] 3. Tambah validateRoadNameVsCoordinate() dan aggregateSeverity() ke ReportController
[ ] 4. Tambah analyzeBatch() ke AIController
[ ] 5. Tambah storeBatch() ke ReportController
[ ] 6. Tambah route baru ke api.php
[ ] 7. Buat src/types/laporan.ts
[ ] 8. Buat src/hooks/useGPS.ts
[ ] 9. Buat src/components/TrustBadge.tsx
[ ] 10. Modifikasi halaman upload (task 4A–4G)
[ ] 11. Modifikasi dashboard supervisor (task 5A–5C)
[ ] 12. Test end-to-end: upload batch → AI analisis → supervisor review
```

---

## LARANGAN — JANGAN LAKUKAN INI

```
JANGAN hard-reject laporan hanya karena trust score rendah
       → Supervisor yang memutuskan, bukan sistem otomatis

JANGAN hapus endpoint upload single yang sudah ada
       → Tambahkan endpoint batch sebagai opsi baru di samping yang lama

JANGAN ubah nama kolom tabel reports yang sudah ada
       → Hanya tambah kolom baru via migration

JANGAN buat role publik atau warga di sistem ini
       → Hanya tiga role: petugas, supervisor, admin

JANGAN simpan foto di database sebagai base64
       → Gunakan storage disk Laravel, simpan path saja

JANGAN panggil AI server lebih dari sekali per batch
       → Satu request /analyze-batch untuk semua foto sekaligus

JANGAN timpa logika autocomplete LocationIQ yang sudah ada
       → Hanya tambahkan setRoadNameSource() di handler yang sudah ada
```

---

## CATATAN KHUSUS JIKA MENEMUKAN KONFLIK

Jika kamu menemukan kode yang sudah ada dan bertentangan dengan instruksi ini:
- Autocomplete LocationIQ sudah ada → pertahankan, TAMBAHKAN setRoadNameSource('autocomplete')
- Reverse geocode di backend sudah ada → jadikan bagian dari validateRoadNameVsCoordinate()
- Duplicate check radius 15m sudah ada → pertahankan, panggil sebelum storeBatch()
- Single upload endpoint sudah ada → pertahankan, JANGAN hapus
- Image hash check sudah ada → pertahankan, hitung per file di loop storeBatch()

Jika ada konflik yang tidak bisa diselesaikan dengan penggabungan,
TANYAKAN dulu kepada developer sebelum menimpa kode yang ada.