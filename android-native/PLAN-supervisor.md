# PLAN-supervisor — Role Supervisor di Android Native

> Status: **in progress** — S1 dieksekusi. Dikoreksi hasil crosscheck mendalam backend+web+native
> (5 koreksi: guard `source` `confirm-ai`, presisi `duplicateOf` list, alasan `filterStatus`,
> auto-refresh bukan "port web", bukti grep DTO).
> Keputusan scope: **S1 + S2** (fondasi + triase inti). Tanpa bulk approve/tolak, tanpa export PDF.
> Referensi UI/UX: `Frontend-stable/` (web) + bahasa desain hasil adaptasi warga (`AGENTS.md`, `DESIGN.md`).
> Aturan kerja: tanpa perubahan backend, tanpa commit otomatis, `gradlew` + `adb install` diotorisasi.

---

## 1. Latar & kondisi awal

- Aplikasi native hari ini tidak mengenal supervisor: login multi-role lolos, tapi `MainActivity.Root`
  hanya bercabang `warga → WargaScaffold`, sisanya (`else`) → `MainScaffold` petugas 1:1.
  Kata "supervisor" di codebase hanya muncul di teks/komentar, bukan logika: empty-state
  (`Tabs.kt:73`), komentar (`LoginScreen.kt:50`, `AuthViewModel.kt:83`), konstanta
  (`AuthRepository.kt:134,141`). (`SupervisorJob` di `DeltaJalanMessagingService` adalah
  coroutines, bukan role.)
- Tidak ada `SupervisorViewModel`, layar supervisor, endpoint review/disposisi/assign, maupun DTO-nya.
  (Crosscheck: `grep -rn "review|disposisi|approve" core/network/Models.kt` = **NOL hasil**; hanya ada
  field `assigned_team_id/assigned_team_name/assigned_supervisor_id` — yaitu `assign` sebagai substring.
  Tidak ada DTO triase/review sama sekali.)
- Backend **siap penuh**: semua endpoint ada, gate role di controller (sebagian tanpa cek role —
  andalkan FE memilih endpoint yang benar). `GET /uprs` tidak ada (UPR dihapus → `teams` + `uptd_id`).
- Web acuan: `routes/supervisor.tsx` (guard `role === 'supervisor'`), `supervisor/index.tsx`,
  `supervisor/review.tsx`, `supervisor/patrol-schedule/`, `detail-report.tsx` (footer role-aware),
  `map.tsx` (shared; hanya `back` + `userRole` yang role-aware). `stats.tsx` BUKAN acuan bersama —
  ia hanya load bila `role === 'supervisor'`, jangan port sebagai layar umum.

---

## 2. Kontrak API (backend — dibaca dari `routes/api.php` + controller, bukan ditebak)

Semua di bawah `auth:sanctum`. Gate supervisor di **dalam controller** (`403` bila role tak cocok).

### 2.1 Triase / review (inti)

