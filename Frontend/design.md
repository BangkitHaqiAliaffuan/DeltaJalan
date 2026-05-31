# Design System — JalanKita

**Website Image Processing & Klasifikasi Kerusakan Jalan**
Dinas Perhubungan Kabupaten Sidoarjo

> Dokumen ini dibuat untuk keperluan **proyek magang**.
> Scope wilayah: **Kabupaten Sidoarjo, Jawa Timur (18 Kecamatan)**

---

## 1. Identitas & Tone

| Atribut         | Nilai                                                              |
| --------------- | ------------------------------------------------------------------ |
| Nama Produk     | JalanKita                                                          |
| Tagline         | Deteksi Cepat, Penanganan Tepat                                    |
| Instansi        | Dinas Perhubungan Kabupaten Sidoarjo                               |
| Alamat Instansi | Jl. Sultan Agung No. 12, Sidoarjo, Jawa Timur 61211                |
| Tone            | Profesional · Tepercaya · Efisien                                  |
| Target pengguna | Petugas Lapangan, Supervisor, Kepala Bidang, Admin Dishub Sidoarjo |
| Platform        | Web responsif — desktop utama, mobile untuk petugas lapangan       |
| Scope wilayah   | 18 Kecamatan di Kabupaten Sidoarjo                                 |

---

## 2. Data Wilayah — 18 Kecamatan Sidoarjo

Digunakan di semua dropdown "Kecamatan", filter tabel, dan layer peta.

| No  | Kecamatan    | Zona Wilayah |
| --- | ------------ | ------------ |
| 1   | Sidoarjo     | Pusat        |
| 2   | Buduran      | Utara        |
| 3   | Gedangan     | Utara        |
| 4   | Sedati       | Utara        |
| 5   | Waru         | Utara        |
| 6   | Taman        | Barat        |
| 7   | Krian        | Barat        |
| 8   | Balongbendo  | Barat        |
| 9   | Wonoayu      | Barat        |
| 10  | Sukodono     | Barat        |
| 11  | Candi        | Timur        |
| 12  | Porong       | Selatan      |
| 13  | Krembung     | Selatan      |
| 14  | Tulangan     | Selatan      |
| 15  | Tanggulangin | Selatan      |
| 16  | Jabon        | Selatan      |
| 17  | Tarik        | Timur        |
| 18  | Prambon      | Timur        |

**Koordinat pusat peta default (Kabupaten Sidoarjo):**

```
Latitude  : -7.4478
Longitude : 112.7183
Zoom level: 12
Bounds    : SW -7.6200, 112.5700 — NE -7.2800, 112.9200
```

---

## 3. Data Dummy Realistis — Ruas Jalan Sidoarjo

Digunakan di tabel laporan, form contoh, dan mockup hasil analisis.

| ID Laporan  | Nama Jalan            | Kecamatan    | Jenis Kerusakan   | Tingkat      |
| ----------- | --------------------- | ------------ | ----------------- | ------------ |
| LP-2024-001 | Jl. Jenggolo No. 5    | Sidoarjo     | Lubang Besar      | Rusak Berat  |
| LP-2024-002 | Jl. Pahlawan No. 23   | Sidoarjo     | Retak Memanjang   | Rusak Sedang |
| LP-2024-003 | Jl. Ahmad Yani No. 88 | Waru         | Lubang Kecil      | Rusak Ringan |
| LP-2024-004 | Jl. Raya Taman No. 14 | Taman        | Amblas            | Rusak Berat  |
| LP-2024-005 | Jl. Raya Gedangan     | Gedangan     | Retak Kulit Buaya | Rusak Sedang |
| LP-2024-006 | Jl. Raya Porong No. 7 | Porong       | Lubang Besar      | Rusak Berat  |
| LP-2024-007 | Jl. Raya Krian No. 31 | Krian        | Bergelombang      | Rusak Sedang |
| LP-2024-008 | Jl. Lingkar Barat     | Sukodono     | Retak Kotak-Kotak | Rusak Ringan |
| LP-2024-009 | Jl. Raya Candi No. 9  | Candi        | Lubang Sedang     | Rusak Sedang |
| LP-2024-010 | Jl. Raya Sedati       | Sedati       | Pelepasan Butir   | Rusak Ringan |
| LP-2024-011 | Jl. Raya Tanggulangin | Tanggulangin | Lubang Besar      | Rusak Berat  |
| LP-2024-012 | Jl. Raya Tulangan     | Tulangan     | Retak Sambungan   | Rusak Ringan |

**Akun pengguna sampel:**

