# Manual Uji Coba — DeltaJalan

Aplikasi pelaporan kerusakan jalan internal untuk **Dinas PU Bina Marga Kabupaten Sidoarjo**. Empat peran: `petugas`, `petugas_eksekusi`, `supervisor`, `admin` (belum diterapkan). Tidak ada peran publik/warga.

## 1. Login

| Field | Contoh |
|-------|--------|
| URL | `http://localhost:5173` |
| Email | (dari database, sesuai role) |
| Password | (dari database) |

| Username | Role | Password
|budi.santoso@dishub.sidoarjo.go.id | supervisor | password123
|agus.setiawan@dishub.sidoarjo.go.id | petugas surveyor | password123
|eksekusi.satgaswilayahtimur@jalankita.test | petugas eksekusi | password123


**Redirect per role setelah login:**
| Role | Tujuan |
|------|--------|
| `petugas` | `/home` |
| `supervisor` | `/supervisor` |
| `petugas_eksekusi` | `/petugas-eksekusi` |

---

## 2. Petugas — Buat Laporan

### A. Single (1 foto)

1. Buka `/upload` — klik **Galeri**
2. Pilih 1 foto → validasi EXIF date + GPS otomatis
3. Isi: **Nama Jalan** (pilih dari saran autocomplete), **Kecamatan** (dropdown), **Tanggal**, **Catatan** (opsional), **Dimensi Kerusakan** (P × L meter)
4. Klik **Analisis Sekarang** → AI menganalisis
5. Di `/ai-result` → lihat hasil deteksi (bounding box, severity, confidence)
6. Klik **Konfirmasi & Buat Laporan**
7. Di `/create-report` → review data → klik **Kirim Laporan Resmi**
8. ✅ Toast sukses → otomatis ke `/home` (status: *Menunggu Review*)

### B. Batch (2–20 foto)

1. Buka `/upload` — pilih banyak foto dari galeri
2. Tiap foto mendapat: validasi EXIF, GPS, hash, cek duplikat
3. Isi **Nama Jalan + Kecamatan** (auto-fill dari GPS foto pertama)
4. Isi **Dimensi Kerusakan** per foto (di grid thumbnail)
5. Klik **Upload N Foto Sekaligus**
   - Phase 1: AI analisis semua foto
   - **Phase 2: Langsung simpan ke database**
6. Di `/ai-result` → lihat ringkasan batch + trust score
7. Klik **Lihat Laporan Tersimpan** → `/my-reports`

> **Perbedaan utama:** Batch langsung tersimpan di DB saat upload (tidak ada `/create-report`). Single butuh langkah konfirmasi terpisah.

### C. Duplikat & Dukung Laporan

- Jika hash foto cocok dengan laporan existing: muncul banner **"Foto sudah pernah dilaporkan"**
- Petugas bisa klik **Dukung Laporan** untuk menambahkan fotonya sebagai bukti ke laporan yang sudah ada (tanpa membuat laporan baru)

---

## 3. Supervisor — Review & Approve

### Dashboard (`/supervisor`)

| Tab | Isi |
|-----|-----|
| **Perlu Review** | Status *Menunggu Review* + *Ditinjau* |
| **Disetujui** | Status *Disetujui* — bisa **Mulai Pengerjaan** |
| **Diperbaiki** | Status *Sedang Diperbaiki* (read-only) |
| **Ditolak** | Status *Ditolak* (read-only) |
| **Semua** | Semua laporan |

> ⚠️ Approve/Tolak hanya bisa dilakukan dari halaman **Detail** (`/review`), bukan dari dashboard.

### Approve flow

1. Klik **Detail** pada laporan → buka `/review?reportId=X`
   - Otomatis `POST /reports/:id/mulai-review` → status jadi *Ditinjau*
   - Lihat: foto, AI result, trust score, timeline, lokasi
2. Isi **Prioritas Penanganan** (Rendah/Sedang/Tinggi) + **Catatan Supervisor**
3. Klik **Setujui & Disposisi** → approve + disposisi ke UPR (status → *Disetujui*)
4. Setelah *Disetujui*:
   - Kembali ke dashboard → tab **Disetujui** → klik **Mulai Pengerjaan**
   - Pilih **UPR** dari modal → status → *Sedang Diperbaiki*

### Tolak flow

- Di halaman Detail, klik **Tolak Laporan** → pilih alasan (dropdown) + catatan opsional
- Alasan: `koordinat_tidak_valid`, `foto_tidak_jelas`, `bukan_kerusakan_jalan`, `duplikat`, `lainnya`

### Export PDF

- Pilih bulan + tahun → klik **Export PDF** → download laporan bulanan