| Endpoint | Gate / syarat status | Body / catatan |
|---|---|---|
| `GET /reports` | scope `assigned_supervisor_id = me OR NULL`, exclude `Diedit` | query: `status, q, source, severity, uptd_id, pci, sort_by, limit, page`; resp list memetakan HANYA `assigned_team_name, photos_count, is_duplicate, duplicate_score` — objek `duplicate_of` nested TIDAK diekspos di list (query `index()` memang eager-load `duplicateOf.originalReport`, tapi tidak ikut dipetakan ke output) |
| `GET /reports/{id}` | supervisor bebas (gate 403 hanya untuk `petugas`: milik/tim) | detail + foto, `system_notes`, PCI, duplikat (`duplicate_of{id, report_code, …, score, match_type, status}`) |
| `POST /reports/{id}/mulai-review` (supervisor+admin, else 403) | harus `Menunggu Review` → `Ditinjau`; idempoten (200 `"OK."` tanpa mutasi bila status lain) | tanpa body; auto-dipanggil HANYA dari `detail-report.tsx` (drawer review TIDAK memanggilnya — status antrean tetap sampai dibuka di detail/approve) |
| `POST /reports/{id}/approve` | **tanpa cek role**; hanya `Menunggu Review/Ditinjau` else 422 | `priority?`; `source petugas` → langsung `Ditugaskan` ke `reporter.team_id` (422 bila pelapor tanpa tim); `source warga/telegram` → `Hasil AI` (lanjut `analyze-ai`) |
| `POST /reports/{id}/approve-and-assign` | `source in [warga, telegram]`; `Menunggu Review/Ditinjau` → `Ditugaskan` | `priority?, assigned_team_id?` (auto `Uptd::resolveTeamIdByDistrict` bila kosong; 422 `needs_team:true` bila tak ketemu); hitung PCI; notif pelapor + tim |
| `POST /reports/{id}/tolak` | **tanpa cek role**; hanya `Menunggu Review/Ditinjau` else 422 | `alasan` wajib (max 100), `catatan?` (max 500) → `Ditolak` + `system_notes [REJECTED]` (batas hanya validasi server — web TIDAK enforce `maxLength`, native wajib enforce sendiri) |
| `POST /reports/{id}/analyze-ai` | harus `Hasil AI` else 422; foto wajib ada di disk | forward sinkron FastAPI; 502 bila AI gagal |
| `POST /reports/{id}/confirm-ai` | harus `Hasil AI` → `Ditugaskan` (**tanpa cek role DAN tanpa cek `source`**) | auto tim via district; 422 bila tak terpetakan — TANPA flag `needs_team` (retry manual tak didukung; beda dari `approve-and-assign`). ⚠️ native WAJIB guard `source` di tombol konfirmasi: endpoint ini akan menugaskan laporan `source=petugas` juga bila statusnya `Hasil AI` |
| `POST /reports/{id}/disposisi` | **DEPRECATED** (`Log::warning`) | jangan dipakai; alur baru `approve(-and-assign)` → `mulai()` oleh tim |
| `DELETE /reports/{id}/duplicate` (supervisor only) | baris `report_duplicates` harus ada else 404 | hapus marking saja, laporan tetap |
| `DELETE /reports/{id}` | `user_id == me OR role == supervisor`; status `Menunggu Review/Ditinjau/Diedit/Ditolak` else 422 | hapus file storage + cascade |
| `POST /reports/{id}/reopen` | harus `Selesai` → `Sedang Diperbaiki` (**TANPA cek role — server mengizinkan siapa pun**) | aksi eksekusi petugas; supervisor JANGAN panggil — wajib guard client eksplisit karena server tidak menjaga |

### 2.2 Statistik / wilayah (eksklusif supervisor)

| Endpoint | Catatan |
|---|---|
| `GET /reports/stats` | scope supervisor; `{total, menunggu_review (gabung), disetujui, ditolak, hasil_ai, ditugaskan, sedang_diperbaiki, selesai, rusak_berat/sedang/ringan, monthly_trend[6]}`; cache 60 dtk | NUANSA: scope `stats` = `assigned_supervisor_id = me` SAJA (tanpa NULL) — lebih sempit dari scope `GET /reports` (`me OR NULL`). `monthly_trend` hanya berisi `{bulan, total, menunggu_review, disetujui, ditolak, sedang_diperbaiki, selesai, rusak_berat}` (tanpa `hasil_ai/ditugaskan`) |
| `GET /reports/stats-by-team` | tanpa scope; per tim `{total, ditugaskan, sedang_diperbaiki, selesai, total_panjang_m, total_luas_m2}`; cache 120 dtk | tanpa cek role (semua role auth bisa panggil) |
| `GET /reports/map-data` | BUTUH `auth:sanctum` — BUKAN endpoint peta publik warga (`GET /public/reports/map-overview`, tanpa auth) | agregat kecamatan + ≤1000 marker; resp `{districts, reports, stats{total, by_severity, by_status, terlambat_count, …}}` |
| `GET /supervisor/regions` (`!== supervisor → 403`, admin pun 403) | `{uptds[id, nama, kecamatan_wilayah], label, districts[]}` — pengganti endpoint UPTD |
| `GET /teams` (gate supervisor+admin, else 403; param `limit` DIABAIKAN — selalu semua tim + `members_count` + `uptd`) | nama tim untuk collapsible UPTD + picker assign (tim valid = lolos `Team::find` di `approveAndAssign`) |
| `GET /pci/overview` (tanpa 403; non-admin di-scope `assigned_supervisor_id = me`) | `{districts[{district, total, avg_pci, min_pci, max_pci, kritis}], kabupaten{total_laporan, avg_pci, kritis}}`; cache 120 dtk |

### 2.3 Endpoint yang disengaja TIDAK dipakai supervisor

Dua kelompok — bedakan alasannya karena menentukan guard client:

**A. Benar-benar 403 untuk supervisor (server menjaga):**
`mulai-edit / batal-edit / PUT /reports/{id}` (petugas-only + harus pemilik), `update-triage`
(petugas tim ter-assign, status `Disetujui/Sedang Diperbaiki`).

