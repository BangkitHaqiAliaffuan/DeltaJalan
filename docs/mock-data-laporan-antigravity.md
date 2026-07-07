# Mock Data Laporan via Antigravity

Panduan lengkap membuat data laporan kerusakan jalan (mock data) langsung ke database PostgreSQL melalui **Antigravity** (web-based DB management tool), sesuai sistem DeltaJalan terkini per 1 Juli 2026.

---

## 1. Data Model Overview

```
reports (main table)
  ├── report_photos           (CASCADE on delete)
  ├── report_after_photos     (CASCADE on delete)
  ├── report_progress_updates (CASCADE on delete)
  ├── status_logs             (CASCADE on delete)
  └── report_duplicates       (CASCADE on delete, self-ref via duplicate_of_id)

reports.survey_task_id    → survey_tasks.id   (SET NULL on delete)
reports.assigned_team_id  → teams.id
reports.user_id           → users.id
```

### Aturan Penting

- Semua UUID bisa di-generate via `gen_random_uuid()` atau dari uuidgenerator.net.
- `report_code` format: `LP-YYYY-XXXXX` (YYYY = tahun, XXXXX = 5 digit urut, UNIQUE).
- Foto disimpan di **disk** (`storage/app/public/reports/...`), path-nya diisi di DB. File fisik harus benar-benar ada.
- `image_hash` menggunakan SHA-256 (64 karakter hex), UNIQUE di tabel `reports`.
- Untuk laporan batch: `batch_id` diisi UUID yang SAMA untuk semua sub-report dalam 1 batch. Foto-foto via `report_photos`, `image_original_path` di `reports` = NULL.
- `overall_severity` dan `status` menggunakan PostgreSQL native ENUM — value HARUS case-sensitive persis.

---

## 2. Cara Hapus Data Lama

### Via Antigravity (SQL)

Jalankan **berurutan**:

```sql
DELETE FROM report_progress_updates;
DELETE FROM report_after_photos;
DELETE FROM status_logs;
DELETE FROM report_duplicates;
DELETE FROM report_photos;
DELETE FROM reports;
```

Atau langsung (CASCADE akan handle):

```sql
DELETE FROM reports;
```

Setelah itu hapus direktori foto (via terminal/file manager):

```bash
rm -rf storage/app/public/reports/
```

### Via Laravel Tinker

```bash
php artisan tinker
```

```php
Storage::disk('public')->deleteDirectory('reports');
\App\Models\Report::query()->delete();
```

---

## 3. Reference Data — Existing IDs

Gunakan ID asli ini untuk foreign key.

### 3.1 Teams

| ID | Name | Wilayah |
|---|---|---|
| `019f1b7c-7098-72c2-954f-ac39a0fe3165` | Tim Satgas Utara | Waru, Gedangan, Sedati, Buduran |
| `019f1b7c-709c-72bf-a431-c04c04cf0019` | Tim Satgas Pusat | Sidoarjo Kota, Buduran, Sedati |
| `019f1b7c-709b-7265-a4d1-4a3c9a49a7cd` | Tim Satgas Barat | Taman, Krian, Balongbendo, Wonoayu, Sukodono |
| `019f1b7c-709a-735b-9c1c-db95c45acfe0` | Tim Satgas Selatan | Porong, Krembung, Tulangan, Tanggulangin, Jabon |
| `019f1b7c-709b-7265-a4d1-4a3c9a8036e5` | Tim Satgas Timur | Candi, Sidoarjo, Tarik, Prambon |

### 3.2 Petugas Users

| ID (bigint) | Name | Team ID |
|---|---|---|
| `61` | Agus Setiawan | `019f1b7c-7098-72c2-954f-ac39a0fe3165` (Utara) |
| `62` | Rizky Firmansyah | `019f1b7c-709c-72bf-a431-c04c04cf0019` (Pusat) |
| `63` | Dewi Rahayu | `019f1b7c-709b-7265-a4d1-4a3c9a49a7cd` (Barat) |
| `64` | Bambang Eko | `019f1b7c-709a-735b-9c1c-db95c45acfe0` (Selatan) |
| `65` | Dodi Kurniawan | `019f1b7c-709b-7265-a4d1-4a3c9a8036e5` (Timur) |

### 3.3 Supervisors