---

## 4. Petugas Eksekusi — Kerjakan Tugas

### Dashboard (`/petugas-eksekusi`)

| Grup | Filter | Aksi |
|------|--------|------|
| **Siap Dikerjakan** | Status *Disetujui* | Klik **Mulai** → `POST /reports/:id/mulai` → status *Sedang Diperbaiki* |
| **Sedang Dikerjakan** | Status *Sedang Diperbaiki* | Klik **Selesaikan** → buka `/complete-report` |
| **Riwayat Selesai** | Status *Selesai* | Lihat detail (eye icon → `/review`) |

### Selesaikan Pengerjaan

1. Di grup **Sedang Dikerjakan**, klik **Selesaikan**
2. Upload **Foto Setelah Perbaikan** (wajib, dari kamera)
3. Isi **Catatan** (opsional)
4. Klik **Kirim** → `POST /reports/:id/complete`
5. ✅ Toast sukses → otomatis balik ke `/petugas-eksekusi` (status: *Selesai*)

### Prioritas & Filter

- Filter: **Semua** / **Rendah** / **Sedang** / **Tinggi**
- Urutkan: Prioritas Tertinggi / Terdekat / Waktu Laporan

---

## 5. Peta Interaktif (`/map`)

Semua role bisa akses — klik **Peta** di navbar/bottomnav.

| Zoom | Poligon | Marker |
|------|---------|--------|
| < 10 | ✅ Kecamatan + warna severity | ✅ Cluster |
| 10–12 | ✅ Kecamatan + warna severity | ❌ Tersembunyi |
| ≥ 13 | ❌ Hilang | ✅ Individu |

**Fitur:**
- Filter panel: status, severity, kecamatan, UPR, SLA aging
- Panel statistik: total, sebaran severity, breakdown status, peringatan SLA
- Legenda: warna severity + indikator batas kecamatan
- Klik marker → popup → **Lihat Detail** → buka `/review`

---

## 6. Timeline Riwayat

Di halaman detail laporan (`/review` atau `/detail-report`):
- Vertical timeline dengan titik warna per event
- Event: laporan_dibuat, ditinjau, disetujui/ditolak, disposisi, perbaikan_dimulai, perbaikan_selesai, ditugaskan, dibuka_kembali, diedit
- Tiap event menampilkan: actor (nama user), timestamp, catatan
- Event terakhir punya animasi pulse

---

## 7. Diagram Status Flow

```
                    ┌─────────────────────┐
                    │   Menunggu Review    │◄──────────────┐
                    │  (petugas submit)    │               │
                    └──────────┬──────────┘               │
                               │ Supervisor buka review   │
                      POST /reviews/:id/mulai-review      │
                               │                          │
                    ┌──────────┴──────────┐               │
                    ▼                     ▼               │
            ┌──────────────┐    ┌──────────────┐          │
            │   Ditinjau   │    │   Diedit     │──────────┘
            └──────┬───────┘    │(petugas edit)│ petugas
                   │            └──────────────┘ batal edit
          ┌────────┴────────┐
          ▼                 ▼
    ┌──────────┐     ┌──────────┐
    │ Disetujui│     │ Ditolak  │
    │+ priority│     │ (final)  │
    └─────┬────┘     └──────────┘
          │ Supervisor/eksekusi klik Mulai
          │ POST /reports/:id/mulai
          ▼
    ┌──────────────┐
    │ Sedang       │
    │ Diperbaiki   │
    └──────┬───────┘
           │ Upload foto after
           │ POST /reports/:id/complete
           ▼
    ┌──────────────┐
    │   Selesai    │──── Supervisor reopen ────► Menunggu Review
    └──────────────┘     POST /reports/:id/reopen
```

---

## 8. Route Map (Navigasi)

```
/ (login)
├── /home (petugas dashboard)
├── /upload (upload foto + AI analysis — single & batch)
│   ├── [single] → /ai-result → /create-report → /home
│   └── [batch]  → /ai-result → /my-reports
├── /my-reports (daftar laporan petugas)
├── /detail-report?reportId=X (detail view all roles)
├── /edit-report?reportId=X (edit laporan — petugas only)
├── /map (peta interaktif — all roles)
├── /supervisor (dashboard supervisor)
│   └── /review?reportId=X (detail + approve/tolak)
│       └── /complete-report?reportId=X (selesaikan)
├── /petugas-eksekusi (dashboard tugas)
│   └── /review?reportId=X (detail)
│   └── /complete-report?reportId=X (selesaikan)
├── /stats (statistik — supervisor & eksekusi)
└── /reports (redirect)
```