**B. Server MENGIZINKAN tapi dilarang disiplin client (server TIDAK 403 — wajib guard di native):**
`mulai` (route `POST /reports/{id}/mulai`, bukan `/selesaikan`; cek tim hanya untuk petugas),
`updateProgress` (`POST …/progress`), `complete` (`POST …/complete`, bukan `/selesaikan`),
`reopen` (TANPA cek role sama sekali — bahkan warga bisa panggil). Tanpa guard client + tombol
yang disembunyikan, supervisor bisa memicu transisi eksekusi dari aplikasi.

**C. Hak supervisor, ditunda ke S3 sebagai keputusan scope (BUKAN "milik peran lain" / bukan 403):**
`users / settings` (gate supervisor+admin), patrol-schedule + survei write (gate supervisor+admin;
`index` patroli bahkan mengizinkan petugas). Jangan tulis komentar "admin area" — keliru.

---

## 3. Aturan bisnis kritis (wajib jadi komentar kode + guard client)

1. **Routing approve per `source`** — server `approve`/`tolak`/`confirm-ai` TIDAK cek role.
   FE wajib: `source == petugas` → `POST approve`; `source in [warga, telegram]` →
   `POST approve-and-assign`. Salah pilih → 422 atau laporan macet di `Hasil AI`.
   **`confirm-ai` juga TIDAK cek `source`** — guard client wajib memastikan tombol konfirmasi hanya
   muncul untuk `source in [warga, telegram]`; jika tidak, laporan `petugas` ber-status `Hasil AI`
   bisa ikut ditugaskan lewat endpoint itu.
2. **`needs_team:true`** — HANYA di-emit oleh `approve-and-assign` 422. Bila flag ini muncul,
   buka picker tim (`GET /teams`), lalu ulangi dengan `assigned_team_id`. PERHATIAN: `confirm-ai`
   yang gagal petakan tim juga 422 TAPI tanpa flag ini — retry manual tidak didukung di endpoint itu.
3. **Transisi status ketat** — aksi hanya untuk `Menunggu Review/Ditinjau` (approve/tolak),
   `Hasil AI` (confirm-ai). Di luar itu server 422 → tampilkan pesan transisi, bukan generik.
4. **Hapus** — supervisor boleh hapus status apa pun yang diizinkan server
   (`Menunggu Review/Ditinjau/Diedit/Ditolak`); web membatasi ke `Ditolak` — ikuti kontrak
   backend yang lebih longgar + dialog konfirmasi.
5. **`mulai-review` idempoten** — aman dipanggil tiap buka detail (status lain → 200 `"OK."`
   tanpa mutasi); jangan jadikan error. CATATAN: auto-call hanya ada di `detail-report.tsx`
   — drawer review web TIDAK memanggilnya, jadi jangan asumsikan status antrean berubah saat
   item dibuka dari antrean (butuh refresh eksplisit setelah aksi — lihat Risiko 2).

---

## 4. Arsitektur native (ikuti pola warga, bukan pola baru)

```
feature/supervisor/
├── SupervisorScaffold.kt      # bottom-nav: Beranda, Review, Peta, Profil (+ state DETAIL/AKSI)
├── SupervisorDashboardScreen.kt
├── SupervisorReviewScreen.kt  # antrean + layar aksi (pengganti ReviewDrawer 2-panel web)
├── SupervisorDetailScreen.kt  # reuse pola WargaDetailScreen + aksi supervisor
├── SupervisorPetaScreen.kt    # reuse komponen peta (lihat §6)
├── SupervisorViewModel.kt
core/data/SupervisorRepository.kt
core/network/  += endpoint + DTO (RegionDto, TeamDto, PciOverviewDto, request bodies)
```

- `MainActivity.Root`: cabang ketiga `role == supervisor → SupervisorScaffold`
  (sejajar `warga → WargaScaffold`, sisanya `MainScaffold`).
- Isolasi endpoint ala `WargaRepository` (header komentar ATURAN KERAS) + error mapping 422
  spesifik reuse pola `parseSubmitError` (`WargaRepository.kt`).
- State ViewModel ala `WargaViewModel` (`loading/errorMessage/sessionExpired`,
  `loadX(force)`, paginasi `historyPage/historyLastPage`).

---

## 5. Spesifikasi layar (port web)

### 5.1 Dashboard triase (port `supervisor/index.tsx`)