| Nama               | Role             | Wilayah Tugas                                           |
| ------------------ | ---------------- | ------------------------------------------------------- |
| Agus Setiawan      | Petugas Lapangan | Kec. Sidoarjo                                           |
| Rizky Firmansyah   | Petugas Lapangan | Kec. Waru & Gedangan                                    |
| Dewi Rahayu        | Petugas Lapangan | Kec. Taman & Krian                                      |
| Bambang Eko        | Petugas Lapangan | Kec. Porong & Tanggulangin                              |
| Budi Santoso       | Supervisor       | Wilayah Utara (Waru, Gedangan, Sedati, Buduran)         |
| Siti Marlina       | Supervisor       | Wilayah Selatan (Porong, Tulangan, Tanggulangin, Jabon) |
| Hendra Kusuma      | Supervisor       | Wilayah Barat (Taman, Krian, Sukodono, Wonoayu)         |
| Fajar Nugroho      | Supervisor       | Wilayah Pusat & Timur (Sidoarjo, Candi, Tarik, Prambon) |
| Ir. Darmawan, M.T. | Kepala Bidang    | Seluruh Kab. Sidoarjo                                   |
| Ratna Dewi, S.Kom  | Admin Sistem     | Seluruh Kab. Sidoarjo                                   |

---

## 4. Warna

### Palet Utama

| Token             | Hex       | Penggunaan                          |
| ----------------- | --------- | ----------------------------------- |
| `--primary`       | `#1A4F8A` | Tombol utama, sidebar, header brand |
| `--primary-dark`  | `#0F3260` | Hover state, active state           |
| `--primary-light` | `#E8F0FA` | Background section, badge info      |
| `--accent`        | `#F59E0B` | Highlight, badge peringatan         |
| `--success`       | `#10B981` | Status selesai, indikator aman      |
| `--warning`       | `#F97316` | Kerusakan sedang, perlu perhatian   |
| `--danger`        | `#EF4444` | Kerusakan berat, butuh segera       |
| `--neutral-50`    | `#F8FAFC` | Background halaman                  |
| `--neutral-100`   | `#F1F5F9` | Background card, table row alt      |
| `--neutral-200`   | `#E2E8F0` | Border, divider                     |
| `--neutral-600`   | `#475569` | Body text sekunder                  |
| `--neutral-900`   | `#0F172A` | Heading, body text utama            |

### Skema Warna Tingkat Kerusakan Jalan

| Level        | Warna  | Hex       | Keterangan                                       |
| ------------ | ------ | --------- | ------------------------------------------------ |
| Baik         | Hijau  | `#10B981` | Tidak ada kerusakan berarti                      |
| Rusak Ringan | Kuning | `#F59E0B` | Retak halus, tidak berbahaya                     |
| Rusak Sedang | Oranye | `#F97316` | Lubang kecil, perlu penjadwalan perbaikan        |
| Rusak Berat  | Merah  | `#EF4444` | Lubang besar atau dalam, bahaya, prioritas utama |

### Skema Warna Marker Peta

| Level        | Warna Marker | Hex       |
| ------------ | ------------ | --------- |
| Rusak Berat  | Merah solid  | `#EF4444` |
| Rusak Sedang | Oranye solid | `#F97316` |
| Rusak Ringan | Kuning solid | `#F59E0B` |
| Selesai      | Hijau solid  | `#10B981` |

---

## 5. Tipografi

| Peran                | Font              | Weight | Size    |
| -------------------- | ----------------- | ------ | ------- |
| Heading utama (H1)   | Plus Jakarta Sans | 700    | 28–32px |
| Heading section (H2) | Plus Jakarta Sans | 600    | 20–24px |
| Heading card (H3)    | Plus Jakarta Sans | 600    | 16–18px |
| Body text            | Inter             | 400    | 14–16px |
| Label, badge         | Inter             | 500    | 11–13px |
| Kode / ID laporan    | JetBrains Mono    | 400    | 12–13px |

> Import via Google Fonts:
> `Plus Jakarta Sans` (400, 600, 700) + `Inter` (400, 500) + `JetBrains Mono` (400)

---

## 6. Komponen UI

### 6.1 Sidebar Navigasi