| ID | Name |
|---|---|
| `66` | Budi Santoso |
| `67` | Siti Marlina |
| `68` | Hendra Kusuma |
| `69` | Fajar Nugroho |

### 3.4 Patrol Schedules

| ID | Team | Hari | Kecamatan | Frekuensi | Mulai |
|---|---|---|---|---|---|
| `019f1c06-7973-73ba-938f-fb161ba380df` | Utara | Rabu, Selasa, Kamis | Waru, Gedangan, Sedati, Buduran | dua_mingguan | 2026-07-01 |
| `019f1c70-437b-722a-a471-efc64d9ded46` | Barat | Rabu, Kamis, Jumat | Taman, Krian, Balongbendo, Wonoayu, Sukodono | setiap_minggu | 2026-07-01 |

### 3.5 Survey Tasks (Aktif)

**Tim Satgas Utara:**

| ID | Kecamatan | Tanggal |
|---|---|---|
| `019f1b7c-70e7-733c-8e69-456e031cd007` | Waru | 2026-06-24 |
| `019f1b7c-70ea-725d-8ca6-3b1e8634730f` | Waru | 2026-06-23 |
| `019f1b7c-70eb-71af-be28-9e0d7ce70678` | Gedangan | 2026-06-24 |
| `019f1b7c-70ec-71d6-b56a-fca40abac66e` | Sedati | 2026-06-24 |
| `019f1b7c-70ed-7247-8898-ca5cd37d0a71` | Buduran | 2026-06-24 |
| `2bda6b4e-f2f2-4db8-9d9a-a405d8d5862f` | Waru | 2026-07-01 |
| `3fdc7d95-e4fa-4fe9-958a-78b0b3d1e059` | Gedangan | 2026-07-02 |
| `c3bb1a8f-3906-4301-b664-ac7818fb47d2` | Sedati | 2026-07-07 |
| `9daf15aa-dac1-4817-8f02-d8a3adc2ca57` | Buduran | 2026-07-08 |
| `a69dccfc-9823-4c16-9e57-c3e81d950826` | Waru | 2026-07-09 |
| `73036def-c986-4da4-9cd5-7a2816cdbb5f` | Gedangan | 2026-07-14 |
| `afb2fa35-9e48-4ebe-be78-0a833ec65d96` | Sedati | 2026-07-15 |

**Tim Satgas Pusat:**

| ID | Kecamatan | Tanggal |
|---|---|---|
| `019f1b7c-70ee-72f7-9cd9-7b1b9c7902b2` | Sidoarjo | 2026-06-24 |
| `019f1b7c-70ef-7378-8e5f-36601c71843f` | Sidoarjo | 2026-06-23 |
| `019f1b7c-70f0-703b-ab22-0ebce3fbe034` | Sidoarjo | 2026-06-22 |
| `019f1b7c-70f1-73a0-b159-f7f0b34e4e61` | Buduran | 2026-06-24 |
| `019f1b7c-70f1-73a0-b159-f7f0b4307f06` | Sedati | 2026-06-24 |

**Tim Satgas Barat:**

| ID | Kecamatan | Tanggal |
|---|---|---|
| `019f1b7c-70f2-72f3-94de-f566ad4c3596` | Taman | 2026-06-24 |
| `019f1b7c-70f3-734a-b2e3-248996a30c8e` | Krian | 2026-06-24 |
| `019f1b7c-70f3-734a-b2e3-24899701d671` | Krian | 2026-06-23 |
| `019f1b7c-70f4-72a6-a605-55d510ea6ebb` | Sukodono | 2026-06-24 |
| `019f1b7c-70f5-739b-86da-17a7abcb97df` | Sukodono | 2026-06-23 |
| `019f1b7c-70f5-739b-86da-17a7aca3d474` | Balongbendo | 2026-06-24 |
| `db094d55-6223-4f8f-a75b-6912fc031428` | Taman | 2026-07-01 |
| `0124a276-5de2-4962-b4cc-84df1c37639c` | Krian | 2026-07-02 |
| `ff8a6685-d776-4817-8234-4a6bfc4cb8ee` | Balongbendo | 2026-07-03 |
| `9bc3892e-4af9-4b4a-a0b5-2fd045c811a5` | Wonoayu | 2026-07-08 |
| `87011bbd-08aa-402f-bf5a-06e45b5972cb` | Sukodono | 2026-07-09 |
| `959191ce-1d95-4f79-a135-4e71dd8ecebe` | Taman | 2026-07-10 |
| `92b19374-672b-4168-8ee4-b54191e5c239` | Krian | 2026-07-15 |

