# DeltaJalan (JalanKita)

**Sistem Pelaporan dan Penanganan Kerusakan Jalan** untuk Dinas PU Bina Marga Kabupaten Sidoarjo.

Aplikasi ini memungkinkan petugas lapangan, supervisor, dan warga untuk melaporkan, menganalisis, dan melacak perbaikan kerusakan jalan. Foto dianalisis oleh AI (YOLOv8s) untuk mengklasifikasikan 4 jenis kerusakan dengan 4 tingkat keparahan.

---

## Arsitektur

Tiga layanan independen:

| Layanan | Stack | Direktori |
|---|---|---|
| **Frontend** | React 19 + TanStack Start SSR + Tailwind v4 + Vite 7 | `Frontend-stable/` |
| **Backend API** | Laravel 13 + Sanctum + PostgreSQL 16 | `backend_POSTGRESQL/` |
| **AI Server** | FastAPI + YOLOv8s (4 kelas kerusakan) | `backend_AI/` |
| **Mobile** | Capacitor 8 (Android APK) | via `build.py` |

```
Vite proxy (:5173) → Laravel (:8080) → FastAI (:8000)
                            ↕
                      PostgreSQL (:5432)
```

---

## Fitur Utama

- **Multi-Sumber Laporan**: Petugas (web), Warga (web + Telegram), Patroli Terjadwal
- **AI Detection**: YOLOv8s — Lubang, Retak Kulit Buaya, Retak Memanjang, Retak Melintang
- **Severity**: Baik, Rusak Ringan, Rusak Sedang, Rusak Berat
- **Batch Upload**: Multiple foto + GPS EXIF per sub-report
- **Cek Duplikat**: Spatial (15m radius) + tekstual + hash SHA-256
- **Validasi EXIF**: Tanggal foto ≤7 hari, GPS EXIF otomatis
- **Telegram Bot**: Laporan warga via Telegram dengan state machine
- **Tracking Publik**: Lacak status laporan via kode unik
- **Peta Interaktif**: Leaflet + MarkerCluster untuk visualisasi sebaran
- **Dashboard**: Statistik real-time, filter berdasarkan UPR/team/kecamatan
- **Notifikasi**: Push notifications + Telegram untuk update status
- **3 Role**: Petugas, Petugas Eksekusi, Supervisor + Admin

---

## Persiapan

### Prasyarat

- **Node.js** 20+
- **PHP** 8.3 + Composer
- **Python** 3.10+ + pip
- **PostgreSQL** 16 (atau Docker)
- **Capacitor CLI** (untuk build Android)

### 1. Clone & Instal Dependensi

```bash
# Frontend
cd Frontend-stable
npm install

# Backend
cd backend_POSTGRESQL
composer install
cp .env.example .env
php artisan key:generate

# AI Server
cd backend_AI
pip install -r requirements.txt
```

### 2. Konfigurasi Database

```bash
cd backend_POSTGRESQL
# Edit .env — sesuaikan DB_DATABASE, DB_USERNAME, DB_PASSWORD
php artisan migrate
php artisan db:seed
```

### 3. Jalankan Services

```bash
# Terminal 1: Backend API
cd backend_POSTGRESQL
php artisan serve --port=8080

# Terminal 2: Queue worker (untuk Telegram async)
php artisan queue:work

# Terminal 3: AI Server
cd backend_AI
python server.py

# Terminal 4: Frontend
cd Frontend-stable
npm run dev
```

Akses frontend di `http://localhost:5173`, API di `http://localhost:8080`.

---

## Login Testing

| Role | Email | Password |
|---|---|---|
| Petugas | agus.setiawan@dispu.binamarga.go.id | password123 |
| Supervisor | budi.santoso@dispu.binamarga.go.id | password123 |
| Admin | admin@dispu.binamarga.go.id | password123 |

---

## Scripts Tersedia

```bash
# Frontend
npm run lint          # ESLint
npm run format        # Prettier
npm run build         # Production build (SSR)
npm run build:mobile  # SPA build untuk Capacitor

# Backend
composer run test     # PHPUnit
php vendor/bin/pint   # Laravel Pint (lint)

# Ubuntu Docker (jika PHP 8.3 tidak native)
bash scripts/start-ubuntu.sh
bash scripts/start-dev-ubuntu.sh
```

---

## Struktur Direktori

```
DeltaJalan/
├── Frontend-stable/       React + TanStack Start SSR
│   ├── src/
│   │   ├── components/    UI components
│   │   ├── hooks/         TanStack Query hooks
│   │   ├── lib/           Utilities (auth, API, EXIF)
│   │   ├── routes/        TanStack Router routes
│   │   └── types/         TypeScript types
│   └── public/            Static assets
├── backend_POSTGRESQL/    Laravel REST API
│   ├── app/
│   │   ├── Http/Controllers/
│   │   ├── Models/
│   │   ├── Services/
│   │   └── Jobs/
│   ├── database/
│   │   ├── migrations/
│   │   └── seeders/
│   └── routes/
├── backend_AI/            FastAPI + YOLOv8s
│   └── server.py
├── docs/                  Dokumentasi
├── scripts/               Dev & tunnel scripts
└── docker-compose.yml     PHP 8.3 + PostgreSQL 16
```

---

## Lisensi

Hak cipta © Dinas PU Bina Marga Kabupaten Sidoarjo.
