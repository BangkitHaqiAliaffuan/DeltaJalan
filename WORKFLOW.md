# Workflow Operasional JalanKita — Dinas PU Bina Marga & Sumber Daya Air Kabupaten Sidoarjo

## 1. Alur Kerja Lengkap — Dua Jalur Eksekusi

```
Petugas Lapangan          Supervisor              Petugas Eksekusi (Tim Satgas/UPR)
     │                         │                              │
     │ (1) Ambil foto          │                              │
     │ (2) Upload + AI         │                              │
     │ (3) Isi form + kirim    │                              │
     │                         │                              │
     ├──── Laporan baru ───────►                              │
     │    (Menunggu Review)    │                              │
     │                         │                              │
     │                         │ (4) Buka review              │
     │                         │     → Ditinjau               │
     │                         │                              │
     │                         │ (5) Approve / Tolak          │
     │                         │                              │
     │          ┌─ Ditolak ◄───┤                              │
     │          │              │                              │
     │          │              │ (6) Disetujui                │
     │          │              │     ┌───────────────────┐    │
     │          │              │     │ Dua jalur:        │    │
     │          │              │     │ A) Supervisor     │    │
     │          │              │     │    mulai langsung │    │
     │          │              │     │ B) Petugas mulai  │    │
     │          │              │     │    sendiri        │    │
     │          │              │     └───────────────────┘    │
     │          │              │                              │
     │          │   ┌──────────┴──────────┐                   │
     │          │   │                     │                   │
     │          │   │ Jalur A:            │ Jalur B:          │
     │          │   │ Supervisor assign   │ Supervisor assign │
     │          │   │ UPR + Mulai         │ UPR (tanpa mulai) │
     │          │   │ → Sedang Diperbaiki │ → Disetujui       │
     │          │   │                     │                   │
     │          │   │                     │ Petugas klik Mulai│
     │          │   │                     │ → Sedang Diperb.  │
     │          │   │                     │                   │
     │          │   ├──── Tugas ──────────┼──────────────────►│
     │          │   │   (Sedang Diperb.)  │                   │
     │          │   │                     │                   │
     │          │   │        (7) Eksekusi di lapangan         │
     │          │   │        (8) Foto after                  │
     │          │   │        (9) Selesaikan Laporan           │
     │          │   │◄────── Selesai ────────────────────────┤
     │          │   │        (Selesai)                       │
     │          │   │                     │                   │
     │◄─────────┴─── Notifikasi ──────────┘                   │
```

## 2. Peran Pengguna (Roles)

| Role | Tugas | Kemampuan |
|---|---|---|
| **Petugas Lapangan** | Melaporkan kerusakan jalan yang ditemukan saat patroli | Upload foto single/batch, lihat riwayat laporan sendiri |
| **Petugas Eksekusi** | Tim Satgas di lapangan yang melakukan perbaikan | Lihat tugas UPR, mulai pengerjaan, upload foto after + selesaikan |
| **Supervisor** | Verifikasi, disposisi, monitoring | Approve/tolak laporan, assign ke UPR, mulai & tutup pengerjaan, lihat semua laporan & statistik |
| **Admin** (akan datang) | Kelola pengguna, master data | CRUD user, atur kecamatan, atur UPR |

## 3. Status Laporan Flow

```
                  ┌────────────────────┐
                  │    Menunggu        │◄────────┐
                  │    Review          │         │ Petugas batal edit
                  └────────┬───────────┘         │
                           │                     │
                  ┌────────┴────────┐            │
                  ▼                 ▼            │
           ┌─────────────┐  ┌──────────────┐     │
           │  Ditinjau   │  │   Diedit     ├─────┘
           │ (supervisor │  │ (petugas     │ Petugas mulai edit
           │  baca)      │  │  mengedit)   │
           └──────┬──────┘  └──────────────┘
                  │
         ┌────────┴────────┐
         ▼                 ▼
  ┌──────────────┐  ┌──────────────┐
  │ Disetujui    │  │ Ditolak      │
  │              │  │ (final)      │
  └──────┬───────┘  └──────────────┘
         │
         ▼ (Mulai: supervisor atau petugas)
  ┌──────────────┐
  │ Sedang       │◄──────────────┐
  │ Diperbaiki   │               │ Supervisor reopen
  └──────┬───────┘               │
         │ (Foto after)          │
         ▼                       │
  ┌──────────────┐               │
  │ Selesai      ├───────────────┘
  │              │
  └──────────────┘
```

## 4. Komponen Sistem

### A. Frontend (React + TanStack Start)