**Tim Satgas Selatan:**

| ID | Kecamatan | Tanggal |
|---|---|---|
| `019f1b7c-70f6-70fd-af9f-6de33cfb2264` | Porong | 2026-06-24 |
| `019f1b7c-70f7-7341-8dd5-82cde8244cac` | Porong | 2026-06-23 |
| `019f1b7c-70f8-7336-8dd3-29008a6d253c` | Tanggulangin | 2026-06-24 |
| `019f1b7c-70f9-7317-beb1-e3932040ab17` | Tanggulangin | 2026-06-23 |
| `019f1b7c-70f9-7317-beb1-e393207d6a89` | Tanggulangin | 2026-06-22 |
| `019f1b7c-70fa-7169-832c-d02055ecf4f3` | Krembung | 2026-06-24 |

**Tim Satgas Timur:**

| ID | Kecamatan | Tanggal |
|---|---|---|
| `019f1b7c-70fb-70d5-858e-6dd0fc0db97e` | Candi | 2026-06-24 |
| `019f1b7c-70fb-70d5-858e-6dd0fc270b55` | Candi | 2026-06-23 |
| `019f1b7c-70fc-70b7-a7a4-c1eb240790e0` | Tarik | 2026-06-24 |
| `019f1b7c-70fd-72ec-a552-ef9fa70f5670` | Tarik | 2026-06-23 |
| `019f1b7c-70fd-72ec-a552-ef9fa7f95511` | Prambon | 2026-06-24 |
| `019f1b7c-70ff-70a0-b0f5-ae114b75ecd2` | Prambon | 2026-06-23 |

---

## 4. Aturan Deadline

Config `config/deadline.php`:

| Priority | Review Hours | Resolution Hours | Warning Before |
|---|---|---|---|
| Tinggi | 24 jam | 72 jam (3 hari) | 8 jam |
| Sedang | 72 jam (3 hari) | 168 jam (7 hari) | 24 jam |
| Rendah | 168 jam (7 hari) | 336 jam (14 hari) | 48 jam |

### Formula

```
deadline_review  = created_at + review_hours     (berdasarkan priority)
deadline_resolusi = perbaikan_dimulai_at + resolution_hours  (berdasarkan priority)
terlambat_review  = (deadline_review < NOW()) AND (status IN ('Menunggu Review', 'Ditinjau'))
terlambat_resolusi = (deadline_resolusi < NOW()) AND (status IN ('Sedang Diperbaiki'))
```

### KRUSIAL

**Laporan dengan status selain `Selesai` harus punya `created_at` HARI INI (atau maksimal 1-2 hari yang lalu).**

Jika `created_at` terlalu lama (misal bulan lalu), maka:
- `deadline_review` sudah lewat → `terlambat_review = true`
- Sistem akan mengirim notifikasi overdue yang tidak diinginkan

Untuk laporan `Selesai`, `created_at` boleh dari tanggal lalu (10-180 hari) karena proses review + perbaikan memang butuh waktu.

---

## 5. SQL INSERT Templates

### 5.1 reports