- Header wilayah (`GET supervisor/regions`): label + UPTD yang disupervisi.
- 4 kartu statistik (`GET reports/stats`): Total / Perlu Review (`menunggu_review`) /
  Ditugaskan (`ditugaskan`) / Diperbaiki (`sedang_diperbaiki`). Reuse `StatCard`.
- Ringkasan PCI (`GET pci/overview`): skor kabupaten + jumlah kritis + rincian per kecamatan
  (list sederhana; chart penuh milik S3).
- Collapsible per-UPTD (`GET reports/stats-by-team` + nama dari `GET teams`).
- List tab: Menunggu (`status=menunggu_review`, sort `deadline_review`) / Disetujui /
  Sedang Diperbaiki (sort `deadline_resolusi`) / Ditugaskan / Ditolak / Semua
  (Ditugaskan/Ditolak/Semua TANPA `sort_by` di web — default server);
  search (kode/jalan/pelapor; web TANPA debounce — native wajib tambah sendiri, jangan tiru
  mentah); filter UPTD/sumber/severity/deadline/PCI (⚠️ `filterStatus` web BUKAN "state mati":
  ia hidup sebagai dependency `useEffect` + masuk query `p.set("status", …)`, hanya saja TIDAK ada
  kontrol UI yang mengesetnya sehingga selalu `""` — jangan port, dan jangan tiru pola tanpa UI ini);
  auto-refresh: **web `supervisor/index.tsx` TIDAK punya polling** (grep `setInterval`/`30000` = nol;
  hanya `setTimeout` 4000ms untuk clear pesan aksi). Jadi auto-refresh bukan "port web" — ini
  keputusan desain native. Native warga pakai `delay(120_000)` (`WargaDashboardScreen.kt`);
  **putuskan interval saat eksekusi (default 30 dtk)** dan jangan reset scroll/filter saat refresh;
  paginasi — samakan page-size web (9) atau 20 ala native, **putuskan saat eksekusi, default 20**;
  `ReportCard` + hapus (web: tombol hanya bila `Ditolak`; native IKUTI BACKEND — 4 status per §3.4,
  sengaja divergen dari web) + dialog konfirmasi.

### 5.2 Review cepat (port `supervisor/review.tsx`)

- Layar antrean: `GET reports?status=menunggu_review&sort_by=pci_score|deadline_review|
  created_at|priority&source&severity&limit=50` (default web: `pci_score`); badge deadline —
  PAKAI varian queue (`"Terlambat!"/"Mendesak"/"X jam"/"< 1 jam"`, `terlambat_review ||
  status_deadline == "terlambat"` = overdue, deadline <4 jam = mendesak; varian drawer
  `"Terlewat!"/"X jam lagi"/"X hari lagi"` JANGAN dipakai); chip PCI; dot AI hijau = baca
  **`ai_severity`** (bukan confidence); badge sumber hanya bila `!= petugas` (W ungu / T sky);
  empty-state "Semua Sudah Direview"; Next/Prev antar item.
- Layar aksi (pengganti side-panel/overlay web): ringkasan + foto utama + tombol
  **Setujui** / **Tolak** (modal: alasan wajib max 100 + catatan max 500 — enforce `maxLength`
  di native, web tidak enforce) / **Lihat Detail** (WAJIB ada — tombol "Konfirmasi & Tugaskan Tim"
  hanya reachable via detail, antrean hanya berisi `menunggu_review`); sukses → `SuccessBox`/
  layar sukses + refresh antrean + invalidasi stats.
- WAJIB: picker tim `needs_team` di ALUR REVIEW juga, bukan hanya di detail — web review
  (`review.tsx`) tidak punya cabang `needs_team` (approve kecamatan tanpa tim auto → error mentah).
  TETAPKAN saat eksekusi: aksi review cepat kirim `priority` atau tidak (web review: tanpa body;
  web detail: dengan `{priority}` + modal).
- Tanpa bulk action (keputusan scope; web supervisor juga tidak punya bulk).

### 5.3 Detail laporan supervisor (port `detail-report.tsx` footer role-aware)

- Reuse struktur `WargaDetailScreen` (karosel + toggle AI, info, timeline, after-photos,
  progress, PCI) — TAPI cabut alur rating warga (`submitRating → POST warga/reports/{id}/rating`
  via `WargaRepository.rate`; GET detail warga juga tak berlaku — supervisor pakai
  `GET /reports/{id}`). Reuse mentah = 403/422. Mini-peta/`ReportMap` BELUM ADA di native
  (grep nol) — bila dimau, bangun baru; bukan reuse.
