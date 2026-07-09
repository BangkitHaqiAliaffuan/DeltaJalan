# Supervisor Approval Considerations — Context Document

Dokumen ini mendokumentasikan hasil riset dan analisis tentang apa saja pertimbangan supervisor dalam menyetujui/menolak laporan kerusakan jalan dari warga, serta gap antara implementasi saat ini vs SOP Bina Marga resmi dan praktik ideal.

---

## 1. Latar Belakang

Aplikasi JalanKita (DeltaJalan) adalah internal road damage reporting app untuk Dinas PU Bina Marga Kabupaten Sidoarjo. Warga melapor via web atau Telegram, petugas melapor via web. Supervisor (PPK) bertugas memverifikasi dan menyetujui/menolak laporan sebelum ditugaskan ke tim eksekusi.

**Dua jalur approval** untuk laporan warga:
- **Step 1** (approve): `Menunggu Verifikasi` → `Hasil AI` — supervisor setujui, AI menganalisis damage class
- **Step 2** (confirm AI + assign): `Hasil AI` → `Ditugaskan` — supervisor review hasil AI, konfirmasi, tim di-assign otomatis per kecamatan

Untuk laporan petugas: langsung `Menunggu Review` → `Ditugaskan` (approve + assign ke tim pelapor sendiri).

---

## 2. Referensi Resmi: SOP Bina Marga