```sql
INSERT INTO reports (
  id, user_id, batch_id, report_code, reporter_name, road_name,
  district, latitude, longitude, koordinat_sumber,
  image_original_path, image_result_path, image_hash,
  total_detections, overall_severity, ai_raw_output,
  ai_jenis_kerusakan, ai_severity, ai_confidence,
  status, priority, system_notes, catatan_petugas,
  kerusakan_panjang, kerusakan_lebar,
  after_photo_path, after_photo_hash, after_photo_notes,
  perbaikan_dimulai_at, perbaikan_selesai_at, pelaksana,
  assigned_team_id, assigned_at, ditugaskan_at, assignor_name,
  deadline_review, deadline_resolusi, terlambat_review, terlambat_resolusi,
  survey_task_id, created_at, updated_at
) VALUES (
  gen_random_uuid(),              -- id
  61,                             -- user_id
  NULL,                           -- batch_id (UUID untuk batch, NULL untuk single)
  'LP-2026-00001',               -- report_code (UNIQUE)
  'Agus Setiawan',               -- reporter_name
  'Jl. Raya Porong',             -- road_name
  'Sidoarjo',                    -- district
  -7.452100,                     -- latitude
  112.718800,                    -- longitude
  'manual',                      -- 'exif' | 'browser_gps' | 'manual'
  'reports/originals/{uuid}.jpg', -- image_original_path
  NULL,                           -- image_result_path
  md5(random()::text),            -- image_hash (SHA-256, 64 chars, UNIQUE)
  3,                              -- total_detections (0 jika severity='Baik')
  'Rusak Ringan',                -- severity_enum lihat §6
  '{"detections":[{"class":"Lubang","confidence":0.85,"bbox":[100,50,200,150]}],"model":"yolov8s_ensemble"}',
  'Lubang',                      -- ai_jenis_kerusakan
  'ringan',                      -- 'ringan' | 'sedang' | 'berat'
  0.850,                         -- ai_confidence
  'Menunggu Review',             -- status_enum lihat §6
  'Sedang',                      -- 'Rendah' | 'Sedang' | 'Tinggi'
  'Laporan dibuat melalui aplikasi JalanKita', -- system_notes
  'Kerusakan cukup parah, perlu penanganan segera', -- catatan_petugas (nullable)
  2.50,                          -- kerusakan_panjang
  1.30,                          -- kerusakan_lebar
  NULL,                          -- after_photo_path
  NULL,                          -- after_photo_hash
  NULL,                          -- after_photo_notes
  NULL,                          -- perbaikan_dimulai_at
  NULL,                          -- perbaikan_selesai_at
  NULL,                          -- pelaksana
  NULL,                          -- assigned_team_id
  NULL,                          -- assigned_at
  NULL,                          -- ditugaskan_at
  NULL,                          -- assignor_name
  NOW() + INTERVAL '24 hours',  -- deadline_review (created_at + review_hours)
  NULL,                          -- deadline_resolusi
  false,                         -- terlambat_review
  false,                         -- terlambat_resolusi
  NULL,                          -- survey_task_id (UUID, nullable)
  NOW(),                         -- created_at (HARI INI untuk non-Selesai!)
  NOW()                          -- updated_at
);
```

### 5.2 report_photos

```sql
INSERT INTO report_photos (
  id, report_id, reporter_name,
  image_original_path, image_result_path, image_hash,
  latitude, longitude, koordinat_sumber,
  ai_jenis_kerusakan, ai_severity, ai_confidence, ai_raw_output,
  total_detections, kerusakan_panjang, kerusakan_lebar,
  system_notes, sort_order, original_filename,
  created_at, updated_at
) VALUES (
  gen_random_uuid(),               -- id
  '{REPORT_UUID}',               -- report_id (dari INSERT reports di atas)
  'Agus Setiawan',               -- reporter_name
  'reports/originals/{uuid}.jpg',  -- image_original_path
  NULL,                           -- image_result_path
  md5(random()::text),            -- image_hash (tidak perlu UNIQUE di sini)
  -7.452150,                      -- latitude (sedikit berbeda dari main)
  112.718850,                     -- longitude
  'exif',                         -- koordinat_sumber
  'Lubang',                       -- ai_jenis_kerusakan
  'ringan',                       -- ai_severity
  0.850,                          -- ai_confidence
  '{"detections":[{"class":"Lubang","confidence":0.85,"bbox":[100,50,200,150]}]}', -- ai_raw_output
  2,                              -- total_detections
  2.50,                           -- kerusakan_panjang
  1.30,                           -- kerusakan_lebar
  NULL,                           -- system_notes
  0,                              -- sort_order (0 = first photo)
  'patrol_1_0.jpg',              -- original_filename
  NOW(),                          -- created_at
  NOW()                           -- updated_at
);
```

**Single report:** 1-2 foto, sort_order 0, 1.
**Batch report:** 3-6 foto, sort_order 0-5.

### 5.3 status_logs

Setiap perubahan status HARUS dicatat:

```sql
INSERT INTO status_logs (
  id, report_id, old_status, new_status,
  actor_name, actor_role, notes, created_at
) VALUES (
  gen_random_uuid(),
  '{REPORT_UUID}',
  NULL,                          -- old_status (NULL untuk log pertama)
  'Menunggu Review',             -- new_status
  'Agus Setiawan',               -- actor_name
  'petugas',                     -- 'petugas' | 'supervisor' | 'admin'
  'Laporan dibuat',              -- notes
  NOW()
);
```

