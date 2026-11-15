# Plan Eksekusi — Alur Kerja Laporan Warga (Tiga Jalur)

**Status:** Rencana kerja. **Belum ada kode yang diubah.**
**Tanggal:** 2026-11-15
**Dasar:** `docs/plan-alur-kerja-laporan-warga-dual-track-revisi.md` + keputusan pengguna sesi ini
**Prasyarat:** tidak ada (dapat dimulai kapan saja)

> Dokumen ini bukan arsitektur (lihat plan revisi). Dokumen ini adalah **daftar tugas berurutan** yang bisa dicentang, lengkap dengan kriteria terima terukur.

---

## 0. Keputusan yang Sudah Dikunci

| # | Keputusan | Nilai final |
|---|---|---|
| 1 | Sumber dimensi hasil inspeksi | **Opsi A** — kolom baru di `inspection_results`, tidak menimpa data warga |
| 2 | Pemicu "perlu inspeksi" | **Opsi B** — sistem **otomatis** mengantrekan, supervisor dapat membatalkan |
| 3 | Label jalur | **Tampilan saja** — `STATUS_VALUES` tidak diubah |
| 4 | Ambang parah | `overall_severity == 'Rusak Berat'` **ATAU** `pci_score < 56` |
| 5 | Laporan petugas | **Tidak pernah** auto-inspeksi (petugas sudah di lapangan) |
| 6 | PCI bias jarak | **Dikesampingkan** (kesepakatan pengguna); risiko ditangani oleh inspeksi wajib |

### Tiga jalur yang dihasilkan

| Jalur | `source` | Kondisi | Alur | Label tampilan |
|---|---|---|---|---|
| **A** | `warga` | tidak parah | Warga → Supervisor review | `Laporan Warga` |
| **B** | `warga` | parah | Warga → auto-antre patroli → petugas ukur → supervisor | `Hasil Inspeksi` |
| **C** | `petugas` | — | Petugas lapor → supervisor review | `Laporan Petugas` |

---

## 1. Kondisi Awal Terverifikasi

Semua di bawah ini **sudah diperiksa langsung di kode**, bukan asumsi:

| Fakta | Lokasi | Implikasi |
|---|---|---|
| `submit()` tidak menerima dimensi | `NativeInspectionController.php:280-283` | Harus ditambah |
| `inspection_results` tanpa kolom dimensi | migrasi `2026_11_09_000001:61-74` | Butuh migrasi |
| `queue()` **wajib** `survey_task_id` | `NativeInspectionController.php:183` | Auto-queue harus memilih tugas |
| `survey_tasks` punya `team_id`, `kecamatan`, `tanggal_patroli`, `status` | migrasi `2026_06_22_092953:12`, `2026_06_23_000004:12` | Cukup untuk pencocokan |
| Status awal laporan warga = `'Menunggu Review'` | `WargaReportController.php:1262` | Titik sisip auto-queue |
| `store()` & `storePublic()` berbagi `processAndCreateReport()` (:939) | `WargaReportController.php:101`, `:198` | Hook cukup **satu titik** (§12.1) |
| `review()` accept → `Disetujui` | `NativeInspectionController.php:485` | Tidak perlu diubah |
| `approveAndAssign()` tanpa `validate()` | `ReportController.php:2438` | Perlu penguatan |
| `TriageService` belum ada | — | Dibuat baru |
| Migrasi koordinat sesi belum ada | — | Fase 4, ditunda |

---

## 2. Fase 0 — Fondasi Triase (tanpa perubahan perilaku)

**Tujuan:** menyiapkan keputusan "perlu inspeksi?" tanpa mengubah alur apa pun.
**Dapat dirilis sendiri:** ya (tidak terlihat pengguna).

### T0.1 — Buat `TriageService`

**File baru:** `backend_POSTGRESQL/app/Services/TriageService.php`