- `LaunchedEffect`: auto `POST mulai-review` bila status `Menunggu Review/Ditinjau`.
- Status `Menunggu Review/Ditinjau` → tombol **Setujui & Tugaskan Tim**
  (modal prioritas; picker tim bila `needs_team`) + **Tolak** + (bila `Hasil AI`)
  **Konfirmasi & Tugaskan Tim**.
- Status akhir (`Disetujui/Ditugaskan/Selesai/Ditolak`) → monitor-only + tombol Kembali
  (catatan: `Ditolak` di web jatuh ke cabang default tanpa tombol khusus — efek sama).
- Tanpa tombol eksekusi petugas (`mulai/progress/complete/reopen` — route `complete`, bukan
  `/selesaikan`; sembunyikan + JANGAN panggil, server mengizinkan — lihat §2.3-B).

### 5.4 Peta (port `/map` untuk supervisor)

- `WargaPetaScreen` (MapLibre: `MapView`/`SymbolLayer`/lifecycle) TERIKAT `WargaViewModel`
  (`vm.loadMap()`, `vm.mapReports`) — TIDAK ada `ReportMapScreen(reports, onOpenDetail)` generik.
  Anggarkan refaktor ekstraksi (parameterisasi reports + selected + style URL + konstanta source/
  kamera Sidoarjo) sebelum reuse; data `map-data` (auth) identik.
- Tanpa duplikasi `MapView`/`SymbolLayer`/lifecycle.

---

## 6. UI/UX (wajib ikut bahasa adaptasi warga)

Token `ui/theme` (`Color.kt`, `Shape.kt`), `BrandPrimaryButton`/`BrandSecondaryButton`,
`BrandTextField`, `WarningBox`/`InfoBox`/`ErrorBox`/`SuccessBox`, `SectionHeader`,
`StatusBadge`, `EmptyState` + `SkeletonCard` (gradien statis — tidak ada shimmer animasi),
`KecamatanDropdown`, debounce 500ms, pull-to-refresh, ripple default Material (tidak ada
implementasi `indication` eksplisit). Struktur section per layar meniru web
(hero → statistik → filter → list → aksi kontekstual per status).

---

## 7. Fase eksekusi

| Fase | Isi | File (±) |
|---|---|---|
| S1 | endpoint + DTO + `SupervisorRepository` + `SupervisorScaffold` + nav + `SupervisorViewModel` | ±6 |
| S2a | dashboard triase (§5.1) | ±3 |
| S2b | review antrean + aksi (§5.2) | ±3 |
| S2c | detail supervisor + peta reuse (§5.3–5.4) | ±2 |

Verifikasi per fase: `./gradlew :app:assembleDebug` + uji alur per `source`
(petugas vs warga/telegram) + kasus `needs_team` + 422 status salah +
screenshot lawan web berdampingan.

## 8. Risiko

1. Salah routing approve per `source` → 422/laporan macet (§3.1). Mitigasi: guard client + komentar.
2. Review 2-panel web → 2 layar HP: state antrean ↔ aksi harus sinkron (refresh setelah aksi).
   Drawer review TIDAK memanggil `mulai-review`, jadi status antrean tidak berubah sendiri.
3. Auto-refresh 30 dtk + paginasi: jangan reset scroll/filter saat refresh.
4. `GET reports` scope supervisor (`assigned_supervisor_id = me OR NULL`) — list dashboard
   mungkin tidak menampilkan semua laporan global; itu perilaku server, bukan bug FE.
   (Beda dari scope `stats` yang tanpa NULL — jangan samakan ekspektasi angkanya.)
5. `reopen`/`mulai`/`progress`/`complete` mengizinkan supervisor di server (§2.3-B) — tombol
   harus disembunyikan DAN tidak dipanggil; satu pemanggilan tak sengaja = transisi ilegal.
6. Reuse `WargaDetailScreen`/`WargaViewModel` mentah membawa rating warga-only (403/422) —
   cabut sebelum pakai. Mini-peta/`ReportMap` belum ada — bila dimau, bangun baru.
7. `confirm-ai` gagal petakan tim = 422 tanpa `needs_team` — tidak ada jalur retry manual;
   desain UX harus antisipasi (arahkan ke `approve-and-assign` via detail atau tampilkan
   pesan hubungi admin).

## 9. Out-of-scope (dicatat agar tak merayap)

Bulk approve/tolak, export PDF/Excel, patrol-schedule CRUD + kalender, teams CRUD,
statistik chart penuh (S3), aksi petugas & admin, Telegram bot, FCM deep-link,
perubahan backend, commit otomatis.