**Template untuk setiap transisi status:**

| old_status | new_status | actor_role | Kegiatan |
|---|---|---|---|
| NULL | `Menunggu Review` | petugas | Laporan dibuat |
| `Menunggu Review` | `Ditinjau` | supervisor | Supervisor mulai review |
| `Ditinjau` | `Disetujui` | supervisor | Disetujui |
| `Ditinjau` | `Ditolak` | supervisor | Ditolak (isi notes alasan) |
| `Disetujui` | `Ditugaskan` | supervisor | Ditugaskan ke tim |
| `Ditugaskan` | `Sedang Diperbaiki` | petugas | Mulai perbaikan |
| `Sedang Diperbaiki` | `Selesai` | petugas | Perbaikan selesai |

### 5.4 report_progress_updates (hanya untuk Sedang Diperbaiki)

```sql
INSERT INTO report_progress_updates (
  id, report_id, user_id, foto_path, catatan, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  '{REPORT_UUID}',
  61,                             -- user_id petugas
  'reports/progress/{uuid}.jpg', -- foto_path
  'Pengerjaan tahap awal',       -- catatan
  NOW(),                          -- created_at
  NOW()                           -- updated_at
);
```

### 5.5 report_after_photos (hanya untuk Selesai)

```sql
INSERT INTO report_after_photos (
  id, report_id, file_path, file_hash, sort_order, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  '{REPORT_UUID}',
  'reports/after/{uuid}.jpg',   -- file_path
  md5(random()::text),           -- file_hash (SHA-256)
  0,                              -- sort_order
  NOW(),                          -- created_at
  NOW()                           -- updated_at
);
```

**WAJIB:** Update juga kolom after_photo di tabel reports:
```sql
UPDATE reports
SET after_photo_path = 'reports/after/{uuid}.jpg',
    after_photo_hash = md5(random()::text),
    after_photo_notes = 'Perbaikan selesai dilaksanakan'
WHERE id = '{REPORT_UUID}';
```

### 5.6 report_duplicates (opsional)

```sql
INSERT INTO report_duplicates (
  id, report_id, duplicate_of_id, score, match_type, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  '{DUPLICATE_UUID}',            -- laporan yang dianggap duplikat
  '{ORIGINAL_UUID}',             -- laporan asli
  0.950,                          -- score
  'image_hash',                  -- 'user_confirmed' | 'spatial' | 'image_hash'
  NOW(),
  NOW()
);
```

---

## 6. ENUM Values (Case-Sensitive!)

### status_enum

| Value | Deskripsi | Biasanya dibuat oleh |
|---|---|---|
| `Menunggu Review` | Menunggu review supervisor | Initial status (default) |
| `Ditinjau` | Sedang direview supervisor | Supervisor |
| `Disetujui` | Disetujui, siap ditugaskan | Supervisor |
| `Ditugaskan` | Ditugaskan ke tim satgas | Supervisor |
| `Sedang Diperbaiki` | Sedang dikerjakan | Petugas (mulai kerja) |
| `Selesai` | Perbaikan selesai | Petugas (complete) |
| `Ditolak` | Ditolak supervisor | Supervisor |
| `Diedit` | Sedang diedit petugas | Petugas |

### severity_enum

`Baik`, `Rusak Ringan`, `Rusak Sedang`, `Rusak Berat`

### priority

`Rendah`, `Sedang`, `Tinggi`

---

## 7. Reference Data Konstan

### 18 Kecamatan + GPS Center

| Kecamatan | Lat | Lng |
|---|---|---|
| Sidoarjo | -7.4521 | 112.7188 |
| Buduran | -7.4207 | 112.7240 |
| Gedangan | -7.3967 | 112.6926 |
| Sedati | -7.3690 | 112.7805 |
| Waru | -7.3511 | 112.7688 |
| Taman | -7.3727 | 112.6695 |
| Krian | -7.4086 | 112.5733 |
| Balongbendo | -7.4418 | 112.5295 |
| Wonoayu | -7.4690 | 112.6238 |
| Sukodono | -7.3892 | 112.6461 |
| Candi | -7.4946 | 112.7340 |
| Porong | -7.5398 | 112.6869 |
| Krembung | -7.5213 | 112.6272 |
| Tulangan | -7.5060 | 112.6538 |
| Tanggulangin | -7.5128 | 112.7094 |
| Jabon | -7.5734 | 112.7509 |
| Tarik | -7.4517 | 112.5549 |
| Prambon | -7.5425 | 112.6060 |

