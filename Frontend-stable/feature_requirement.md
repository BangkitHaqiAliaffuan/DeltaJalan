# Requirements Document

## Introduction

Fitur **Anti-Duplikasi Laporan** (_report-duplicate-check_) adalah mekanisme pencegahan laporan ganda pada aplikasi DeltaJalan. Fitur ini membantu petugas lapangan Dinas Perhubungan Kabupaten Sidoarjo untuk mengetahui apakah kerusakan jalan yang hendak mereka laporkan sudah pernah dilaporkan sebelumnya oleh petugas lain.

Fitur ini bekerja melalui empat pendekatan yang saling melengkapi:

1. **Pencarian Spasial (Skenario 1)** — Jika perangkat petugas berhasil mendapatkan koordinat GPS, sistem mencari laporan aktif lain dalam radius 15 meter menggunakan Haversine Formula dan menampilkannya sebagai marker merah di peta Leaflet.
2. **Pencarian Tekstual & Wilayah (Skenario 2)** — Sebagai jaring pengaman untuk laporan lama tanpa koordinat, sistem mencari laporan aktif berdasarkan kecamatan yang dipilih dan nama jalan yang diketik petugas secara real-time, lalu menampilkannya sebagai daftar kartu di bawah peta.
3. **Konsistensi Data via Reverse Geocoding** — Ketika GPS aktif, field nama jalan dan kecamatan diisi otomatis dari hasil reverse geocoding menggunakan Nominatim API dan dikunci menjadi read-only, sehingga data nama jalan di database konsisten tanpa variasi penulisan.
4. **Aksi Preventif "Dukung Laporan"** — Alih-alih hanya menampilkan banner peringatan pasif, setiap kartu duplikat dilengkapi tombol aksi konkret yang memungkinkan petugas menambahkan bukti foto ke laporan yang sudah ada tanpa membuat laporan baru.
5. **Filter Keamanan Image Hash** — Backend menghitung hash dari file gambar yang diunggah dan menolak foto yang identik dengan foto yang sudah ada di database, mencegah spam upload foto yang sama.

Fitur ini diintegrasikan ke halaman `upload.tsx` yang sudah ada, dan memanfaatkan stack teknis yang sudah berjalan: Laravel 11 (backend), React + TanStack Start (frontend), PostgreSQL (database), serta Leaflet.js (peta interaktif).

---

## Glossary

- **DuplicateChecker**: Komponen sistem yang bertanggung jawab mendeteksi potensi duplikasi laporan.
- **SpatialSearch**: Mekanisme pencarian laporan berdasarkan jarak geografis menggunakan Haversine Formula.
- **TextualSearch**: Mekanisme pencarian laporan berdasarkan nama jalan (ILIKE) dan kecamatan.
- **ActiveReport**: Laporan dengan status selain `'Selesai'` (yaitu `'Menunggu Review'` atau `'Sedang Diperbaiki'`).
- **SpatialDuplicate**: Laporan aktif yang ditemukan dalam radius 15 meter dari koordinat GPS petugas.
- **TextualDuplicate**: Laporan aktif yang ditemukan berdasarkan kecocokan kecamatan dan nama jalan.
- **DuplicateWarningBanner**: Komponen UI berupa banner kuning yang muncul di atas tombol submit jika ada potensi duplikasi.
- **LocalReportList**: Komponen UI berupa daftar kartu laporan aktif di kecamatan yang dipilih petugas.
- **MapView**: Komponen peta Leaflet yang menampilkan posisi petugas (marker biru) dan laporan terdekat (marker merah).
- **CheckDuplicateAPI**: Endpoint `GET /api/v1/reports/check-duplicate` di Laravel yang melayani permintaan pengecekan duplikasi.
- **AddEvidenceAPI**: Endpoint `POST /api/v1/reports/{id}/add-evidence` di Laravel yang menerima foto tambahan sebagai bukti pendukung pada laporan yang sudah ada.
- **EvidenceAttachment**: File foto tambahan yang dilampirkan ke laporan yang sudah ada melalui AddEvidenceAPI, bukan membuat laporan baru.
- **SupportCount**: Penghitung jumlah petugas yang telah mengonfirmasi bahwa laporan yang ada merujuk pada kerusakan yang sama dengan yang mereka temukan.
- **NominatimAPI**: Layanan reverse geocoding publik dari OpenStreetMap yang mengonversi koordinat GPS menjadi alamat jalan terstruktur, dapat diakses di `https://nominatim.openstreetmap.org/reverse`.
- **ReverseGeocoding**: Proses mengonversi koordinat GPS (latitude, longitude) menjadi nama jalan dan wilayah administratif yang dapat dibaca manusia.
- **ImageHash**: Nilai hash kriptografis (MD5, 32 karakter heksadesimal) yang dihitung dari konten biner file gambar, digunakan untuk mendeteksi foto yang identik secara konten.
- **Petugas**: Pengguna aplikasi DeltaJalan dengan role petugas lapangan.
- **Debounce**: Teknik menunda eksekusi fungsi hingga pengguna berhenti mengetik selama interval tertentu (300ms).
- **HaversineFormula**: Rumus matematika untuk menghitung jarak antara dua titik koordinat di permukaan bumi.

