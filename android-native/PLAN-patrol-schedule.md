# PLAN-patrol-schedule — Jadwal Cek Rutin (Patroli) untuk Supervisor di Android Native

> Status: **analisis selesai, siap eksekusi** (belum menulis kode fitur).
> Referensi utama: `Frontend-stable/` (web) — sudah berjalan penuh.
> Aturan kerja: tanpa perubahan backend, tanpa commit otomatis, `gradlew` diotorisasi,
> **device testing butuh izin per-sesi** (lihat `AGENTS.md`).
> Dokumen ini = hasil analisis mendalam; belum ada file fitur yang dibuat.

---

## 1. Ringkasan fitur di web (fakta dari kode)

Supervisor membuat **pola patroli rutin** untuk tim satgas; sistem lalu **men-generate
"shift/task" per tanggal** otomatis. Fitur tersebar di:

| Berkas web | Baris | Peran |
|---|---|---|
| `routes/supervisor/patrol-schedule.tsx` | 15 | Layout (PageLayout + Outlet) |
| `routes/supervisor/patrol-schedule/index.tsx` | 715 | **Halaman utama**: hero, daftar kartu, 3 modal (create/edit, generate, delete), + `ScheduleCard` |
| `routes/supervisor/patrol-schedule.detail.tsx` | 409 | **Detail**: info + kalender bulanan hari patroli |
| `components/jk/PatrolScheduleCard.tsx` | 294 | Kartu pola mingguan (dipakai dashboard petugas) |
| `components/jk/PatrolMap.tsx` | 159 | Peta (dipakai halaman lain) |
| `hooks/usePatrolScheduleQueries.ts` | 165 | 6 query/mutation React-Query |
| `routes/detail-patroli.tsx` | 272 | (Petugas) sesi patroli + daftar laporan |

**Prinsip bisnis yang terbaca dari kode:**
1. Satu tim hanya boleh punya **1 jadwal aktif** (server 409; UI menyembunyikan tim yang
   sudah punya jadwal aktif dari picker saat create).
2. `hari` wajib **minimal 3** di server (`required|array|min:3`), tapi **UI web memvalidasi min 2**
   (`form.hari.length < 2`) → **inkonsistensi**; kalau user pilih 2, server balas 422.
3. `kecamatan_list` **otomatis terisi dari wilayah UPTD tim** saat tim dipilih
   (`team.uptd.kecamatan_wilayah`), user tidak memilih manual.
4. Saat `store`, server **langsung generate task** untuk rentang `start_date` s/d
   `end_date` (atau +2 minggu bila `end_date` kosong).
5. `toggle` mengubah `aktif ↔ nonaktif`. `generate` menambah task untuk rentang baru.
6. `jam_mulai`/`jam_selesai` ada di DB & form server, **tapi TIDAK ada di form web** —
   web pakai default tampil `07:00–16:00` di detail (fallback string).

---

## 2. Kontrak API (backend — dibaca dari `routes/api.php` + `PatrolScheduleController`)

Semua `auth:sanctum`. Gate role **di dalam controller** (403 bila tak cocok):

| Endpoint | Gate | Body / catatan |
|---|---|---|
| `GET /patrol-schedules?team_id&status&per_page` | supervisor/admin/petugas (petugas auto-scope `team_id`+`status=aktif`) | **paginator** `{data[], current_page, last_page, total, per_page}` |
| `GET /patrol-schedules/preview` | supervisor/admin | **GET** aneh tapi validasi `hari*`, `kecamatan_list*`, `start_date` → `preview{total_hari, hari_patroli, kecamatan_count, estimated_tasks, start_date, end_date}` |
| `POST /patrol-schedules` | supervisor/admin | `team_id`, `hari[≥3]`, `kecamatan_list[≥1]`, `frekuensi`, `start_date` (≥today), `end_date?`, `alasan_tugas?`, `jam_mulai?`, `jam_selesai?` → 201 `{data, message}`; **409** bila tim sudah punya jadwal aktif |
| `GET /patrol-schedules/{id}` | supervisor/admin | `{data: schedule + team.surveyTasks(status aktif, dlm rentang, withCount reports)}` |
| `PUT /patrol-schedules/{id}` | supervisor/admin | field `sometimes`; **regenerate task** bila `hari/kecamatan_list/frekuensi/start_date/end_date/team_id` berubah |
| `DELETE /patrol-schedules/{id}` | supervisor/admin | hapus task aktif tanpa laporan (<30 hari), lalu jadwal |
| `POST /patrol-schedules/{id}/generate` | supervisor/admin | `start_date`, `end_date` (wajib); **422** bila jadwal nonaktif → `{generated_count, message}` |
| `POST /patrol-schedules/{id}/toggle` | supervisor/admin | tanpa body → `{data, message}` |