### Road Names

```
Jl. Raya Porong, Jl. Ahmad Yani, Jl. Gajah Mada, Jl. Majapahit,
Jl. Pahlawan, Jl. Diponegoro, Jl. Jenggolo, Jl. Thamrin,
Jl. Sudirman, Jl. Raya Buduran, Jl. Raya Waru, Jl. Raya Taman,
Jl. Raya Krian, Jl. Raya Candi, Jl. Raya Tanggulangin,
Jl. Raya Sedati, Jl. Raya Sukodono, Jl. Raya Wonoayu
```

### 4 AI Damage Classes

```
Lubang, Retak Kulit Buaya, Retak Memanjang, Retak Melintang
```

---

## 8. Distribusi Status yang Disarankan (60 laporan)

| Status | Jumlah | created_at | deadline_review |
|---|---|---|---|
| `Menunggu Review` | 12 | HARI INI | NOW + review_hours |
| `Ditinjau` | 6 | HARI INI | NOW + (sisa review_hours) |
| `Disetujui` | 8 | HARI INI atau -1 hari | sudah lewat / hari ini |
| `Ditugaskan` | 6 | HARI INI atau -1 hari | sudah lewat |
| `Sedang Diperbaiki` | 12 | HARI INI atau -2 hari | sudah lewat |
| `Selesai` | 10 | 10-180 hari lalu | sudah lewat |
| `Ditolak` | 6 | HARI INI atau -1 hari | sudah lewat / hari ini |

### Priority Distribution (seimbang)

| Priority | Jumlah |
|---|---|
| Tinggi | ~20 |
| Sedang | ~20 |
| Rendah | ~20 |

### Timeline untuk Laporan Non-Selesai (contoh)

**created_at = HARI INI (NOW()), priority = Sedang:**
- `deadline_review = NOW() + 72 hours` (3 hari ke depan)
- `terlambat_review = false`

**created_at = 2 HARI YANG LALU, priority = Tinggi:**
- `deadline_review = 2_hari_lalu + 24 hours` (1 hari yang lalu → sudah lewat)
- `terlambat_review = true` (karena status masih `Menunggu Review` atau `Ditinjau`)
- **Hindari ini** untuk data normal. Gunakan hanya untuk test deadline.

---

## 9. Contoh Lengkap: 1 Laporan Full Chain (Selesai)

Berikut contoh 1 laporan yang melalui semua status dari awal hingga selesai.

**Step 1 — Insert reports:** (`created_at = 14 hari yang lalu`)
```sql
INSERT INTO reports (
  id, user_id, report_code, reporter_name, road_name,
  district, latitude, longitude, koordinat_sumber,
  image_original_path, image_hash, total_detections,
  overall_severity, ai_raw_output, ai_jenis_kerusakan,
  ai_severity, ai_confidence, status, priority,
  kerusakan_panjang, kerusakan_lebar,
  deadline_review, created_at, updated_at
) VALUES (
  gen_random_uuid(), 61, 'LP-2026-00060',
  'Agus Setiawan', 'Jl. Raya Porong',
  'Sidoarjo', -7.452100, 112.718800, 'manual',
  'reports/originals/uuid-main.jpg', md5(random()::text), 4,
  'Rusak Berat',
  '{"detections":[{"class":"Lubang","confidence":0.92,"bbox":[100,50,200,150]}],"model":"yolov8s_ensemble"}',
  'Lubang', 'berat', 0.920,
  'Selesai', 'Tinggi',
  3.50, 2.10,
  NOW() - INTERVAL '13 days',
  NOW() - INTERVAL '14 days', NOW() - INTERVAL '14 days'
);
-- Simpan UUID: {REPORT_UUID}
```

