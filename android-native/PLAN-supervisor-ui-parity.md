# PLAN-supervisor-ui-parity — Parity UI/UX Card & Detail Laporan (Supervisor)

> Status: **planning** (belum dieksekusi). Hasil analisis mendalam native vs `Frontend-stable/`.
> Tujuan user: card laporan & detail laporan supervisor **selayout & semirip mungkin dengan web**.
> Aturan kerja: tanpa commit otomatis, `gradlew` diotorisasi, verifikasi = `:app:assembleDebug`.
> Catatan jujur: "100% identik" mustahil lintas platform (HTML/CSS vs Compose). Target realistis =
> **paritas struktural + visual** (urutan section, hierarki, warna, tipografi, spacing) — bukan pixel-perfect.

---

## 0. Ringkasan temuan (hasil baca sumber, bukan asumsi)

Sumber acuan yang dibaca penuh:
- `components/jk/ReportCard.tsx` (308 baris) + `report-card/CardActions.tsx` + `report-card/types.ts`
- `routes/supervisor/index.tsx` (pemakaian card) & `routes/supervisor/review.tsx` (list row, BUKAN ReportCard)
- `components/jk/ReviewDrawer.tsx` (633 baris, panel aksi review)
- `routes/detail-report.tsx` (1962 baris, footer role-aware + section lengkap)
- `lib/pci.ts`, `lib/rejectReasons.ts`, `components/jk/PciCard.tsx`, `DeadlineBadge.tsx`, `StatusBadge.tsx`

**Temuan kunci:**

1. **`supervisor/index.tsx` memakai `ReportCard` penuh** dengan `options={{ showTrust:false, showDeadline:true, isClient }}`
   + actions: `[Hapus (hanya bila Ditolak), Lihat Detail (iconOnly)]`. Grid `md:grid-cols-3`.
   **Native sekarang salah bentuk**: `ReportCard` native = thumbnail-atas + teks-ke-bawah (mirip kartu warga),
   sedangkan web = **thumbnail 4:3 di atas, body berisi header jalan + badge, baris kode·waktu, baris dot status,
   baris lokasi, mini progress bar, divider, grid 2-kolom (Tingkat/Dimensi/[Deadline]/Pelapor), PCI, actions**.
2. **`review.tsx` TIDAK memakai `ReportCard`** — ia list row kompak (thumb `w-10 h-10` persegi, 1 baris jalan,
   baris kode·PCI·badge sumber, baris deadline). Native sekarang justru memakai `ReportCard` besar di layar Review → **jauh dari web**.