**DTO web (`types/survey.ts`):**
`PatrolSchedule{id, team_id, team{id,name,description?}, hari[], kecamatan_list[], frekuensi, start_date, end_date|null, alasan_tugas, status:"aktif"|"nonaktif", jam_mulai?, jam_selesai?, created_by, created_at, updated_at, tasks_count?}`.
`SurveyTask{id, road_name, kecamatan, ..., tanggal_patroli?, jam_mulai?, jam_selesai?, status:"aktif"|"selesai"|"dibatalkan", reports_count?}`.
`Hari = Senin..Sabtu` (7 hari penuh hanya di `PatrolScheduleCard`).
`Frekuensi = setiap_minggu|dua_mingguan|bulanan`.
`PatrolPreview{total_hari, hari_patroli, kecamatan_count, estimated_tasks, start_date, end_date}`.

---

## 3. Spesifikasi UI/UX web (yang harus ditiru)

### 3.1 Halaman daftar (`patrol-schedule/index.tsx`)
- **Hero** gradien biru `#1e40af→#2e68d8`, teks "Selamat {pagi/siang/sore}, {nama}" +
  subjudul "Atur pola patroli rutin tim satgas" + badge "SUPERVISOR".
- Baris judul "Daftar Jadwal Patroli" + tombol **"+ Jadwal Baru"** (biru `#1A4F8A`).
- **Empty state**: ikon `calendar_month` besar redup + "Belum ada jadwal patroli rutin" +
  tombol "Buat Jadwal Baru".
- **Grid kartu** `grid-cols-1 md:grid-cols-2 @[1100px]:grid-cols-3 gap-4` (→ native: 1 kolom di HP).
- **Muat**: teks "Memuat data..." (web belum pakai skeleton di sini).

**`ScheduleCard`** (index.tsx:596-715):
- Header: kotak ikon `calendar_month` (`#EEF3FA`) + nama tim (tebal) + label frekuensi;
  kanan = **toggle switch** (`aktif` biru / `nonaktif` abu).
- Baris chip **7 hari** (`Sen..Sab`); hari aktif biru, nonaktif abu.
- Baris chip **kecamatan** (max 5 + "+N").
- Baris periode: `start — end` atau `start — ∞`, + badge status Aktif/Nonaktif.
- Footer aksi: **Detail** (biru) · **Edit** (abu) · **Hapus** (merah, `ml-auto`).

**Modal Create/Edit** (`ModalBase`): field
`Tim Satgas*` (**SearchSelect**, saat create hanya tim tanpa jadwal aktif) ·
`Hari Patroli*` (chip toggle Sen–Sab, hint "Terpilih: … (minimal 2)") ·
`Kecamatan*` (read-only chips, "otomatis berdasarkan wilayah tim") ·
`Frekuensi` (3 tombol) · `Mulai*`/`Selesai?` (date, "Kosongi untuk tanpa batas") ·
`Jenis Tugas` (select: Rutin/Tindak Lanjut/Pengaduan). Footer Batal + Simpan/Perbarui.

**Modal Generate**: `Dari Tanggal` / `Sampai Tanggal` (default: hari ini → +14 hari).

**Modal Delete**: konfirmasi teks "Shift aktif yang belum memiliki laporan akan ikut dihapus."

### 3.2 Halaman detail (`patrol-schedule.detail.tsx`)
- Hero: "Detail Jadwal Patroli" + nama tim.
- Kartu info: Frekuensi · Status · Periode · **Jam Patroli** (default 07:00–16:00 WIB) ·
  Jenis Tugas; baris chip hari + chip kecamatan.
- **Kalender bulanan**: navigasi ◀ ▶ bulan, header "Sen..Min" (7 kolom), sel tanggal:
  - hari patroli tanpa task → border biru muda `bg-[#EFF6FF]`;
  - hari patroli **dengan task** → hijau `bg-[#ECFDF5]` + ikon check + "N laporan";
  - hari ini → lingkaran biru penuh;
  - nama kecamatan kecil di sel.
  - footer: jumlah "N hari patroli" + "M task sudah digenerate".
- Legenda 3 item (jadwal / task digenerate / hari ini).

### 3.3 Kartu dashboard petugas (`PatrolScheduleCard.tsx`, sudah ada read-only di native)
- Kartu per tim: header nama tim + periode, kartu hari (highlight "Hari ini"),
  baris "Pekan" ringkas, tombol "Lihat Wilayah" → dropdown tautan Google Maps per kecamatan.