**Step 2 — Insert 2 report_photos:**
```sql
INSERT INTO report_photos (id, report_id, reporter_name, image_original_path, image_hash, latitude, longitude, koordinat_sumber, ai_jenis_kerusakan, ai_severity, ai_confidence, ai_raw_output, total_detections, kerusakan_panjang, kerusakan_lebar, sort_order, original_filename, created_at, updated_at) VALUES
  (gen_random_uuid(), '{REPORT_UUID}', 'Agus Setiawan', 'reports/originals/uuid-photo1.jpg', md5(random()::text), -7.452150, 112.718850, 'exif', 'Lubang', 'berat', 0.920, '{"detections":[]}', 3, 3.50, 2.10, 0, 'chain_0.jpg', NOW() - INTERVAL '14 days', NOW() - INTERVAL '14 days'),
  (gen_random_uuid(), '{REPORT_UUID}', 'Agus Setiawan', 'reports/originals/uuid-photo2.jpg', md5(random()::text), -7.452180, 112.718880, 'exif', 'Lubang', 'berat', 0.870, '{"detections":[]}', 2, 3.00, 1.80, 1, 'chain_1.jpg', NOW() - INTERVAL '14 days', NOW() - INTERVAL '14 days');
```

**Step 3 — Insert 6 status_logs (full chain):**
```sql
INSERT INTO status_logs (id, report_id, old_status, new_status, actor_name, actor_role, notes, created_at) VALUES
  (gen_random_uuid(), '{REPORT_UUID}', NULL, 'Menunggu Review', 'Agus Setiawan', 'petugas', 'Laporan dibuat', NOW() - INTERVAL '14 days'),
  (gen_random_uuid(), '{REPORT_UUID}', 'Menunggu Review', 'Ditinjau', 'Budi Santoso', 'supervisor', 'Sedang direview', NOW() - INTERVAL '13 days'),
  (gen_random_uuid(), '{REPORT_UUID}', 'Ditinjau', 'Disetujui', 'Budi Santoso', 'supervisor', 'Laporan disetujui', NOW() - INTERVAL '12 days'),
  (gen_random_uuid(), '{REPORT_UUID}', 'Disetujui', 'Ditugaskan', 'Budi Santoso', 'supervisor', 'Ditugaskan ke Tim Satgas Utara', NOW() - INTERVAL '11 days'),
  (gen_random_uuid(), '{REPORT_UUID}', 'Ditugaskan', 'Sedang Diperbaiki', 'Agus Setiawan', 'petugas', 'Pengerjaan dimulai', NOW() - INTERVAL '10 days'),
  (gen_random_uuid(), '{REPORT_UUID}', 'Sedang Diperbaiki', 'Selesai', 'Agus Setiawan', 'petugas', 'Perbaikan selesai', NOW() - INTERVAL '5 days');
```

**Step 4 — Insert 2 progress updates:**
```sql
INSERT INTO report_progress_updates (id, report_id, user_id, foto_path, catatan, created_at, updated_at) VALUES
  (gen_random_uuid(), '{REPORT_UUID}', 61, 'reports/progress/uuid-prog1.jpg', 'Pengerjaan tahap awal', NOW() - INTERVAL '9 days', NOW() - INTERVAL '9 days'),
  (gen_random_uuid(), '{REPORT_UUID}', 61, 'reports/progress/uuid-prog2.jpg', 'Perbaikan 50%', NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days');
```

**Step 5 — Insert 2 after photos:**
```sql
INSERT INTO report_after_photos (id, report_id, file_path, file_hash, sort_order, created_at, updated_at) VALUES
  (gen_random_uuid(), '{REPORT_UUID}', 'reports/after/uuid-after1.jpg', md5(random()::text), 0, NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days'),
  (gen_random_uuid(), '{REPORT_UUID}', 'reports/after/uuid-after2.jpg', md5(random()::text), 1, NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days');
```

**Step 6 — Update after_photo + metadata di reports:**
```sql
UPDATE reports SET
  after_photo_path = 'reports/after/uuid-after1.jpg',
  after_photo_hash = (SELECT file_hash FROM report_after_photos WHERE report_id = '{REPORT_UUID}' ORDER BY sort_order LIMIT 1),
  after_photo_notes = 'Perbaikan selesai dilaksanakan',
  assigned_team_id = '019f1b7c-7098-72c2-954f-ac39a0fe3165',
  assigned_at = NOW() - INTERVAL '12 days',
  ditugaskan_at = NOW() - INTERVAL '11 days',
  assignor_name = 'Budi Santoso',
  pelaksana = 'Agus Setiawan',
  perbaikan_dimulai_at = NOW() - INTERVAL '10 days',
  perbaikan_selesai_at = NOW() - INTERVAL '5 days',
  deadline_review = NOW() - INTERVAL '13 days',
  deadline_resolusi = NOW() - INTERVAL '7 days',
  survey_task_id = '019f1b7c-70e7-733c-8e69-456e031cd007'
WHERE id = '{REPORT_UUID}';
```