| Halaman | Path | Deskripsi |
|---|---|---|
| Login/Splash | `/` | Autentikasi petugas & supervisor |
| Upload (single) | `/upload` | Ambil foto, AI analisis, isi lokasi, kirim |
| Upload (batch) | `/upload` (tab) | Upload 2-20 foto sekaligus |
| Hasil AI | `/ai-result` | Preview hasil deteksi AI per foto |
| Buat Laporan | `/create-report` | Konfirmasi & kirim data dari hasil analisis |
| Dashboard Petugas | `/home` | Daftar laporan milik sendiri + notifikasi |
| Dashboard Petugas Eksekusi | `/petugas-eksekusi` | Tugas UPR: mulai & selesaikan pengerjaan |
| Dashboard Supervisor | `/supervisor` | Stats, daftar semua laporan, approve/tolak/assign |
| Review Detail | `/review` | Detail laporan + foto + hasil AI + trust breakdown |
| Selesaikan | `/complete-report` | Upload foto after + tutup laporan |
| Detail Laporan | `/detail-report` | Detail laporan (standalone) |
| Edit Laporan | `/edit-report` | Edit laporan milik sendiri (status → Diedit) |
| Laporan Saya | `/my-reports` | Filter laporan milik petugas yang login |
| Semua Laporan | `/reports` | Daftar laporan umum (filter & search) |
| Statistik | `/stats` | Dashboard statistik per UPR & periode |

### B. Backend API (Laravel 13 + Sanctum)

| Endpoint | Method | Auth | Fungsi |
|---|---|---|---|---|
| `/auth/login` | POST | - | Login (throttle: 10/mnt) |
| `/auth/logout` | POST | Sanctum | Logout |
| `/auth/me` | GET | Sanctum | Data user saat ini |
| `/analyze` | POST | Sanctum | Analisis AI single foto |
| `/analyze-batch` | POST | Sanctum | Analisis AI batch (max 20 foto) |
| `/reports` | POST | Sanctum | Simpan laporan baru |
| `/reports/{id}` | PUT | Sanctum | Update laporan (setelah edit) |
| `/reports/batch` | POST | Sanctum | Simpan batch laporan |
| `/reports` | GET | Sanctum | Daftar laporan (filter status & user) |
| `/reports/stats` | GET | Sanctum | Statistik laporan |
| `/reports/stats-by-upr` | GET | Sanctum | Statistik per UPR |
| `/reports/{id}` | GET | Sanctum | Detail laporan |
| `/reports/{id}/mulai-review` | POST | Sanctum | Supervisor mulai baca → Ditinjau |
| `/reports/{id}/approve` | POST | Sanctum | Approve laporan |
| `/reports/{id}/tolak` | POST | Sanctum | Tolak laporan (wajib alasan) |
| `/reports/{id}/disposisi` | POST | Sanctum | Disposisi → Sedang Diperbaiki |
| `/reports/{id}/mulai` | POST | Sanctum | Mulai pengerjaan + assign UPR |
| `/reports/{id}/complete` | POST | Sanctum | Selesaikan + upload foto after |
| `/reports/{id}/assign` | POST | Sanctum | Assign/tukar UPR |
| `/reports/{id}/reopen` | POST | Sanctum | Supervisor reopen → Sedang Diperbaiki |
| `/reports/{id}/mulai-edit` | POST | Sanctum | Petugas mulai edit → Diedit |
| `/reports/{id}/batal-edit` | POST | Sanctum | Petugas batal edit → Menunggu Review |
| `/reports/bulk-approve` | POST | Sanctum | Approve massal |
| `/reports/bulk-tolak` | POST | Sanctum | Tolak massal |
| `/reports/{id}/add-evidence` | POST | Sanctum | Tambah bukti foto |
| `/reports/check-duplicate` | GET/POST | Public | Cek duplikasi (spasial+tekstual+hash) |
| `/uprs` | GET | Sanctum | Daftar tim satgas |

### C. Server AI (FastAPI + YOLOv8s)

| Endpoint | Method | Fungsi |
|---|---|---|
| `/predict` | POST | Deteksi kerusakan dari 1 foto |
| `/health` | GET | Cek status server AI |

### D. Eksternal

| Service | Fungsi |
|---|---|
| **LocationIQ** (Reverse Geocoding) | Validasi nama jalan vs koordinat |

## 5. Mekanisme Anti-Fraud

| Fitur | Deskripsi | Dampak |
|---|---|---|
| **EXIF Date Validation** | Foto >2 hari atau dari masa depan ditolak | Mencegah laporan foto lama/future |
| **GPS EXIF Extraction** | Koordinat dari EXIF foto vs manual | Trust score +30 jika cocok |
| **Fake GPS Detection** | 3 heuristik (1m presisi, spread sempit, altitude null) | Trust score -15 jika dicurigai |
| **Image Hash Dedup** | SHA-256 dari konten file | Cegah upload foto yang sama berulang |
| **Spatial Dedup** | Haversine 15m dari koordinat existing | Cegah laporan lokasi berulang |
| **Road Name Validation** | Normalisasi + similar_text + containment | Trust score +20 jika cocok |
| **Trust Score System** | 5 faktor (0-100), skor: hijau≥75, kuning 45-74, merah<45 | Bantu supervisor prioritas review |

## 6. Struktur Tim Satgas (UPR)