- Sudah dipakai native `DashboardExtras.kt` (mode read-only). **Tidak diubah** kecuali perlu.

---

## 4. Kondisi native saat ini (hasil pemeriksaan)

**Sudah ada (read-only, untuk petugas):**
- `PatrolScheduleDto` (`core/network/DashboardModels.kt:82`) — subset field.
- `ApiService.patrolSchedules(team_id, status)` — `ApiEnvelope<List<PatrolScheduleDto>>`.
- `DashboardRepository.patrolSchedules(teamId)` + `DashboardViewModel.schedules`
  + `DashboardExtras` menampilkan jadwal petugas.
- `KECAMATAN_SIDOARJO` (18 kecamatan) di `Models.kt`.
- Token/composable UI: `BrandPrimaryButton`, `BrandSecondaryButton`, `BrandTextField`,
  `WarningBox/InfoBox/ErrorBox/SuccessBox`, `StatusBadge`, `EmptyState`, `SkeletonCard`,
  `DeltaTopBar`, `ReportMapScreen`, dropdown kecamatan.

**Belum ada (yang harus dibangun):**
- CRUD supervisor: create/edit/delete/toggle/generate/preview.
- DTO penuh `PatrolSchedule` (tim + uptd), `SurveyTask`, `TeamDto.uptd.kecamatan_wilayah`.
- Layar: Daftar Jadwal, Detail (kalender), + entri navigasi di `SupervisorScaffold`.
- `SearchSelect` padanan (picker tim dengan cari).
- BBOX kecamatan (untuk "Lihat Wilayah"/peta) — **native belum punya**.

**Risiko/inkonsistensi yang sudah teridentifikasi di web (jangan ditiru mentah):**
1. Validasi hari: UI web "min 2" vs server "min 3" → **native pakai min 3** agar tak 422.
2. `patrol-schedules/preview` memakai **GET** padahal ada body → di Retrofit harus
   dikirim sebagai query params (`@Query`), bukan `@Body` (GET tak boleh body).
3. Web create tidak punya field jam; native: **ikuti web** (tanpa jam) atau tambah jam
   sebagai enhancement — keputusan saat eksekusi (default: ikuti web, tanpa jam).
4. `index` mengembalikan **paginator**, bukan `{data}` polos. DTO native existing
   `ApiEnvelope<List<PatrolScheduleDto>>` tetap bekerja karena `data` array, tapi
   `last_page` terbuang → untuk supervisor perlu DTO paginator.

---

## 5. Rencana arsitektur native

```
core/network/PatrolModels.kt            # DTO baru (PatrolScheduleDto penuh, TeamDto, SurveyTaskDto, PreviewDto, request bodies)
core/network/ApiService.kt              # + 7 endpoint patrol (create/update/delete/toggle/generate/preview/listPaginated/detail)
core/data/PatrolRepository.kt           # isolasi endpoint supervisor patrol
feature/supervisor/PatrolViewModel.kt   # state list/form/detail/preview
feature/supervisor/PatrolListScreen.kt  # daftar + 3 modal (create/edit, generate, delete)
feature/supervisor/PatrolDetailScreen.kt# detail + kalender bulanan
feature/supervisor/components/PatrolScheduleCardS.kt  # kartu (port index ScheduleCard)
feature/supervisor/components/TeamSearchSelect.kt     # picker tim (port SearchSelect)
ui/util/KecamatanBbox.kt                # port KECAMATAN_BBOX (untuk "Lihat Wilayah")
```
Navigasi: tambah entri di `SupervisorScaffold` (mis. tombol "Jadwal Patroli" di Beranda,
atau tab/aksi). Detail = `SupervisorScreen.PATROL_DETAIL` dgn `scheduleId`.

---

## 6. Fase eksekusi

| Fase | Isi | Verifikasi |
|---|---|---|
| **PS1** | `PatrolModels.kt` + endpoint `ApiService` + `PatrolRepository` | compile |
| **PS2** | `PatrolViewModel` (list/preview/CRUD state) | compile |
| **PS3** | Daftar: hero + grid kartu + empty state + toggle/aksi | compile |
| **PS4** | Modal create/edit (TeamSearchSelect + chip hari min-3 + kecamatan auto + frekuensi + date + jenis) | compile |
| **PS5** | Modal generate + modal delete + snackbar hasil | compile |
| **PS6** | Detail + kalender bulanan + legenda | compile |
| **PS7** | Navigasi di `SupervisorScaffold` + wiring | compile |
| **PS8** | `assembleDebug` + (dengan izin) uji device + screenshot vs web | build hijau |

---

