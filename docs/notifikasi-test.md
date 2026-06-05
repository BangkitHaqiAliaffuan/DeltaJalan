# Testing Notifikasi

## Prasyarat

- Backend running: `php artisan serve` (port 8080)
- Frontend running: `npm run dev` (port 5173)
- Minimal ada 1 user setiap role: `petugas`, `supervisor`, `petugas_eksekusi`

## Test Case 1: Notifikasi Laporan Baru (→ Supervisor)

1. Login sebagai **petugas**
2. Upload laporan baru via `/upload` (single atau batch)
3. Login sebagai **supervisor**
4. Buka halaman mana saja — klik bell icon di kanan atas
5. **Expected**: Muncul badge merah, dropdown berisi notifikasi "Laporan baru LP-... dari ... di ..."

## Test Case 2: Notifikasi Laporan Disetujui (→ Petugas)

1. Login sebagai **supervisor**
2. Buka halaman review, setujui laporan yang baru dibuat
3. Login sebagai **petugas** (yang membuat laporan tersebut)
4. Klik bell icon
5. **Expected**: Notifikasi "Laporan LP-... disetujui oleh ..."

## Test Case 3: Notifikasi Laporan Ditolak (→ Petugas)

1. Login sebagai **supervisor**
2. Buka halaman review, tolak laporan dengan alasan
3. Login sebagai **petugas** (yang membuat laporan)
4. Klik bell icon
5. **Expected**: Notifikasi "Laporan LP-... ditolak oleh ...: ..."

## Test Case 4: Notifikasi UPR Ditugaskan (→ Petugas Eksekusi)

1. Login sebagai **supervisor**
2. Buka laporan yang sudah disetujui, klik "Assign UPR"
3. Pilih UPR dan submit
4. Login sebagai **petugas_eksekusi** yang tergabung di UPR tersebut
5. Klik bell icon
6. **Expected**: Notifikasi "Tugas baru: laporan LP-... di ... — [Nama UPR]"

## Test Case 5: Notifikasi Perbaikan Selesai (→ Supervisor)

1. Login sebagai **petugas_eksekusi**
2. Complete laporan yang sedang diperbaiki (`/complete-report`)
3. Login sebagai **supervisor**
4. Klik bell icon
5. **Expected**: Notifikasi "Perbaikan laporan LP-... selesai oleh ..."

## Test Case 6: Mark Read

1. Buka dropdown notifikasi
2. Klik salah satu notifikasi
3. **Expected**: Notifikasi hilang dari state unread, navigasi ke halaman detail laporan

## Test Case 7: Mark All Read

1. Buka dropdown notifikasi
2. Klik "Tandai dibaca"
3. **Expected**: Badge unread hilang, semua notifikasi jadi background putih

## API Check (via curl)

```bash
# Login sebagai supervisor
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"supervisor@email.com","password":"password"}'

# Pakai token dari response
TOKEN="..."

# Cek unread count
curl http://localhost:8080/api/notifications/unread-count \
  -H "Authorization: Bearer $TOKEN"

# List notifikasi
curl http://localhost:8080/api/notifications \
  -H "Authorization: Bearer $TOKEN"

# Mark satu notifikasi
curl -X POST http://localhost:8080/api/notifications/{id}/read \
  -H "Authorization: Bearer $TOKEN"

# Mark all
curl -X POST http://localhost:8080/api/notifications/read-all \
  -H "Authorization: Bearer $TOKEN"
```