```php
namespace App\Services;

use App\Models\Report;

class TriageService
{
    /** Batas bawah "Rusak Sedang" pada PciService::CONDITION_MAP. */
    public const PCI_INSPECTION_THRESHOLD = 56.0;

    /**
     * Apakah laporan perlu diverifikasi lapangan sebelum dieksekusi.
     *
     * Hanya memakai kolom yang TERBUKTI terisi di produksi:
     * `overall_severity` dan `pci_score`.
     * `ai_confidence` dan `ai_jenis_kerusakan` sengaja TIDAK dipakai —
     * keduanya NULL pada payload produksi, dan `ai_confidence` historis
     * diisi acak oleh BackfillPhotoData.
     */
    public function needsInspection(Report $report): bool
    {
        // Laporan petugas: petugas sudah berada di lokasi, tak perlu inspeksi.
        if ($report->source === 'petugas') {
            return false;
        }

        if ($report->overall_severity === 'Rusak Berat') {
            return true;
        }

        // PCI NULL → jangan menebak; arahkan ke inspeksi (aman).
        if ($report->pci_score === null) {
            return true;
        }

        return (float) $report->pci_score < self::PCI_INSPECTION_THRESHOLD;
    }

    /** Alasan untuk ditampilkan di UI supervisor & log. */
    public function reason(Report $report): string
    {
        return match (true) {
            $report->overall_severity === 'Rusak Berat'
                => 'Kerusakan berat; perlu verifikasi volume dan kondisi lapangan',
            $report->pci_score === null
                => 'PCI belum tersedia; verifikasi lapangan dianjurkan',
            (float) $report->pci_score < self::PCI_INSPECTION_THRESHOLD
                => 'PCI di bawah ambang; perlu pengukuran dimensi',
            default => 'Kerusakan rutin; dapat langsung dieksekusi',
        };
    }
}
```

### T0.2 — Unit test `TriageService`

**File baru:** `backend_POSTGRESQL/tests/Unit/TriageServiceTest.php`