---

## Requirements

### Requirement 1: API Endpoint Pengecekan Duplikasi

**User Story:** Sebagai petugas lapangan, saya ingin sistem secara otomatis memeriksa apakah laporan yang akan saya kirim sudah ada sebelumnya, sehingga saya tidak mengirim data ganda yang membuang waktu dan sumber daya.

#### Acceptance Criteria

1. THE CheckDuplicateAPI SHALL menerima query parameter `latitude`, `longitude`, `district`, dan `road_name` melalui HTTP GET request ke `/api/v1/reports/check-duplicate`.
2. WHEN parameter `latitude` dan `longitude` keduanya tersedia dan valid, THE CheckDuplicateAPI SHALL menjalankan query HaversineFormula untuk mencari ActiveReport dalam radius 15 meter dari koordinat tersebut.
3. THE CheckDuplicateAPI SHALL menjalankan query pencarian tekstual untuk mengambil semua ActiveReport di `district` yang diberikan, disaring menggunakan operator `ILIKE` pada kolom `road_name` dengan pola `%road_name%`.
4. THE CheckDuplicateAPI SHALL mengembalikan response JSON dengan struktur `{ "spatial_duplicates": [...], "textual_duplicates": [...] }` dan HTTP status 200.
5. WHEN parameter `latitude` atau `longitude` tidak tersedia atau tidak valid, THE CheckDuplicateAPI SHALL mengembalikan array kosong `[]` untuk field `spatial_duplicates` tanpa mengembalikan error.
6. WHEN parameter `district` tidak tersedia, THE CheckDuplicateAPI SHALL mengembalikan array kosong `[]` untuk field `textual_duplicates` tanpa mengembalikan error.
7. IF query database gagal dieksekusi, THEN THE CheckDuplicateAPI SHALL mengembalikan response JSON `{ "spatial_duplicates": [], "textual_duplicates": [] }` dengan HTTP status 200 agar frontend tidak terganggu.
8. THE CheckDuplicateAPI SHALL menyertakan field berikut pada setiap objek dalam array hasil: `id`, `report_code`, `road_name`, `district`, `latitude`, `longitude`, `status`, `support_count`, dan `created_at`.
9. THE CheckDuplicateAPI SHALL dapat diakses tanpa autentikasi (publik) agar petugas yang belum login pun dapat melihat potensi duplikasi.

---

### Requirement 2: Pencarian Spasial Berbasis Radius GPS