## 7. Pertanyaan/keputusan yang perlu dikonfirmasi sebelum eksekusi

1. **Titik masuk**: taruh "Jadwal Patroli" sebagai **tombol di Beranda supervisor**,
   tab bottom-nav baru, atau kartu di Beranda? (web: rute `/supervisor/patrol-schedule`.)
2. **Field jam** (`jam_mulai/jam_selesai`): ikut web (tanpa field jam, detail pakai
   default 07:00–16:00) atau tambah input jam? (default usulan: ikut web dulu.)
3. **Preview**: web punya endpoint `/preview` tapi `index.tsx` **tidak memperlihatkan**
   preview ke user (hook `usePatrolPreview` ada tapi tak dipakai di halaman).
   Native: pakai preview sebagai konfirmasi sebelum simpan, atau lewati seperti web?
4. **Cakupan**: full CRUD + detail (rekomendasi), atau daftar + create saja dulu?

---

## 9. HASIL CROSSCHECK (verifikasi plan vs kode aktual)

Diverifikasi langsung ke `routes/api.php`, `PatrolScheduleController.php`, `TeamController.php`,
`Uptd.php`, `SurveyTask.php`, `SupervisorModels.kt`, `SupervisorScaffold.kt`.

**Koreksi terhadap plan (klaim awal salah/ kurang tepat):**

| # | Klaim awal | Fakta aktual | Dampak |
|---|---|---|---|
| C1 | "default jam 07:00–16:00" | **DB default `09:00–16:00`** (migration `..._add_jam...`). `detail.tsx` menampilkan `07:00` sebagai fallback string saat `jam_mulai` null → itu **bug tampilan web**, bukan default server | Native: JANGAN hardcode 07:00; pakai nilai server, fallback apa pun harus diberi komentar |
| C2 | `TeamDto` siap dipakai utk auto-isi kecamatan | **`TeamUptdDto` native TIDAK punya `kecamatanWilayah`** — padahal web mengandalkan `team.uptd.kecamatan_wilayah` | **Wajib tambah** `@Json("kecamatan_wilayah") kecamatanWilayah: List<String>?` (kolom `json` + cast array → aman) |
| C3 | "web min 2 vs server min 3" | Terkonfirmasi: web `min < 2` (index.tsx:212), server `min:3` di **store+update+preview** | Native pakai **min 3** (bukan 2) — kalau ikut web, 422 |
| C4 | Titik masuk "tombol di Beranda" | `SupervisorDashboardScreen` **tidak punya** param `onOpenPatrol`; `SupervisorScreen` enum belum punya `PATROL`/`PATROL_DETAIL` | Perlu ubah signature + tambah 2 nilai enum + cabang `when(screen)` |

**Klaim yang terkonfirmasi benar:**
- `preview` = **GET** (routes/api.php:361) — walau validasi pakai body; Retrofit harus `@Query`.
- `usePatrolPreview` **didefinisikan tapi tidak dipakai** di web (grep: hanya definisi di hook).
- Form create web **tanpa field jam** (grep `jam_mulai` di index.tsx = nol) — DB punya default.
- Kecamatan auto-isi dari `team.uptd.kecamatan_wilayah` (index.tsx:366).
- `GET /patrol-schedules` gate supervisor/admin/**petugas**; store/update/delete/generate/toggle/preview = supervisor/admin saja.
- `show()` memuat `team.surveyTasks` (status aktif, dlm rentang) + `withCount('reports')` ✓.
- Satu tim = 1 jadwal aktif (store 409) ✓.
- `if($schedule->status !== 'aktif') 422` pada `generate` ✓.
- `Uptd.kecamatan_wilayah` = kolom `json`, cast `array` → serialisasi array string ✓.

**Catatan arsitektur navigasi native:** `SupervisorScaffold` memakai `enum SupervisorScreen`
+ `when(screen)`. Menambah alur patrol berarti: `+PATROL`, `+PATROL_DETAIL` di enum, cabang baru
di `when`, dan param `onOpenPatrol` di `SupervisorDashboardScreen`. Detail patrol butuh
`scheduleId` (pola `detailId` yang sudah ada) → boleh reuse `remember { mutableStateOf<String?>(null) }`.

**Belum diverifikasi (di luar jangkauan tanpa jaringan/device):**
- Bentuk persis JSON `GET /teams` saat runtime (kesimpulan di atas dari kode + cast, bukan crash-test).
- Perilaku `generate` nyata (butuh server + data).

## 10. Out-of-scope

Perubahan backend, FCM deep-link, laporan tugas petugas (sudah ada read-only),
edit jam patroli di kode petugas, export.