| Kasus | Input | Harapan |
|---|---|---|
| Berat | `overall_severity='Rusak Berat'`, `pci=80` | `true` (severity menang) |
| Ringan | `'Rusak Ringan'`, `pci=90` | `false` |
| Sedang PCI rendah | `'Rusak Sedang'`, `pci=45` | `true` |
| Sedang PCI cukup | `'Rusak Sedang'`, `pci=60` | `false` |
| **PCI null** | `'Rusak Sedang'`, `pci=null` | `true` (fallback aman) |
| **Petugas** | `source='petugas'`, `'Rusak Berat'` | `false` (keputusan #5) |
| Batas tepat | `pci=56.0` | `false` (`<` bukan `<=`) |

**Kriteria terima:**
```bash
cd backend_POSTGRESQL && composer run test -- --filter=TriageServiceTest
```
→ **7 test lulus, 0 gagal.** Pastikan jumlah test > 0 (filter yang tidak cocok tetap exit 0).

---

## 3. Fase 1 — Dimensi Hasil Inspeksi (Opsi A)

**Tujuan:** petugas bisa mengirim panjang/lebar/kedalaman saat submit.
**Dapat dirilis sendiri:** ya, tapi belum terpakai sampai Fase 2.

### T1.1 — Migrasi kolom dimensi

**File baru:** `backend_POSTGRESQL/database/migrations/2026_11_16_000001_add_dimensions_to_inspection_results.php`

```php
Schema::table('inspection_results', function (Blueprint $table) {
    $table->decimal('kerusakan_panjang', 8, 2)->nullable()->after('notes');
    $table->decimal('kerusakan_lebar', 8, 2)->nullable()->after('kerusakan_panjang');
    $table->decimal('kerusakan_kedalaman', 8, 2)->nullable()->after('kerusakan_lebar');
});
```

**Aturan:** hanya **menambah kolom nullable**. Tidak mengubah/menghapus kolom lama (wajib per `AGENTS.md`).

**Kriteria terima:** `php artisan migrate` sukses; `migrate:rollback` juga bersih (down() men-drop ketiganya).

### T1.2 — `submit()` menerima dimensi

**File:** `backend_POSTGRESQL/app/Http/Controllers/NativeInspectionController.php`

Tambahan pada `$request->validate([...])` (baris ~280):
```php
'kerusakan_panjang'   => 'nullable|numeric|min:0.01|max:100',
'kerusakan_lebar'     => 'nullable|numeric|min:0.01|max:100',
'kerusakan_kedalaman' => 'nullable|numeric|min:0.01|max:100',
```
Dan sertakan ketiganya pada `InspectionResult::create([...])`.

⚠️ **Idempotensi:** `$fingerprint` (baris ~286) **harus** ikut menyertakan tiga field ini. Bila tidak, submit ulang dengan dimensi berbeda akan dianggap payload sama dan dimensi baru hilang diam-diam.

**Kriteria terima:** test baru di `NativeInspectionWorkflowTest`:
- submit dengan dimensi → tersimpan & terbaca di `GET /inspection-tasks/{id}`
- submit ulang dimensi sama → `200`, tidak duplikat
- submit ulang dimensi **berbeda** → `409`

---

## 4. Fase 2 — Auto-Queue Laporan Warga (inti perubahan perilaku)

**Tujuan:** laporan warga parah otomatis masuk jadwal patroli.
**Dapat dirilis sendiri:** ya — ini titik di mana alur Anda mulai berlaku.

### T2.1 — `PatrolAssignmentResolver`

**File baru:** `backend_POSTGRESQL/app/Services/PatrolAssignmentResolver.php`

Mencari tugas patroli yang cocok **tanpa** campur tangan supervisor:

```php
public function resolve(Report $report): ?SurveyTask
{
    $teamId = Uptd::resolveTeamIdByDistrict($report->district);
    if (! $teamId) return null;

    return SurveyTask::query()
        ->where('team_id', $teamId)
        ->where('status', 'aktif')
        ->where('kecamatan', $report->district)
        ->whereDate('tanggal_patroli', '>=', now()->toDateString())
        ->orderBy('tanggal_patroli')          // jadwal terdekat lebih dulu
        ->first();
}
```

⚠️ **Kolomnya `kecamatan` dan `tanggal_patroli`, bukan `scheduled_date`.** Keduanya terverifikasi di migrasi `2026_06_22_092903` dan `2026_06_23_000004`.

⚠️ **Bila `null` (tidak ada jadwal), jangan gagal senyap.** Lihat T2.3.

**Kriteria terima:** unit test dengan 3 kasus — ada jadwal cocok, ada jadwal beda kecamatan, tidak ada jadwal.

### T2.2 — Hook saat laporan warga dibuat

**Lokasi (ditetapkan setelah verifikasi):** `WargaReportController::processAndCreateReport()` (`:939`), tepat setelah `Report::create()` (`:1252`) berhasil.

**Satu titik saja**, karena `store()` (`:101`) dan `storePublic()` (`:198`) sama-sama memanggil metode ini. Lihat §12.1.

```php
// Di dalam processAndCreateReport(), setelah $report tersedia
try {
    app(ReportTriageHook::class)->handle($report);
} catch (\Throwable $e) {
    // Kegagalan triase TIDAK boleh menggagalkan laporan warga.
    Log::warning('Auto-queue inspeksi gagal', [
        'report_id' => $report->id, 'error' => $e->getMessage(),
    ]);
}
```

Isi `ReportTriageHook::handle()`:

```php
if (! app(TriageService::class)->needsInspection($report)) return;      // Jalur A
$task = app(PatrolAssignmentResolver::class)->resolve($report);
if (! $task) { /* T2.3: tandai [PERLU INSPEKSI] */ return; }
app(NativeInspectionController::class)->enqueueForReport(
    task: $task,
    report: $report,
    actorId: $report->user_id ?? $report->assigned_supervisor_id,
);
```

⚠️ **Jangan** memanggil `queue()` HTTP dari dalam controller. Gunakan `queueReportIds()` (lihat §12.3) yang menerima `actorId` **eksplisit**. Sudah terverifikasi bahwa `queue()` mengambil user **di luar** transaksi, jadi pola aman ini memang sudah dipakai.

⚠️ **`started_by` sesi** memakai `$report->user_id`; bila `null` (laporan Telegram/anonim) pakai `assigned_supervisor_id`. Lihat §12.3.

**Kriteria terima:** laporan warga dibuat → assignment inspeksi otomatis terbentuk; laporan tidak hilang bila auto-queue melempar exception.

```php
// Setelah laporan tersimpan & transaksi utama commit
$this->autoQueueIfNeeded($report);
```

```php
private function autoQueueIfNeeded(Report $report): void
{
    if (! app(TriageService::class)->needsInspection($report)) {
        return;   // Jalur A: langsung ke review supervisor
    }

    $task = app(PatrolAssignmentResolver::class)->resolve($report);

### T2.3 — Fallback: tidak ada jadwal patroli

Tiga opsi perilaku. **Rekomendasi: (b).**

| Opsi | Perilaku | Risiko |
|---|---|---|
| (a) Tolak pembuatan laporan | — | ❌ Laporan warga hilang; tidak dapat diterima |
| **(b) Simpan + tandai `[PERLU INSPEKSI]`** | Laporan tetap `Menunggu Review`, supervisor melihat penanda | ✅ Aman, harus ditangani manual |
| (c) Buat `survey_task` otomatis | Sistem mengarang jadwal | ❌ Petugas bisa dikirim ke jalan tanpa rencana |

**Kriteria terima:** laporan tetap terbuat (`201`), `system_notes` memuat `[PERLU INSPEKSI]`, status tetap `Menunggu Review`.

### T2.4 — Supervisor dapat membatalkan

Tombol pembatalan **hanya** muncul bila assignment masih `status = 'assigned'` dan belum `started`. Endpoint baru:

```
DELETE /api/inspection-tasks/{assignment}
```
Syarat: role `supervisor`/`admin`, scope UPTD cocok, status assignment `assigned`.
Efek: hapus assignment + sesi (bila kosong), laporan tetap `Menunggu Review`.

**Kriteria terima:** setelah batal, `candidates()` memuat laporan itu kembali.

---

## 5. Fase 3 — UI Android

**Dapat dirilis sendiri:** ya.

### T3.1 — Form input dimensi petugas

**File:** `feature/home/InspectionResultViewModel.kt` + layar di `feature/home/InspectionScreens.kt`

Tambah state `panjang`, `lebar`, `kedalaman` (String, karena input keyboard). Kirim sebagai `Double?` — `null` bila kosong, bukan `0.0`.

⚠️ **Dimensi tidak boleh wajib.** Bila dipaksa wajib, petugas yang tak punya meteran akan mengarang angka. Kosong lebih jujur daripada palsu.

**Kriteria terima:** unit test konversi `""` → `null`, `"0"` → `null` (bukan 0), `"1.5"` → `1.5`.

### T3.2 — `InspectionUploadWorker` ikut membawa dimensi

**File:** `core/worker/InspectionUploadWorker.kt`

Dimensi masuk antrean offline. Tanpa ini, submit saat offline akan kehilangan dimensi.

**Kriteria terima:** payload kerja memuat 3 field; dibaca kembali tanpa kehilangan presisi.

### T3.3 — Tampilkan dimensi di review supervisor

**File:** `feature/supervisor/InspectionReviewScreen.kt`

Tampilkan panjang × lebar × kedalaman (m) bila ada; bila kosong tampil "—" dengan keterangan "tidak diukur".

### T3.4 — Badge label jalur

**File:** `feature/supervisor/SupervisorDetailScreen.kt` (atau komponen badge bersama)

Gunakan `ui/components/StatusPills.kt` yang sudah ada — **jangan** menulis pill baru.

| Kondisi | Label |
|---|---|
| `source='warga'` + ada assignment inspeksi | `Hasil Inspeksi` |
| `source='warga'` + tanpa assignment | `Laporan Warga` |
| `source='petugas'` | `Laporan Petugas` |

**Kriteria terima:** ketiga label tampil benar; tidak ada status baru di `STATUS_VALUES`.

### T3.5 — Penanda `[PERLU INSPEKSI]` di daftar supervisor

Laporan tanpa jadwal patroli harus terlihat menonjol agar tidak terlupakan.

---

## 6. Fase 4 — Ditunda (JANGAN dikerjakan di rilis ini)

| Item | Alasan ditunda |
|---|---|
| Geo-Corridor Matching (jarak ≤2 km) | `inspection_sessions` tanpa kolom koordinat; butuh migrasi terpisah |
| Normalisasi PCI terhadap jarak foto | Kesepakatan pengguna: dikesampingkan |
| Tab filter "Terdekat" di `InspectionQueueSheet` | Bergantung pada Geo-Corridor |
| Polylines peta | Di luar lingkup |

---

## 7. Urutan Pengerjaan & Ketergantungan

```
Fase 0 (T0.1 → T0.2)
    ↓
Fase 1 (T1.1 → T1.2)          ← bisa paralel dengan Fase 0
    ↓
Fase 2 (T2.1 → T2.2 → T2.3 → T2.4)   ← butuh Fase 0 & 1
    ↓
Fase 3 (T3.1 → T3.2 → T3.3 → T3.4 → T3.5)
```

Setiap fase **harus** meninggalkan repo dalam keadaan build hijau.

---

## 8. Kriteria Terima Global

Dijalankan sebelum menyatakan selesai:

```bash
# Backend
cd backend_POSTGRESQL
composer run test                      # seluruh suite, 0 gagal
php vendor/bin/pint --test             # lint PHP bersih

# Android
cd android-native
./gradlew testDebugUnitTest            # baseline 9 test lulus, tidak boleh berkurang
./gradlew lintDebug                    # baseline 118 warning, tidak boleh bertambah
./gradlew assembleDebug                # APK terbentuk
```

**Baseline terukur saat ini:** 9 test lulus, 118 warning lint, 0 error. Angka ini adalah pembanding — penambahan tidak boleh menaikkan warning.

---

## 9. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| 🔴 Auto-queue gagal → laporan warga hilang | Kehilangan data pelapor | `try/catch`; laporan dibuat **lebih dulu**, auto-queue sesudahnya |
| 🔴 Tidak ada jadwal patroli untuk kecamatan | Laporan menggantung | Fallback T2.3 `[PERLU INSPEKSI]` + penanda UI |
| 🟠 Dimensi hilang saat submit ulang | Data petugas hilang senyap | `$fingerprint` wajib memuat dimensi (T1.2) |
| 🟠 Petugas mengarang dimensi | Keputusan perbaikan salah | Dimensi **opsional**, tampil "tidak diukur" bila kosong |
| 🟠 PCI bias jarak (dikesampingkan) | Salah klasifikasi jalur | Inspeksi wajib = jaring pengaman; supervisor tetap memutuskan |
| 🟠 `approveAndAssign` tanpa validasi | Kesalahan integrasi senyap | Tambahkan `validate()` (T1.3) |

### T1.3 — Penguatan `approveAndAssign()` (kecil, kerjakan bersama Fase 1)

```php
$request->validate([
    'assigned_team_id' => 'nullable|exists:teams,id',
    'priority'         => 'nullable|in:'.implode(',', Report::PRIORITY_VALUES),
]);
```

---

## 10. Yang TIDAK Diubah

- `STATUS_VALUES` (`Report.php:249`) — tidak ditambah
- `PciService` — tidak disentuh
- `review()` — 4 aksi (`accept`/`return`/`reinspect`/`reject`) tetap
- Endpoint `candidates()` — struktur lama dipertahankan; `triage` bersifat aditif
- `queue()` — perilaku HTTP tetap; hanya dipecah agar bisa dipanggil internal
- Semua kolom lama di `reports` dan `inspection_results`

---

## 11. Daftar File

### Dibuat
| File | Fase |
|---|---|
| `app/Services/TriageService.php` | 0 |
| `tests/Unit/TriageServiceTest.php` | 0 |
| `database/migrations/2026_11_16_000001_add_dimensions_to_inspection_results.php` | 1 |
| `app/Services/PatrolAssignmentResolver.php` | 2 |
| `app/Services/ReportTriageHook.php` | 2 |

### Diubah
| File | Fase | Perubahan |
|---|---|---|
| `NativeInspectionController.php` | 1,2 | `submit()` +dimensi; ekstrak `queueReportIds()`; `enqueueForReport()`; endpoint batal |
| `WargaReportController.php` | 2 | hook **satu kali** di `processAndCreateReport()` (:1252) |
| `ReportController.php` | 1 | `validate()` di `approveAndAssign` |
| `routes/api.php` | 2 | `DELETE /inspection-tasks/{assignment}` |
| `InspectionResultViewModel.kt` | 3 | state dimensi |
| `InspectionScreens.kt` | 3 | input dimensi |
| `InspectionUploadWorker.kt` | 3 | dimensi offline |
| `InspectionReviewScreen.kt` | 3 | tampilkan dimensi |
| `SupervisorDetailScreen.kt` | 3 | badge jalur |
| tab TUGAS (`feature/home/`) | 3 | badge jumlah tugas tertunda (T2.5) |
| `tests/Feature/NativeInspectionWorkflowTest.php` | 1,2 | +test dimensi & auto-queue |

---

## 12. Empat Hal yang Semula Belum Diverifikasi — Sudah Diverifikasi

Status: **selesai diverifikasi**. Isi di bawah adalah hasil pemeriksaan + rekomendasi yang sudah ditetapkan.

### 12.1 ✅ `store()` dan `storePublic()` BERBAGI jalur pembuatan laporan

**Hasil:** keduanya memanggil satu metode privat yang sama:

```
WargaReportController::store()        :101  → processAndCreateReport()
WargaReportController::storePublic()  :198  → processAndCreateReport()
WargaReportController::processAndCreateReport() :939 → Report::create() :1252
```

Hanya ada **satu** `Report::create` di seluruh controller ini. Blok validasi memang terduplikasi (dua salinan identik), tetapi pembuatan laporannya tunggal.

**Rekomendasi (ditetapkan):** hook auto-queue dipasang **satu kali saja**, di dalam `processAndCreateReport()` setelah `Report::create()` berhasil — **bukan** di `store()` dan `storePublic()`.

Alasan: satu titik = mustahil lupa memasang di salah satu jalur, dan otomatis mencakup jalur mana pun yang ditambahkan nanti.

⚠️ **Perhatian:** `processAndCreateReport()` mengembalikan `JsonResponse` yang sudah jadi. Hook harus memakai objek `$report` yang tersedia di dalam fungsi, **bukan** mem-parse response. Bila `$report` tidak tersedia di scope, tambahkan variabel sebelum `return`.

### 12.2 ✅ Laporan batch TIDAK perlu auto-queue pada rilis ini

**Hasil:** `POST /reports/batch` → `ReportController::storeBatch()` (:1617) membuat `Report` sendiri di `:1764` (laporan utama) dan `:677` (jalur lain), terpisah dari alur warga. Ini alur petugas (batch upload lapangan), sehingga:

- `source` laporan batch adalah **petugas**, dan keputusan #5 menyatakan laporan petugas **tidak pernah** auto-inspeksi.
- Menambahkan auto-queue di sini akan mengantrekan laporan petugas ke patroli — bertentangan dengan keputusan #5.

**Rekomendasi (ditetapkan):** **tidak** diubah pada rilis ini. Bila nanti batch dipakai warga, tinjau ulang.

### 12.3 ✅ `queue()` memakai `$request->user()`, tetapi TIDAK di dalam closure transaksi

**Hasil:** `$user = $request->user()` diambil di awal method (`:173`), **di luar** `DB::transaction` (`:196`). Di dalam closure, `$user` dipakai dari variabel yang sudah ditangkap (`use (...)`) — bukan memanggil `request()` ulang. Begitu pula `review()` (`:410`, `:429`) mengambil user sebelum transaksi.

Artinya **pola yang baik sudah ada**. Risiko yang saya khawatirkan (request bersarang kehilangan konteks user) **tidak terjadi** pada `queue()`.

**Rekomendasi (ditetapkan):** refaktor `queue()` **tidak perlu mengubah cara mengambil user**. Yang perlu diekstrak hanya bagian inti agar bisa dipanggil internal:

```php
// Method privat baru — user diberikan EKSPLISIT, tidak membaca request.
private function queueReportIds(
    SurveyTask $task,
    array $reportIds,
    int $actorId,
    ?InspectionSession $session = null,
): InspectionSession
```

`queue()` (HTTP) tetap memvalidasi lalu memanggil `queueReportIds($task, $ids, $request->user()->id, $session)`.

⚠️ Di jalur auto-queue, `$actorId` adalah **id pelapor warga** (atau sistem), **bukan** supervisor. Pastikan `started_by` pada sesi tetap terisi id yang valid (FK `users`) — gunakan `$report->user_id`, dan bila `null` (laporan Telegram/anonim) gunakan `user_id` supervisor pemilik laporan.

### 12.4 ✅ Tidak ada notifikasi FCM di alur inspeksi

**Hasil:** `NativeInspectionController` **tidak** memanggil `FcmPushService` maupun `TeamAssignedNotification` sama sekali. `queue()` mengantrekan laporan tanpa memberi tahu siapa pun.

Konsekuensi: setelah auto-queue, **petugas tidak akan tahu** ada tugas baru kecuali membuka aplikasi dan menyegarkan tab TUGAS.

**Rekomendasi (ditetapkan):** **jangan** menambah notifikasi baru pada rilis ini. Sebagai gantinya, tambahkan **badge jumlah tugas tertunda** di tab TUGAS yang sudah ada — lebih murah, tidak butuh infrastruktur push baru, dan tidak berisiko salah kirim.

Bila nanti notifikasi push diinginkan, jadikan pekerjaan terpisah (bukan bagian dari plan ini), karena `FcmPushService` sudah ada tetapi belum pernah dipakai di domain inspeksi — perlu uji perangkat nyata.

---

<details>
<summary>Catatan awal (sebelum verifikasi) — dipertahankan sebagai jejak</summary>

1. Apakah `WargaReportController::store()` dan `storePublic()` berbagi jalur pembuatan laporan yang sama — bila tidak, hook T2.2 harus dipasang **dua kali**.
2. Apakah laporan batch (`POST /reports/batch`) juga perlu auto-queue.
3. Apakah `NativeInspectionController::queue()` memakai `request()` di dalam transaksi — bila ya, refaktor T2.2 harus hati-hati agar tidak kehilangan konteks user.
4. Apakah ada notifikasi FCM yang perlu disesuaikan saat auto-queue terjadi.

</details>

---

## 13. Ringkasan Perubahan Plan Akibat Verifikasi

| Butir | Rencana awal | Setelah verifikasi |
|---|---|---|
| T2.2 hook | Dipasang di `store()` **dan** `storePublic()` | **Satu kali** di `processAndCreateReport()` |
| T2.2 batch | Belum jelas | **Tidak diubah** (batch = petugas) |
| T2.2 refaktor `queue()` | Ubah cara ambil user | User **tidak** diubah; ekstrak `queueReportIds()` |
| T2.2 `started_by` | Tidak disebut | Wajib: `$report->user_id`, fallback supervisor |
| T2.5 notifikasi | Tidak disebut | **Badge** di tab TUGAS, bukan FCM |

### T2.5 — Badge jumlah tugas tertunda (menggantikan notifikasi push)

**File:** `feature/home/` (komponen tab TUGAS) — angka diambil dari panjang daftar `GET /inspection-tasks` yang sudah ada.

**Kriteria terima:** badge menampilkan jumlah tugas aktif; hilang saat daftar kosong; tidak menambah panggilan API baru.