**User Story:** Sebagai petugas lapangan, saya ingin melihat laporan aktif lain yang berada dalam radius 15 meter dari posisi GPS saya di peta, sehingga saya bisa memastikan tidak ada laporan serupa yang sudah dikirim untuk titik yang sama.

#### Acceptance Criteria

1. WHEN koordinat GPS petugas berhasil terdeteksi (`locationState.status === 'success'`), THE DuplicateChecker SHALL secara otomatis memanggil CheckDuplicateAPI dengan koordinat tersebut.
2. THE SpatialSearch SHALL menggunakan HaversineFormula untuk menghitung jarak antara koordinat GPS petugas dan koordinat setiap ActiveReport di database.
3. THE SpatialSearch SHALL hanya mengembalikan ActiveReport yang jaraknya kurang dari atau sama dengan 15 meter dari koordinat GPS petugas.
4. WHEN CheckDuplicateAPI mengembalikan data `spatial_duplicates` yang tidak kosong, THE MapView SHALL merender setiap SpatialDuplicate sebagai marker merah di peta.
5. WHEN petugas mengklik marker merah di peta, THE MapView SHALL menampilkan popup berisi teks `"Kode: [report_code] - [road_name]"`.
6. THE MapView SHALL menampilkan posisi GPS petugas sebagai marker biru yang berpusat di tengah peta.
7. THE MapView SHALL secara otomatis menyesuaikan zoom level peta agar posisi petugas dan semua SpatialDuplicate terlihat dalam satu tampilan.
8. WHILE koordinat GPS sedang dideteksi (`locationState.status === 'detecting'` atau `'geocoding'`), THE MapView SHALL menampilkan indikator loading dan menonaktifkan interaksi peta.

---

### Requirement 3: Pencarian Tekstual dan Daftar Laporan Lokal

**User Story:** Sebagai petugas lapangan, saya ingin melihat daftar laporan aktif di kecamatan yang saya pilih yang namanya mirip dengan jalan yang saya ketik, sehingga saya bisa mendeteksi duplikasi meskipun laporan lama tidak memiliki koordinat GPS.

#### Acceptance Criteria

1. WHEN petugas selesai memilih nilai dari dropdown `kecamatan`, THE DuplicateChecker SHALL memanggil CheckDuplicateAPI dengan nilai `district` yang baru.
2. WHEN petugas mengetik pada field `namaJalan` dan berhenti mengetik selama 300 milidetik, THE DuplicateChecker SHALL memanggil CheckDuplicateAPI dengan nilai `road_name` terkini (Debounce 300ms).
3. THE TextualSearch SHALL mencari ActiveReport menggunakan query `ILIKE '%road_name%'` pada kolom `road_name` di database PostgreSQL, bersifat case-insensitive.
4. THE TextualSearch SHALL membatasi pencarian hanya pada ActiveReport yang memiliki `district` sama dengan nilai yang dikirim.
5. WHEN CheckDuplicateAPI mengembalikan data `textual_duplicates` yang tidak kosong, THE LocalReportList SHALL merender setiap TextualDuplicate sebagai kartu kecil di bawah MapView.
6. THE LocalReportList SHALL menampilkan informasi berikut pada setiap kartu: nama jalan (`road_name`), status laporan (`status`), tanggal laporan (`created_at` dalam format `DD/MM/YYYY`), dan jumlah dukungan (`support_count`).
7. WHEN field `road_name` kosong (belum diisi petugas), THE DuplicateChecker SHALL memanggil CheckDuplicateAPI hanya dengan parameter `district` untuk menampilkan semua laporan aktif di kecamatan tersebut.
8. THE LocalReportList SHALL menampilkan label jumlah laporan yang ditemukan, contoh: `"3 laporan aktif ditemukan di Kecamatan Porong"`.
9. WHILE `locationState.status === 'success'` (GPS aktif), THE DuplicateChecker SHALL menonaktifkan kemampuan petugas untuk mengetik secara manual pada field `namaJalan` dan `district`, karena kedua field tersebut diisi otomatis oleh hasil ReverseGeocoding.
10. WHEN `locationState.status` berubah menjadi selain `'success'` (GPS mati atau gagal), THE DuplicateChecker SHALL mengaktifkan kembali field `namaJalan` dan `district` sehingga petugas dapat mengisi secara manual.