- Lebar: 240px desktop, collapse 64px tablet
- Background: `--primary` (#1A4F8A)
- Header: logo JalanKita + teks kecil **"Dishub Kab. Sidoarjo"**
- Footer: avatar + nama + role pengguna yang login
- Menu item dengan Heroicons outline

**Item menu (urutan prioritas):**

1. Dashboard
2. Upload & Analisis
3. Peta Kerusakan Sidoarjo
4. Daftar Laporan
5. Manajemen Tugas
6. Statistik & Laporan
7. Pengaturan
8. _(Admin only)_ Manajemen Pengguna

---

### 6.2 Top Bar

- Height: 60px, background putih, border bawah `--neutral-200`
- Kiri: breadcrumb halaman aktif
- Kanan: bell notifikasi + badge count + avatar + nama + dropdown logout

---

### 6.3 Metric Cards — Dashboard

- Background putih, border `--neutral-200`, radius 12px, padding 20px 24px
- Grid: 4 kolom desktop · 2 kolom tablet · 1 kolom mobile
- Isi: icon + label + angka besar + perubahan vs bulan lalu

**4 card yang ditampilkan:**

1. Total Laporan Bulan Ini — seluruh Kab. Sidoarjo
2. Kerusakan Berat — butuh tindakan segera
3. Sedang Diproses — sudah didisposisi ke unit
4. Selesai Diperbaiki — bulan berjalan

---

### 6.4 Badge Status & Tingkat

```
Baik         → bg #D1FAE5  text #065F46  border #6EE7B7
Rusak Ringan → bg #FEF3C7  text #92400E  border #FCD34D
Rusak Sedang → bg #FFEDD5  text #9A3412  border #FDBA74
Rusak Berat  → bg #FEE2E2  text #991B1B  border #FCA5A5
Diproses     → bg #EFF6FF  text #1E40AF  border #93C5FD
Selesai      → bg #D1FAE5  text #065F46  border #6EE7B7
```

Semua badge: border-radius 9999px · padding 2px 10px · font 12px weight 500

---

### 6.5 Tombol

| Tipe      | Style                                                      |
| --------- | ---------------------------------------------------------- |
| Primary   | bg `--primary`, putih, hover `--primary-dark`              |
| Secondary | transparan, border+text `--primary`                        |
| Danger    | bg `#EF4444`, putih                                        |
| Ghost     | transparan, text `--neutral-600`, hover bg `--neutral-100` |

Radius 8px · Padding 10px 20px default, 8px 14px small · Inter 500 14px

---

### 6.6 Upload Zone

- Border: 2px dashed `--neutral-200`; hover: `--primary`
- Radius 16px, background `--neutral-50`
- Drag & drop + browse file
- Preview thumbnail setelah upload
- Info: "Format JPG/PNG · Maks. 10MB per file"

---

### 6.7 Tabel Laporan

- Header: background `--neutral-100`, text `--neutral-600` uppercase 11px
- Row: putih, hover `--neutral-50`
- **Kolom:** No · ID Laporan · Ruas Jalan · Kecamatan · Tanggal · Jenis Kerusakan · Tingkat · Status · Aksi
- Pagination bawah · filter + search atas

---

### 6.8 Peta Interaktif (Leaflet.js)

- Tile: OpenStreetMap (gratis)
- **Default center: Kabupaten Sidoarjo** (-7.4478, 112.7183, zoom 12)
- Polygon batas wilayah Kab. Sidoarjo opsional
- Marker berwarna sesuai tingkat keparahan
- MarkerCluster untuk area padat
- Klik marker → panel samping detail laporan
- Filter layer per kecamatan dari 18 kecamatan Sidoarjo

---

### 6.9 Hasil Analisis AI

- 2 kolom: foto asli kiri + bounding box AI kanan
- Info di bawah: label kelas · confidence score · estimasi luas
- Badge keparahan otomatis dari output model
- Tombol aksi: "Konfirmasi Hasil" / "Koreksi Manual" / "Buat Laporan"

---

## 7. Layout Halaman

### 7.1 Dashboard

```
[Sidebar] | [Top Bar: "Dinas Perhubungan Kab. Sidoarjo"]
          | [4x Metric Cards]
          | [Grafik tren 6 bulan (60%)] [Pie chart per kecamatan (40%)]
          | [Peta mini Sidoarjo — marker aktif]
          | [5 laporan terbaru — seluruh Sidoarjo]
```

### 7.2 Upload & Analisis

```
[Sidebar] | [Top Bar]
          | [Upload Zone drag & drop]
          | [Form: Nama Jalan + Kecamatan (18) + Tanggal + Catatan]
          | [Thumbnail grid file]
          | [Tombol "Analisis Sekarang"]
          | [Hasil deteksi + bounding box]
          | [Simpan / Export PDF]
```

### 7.3 Daftar Laporan

```
[Sidebar] | [Top Bar]
          | [Filter: Kecamatan (18) · Tingkat · Status · Tanggal]
          | [Search: ID atau nama jalan]
          | [Tabel + pagination]
          | [Export Excel / PDF — format Dishub Sidoarjo]
```

### 7.4 Detail Laporan

```
[Sidebar] | [Breadcrumb: Laporan > LP-2024-001]
          | [Kiri 65%: info lokasi + foto asli + hasil AI]
          | [Kanan 35%: stepper workflow + form disposisi + riwayat]
```

### 7.5 Peta Kerusakan Sidoarjo

```
[Sidebar] | [Filter panel kiri 260px] | [Peta Kab. Sidoarjo fullscreen]
Filter: Kecamatan (18) · Tingkat · Status · Periode tanggal
```

### 7.6 Statistik & Laporan

```
[Sidebar] | [Selector periode: Bulan / Kuartal / Tahun]
          | [4x metric summary]
          | [Bar chart laporan per kecamatan Sidoarjo]
          | [Tren kerusakan 6 bulan]
          | [Tabel rekap per ruas jalan + per kecamatan]
          | [Generate Laporan Resmi Dishub Sidoarjo (PDF)]
```

---

## 8. Sistem Grid & Spacing

| Token           | Nilai |
| --------------- | ----- |
| `--spacing-xs`  | 4px   |
| `--spacing-sm`  | 8px   |
| `--spacing-md`  | 16px  |
| `--spacing-lg`  | 24px  |
| `--spacing-xl`  | 32px  |
| `--spacing-2xl` | 48px  |

Grid: 12 kolom, gutter 24px
Breakpoint: mobile <768px · tablet 768–1024px · desktop >1024px

---

## 9. Ikon (Heroicons Outline)

| Fitur           | Nama Icon                 |
| --------------- | ------------------------- |
| Dashboard       | `home`                    |
| Upload          | `cloud-arrow-up`          |
| Peta            | `map`                     |
| Laporan         | `document-text`           |
| Tugas           | `clipboard-document-list` |
| Statistik       | `chart-bar`               |
| Pengaturan      | `cog-6-tooth`             |
| Notifikasi      | `bell`                    |
| Filter          | `funnel`                  |
| Kerusakan berat | `exclamation-triangle`    |
| Selesai         | `check-circle`            |
| Lokasi GPS      | `map-pin`                 |
| Export          | `arrow-down-tray`         |

---

## 10. Aksesibilitas & UX

- WCAG AA contrast ratio minimum di semua teks
- Fokus visible: outline 2px `--primary`
- Label pada semua form input (bukan hanya placeholder)
- Loading skeleton saat data dimuat dari server
- Empty state dengan ilustrasi + CTA jika data kosong
- Toast notification untuk feedback aksi (berhasil / gagal)
- Modal konfirmasi sebelum aksi destruktif (hapus laporan)
- Error state dengan pesan yang jelas dan actionable
- Indikator offline untuk petugas lapangan

---

## 11. Konvensi Nama Kelas (Tailwind)

```css
/* Card standar */
.card {
  @apply bg-white border border-slate-200 rounded-xl p-6 shadow-sm;
}

/* Badge keparahan */
.badge-ringan {
  @apply bg-amber-50 text-amber-800 border border-amber-200 rounded-full px-3 py-0.5 text-xs font-medium;
}
.badge-sedang {
  @apply bg-orange-50 text-orange-800 border border-orange-200 rounded-full px-3 py-0.5 text-xs font-medium;
}
.badge-berat {
  @apply bg-red-50 text-red-800 border border-red-200 rounded-full px-3 py-0.5 text-xs font-medium;
}

/* Tombol primary */
.btn-primary {
  @apply bg-blue-800 hover:bg-blue-900 text-white font-medium px-5 py-2.5 rounded-lg transition-colors;
}

/* ID laporan */
.report-id {
  @apply font-mono text-xs text-slate-500;
}
```

---

## 12. Referensi Desain

Inspirasi visual:

- GOV.UK Design System — aksesibilitas & kesederhanaan pemerintah
- Linear, Retool — data-dense dashboard
- Portal Pemkab Sidoarjo (sidoarjokab.go.id) — warna institusional biru

Anti-pattern yang dihindari:

- Dark mode sebagai default (tidak familiar pengguna pemerintah)
- Terlalu banyak warna berbeda per halaman
- Animasi berlebihan yang memperlambat kerja petugas
- Font dekoratif sulit dibaca di ukuran kecil
- Fitur terlalu kompleks untuk scope magang

---

_Versi: 1.1 — Proyek Magang JalanKita_
_Instansi: Dinas Perhubungan Kabupaten Sidoarjo_
_Update: Scope wilayah Kabupaten Sidoarjo (18 Kecamatan) + data dummy realistis Sidoarjo_