---

## 10. Verifikasi Data

Jalankan query berikut setelah insert selesai:

```sql
-- 1. Hitung per status
SELECT status, COUNT(*) FROM reports GROUP BY status ORDER BY status;

-- 2. Hitung total foto
SELECT COUNT(*) as total_photos FROM report_photos;

-- 3. Laporan tanpa foto (seharusnya 0)
SELECT r.report_code FROM reports r
LEFT JOIN report_photos rp ON rp.report_id = r.id
WHERE rp.id IS NULL;

-- 4. Laporan Selesai tanpa after_photo_path
SELECT report_code FROM reports
WHERE status = 'Selesai' AND after_photo_path IS NULL;

-- 5. Laporan Sedang Diperbaiki tanpa progress update
SELECT r.report_code FROM reports r
LEFT JOIN report_progress_updates rpu ON rpu.report_id = r.id
WHERE r.status = 'Sedang Diperbaiki' AND rpu.id IS NULL;

-- 6. Laporan tanpa status_logs (seharusnya 0)
SELECT r.report_code FROM reports r
LEFT JOIN status_logs sl ON sl.report_id = r.id
WHERE sl.id IS NULL;

-- 7. Duplikat report_code (seharusnya 0)
SELECT report_code, COUNT(*) FROM reports
GROUP BY report_code HAVING COUNT(*) > 1;

-- 8. Laporan terlambat yang tidak sengaja (seharusnya minimal untuk test data normal)
SELECT report_code, status, deadline_review, terlambat_review, deadline_resolusi, terlambat_resolusi
FROM reports WHERE terlambat_review = true OR terlambat_resolusi = true;
```

---

## 11. Catatan Penting

1. **image_hash** (`reports`) — UNIQUE constraint. Gunakan `md5(random()::text)` untuk hash random, atau generate manual 64 karakter hex. Jangan duplikat.

2. **report_code** — UNIQUE constraint. Format `LP-YYYY-XXXXX`. Cek nomor terakhir:
   ```sql
   SELECT report_code FROM reports ORDER BY report_code DESC LIMIT 1;
   ```

3. **survey_task_id** — Nullable. Hanya isi jika laporan terkait dengan patrol schedule tertentu. Task harus punya kecamatan yang SAMA dengan district laporan.

4. **Batch upload** — Untuk laporan batch: `batch_id` = UUID yang SAMA untuk semua sub-report. `image_original_path` di reports = NULL. Foto-foto di `report_photos` (masing-masing dengan koordinat GPS sendiri jika ada EXIF).

5. **Foto storage** — Path di DB HARUS sesuai dengan file fisik di `storage/app/public/`. Buat file dummy/placeholder:
   ```bash
   # Contoh generate file dummy
   mkdir -p storage/app/public/reports/originals
   mkdir -p storage/app/public/reports/after
   mkdir -p storage/app/public/reports/progress
   for i in {1..100}; do
     echo "dummy$i" > "storage/app/public/reports/originals/uuid-$i.jpg"
   done
   ```

6. **`ai_raw_output`** — JSONB, format:
   ```json
   {
     "detections": [
       {"class": "Lubang", "confidence": 0.85, "bbox": [100, 50, 200, 150]},
       {"class": "Retak Memanjang", "confidence": 0.72, "bbox": [300, 100, 150, 80]}
     ],
     "model": "yolov8s_ensemble"
   }
   ```

7. **Koordinat** — Semua koordinat harus dalam batas Indonesia:
   - Latitude: -11 sampai 6
   - Longitude: 95 sampai 141
   - Untuk akurasi mock: gunakan GPS center kecamatan ± kecil (offset max 1500m).

8. **`created_at` vs `updated_at`** — Untuk data awal, set `updated_at = created_at`. Jangan biarkan updated_at terisi otomatis NOW() jika created_at berbeda.