---

### Requirement 4: Sistem "Dukung Laporan" dan Banner Peringatan Duplikasi

**User Story:** Sebagai petugas lapangan, saya ingin mendapat peringatan yang jelas dan dapat mengambil tindakan konkret ketika sistem mendeteksi potensi laporan serupa, sehingga saya dapat menambahkan bukti foto ke laporan yang sudah ada tanpa menciptakan data ganda di database.

#### Acceptance Criteria

1. WHEN `spatial_duplicates` atau `textual_duplicates` mengandung satu atau lebih item, THE DuplicateWarningBanner SHALL ditampilkan di atas tombol submit dengan teks: `"⚠️ Sistem mendeteksi potensi laporan serupa di sekitar Anda. Pastikan Anda tidak melaporkan lubang yang sama!"`.
2. THE DuplicateWarningBanner SHALL menggunakan warna latar kuning (`bg-[#FEF3C7]`) dengan border kuning (`border-[#FCD34D]`) dan teks berwarna coklat gelap (`text-[#92400E]`) agar konsisten dengan pola warna peringatan yang sudah ada di aplikasi.
3. WHEN `spatial_duplicates` dan `textual_duplicates` keduanya kosong, THE DuplicateWarningBanner SHALL tidak ditampilkan (hidden).
4. WHEN CheckDuplicateAPI sedang dalam proses pemanggilan (loading), THE DuplicateWarningBanner SHALL menampilkan indikator loading kecil dengan teks `"Memeriksa duplikasi..."` sebagai pengganti banner peringatan.
5. THE LocalReportList SHALL menampilkan tombol aksi berlabel **"Ini Lubang yang Sama (Dukung Laporan)"** pada setiap kartu SpatialDuplicate maupun TextualDuplicate.
6. WHEN petugas mengklik tombol "Dukung Laporan" pada salah satu kartu duplikat, THE DuplicateChecker SHALL mengirim request ke AddEvidenceAPI dengan foto yang sudah dipilih petugas sebagai EvidenceAttachment, dan TIDAK mengirim request pembuatan laporan baru ke endpoint `POST /api/v1/reports`.
7. WHEN petugas mengklik tombol "Dukung Laporan" pada salah satu kartu duplikat, THE DuplicateChecker SHALL menyembunyikan atau menonaktifkan tombol submit utama ("Kirim Laporan Baru") agar petugas tidak dapat mengirim laporan baru setelah memilih aksi penggabungan.
8. WHEN AddEvidenceAPI berhasil memproses request, THE DuplicateChecker SHALL menampilkan konfirmasi kepada petugas bahwa foto berhasil ditambahkan sebagai bukti pada laporan yang dipilih.
9. IF AddEvidenceAPI mengembalikan error, THEN THE DuplicateChecker SHALL menampilkan pesan error dan mengaktifkan kembali tombol submit utama agar petugas dapat memilih tindakan lain.
10. THE DuplicateWarningBanner SHALL tetap ditampilkan sebagai peringatan awal meskipun tombol "Dukung Laporan" sudah tersedia, karena keduanya berfungsi sebagai lapisan informasi yang berbeda.

---

### Requirement 5: Tampilan Peta Interaktif (MapView)

**User Story:** Sebagai petugas lapangan, saya ingin melihat peta yang menampilkan posisi saya dan laporan-laporan terdekat secara visual, sehingga saya dapat dengan mudah memahami konteks spasial sebelum mengirim laporan.

#### Acceptance Criteria