Dokumen paling relevan: **[SOP/UPM/DJBM-126 Rev:02 — Tata Kerja Penilikan Jalan](https://binamarga.pu.go.id/index.php/nspk/detail/sopupmdjbm-126-rev02-tentang-tata-kerja-penilikan-jalan)**

Ini adalah SOP resmi untuk aplikasi **Jalan Kita** (aplikasi nasional yang menjadi model JalanKita). Alur verifikasi dari SOP:

1. Masyarakat melapor via aplikasi Jalan Kita — isi kategori kerusakan, lampirkan foto, cantumkan alamat dan titik koordinat
2. **Pemeriksaan otomatis** oleh sistem: kelengkapan data, keabsahan data, kesesuaian lokasi dengan kewenangan ruas jalan
3. **PPK (Pejabat Pembuat Komitmen = Supervisor)** merespon laporan yang telah diverifikasi sistem, memberikan konfirmasi penerimaan
4. **PPK melakukan verifikasi kondisi aktual di lapangan** — dapat menugaskan Penilik Jalan untuk verifikasi lapangan
5. Penilik Jalan: cek lokasi, dokumentasi kerusakan, input hasil verifikasi via sistem
6. PPK menindaklanjuti: perbaikan langsung, penjadwalan, atau koordinasi dengan pelaksana

Dokumen pendukung lain:
- **[Pedoman CRMS (City Road Management System)](https://binamarga.pu.go.id/uploads/files/2060/02pbm2025-pedoman-sistem-pemeliharaan-jalan-kota-city-road-management-system.pdf)** — 02/P/BM/2025 — sistem pemeliharaan jalan kota, mencakup inspeksi visual, survei IRI, survei screening, verifikasi lapangan
- **[Manual Survei Kondisi Jalan untuk Pemeliharaan Rutin](https://binamarga.pu.go.id/uploads/files/1497/manual-konstruksi-dan-bangunan-no-001-01m2011-tentang-survei-kondisi-jalan-untuk-pemeliharaan-rutin.pdf)** — 001-01/M/2011 — panduan survei kondisi jalan, jenis kerusakan, metode pengukuran
- **[Jurnal: Mapping of Road Pavement Conditions (2025)](https://doi.org/10.29244/jsil.10.1.97-106)** — metode Bina Marga untuk penilaian prioritas penanganan (5 parameter: jumlah tipe kerusakan, lebar, luas, kedalaman, panjang amblesan)
- **[Permendagri tentang DAK Fisik Bidang Jalan](https://doi.org/10.1063/5.0189963)** — mekanisme prioritas penanganan jalan kabupaten via KRISNA

---

## 3. Implementasi Saat Ini: Validasi Otomatis Sebelum Sampai ke Supervisor

Semua cek di bawah terjadi **saat submission** — laporan yang lolos sampai ke supervisor sudah "pre-validated":

| Cek | File | Threshold | Tindakan |
|-----|------|-----------|----------|
| **Koordinat dalam Sidoarjo** | `WargaReportController:59-64` | lat [-7.65, -7.25], lng [112.50, 112.95] | Ditolak 422 |
| **EXIF date terlalu tua** | `WargaReportController:448-480` | >7 hari (`MAX_PHOTO_AGE_DAYS`) | Ditolak 422 |
| **EXIF future date** | Sama | Future | Ditolak 422 |
| **EXIF no metadata** | Sama | Screenshot/download | Ditolak 422 |
| **EXIF read error** | Sama | Parse error | Ditolak 422 |
| **Image hash duplikat** | `WargaReportController:482-496` | SHA-256 match | Ditolak 422 (`DUPLICATE_IMAGE`) |
| **MobileCLIP relevance** | `MobileClipService.php` (via `WargaReportController:514-534`) | Score <0.15 | Ditolak 422 (`IMAGE_NOT_RELEVANT`) |
| **Daily limit per user** | `WargaReportController:366-381` | 5/hari | Ditolak 429 |
| **Fingerprint limit** | `WargaReportController:388-403` | 5/hari per IP+UA | Ditolak 429 |
| **Device ID limit** | `WargaReportController:412-431` | 5/hari per device | Ditolak 429 |

Catatan: petugas tidak kena MobileCLIP, rate limit, atau EXIF date validation yang seketat warga.

---

## 4. Implementasi Saat Ini: Supervisor Review Page

### Data yang Ditampilkan ke Supervisor di `detail-report.tsx`

- **Foto** + AI analysis per-photo (type, severity, confidence, bounding box)
- **Before/After slider** jika sudah ada AI result + after photo
- **Progress bar** jika estimasi hari >0
- **Timeline history** — log status changes
- **Severity badge** — Rusak Berat/Sedang/Ringan/Baik (dari AI)
- **Source badge** — Warga/Telegram/Petugas
- **Deadline card** — countdown berdasarkan priority
- **Road info card** — nama jalan, kecamatan, tim assigned, dimensi, reporter, kode laporan, deskripsi
- **Map** — lokasi dengan pin
- **Duplicate info** — jika ada kecocokan spatial/textual/image, tampilkan jarak dan link
- **Filter** — search by code/road/reporter, filter by UPTD/source/severity/deadline

### Data yang TIDAK Ditampilkan

| Data | Ada di DB? | Alasan Tidak Ditampilkan |
|------|-----------|--------------------------|
| **MobileCLIP score & label** | ✅ `report_photos.mobileclip_score` | Tidak di-render di UI |
| **Trust score, label, breakdown** | ✅ `reports.trust_score, trust_label, trust_breakdown` | **NONAKTIF** — kode dimatikan |
| **GPS EXIF mismatch warning** | ⚠️ Hanya di log `system_notes` | Tidak ditampilkan sebagai card/alert |
| **Riwayat laporan pelapor sebelumnya** | ❌ Hitung dari `reports.user_id` | Tidak ada query |
| **Reporter phone number** | ✅ `reports.reporter_phone` | Tidak ditampilkan di detail |
| **AI relevance score** | ✅ `report_photos.mobileclip_score` | Sama dengan MobileCLIP — tidak di-render |

### Rejection UI Saat Ini

- **Alasan**: Free-text textarea, required, max 100 chars
- **Catatan**: Free-text, optional, max 500 chars
- **Tidak ada predefined rejection categories**

---

## 5. Gap Analysis vs SOP Bina Marga

### Gap Utama

| # | Area | SOP Requirement | Implementasi Saat Ini | Dampak |
|---|------|----------------|----------------------|--------|
| G1 | **Trust score pelapor** | — (tidak di SOP, tapi praktik baik) | NONAKTIF. Kode di `Report.php:66`, `ReportController.php:653` dimatikan dengan marker `// ── TRUST SCORE [NONAKTIF] ──`. File `docs/reactivate-trust-score.md` menjelaskan cara reaktivasi. | Supervisor tidak punya informasi kredibilitas pelapor. Laporan dari first-timer vs repeat reporter diperlakukan sama. |
| G2 | **Predefined rejection reasons** | SOP menyebutkan kategori kerusakan jalan baku | Hanya free-text. Tidak ada dropdown/kategori. | Tidak ada standarisasi alasan tolak. Sulit reporting/analitik. |
| G3 | **MobileCLIP score visible** | — | Score disimpan di `report_photos.mobileclip_score` + `mobileclip_label` tapi tidak dirender di UI supervisor. | Supervisor tidak bisa menilai sendiri apakah gambar relevan — hanya andal threshold 0.15 yang sangat longgar. |
| G4 | **Verifikasi lapangan oleh Penilik Jalan** | SOP: PPK menugaskan Penilik Jalan untuk verifikasi lapangan | Tidak ada. Supervisor approve langsung dari foto + data. | Risiko approve laporan yang tidak akurat. Tapi mungkin di luar scope MVP. |
| G5 | **Duplicate blocking** | — | Endpoint `GET /v1/reports/check-duplicate` ada, dipanggil di halaman lapor, tapi hanya informatif — tidak blocking. Tidak ada cek duplikat ulang saat supervisor approve. | Risiko approve laporan duplikat. |
| G6 | **Drainase assessment** | Manual Bina Marga: drainase harus diperiksa sebelum menentukan penanganan | Tidak ada data drainase sama sekali. | Faktor penting untuk durability perbaikan jalan tidak tertangkap. |

### Gap Minor

| # | Area | Detail |
|---|------|--------|
| G7 | **Reporter riwayat** | Tidak ada "Laporan sebelumnya oleh pelapor ini" di halaman detail |
| G8 | **Auto-suggest priority** | Priority manual (Rendah/Sedang/Tinggi) — tidak ada saran otomatis berdasarkan severity score |
| G9 | **GPS EXIF mismatch warning** | Kalau GPS EXIF beda >500m dari form coordinate, cuma log ke `system_notes`, tidak ada visual warning |
| G10 | **Bulk action UX** | Endpoint bulk-approve & bulk-tolak ada (`ReportController:2710-2808`) tapi tidak ada UI untuk bulk selection |

---

## 6. Enam Dimensi Pertimbangan Supervisor

Berdasarkan riset, supervisor perlu menilai 6 dimensi:

### A. Keabsahan Foto (apakah asli, baru, relevan?)
- EXIF date ✅ (otomatis)
- Duplicate hash ✅ (otomatis)
- MobileCLIP relevance ✅ (otomatis, threshold 0.15)
- **Gap**: Supervisor tidak bisa melihat relevance score — hanya andal automated check

### B. Akurasi Lokasi (apakah koordinat sesuai jalan?)
- Dalam Sidoarjo ✅ (otomatis)
- Road name match ✅ (otomatis via reverse geocode)
- **Gap**: GPS EXIF vs form mismatch tidak divisualisasikan

### C. Duplikasi (apakah sudah ada laporan serupa?)
- Spatial 15m ✅ (informative)
- Textual ILIKE ✅ (informative)
- Image hash ✅ (informative)
- **Gap**: Tidak blocking di approval

### D. Tingkat Keparahan (seberapa parah?)
- AI 4 damage classes ✅
- 4 severity levels ✅
- **Gap**: Tidak ada ukuran kedalaman, luas aktual, atau kondisi drainase (parameter metode Bina Marga)

### E. Kredibilitas Pelapor (apakah bisa dipercaya?)
- Rate limit 5/hari ✅
- **Gap**: Trust score NONAKTIF. Tidak ada riwayat pelapor.

### F. Beban Kerja & Prioritas
- Auto-assign tim per kecamatan ✅
- Priority Rendah/Sedang/Tinggi ✅ (manual)
- **Gap**: Tidak ada prioritas otomatis

---

## 7. Diagram Alur Approval Saat Ini

```
WARGA/TELEGRAM REPORT FLOW:

  [Submission] → Otomatis checks (EXIF, hash, MobileCLIP, dll)
       │
       ▼
  Menunggu Verifikasi
       │
  Supervisor buka detail → POST /mulai-review
       │
       ▼
  Ditinjau
       │
  Supervisor klik "Setujui & Analisis AI"
       │
       ▼
  Hasil AI  ← AI analysis (POST /analyze-ai → FastAPI)
       │
  Supervisor review AI result di /ai-result
  Klik "Konfirmasi & Tugaskan Tim"
       │
       ▼
  Ditugaskan  ← Auto-assign tim via Uptd::resolveTeamIdByDistrict()
       │
  Tim eksekusi mulai kerja → Sedang Diperbaiki → Selesai


ALTERNATIF: Supervisor klik "Tolak"
       │
       ▼
  Ditolak  ← Free-text alasan + catatan
       │
  Notifikasi ke pelapor (ReportRejectedNotification)
       │
  Auto-purge setelah 3 hari (PurgeRejectedReports command, daily 02:00)
```

---

## 8. Data yang Perlu Diputuskan

### Pertanyaan untuk Diskusi

1. **Trust score**: Mau diaktifkan kembali? Komponennya:
   - Riwayat jumlah laporan valid vs ditolak
   - Apakah alamat surel/telepon terverifikasi?
   - Score akhir (0-100) + label (Tidak Terpercaya / Cukup / Terpercaya / Sangat Terpercaya)
   - Lihat `docs/reactivate-trust-score.md` dan kode di `ReportController.php:653`

2. **Predefined rejection categories**: Perlu standarisasi? Contoh:
   - `FOTO_TIDAK_JELAS` — Foto buram, tidak menunjukkan kerusakan
   - `FOTO_TIDAK_RELEVAN` — Foto bukan kerusakan jalan (overridem MobileCLIP)
   - `LOKASI_TIDAK_AKURAT` — Koordinat tidak sesuai jalan
   - `DUPLIKAT` — Laporan sudah ada sebelumnya
   - `DIMENSI_TIDAK_VALID` — Ukuran kerusakan tidak masuk akal
   - `FOTO_EXIF_TIDAK_VALID` — Screenshot/download/edited
   - `LAINNYA` — Free-text fallback

3. **MobileCLIP score di UI supervisor**: Perlu ditambahkan ke card/detail report?

4. **Duplicate blocking**: Perlu dijadikan blocking di approval? Misal: tidak bisa approve jika ada laporan dalam radius 15m dengan status aktif.

5. **Verifikasi lapangan**: Apakah kita perlu workflow "Tugaskan Penilik Jalan" sebelum approve? Atau cukup approve→assign langsung seperti sekarang?

6. **Prioritas otomatis**: Apakah kita auto-set priority berdasarkan severity AI (berat→Tinggi, ringan→Rendah)? Atau tetap manual?

7. **Riwayat pelapor**: Perlu ditampilkan "Laporan sebelumnya: 3 disetujui, 1 ditolak"?

---

## 9. File Referensi Lengkap

### Backend
| File | Isi | Baris Kunci |
|------|-----|-------------|
| `app/Http/Controllers/WargaReportController.php` | Report submission + validasi | `processAndCreateReport():444-534` |
| `app/Http/Controllers/ReportController.php` | Approve/reject/confirm AI | `approve():2013`, `tolak():2290`, `confirmAiResult():2212` |
| `app/Http/Controllers/TelegramWebhookController.php` | Telegram bot handler | `handleConfirm()` |
| `app/Models/Report.php` | Status constants, trust score | `199-210` (status enums) |
| `app/Services/MobileClipService.php` | MobileCLIP relevance check | `RELEVANCE_THRESHOLD=0.15:10` |
| `config/deadline.php` | Deadline by priority | 24h/72h/168h review, 72h/168h/336h resolusi |
| `app/Console/Commands/PurgeRejectedReports.php` | Auto-purge rejected | 3 hari default |
| `app/Notifications/ReportRejectedNotification.php` | Rejection notification | Include alasan |
| `app/Notifications/ReportApprovedNotification.php` | Approval notification | — |

### Frontend
| File | Isi | Baris Kunci |
|------|-----|-------------|
| `routes/detail-report.tsx` | Supervisor detail + approve/reject UI | `handleSetujui:173`, `handleTolak:288`, modal reject:1019, modal approve:1079 |
| `routes/supervisor/index.tsx` | Dashboard list | filter tabs, report cards |
| `routes/ai-result.tsx` | AI result confirmation | `Konfirmasi & Tugaskan` button |
| `components/jk/FraudWarningModal.tsx` | Fraud modal for photo issues | — |
| `components/jk/DuplicateChecker.tsx` | Duplicate check component | — |
| `components/jk/ReportCard.tsx` | Report card in list | — |
| `lib/validatePhotoDate.ts` | Client EXIF validation | — |
| `types/laporan.ts` | LaporanMarker, MapDataResponse types | — |

### Docs
| File | Isi |
|------|-----|
| `docs/reactivate-trust-score.md` | Cara reaktivasi trust score dengan detail komponen |
| `docs/session-2026-07-03-warga-enhancement.md` | Session note: MobileCLIP blocking + fraud modal |
| `SECURITY_ANALYSIS.md` | Known vs fixed security issues |

---

## 10. Timeline & Status

| Item | Status | Prioritas |
|------|--------|-----------|
| MobileCLIP blocking di submission | ✅ Selesai | — |
| FraudWarningModal IMAGE_NOT_RELEVANT | ✅ Selesai | — |
| EXIF GPS removal dari Telegram bot | ✅ Selesai | — |
| **Trust score reactivation** | ❌ **Pending** | ? |
| **Predefined rejection categories** | ❌ **Pending** | ? |
| **MobileCLIP score di UI supervisor** | ❌ **Pending** | ? |
| **Duplicate blocking di approval** | ❌ **Pending** | ? |
| **Riwayat pelapor** | ❌ **Pending** | ? |
| **Verifikasi lapangan workflow** | ❌ **Not planned** | Mungkin out-of-scope |
| **Prioritas otomatis** | ❌ **Pending** | ? |
| **GPS EXIF mismatch visual warning** | ❌ **Pending** | ? |
