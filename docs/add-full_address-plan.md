# Plan: Add `full_address` to Reports

## Goal
Tambahkan kolom `full_address` (alamat lengkap hasil reverse geocode) ke tabel `reports`, di-populate otomatis dari LocationIQ saat laporan dibuat, dan backfill untuk data existing.

## Kenapa
- User ingin melihat alamat lengkap (kecamatan, kota, provinsi, kode pos) di detail laporan
- Saat ini hanya ada `road_name` (nama jalan) dan `district` (kecamatan)
- `full_address` di-generate server-side dari koordinat GPS via LocationIQ reverse geocode

## Scope
- Backend: Model, Migration, Controller (auto-populate), Artisan Command (backfill)
- Frontend: Type definition, display di detail page
- **Tidak** menyentuh: WargaReportController, TelegramService, Observer, edit flow, create form

## Arsitektur

### Data Flow

```
Petugas submit report → ReportController@store / storeBatch
  ↓
validateRoadNameVsCoordinate() → panggil LocationIQ reverse geocode (SUDAH ADA)
  ↓
Ekstrak $data['display_name'] sebagai full_address (BARU)
  ↓
DB transaction → Report::create([..., 'full_address' => $fullAddress])
  ↓
Response → return full_address ke frontend
```

Backfill:
```
php artisan reports:backfill-address
  ↓
Report::whereNull('full_address') → lazyById(50)
  ↓
Panggil LocationIQ per lat/lng sama (pakai cache key yg sama)
  ↓
Update full_address
```

### Mengapa Reuse `validateRoadNameVsCoordinate`
- Method ini SUDAH memanggil LocationIQ untuk tiap petugas report (store + storeBatch)
- `$data['display_name']` sudah tersedia dari response API — tinggal di-ekstrak
- **Zero extra API call** saat store — tidak ada tambahan latency
- Cache key `locationiq_md5(lat,lng)` sudah ada — reuse untuk dedup

## File Yang Berubah

| # | File | Perubahan |
|---|---|---|
| 1 | `database/migrations/YYYY_MM_DD_HHMMSS_add_full_address_to_reports.php` | **BARU** — `$table->text('full_address')->nullable()->after('longitude')` |
| 2 | `app/Models/Report.php` | Tambah `'full_address'` ke `$fillable` |
| 3 | `app/Http/Controllers/ReportController.php` — `validateRoadNameVsCoordinate()` | Tambah `'full_address'` ke return array (3 titik) |
| 4 | `app/Http/Controllers/ReportController.php` — `store()` | Ekstrak `$fullAddress` dari roadValidation + simpan ke create + response |
| 5 | `app/Http/Controllers/ReportController.php` — `storeBatch()` | Ekstrak `$fullAddress` dari roadValidation + simpan ke create |
| 6 | `app/Http/Controllers/ReportController.php` — `show()` | Tambah `'full_address'` ke response array |
| 7 | `app/Console/Commands/BackfillReportAddress.php` | **BARU** — Artisan command untuk isi `full_address` yg null |
| 8 | `Frontend-stable/src/types/laporan.ts` | Tambah `full_address?: string \| null` ke `Laporan` interface |
| 9 | `Frontend-stable/src/routes/detail-report.tsx` | Display `full_address` di section Lokasi |

## Detail Implementasi

### 1. Migration
```php
Schema::table('reports', function (Blueprint $table) {
    $table->text('full_address')->nullable()->after('longitude');
});
```

### 2. Model — Report.php
Tambah ke array `$fillable`:
```php
'full_address',
```

### 3. ReportController — validateRoadNameVsCoordinate()
Di return sukses (sebelum tutup kurung):
```php
'full_address' => $data['display_name'] ?? null,
```
Di return error (2 tempat):
```php
'full_address' => null,
```

### 4. ReportController — store()
Setelah `$roadValidation`:
```php
$fullAddress = $roadValidation['full_address'] ?? null;
```
Teruskan ke closure transaksi, tambah ke `Report::create([..., 'full_address' => $fullAddress])`.
Tambah ke response array: `'full_address' => $report->full_address`.

### 5. ReportController — storeBatch()
Setelah `$roadValidation`:
```php
$fullAddress = $roadValidation['full_address'] ?? null;
```
Teruskan ke closure, tambah ke `Report::create([..., 'full_address' => $fullAddress])`.

### 6. ReportController — show()
Tambah ke response array (line ~995):
```php
'full_address' => $report->full_address,
```

### 7. Artisan Command — BackfillReportAddress
```php
protected $signature = 'reports:backfill-address {--chunk=50} {--delay=1}';
```
- Query: `Report::whereNull('full_address')->lazyById($chunkSize)`
- Panggil LocationIQ dengan timeout 2s, ambil `display_name`
- Update per record
- Delay antar chunk untuk rate limit
- Log progress

### 8. Frontend — types/laporan.ts
```typescript
full_address?: string | null;
```

### 9. Frontend — detail-report.tsx
Di section Lokasi (line ~884-888), setelah koordinat:
```tsx
{report.full_address && (
  <p className="text-[12px] text-[#475569] mt-1">{report.full_address}</p>
)}
```

## Edge Cases & Mitigasi

| Edge Case | Dampak | Mitigasi |
|---|---|---|
| LocationIQ down saat store | `full_address` = null | Acceptable — nullable field |
| Report diedit (road_name berubah) | `full_address` tetap dari lat/lng asli | Benar — geocode berdasarkan koordinat, bukan input manual |
| Warga/Telegram report baru | `full_address` = null | Backfill menangani nanti |
| Backfill kena rate limit | Gagal di tengah | Idempotent — run ulang aman |
| Cache hit (lat/lng duplikat) | No extra API call | Cache key `locationiq_md5(lat,lng)` sudah benar |
| Duplicate `$data` variable scope di catch | `$data` undefined | `'full_address' => null` di return error |

## Files NOT Modified
- `WargaReportController.php` — tidak panggil LocationIQ, backfill akan isi
- `TelegramService.php` — sama
- `ReverseGeocodeController.php` — endpoint terpisah
- `ReportObserver.php` — tidak relevan
- `edit-report.tsx` — edit tidak ubah koordinat
- `upload.tsx`, `lapor.tsx`, `ai-result.tsx` — `full_address` server-generated
- `useLocationFromPhoto.ts` — hook autofill, tidak relevan

## Rollback
```bash
php artisan migrate:rollback --step=1
# + revert code changes
```