1. THE MapView SHALL dirender menggunakan library React Leaflet (atau Leaflet.js) dengan tile layer OpenStreetMap.
2. WHEN koordinat GPS petugas tersedia, THE MapView SHALL secara otomatis berpusat pada koordinat tersebut dengan zoom level 18 (setara tampilan jalan).
3. WHEN koordinat GPS petugas tidak tersedia, THE MapView SHALL berpusat pada koordinat default Kabupaten Sidoarjo (`-7.4478, 112.7183`) dengan zoom level 13.
4. THE MapView SHALL menampilkan marker biru untuk posisi petugas dengan tooltip `"Posisi Anda"`.
5. THE MapView SHALL menampilkan marker merah untuk setiap SpatialDuplicate dengan popup yang berisi `"Kode: [report_code] - [road_name]"`.
6. THE MapView SHALL memiliki tinggi minimum 200 piksel dan lebar penuh (100%) agar dapat digunakan di perangkat mobile.
7. WHERE fitur GPS tidak tersedia di perangkat petugas, THE MapView SHALL tetap ditampilkan dengan posisi default Sidoarjo tanpa menampilkan marker biru.
8. THE MapView SHALL dirender hanya di sisi klien (client-side only) untuk menghindari error SSR karena Leaflet bergantung pada objek `window` browser.

---

### Requirement 6: Integrasi ke Halaman Upload

**User Story:** Sebagai petugas lapangan, saya ingin fitur pengecekan duplikasi muncul secara alami di dalam form upload yang sudah ada, sehingga saya tidak perlu berpindah halaman untuk memeriksa potensi duplikasi.

#### Acceptance Criteria

1. THE DuplicateChecker SHALL diintegrasikan ke dalam halaman `upload.tsx` yang sudah ada, ditempatkan di antara bagian "Informasi Lokasi" dan tombol submit.
2. WHEN halaman upload pertama kali dimuat, THE DuplicateChecker SHALL tidak memanggil CheckDuplicateAPI sampai ada perubahan pada field `kecamatan`, `namaJalan`, atau koordinat GPS.
3. THE DuplicateChecker SHALL menggunakan nilai `kecamatan` dan `namaJalan` yang sudah ada di state form `upload.tsx` tanpa menduplikasi state.
4. THE DuplicateChecker SHALL menggunakan nilai `locationState.lat` dan `locationState.lng` dari hook `useLocationFromPhoto` yang sudah ada tanpa menduplikasi logika GPS.
5. WHEN petugas menghapus foto (fungsi `removeFile`), THE DuplicateChecker SHALL mereset semua hasil pengecekan duplikasi dan menyembunyikan MapView, LocalReportList, dan DuplicateWarningBanner.
6. THE DuplicateChecker SHALL diimplementasikan sebagai custom hook `useDuplicateCheck` yang dapat diimpor dan digunakan di `upload.tsx` dengan minimal perubahan pada kode yang sudah ada.

---

### Requirement 7: Performa dan Pengalaman Pengguna

**User Story:** Sebagai petugas lapangan yang sering bekerja di lapangan dengan koneksi internet tidak stabil, saya ingin fitur pengecekan duplikasi tidak memperlambat aplikasi atau mengganggu alur kerja utama saya.

#### Acceptance Criteria

1. THE DuplicateChecker SHALL menggunakan Debounce 300 milidetik pada input `namaJalan` untuk mengurangi jumlah request ke CheckDuplicateAPI.
2. THE DuplicateChecker SHALL membatalkan request CheckDuplicateAPI yang sedang berjalan (menggunakan `AbortController`) jika ada request baru yang dipicu sebelum request sebelumnya selesai.
3. IF CheckDuplicateAPI tidak merespons dalam 10 detik, THEN THE DuplicateChecker SHALL menghentikan request dan menampilkan state kosong tanpa menampilkan pesan error kepada petugas.
4. THE DuplicateChecker SHALL tidak memblokir proses submit laporan — jika pengecekan duplikasi gagal, petugas tetap dapat mengirim laporan.
5. THE MapView SHALL menggunakan lazy loading (dynamic import) agar tidak memperlambat waktu muat awal halaman upload.
6. THE DuplicateChecker SHALL hanya memanggil CheckDuplicateAPI jika minimal satu dari kondisi berikut terpenuhi: koordinat GPS tersedia, atau field `district` terisi, atau field `road_name` memiliki minimal 3 karakter.