| Tim | Wilayah Cakupan |
|---|---|
| **Satgas Wilayah Utara** | Waru, Sedati, Buduran, Gedangan |
| **Satgas Wilayah Selatan** | Porong, Krembung, Tulangan, Tanggulangin, Jabon |
| **Satgas Wilayah Barat** | Taman, Krian, Balongbendo, Wonoayu, Sukodono |
| **Satgas Wilayah Timur** | Candi, Sidoarjo, Tarik, Prambon |

Data master UPR ada di tabel `uprs` — dapat dimodifikasi oleh admin.

## 7. Skenario Penggunaan Nyata

### Contoh 1: Petugas menemukan jalan berlubang (Jalur B — petugas mulai sendiri)

1. Petugas buka aplikasi → Login → Upload foto → AI deteksi "Rusak Berat"
2. Sistem auto-fill koordinat GPS dari browser, ambil EXIF date untuk validasi
3. Petugas pilih kecamatan, pilih nama jalan dari autocomplete, submit
4. Sistem: check duplikasi → hitung trust score → simpan → notif supervisor
5. Supervisor lihat dashboard → review foto + trust score → **Approve**
6. Supervisor pilih **Assign** → laporan ditugaskan ke **Satgas Wilayah Utara** (status tetap Disetujui)
7. **Petugas Eksekusi** login ke akun tim → lihat tugas di `/petugas-eksekusi`
8. Tim satgas tiba di lokasi, klik **Mulai Pengerjaan** → status **Sedang Diperbaiki**
9. Tim eksekusi perbaikan di lapangan
10. Tim ambil foto after → upload via **Selesaikan Laporan** → status **Selesai**

### Contoh 1b: Supervisor langsung mulai pengerjaan (Jalur A)

Setelah approve (step 5), supervisor bisa langsung klik **Mulai Pengerjaan** → pilih UPR → status **Sedang Diperbaiki**. Petugas Eksekusi tinggal datang, eksekusi, foto after, dan selesaikan.

### Contoh 2: Batch report (2+ titik kerusakan dalam 1 patroli)

Sama seperti di atas, tapi petugas upload 5 foto sekaligus. Masing-masing foto:
- Mendapat analisis AI sendiri-sendiri
- Ekstrak GPS EXIF per foto (jika ada)
- Validasi EXIF date per foto (foto invalid dilewati, tidak gagal total)
- Disimpan sebagai sub-report dari 1 laporan utama

### Contoh 3: Trust score rendah

Seorang petugas baru melaporkan jalan "Jl. Raya Sidoarjo" tapi GPS menunjukkan di Kecamatan Porong (jarak >5km). Sistem memberi skor +0 untuk nama_jalan, -15 jika fake GPS dicurigai. Total trust: 45 (kuning). Supervisor di-dashboard melihat badge kuning — perlu review lebih teliti.

## 8. Catatan Implementasi

- **Validasi jalan vs koordinat**: Nama jalan dinormalisasi ("Jl." → "Jalan", "Jln." → "Jalan") lalu dibandingkan dengan hasil reverse geocoding LocationIQ. Similarity ≥60% atau containment = match.
- **Foto after perbaikan**: WAJIB diupload untuk menutup laporan. Hash SHA-256 digunakan untuk deteksi duplikasi.
- **Rating/feedback**: BELUM diimplementasikan (rencana: pelapor bisa rating setelah selesai).
- **Notifikasi push**: BELUM diimplementasikan (rencana: Web Push API atau WhatsApp).
- **Role admin**: BELUM diimplementasikan (rencana: kelola pengguna + master data).

## 9. Arsitektur Deployment

```
                     ┌──────────┐
                     │  ngrok   │ ← tunnel URL untuk testing eksternal
                     │ :5173    │
                     └────┬─────┘
                          │
┌─────────────────────────┼─────────────────────────────────┐
│                  Vite Proxy                              │
│            /api/* → http://localhost:8080/*              │
│            /storage/* → http://localhost:8080/storage/*  │
│                         │                                │
│         ┌───────────────┴────────────────┐              │
│         │           Frontend             │              │
│         │     TanStack Start SSR         │              │
│         │         http://:5173            │              │
│         └────────────────────────────────┘              │
│                                                          │
│         ┌────────────────────────────────┐              │
│         │       Laravel 13 (API)         │              │
│         │       http://localhost:8080     │              │
│         │        │                       │              │
│         │   POST /analyze ───┬───────────┤              │
│         │                    │           │              │
│         └────────────────────┼───────────┘              │
│                              │                          │
│         ┌────────────────────▼───────────┐              │
│         │   FastAPI AI Server            │              │
│         │   YOLOv8s (4 classes)          │              │
│         │   http://localhost:8000         │              │
│         └────────────────────────────────┘              │
└─────────────────────────────────────────────────────────┘

Database: PostgreSQL (Laravel)
Photo storage: Laravel storage/app/public/
```