3. **Panel aksi review web = `ReviewDrawer`** (bukan dialog): header (nama jalan + prev/next `i/total`),
   area foto (object-contain di bg `#0F172A`, toggle Asli/Deteksi AI, dot foto), info (jalan, kode, badge Terlambat,
   kec/pelapor/sumber/waktu, Deadline badge, alamat, peringatan duplikat, system notes, **DetectionList**,
   kartu Severity+AI (severity/catatan/kualitas/PCI/relevansi/dimensi/tim), **MiniMap preview + link Google Maps**,
   catatan petugas, deskripsi), lalu **action bar bawah**: `Setujui & Assign Tim` (biru #1A4F8A penuh) +
   `Tolak` (merah muda) + `Detail`. Form tolak = overlay dengan **dropdown alasan baku** (REJECT_REASONS) + catatan.
4. **`detail-report.tsx` (supervisor)** — urutan section main (`max-w-2xl`):
   foto-per-foto(w/ toggle AI + deteksi) → progress bar → progress timeline → after-photos → penilaian warga →
   **badges** (severity pill + status pill + Warga/Telegram + DeadlineCard compact) → **PciCard** →
   alasan ditolak → **Info Jalan** (grid 2 kolom: kec, tim, dimensi×luas m², tanggal, pelapor, kode + deskripsi) →
   **TimelineCard** → **Lokasi** (koord + alamat + map h-48 + klik→Google Maps utk supervisor) → **Duplikasi**.
   Footer role-aware: `Menunggu Review/Ditinjau` → `Setujui & Tugaskan Tim`+`Tolak`+`Kembali`;
   `Hasil AI` → `Konfirmasi & Tugaskan Tim`+`Kembali`; `Disetujui`/`Ditugaskan`/`Selesai` → pesan monitor + `Kembali`.
5. **Tolak modal detail** memakai `ModalBase` (icon block, badge "TOLAK LAPORAN") dengan **dropdown alasan baku**
   (`REJECT_REASONS`, termasuk "Lainnya" → textarea) + catatan opsional. Native sekarang = 2 textfield bebas → **kurang tepat**.
6. **Team picker web** = modal `max-w-sm` rounded-2xl, ikon group, judul "Pilih Tim Satgas", **`<select>`** + tombol
   "Tugaskan ke Tim Ini" + Batal. Native sekarang = AlertDialog list rows → bentuk beda.
7. **`PciCard` & badge PCI** punya pemetaan warna khusus (`lib/pci.ts`): Baik #22c55e ≥86 · Ringan #86efac 71–85 ·
   Sedang #eab308 56–70 · Berat #f97316 41–55 · Kritis #ef4444 ≤40. Native belum punya util ini → **perlu dibuat**.
8. **`isTerlambat`** di `ReportCard` = `status_deadline=="terlambat" || terlambat_review || terlambat_resolusi`
   → border kartu 2px merah. **`isDuplicate`** → border amber (prioritas: terlambat > duplikat > normal).
   Native hanya cek `terlambat_review || terlambat_resolusi` dan memakai 1px/2px tanpa cabang amber.
9. **DTO native kurang field** untuk paritas: `ReportItemDto` **tidak punya** `pciScore`, `isDuplicate`,
   `estimasiHari`, `source`(ada), `description`(ada), `progressUpdatesCount`(ada). Web card butuh `pci_score`,
   `is_duplicate`, `estimasi_hari`. **Backend sudah mengirim ketiganya** (terverifikasi sebelumnya) → hanya perlu DTO.
10. **`DeadlineCard`/`DeadlineBadge`**: teks `Terlambat!`/`Kurang dari 1 jam`/`X jam`/`X hari` + warna merah/amber/emerald.
    Varian queue (`Terlambat!`/`Mendesak`/`X jam`/`< 1 jam`) di list review. Native sudah mendekati di Review, tapi
    belum di card.

---

## 1. Gap analysis — CARD laporan supervisor

| Elemen web (`ReportCard.tsx`) | Native sekarang (`Cards.kt`) | Aksi |
|---|---|---|
| Border: terlambat 2px merah / duplikat 1px amber / normal 1px `#E2E8F0` | 2px merah bila `terlambat_*`, else 1px abu | **Rombak**: tambah cabang duplikat amber + pakai `status_deadline` |
| Header: jalan (line-clamp-2) + badge Terlambat/Duplikat/Warga (kanan atas) | Tidak ada baris badge di header | **Tambah** |
| Baris: `report_code` (mono biru) • `formatDateRelative` | kode mono + meta digabung 1 baris abu | **Pisah** persis |
| Baris: dot status + `displayStatus` | badge pill status (beda bentuk) | **Ganti** ke dot+teks |
| Baris (khusus Ditolak): "Dihapus otomatis 3 hari…" | Tidak ada | **Tambah** |
| Baris: ikon lokasi + district | digabung di meta | **Pisah** |
| Mini progress bar (bila `Sedang Diperbaiki` & `estimasi_hari>0`): "Hari n/m" + bar biru | Tidak ada | **Tambah** |
| Divider `#F1F5F9` full-bleed | Tidak ada | **Tambah** |
| Grid 2 kolom: Tingkat (ikon warning+label) / Dimensi (P×L) / [Deadline] / Pelapor | Tidak ada | **Tambah** |
| PCI: ikon road + "PCI n — label" warna `pciColor` | Tidak ada | **Tambah** |
| Actions: `Hapus` (Ditolak) + `Lihat Detail` iconOnly | Tidak ada (klik seluruh kartu) | **Tambah** `CardActions` |
| Thumbnail kosong → ikon `photo` di bg `#E8F0FA` | hilang total bila null | **Tambah** placeholder |
| `aspect 4:3` + `object-cover` | aspectRatio 4:3 Crop ✓ | ok |
| rounded-xl (12dp) | 12dp ✓ | ok |

**Keputusan desain:** buat **`SupervisorReportCard`** baru (jangan ubah `ReportCard` petugas, agar tak regresi).
Letakkan di `feature/supervisor/components/SupervisorReportCard.kt`. Param `options(showDeadline, isClient)` &
`actions: List<CardAction>`.

---

## 2. Gap analysis — DETAIL laporan supervisor

| Section web (`detail-report.tsx`) | Native sekarang (`SupervisorDetailScreen.kt`) | Aksi |
|---|---|---|
| Foto per-foto + toggle Asli/Deteksi AI + meta AI/kualitas | 1 foto utama statis, tanpa toggle | **Bangun** galeri + toggle |
| DetectionList per foto | Tidak ada | **Bangun** (list deteksi) |
| Progress bar (estimasi_hari) + Progress timeline | Tidak ada | **Tambah** |
| After-photo gallery | ada (list gambar) ✓ tapi tanpa judul/tata sama | **Rapikan** |
| Penilaian warga (bila source warga/telegram) | Tidak ada | **Tambah** |
| Baris badges: severity pill + status pill + Warga/Telegram + DeadlineCard compact | StatusBadge (severity+status) saja | **Rombak** jadi baris badges + deadline |
| PciCard (skor besar + bar + label) | hanya angka di InfoCard | **Ganti** ke PciCard |
| Info Jalan (grid 2 kolom) | InfoCard list 1 kolom | **Rombak** jadi grid 2 kolom + luas m² |
| TimelineCard | TimelineList sederhana | **Tingkatkan** (ikon/label/warna per event) |
| Lokasi: koord + alamat + **mini-map h-48** + klik→Google Maps | Tidak ada | **Tambah** (mini-map / tombol Google Maps) |
| Duplikasi: kartu amber + jarak + "Lihat di Peta" | WarningBox sederhana | **Rombak** |
| Alasan ditolak (`extractRejectReason`) | system notes generik | **Tambah** ekstraksi alasan |
| Footer: tombol per status (mirip web) + `actionMsg` box | Approve/Tolak/Confirm-ai + InfoBox | **Selaraskan** teks & pesan |
| Tolak modal: dropdown alasan baku + "Lainnya" | 2 textfield bebas | **Ganti** ke dropdown REJECT_REASONS |
| Team picker: modal select + "Tugaskan ke Tim Ini" | AlertDialog list rows | **Selaraskan** (judul/teks/CTA) |
| Judul header bar: "Detail Laporan" + kode di kanan | "Detail Laporan" saja | **Tambah** kode |

**Catatan yang TIDAK diubah (sengaja, per PLAN-supervisor §2.3-B):** jangan munculkan tombol
`mulai/progress/complete/reopen` (milik petugas) walau server mengizinkan.

---

## 3. Perubahan DTO & util (fondasi)

**3.1 `ReportItemDto` (DashboardModels.kt)** — tambah field yang backend sudah kirim:
```kotlin
@Json(name="pci_score") val pciScore: Double? = null,
@Json(name="is_duplicate") val isDuplicate: Boolean = false,
@Json(name="duplicate_score") val duplicateScore: Double? = null,
@Json(name="estimasi_hari") val estimasiHari: Int? = null,
@Json(name="status_deadline") val statusDeadline: String? = null,
```
**3.2 `SupervisorReportDetail` (SupervisorModels.kt)** — tambah yang dibutuhkan detail:
`afterPhotoUrl`, `afterPhotoNotes`, `catatanPetugas`, `rating`, `ratingComment`, `estimasiHari`,
`totalDetections`, `aiRawOutput`(trimmed), dan foto kaya (`aiRawOutput`, `totalDetections`,
`mobileclipScore`, `qualityScores`) pada `SupervisorPhotoDto`.
**3.3 util baru `ui/util/Pci.kt`** — port `lib/pci.ts`: `pciColor(score)`, `pciConditionLabel(score)`,
`pciBgColor(score)` (warna hex persis).
**3.4 `feature/supervisor/components/RejectReasons.kt`** — konstant daftar alasan baku + `OTHER` marker
(port `lib/rejectReasons.ts`) + `extractRejectReason(systemNotes)`.
**3.5 `feature/supervisor/components/CardAction.kt`** — model `CardAction(label, icon, iconOnly, variant, onClick)`.

---

## 4. File yang dibuat / diubah

**Baru:**
```
feature/supervisor/components/SupervisorReportCard.kt   # port ReportCard.tsx + CardActions
feature/supervisor/components/CardAction.kt             # model aksi
feature/supervisor/components/RejectReasons.kt          # alasan baku + extract
feature/supervisor/components/DeadlineBadge.kt          # varian card & queue
feature/supervisor/components/PciCard.kt                # port PciCard.tsx
feature/supervisor/components/DetailSections.kt         # InfoJalanGrid, BadgeRow, DuplicateCard, TimelineList
ui/util/Pci.kt                                          # lib/pci.ts
```
**Diubah:**
```
core/network/DashboardModels.kt        # + field ReportItemDto
core/network/SupervisorModels.kt       # + field detail & foto
feature/supervisor/SupervisorDashboardScreen.kt  # pakai SupervisorReportCard + actions (Hapus/Lihat Detail) + paginasi
feature/supervisor/SupervisorReviewScreen.kt     # ganti ReportCard → ReviewQueueRow kompak (port review.tsx)
feature/supervisor/SupervisorDetailScreen.kt     # rombak total: urutan section + footer + modal
```

---

## 5. Fase eksekusi

| Fase | Isi | Verifikasi |
|---|---|---|
| **P1** | DTO + util Pci + RejectReasons + CardAction | `:app:compileDebugKotlin` |
| **P2** | `SupervisorReportCard` (port penuh) + `PciCard` + `DeadlineBadge` | kompilasi |
| **P3** | Dashboard pakai kartu baru + actions + paginasi (web punya prev/next) | kompilasi |
| **P4** | Review: `ReviewQueueRow` kompak (thumb 40dp, dot overdue/urgent/ok, PCI chip, badge sumber, deadline) + panel aksi selaras ReviewDrawer (dropdown tolak, ConfirmDialog setujui) | kompilasi |
| **P5** | Detail: rombak section (foto+toggle, badges, PciCard, InfoJalan grid, timeline, lokasi+map, duplikat) | kompilasi |
| **P6** | Detail: footer per-status selaras web + modal tolak dropdown + team picker selaras | kompilasi |
| **P7** | Build `:app:assembleDebug` + screenshot berdampingan (bila emulator tersedia) | build hijau |

---

## 6. Risiko & batasan

1. **"100% identik" tidak tercapai** — beda engine render. Target: paritas struktur/warna/teks/hierarki. Akan saya
   laporkan per-elemen apa yang bisa & tidak bisa disamakan.
2. **Mini-map di detail** — web pakai `ReportMap` (h-48). Native punya `ReportMapScreen` generik; untuk preview kecil
   perlu parameter `miniMap=true` (sudah disiapkan) atau tombol "Buka Google Maps" saja bila berat. **Keputusan:**
   coba mini-map via AndroidView kecil; fallback tombol Google Maps.
3. **`DetectionList` & quality_scores** — butuh DTO `ai_raw_output`/`quality_scores`; bila parsing berat, tampilkan
   ringkas (jumlah deteksi, jenis, confidence) dulu.
4. **Regresi petugas/warga** — semua komponen baru ditaruh di paket `supervisor`, TIDAK mengubah `Cards.kt` petugas.
   `DashboardModels.kt` diubah aditif (field baru nullable) → aman.
5. **Tidak commit** sampai user minta eksplisit.

## 7. Out-of-scope

Perubahan backend, patrol-schedule, teams CRUD, statistik chart penuh, aksi petugas/admin, bulk, export.