---

### Requirement 8: Konsistensi Data Nama Jalan via Reverse Geocoding

**User Story:** Sebagai administrator sistem, saya ingin data nama jalan di database konsisten tanpa variasi penulisan, sehingga pencarian dan analisis data laporan menjadi akurat dan dapat diandalkan.

#### Acceptance Criteria

1. WHEN `locationState.status === 'success'` (koordinat GPS berhasil didapatkan), THE DuplicateChecker SHALL secara otomatis mengirim request ke NominatimAPI dengan koordinat tersebut untuk mendapatkan nama jalan dan kecamatan melalui proses ReverseGeocoding.
2. WHEN NominatimAPI mengembalikan response yang berhasil, THE DuplicateChecker SHALL mengisi field `namaJalan` dengan nilai nama jalan dari hasil ReverseGeocoding dalam format standar yang konsisten.
3. WHEN NominatimAPI mengembalikan response yang berhasil, THE DuplicateChecker SHALL mengisi field `district` dengan nilai kecamatan dari hasil ReverseGeocoding jika kecamatan tersebut termasuk dalam daftar 18 kecamatan Kabupaten Sidoarjo yang valid.
4. WHILE `locationState.status === 'success'`, THE DuplicateChecker SHALL menjaga field `namaJalan` dan `district` dalam kondisi read-only sehingga petugas tidak dapat mengubah nilai yang sudah diisi oleh ReverseGeocoding.
5. WHEN `locationState.status` berubah menjadi nilai selain `'success'` (GPS dimatikan, gagal, atau timeout), THE DuplicateChecker SHALL mengubah field `namaJalan` dan `district` kembali menjadi dapat diedit (editable) oleh petugas.
6. IF NominatimAPI tidak merespons dalam 5 detik atau mengembalikan error, THEN THE DuplicateChecker SHALL membiarkan field `namaJalan` dan `district` tetap dapat diedit secara manual oleh petugas tanpa menampilkan pesan error yang mengganggu.
7. IF NominatimAPI mengembalikan nama kecamatan yang tidak termasuk dalam daftar 18 kecamatan Kabupaten Sidoarjo, THEN THE DuplicateChecker SHALL membiarkan field `district` tetap pada nilai sebelumnya dan mengaktifkan field tersebut untuk diisi manual oleh petugas.
8. THE DuplicateChecker SHALL menggunakan instance NominatimAPI yang sama dengan yang sudah digunakan oleh hook `useLocationFromPhoto` yang ada, tanpa membuat request duplikat ke NominatimAPI untuk koordinat yang sama.

---

### Requirement 9: Filter Keamanan Image Hash

**User Story:** Sebagai administrator sistem, saya ingin sistem menolak foto yang identik dengan foto yang sudah ada di database, sehingga petugas tidak dapat mengirim laporan ganda menggunakan foto yang persis sama.

#### Acceptance Criteria

1. THE ReportController SHALL menghitung nilai ImageHash dari konten biner file gambar yang diunggah sebelum melakukan penyimpanan file atau pemanggilan ke AI Server.
2. WHEN nilai ImageHash dari foto yang diunggah sudah ditemukan pada kolom `image_hash` di tabel `reports`, THE ReportController SHALL menolak request dengan HTTP status 422 dan error code `DUPLICATE_IMAGE` tanpa meneruskan proses ke AI Server.
3. THE ReportController SHALL melakukan pengecekan ImageHash di dalam method `store()`, setelah validasi input dan setelah pengecekan EXIF, tetapi sebelum penyimpanan file ke storage.
4. WHEN laporan baru berhasil disimpan ke database, THE ReportController SHALL menyimpan nilai ImageHash dari foto tersebut ke kolom `image_hash` pada record laporan yang baru dibuat.
5. THE Database SHALL memiliki kolom `image_hash` bertipe VARCHAR(32) yang bersifat nullable dan memiliki index pada tabel `reports`, ditambahkan melalui migration baru.
6. THE Database SHALL memiliki constraint unique pada kolom `image_hash` untuk memastikan tidak ada dua laporan yang memiliki nilai ImageHash yang sama (kecuali nilai NULL).
7. IF penghitungan ImageHash gagal karena alasan teknis (file corrupt, dll), THEN THE ReportController SHALL mencatat warning di log sistem dan melanjutkan proses penyimpanan laporan tanpa ImageHash, agar laporan tetap dapat disimpan.
8. WHEN AddEvidenceAPI menerima foto baru sebagai EvidenceAttachment, THE AddEvidenceAPI SHALL juga menghitung dan memeriksa ImageHash dari foto tersebut sebelum menyimpannya, dengan aturan yang sama seperti pada pembuatan laporan baru.

---

### Requirement 10: Add Evidence API (Endpoint Penambahan Bukti)

**User Story:** Sebagai petugas lapangan, saya ingin dapat menambahkan foto bukti saya ke laporan yang sudah ada tanpa membuat laporan baru, sehingga data kerusakan jalan yang sama tidak tersebar di banyak laporan terpisah.

#### Acceptance Criteria

1. THE AddEvidenceAPI SHALL menerima request `POST /api/v1/reports/{id}/add-evidence` dengan payload berupa file foto (multipart/form-data) dan nama petugas yang mengirim bukti.
2. WHEN request diterima dengan `id` laporan yang valid dan foto yang valid, THE AddEvidenceAPI SHALL menyimpan foto tersebut sebagai EvidenceAttachment yang terhubung ke laporan dengan `id` tersebut.
3. WHEN EvidenceAttachment berhasil disimpan, THE AddEvidenceAPI SHALL menaikkan nilai `support_count` pada laporan yang bersangkutan sebesar 1.
4. WHEN request diterima dengan `id` laporan yang tidak ditemukan di database, THE AddEvidenceAPI SHALL mengembalikan HTTP status 404 dengan pesan error yang informatif.
5. THE AddEvidenceAPI SHALL memvalidasi file foto yang diterima dengan aturan yang sama dengan endpoint pembuatan laporan baru: format JPEG/PNG, ukuran maksimal 5MB.
6. IF file foto yang dikirim ke AddEvidenceAPI memiliki ImageHash yang sudah ada di database (foto identik), THEN THE AddEvidenceAPI SHALL mengembalikan HTTP status 422 dengan error code `DUPLICATE_IMAGE`.
7. THE AddEvidenceAPI SHALL mengembalikan response JSON dengan HTTP status 200 yang berisi data laporan yang diperbarui, termasuk nilai `support_count` terbaru dan daftar EvidenceAttachment yang terhubung.
8. THE AddEvidenceAPI SHALL dapat diakses oleh petugas yang sudah terautentikasi (memerlukan token autentikasi yang valid), berbeda dengan CheckDuplicateAPI yang bersifat publik.
9. THE Database SHALL memiliki tabel `report_evidences` dengan kolom minimal: `id`, `report_id` (foreign key ke tabel `reports`), `image_path`, `image_hash`, `reporter_name`, dan `created_at`, ditambahkan melalui migration baru.
10. WHEN AddEvidenceAPI berhasil memproses request, THE AddEvidenceAPI SHALL mencatat aktivitas penambahan bukti di log sistem dengan informasi: `id` laporan, nama petugas, dan timestamp.
