# ANALISIS + PLAN — Petugas Membuat Laporan dari Cek Rutin (Patroli) di Android Native

> Status: **analisis selesai; planning komprehensif; belum dieksekusi**.
> Pertanyaan: apakah role petugas sudah bisa membuat laporan berdasarkan cek rutin?
> Referensi: `Frontend-stable/` (web, sudah jalan) + `backend_POSTGRESQL` + native.

---

## 1. JAWABAN SINGKAT

**BELUM.** Di Android native, petugas **tidak dapat** membuat laporan dari cek rutin:

- Tidak ada layar daftar tugas patroli (padanan `tugas-saya.tsx`).
- Tidak ada layar detail sesi patroli (padanan `detail-patroli.tsx`).
- `ApiService.createReport()` **tidak punya parameter `survey_task_id`** → laporan tak bisa diikat ke task.
- `TugasScreen` (native) hanya menampilkan **ringkasan jadwal read-only** (`PatrolCompactCard`) tanpa aksi apa pun.
- Backend **siap penuh** (semua endpoint & field ada). Jadi ini murni **gap native**, bukan backend.

**Bukti (grep):** nol file native menyebut `taskId`, `surveyTask`, `tanggal_patroli`, atau `survey_task_id`
di luar fitur supervisor. Tidak ada route/berkas baru yang cocok pola `*urvei*`/`*atroli*` (petugas).

---

## 2. ALUR DI WEB (referensi yang harus ditiru)

```
tugas-saya.tsx  ──►  GET /survei (petugas di-scope team_id sendiri)
  PatroliSection: kartu per task → tap → navigate /detail-patroli?taskId=<id>
  (tombol "Kunjungi"/"Mulai" → /upload?taskId=<id>)

detail-patroli.tsx  ──►  GET /survei/{id}  (useSurveyDetail)
  - Info sesi: tanggal, kecamatan, tim, jam, status, ringkasan laporan
  - Tombol "Tambah Laporan Patroli" (hanya petugas & status aktif)
    → navigate /upload?taskId=<id>

upload.tsx  ──►  (form lapor biasa) + FormData menyertakan:
    survey_task_id: taskId?.startsWith("schedule-") ? undefined : taskId
  → POST /reports (multipart) dgn field survey_task_id
```

**Aturan penting dari web:**
1. `taskId` yang diawali `"schedule-"` **tidak** dikirim sebagai `survey_task_id`
   (itu id sintetis dari jadwal, bukan task nyata).
2. Setelah submit sukses, web `invalidateQueries(["survey-list"])` → daftar tugas refresh
   (agar `reports_count` bertambah).
3. Tombol upload hanya muncul saat `userRole === "petugas" && task.status === "aktif"`.

---

## 3. KONTRAK BACKEND (terverifikasi)

| Endpoint | Gate | Catatan |
|---|---|---|
| `GET /survei` | semua auth; petugas **di-scope** `team_id = me` | param: `team_id`, `tanggal_patroli`, dll; `withCount('reports')`, order `tanggal_patroli` asc |
| `GET /survei/{id}` | petugas hanya jika `team_id` cocok (else 403) | detail + reports |
| `POST /reports` | `survey_task_id` = `nullable\|string\|exists:survey_tasks,id` | dipakai di `store()` (baris 474, 698) & `storeBatch()` (1634, 1782) |

**DTO task (web `SurveyTask`):** `id, road_name, kecamatan, team_id, team{id,name}, priority, catatan,
status ("aktif"|"selesai"|"dibatalkan"), jam_mulai, jam_selesai, tanggal_patroli, alasan_tugas,
selesai_at, created_at, updated_at, reports_count?, reports?[]`.

---

## 4. KONDISI NATIVE (gap yang harus ditutup)

| Komponen | Status native | Aksi |
|---|---|---|
| Daftar tugas patroli (`GET /survei`) | ❌ tidak ada | Bangun layar + DTO + endpoint |
| Detail sesi patroli (`GET /survei/{id}`) | ❌ tidak ada | Bangun layar |
| `survey_task_id` di create report | ❌ tidak ada di `createReport()` | Tambah `@Part("survey_task_id")` |
| Tombol "Tambah Laporan" di sesi patroli | ❌ tidak ada | Tambah di detail sesi |
| Kartu jadwal di `TugasScreen` | ⚠️ ada tapi read-only (`PatrolCompactCard`) | Tambah navigasi ke sesi/task |
| `LaporScreen`/`LaporViewModel` | ✅ ada (lapor umum) | Tambah jalur masuk dgn `taskId` opsional |
| Isolasi role | ✅ pola sudah ada | Ikuti pola |

---

## 5. RANCANGAN IMPLEMENTASI

### 5.1 DTO & endpoint (fondasi)
```
core/network/SurveyModels.kt         # SurveyTask, SurveyListResponse, SurveyDetailResponse
core/network/ApiService.kt           # + GET survei, GET survei/{id}; + @Part("survey_task_id") di createReport & storeBatch
core/data/SurveyRepository.kt        # list(tanggal?), detail(id)
```
**Penting:** `createReport()` dan `storeBatch()` harus menerima `surveyTaskId: RequestBody? = null`
(tambahkan sebagai `@Part("survey_task_id")`), tanpa mengubah pemanggil lama (default null → aman).

### 5.2 Layar
```
feature/home/PatrolTaskListScreen.kt    # daftar tugas patroli petugas (padanan tugas-saya PatroliSection)
feature/home/PatrolSessionScreen.kt     # detail sesi + daftar laporan + tombol "Tambah Laporan"
```
- Masuk dari `TugasScreen`: kartu jadwal patroli → tap → daftar task (atau langsung detail).
- `PatrolSessionScreen`: `LaunchedEffect` `GET /survei/{id}`; tombol "Tambah Laporan Patroli" hanya
  bila `role==petugas && status=="aktif"` → buka `LaporScreen` dengan `taskId`.

### 5.3 Jalur lapor dengan `taskId`
- `LaporViewModel` + `LaporScreen` menerima `taskId: String? = null`.
- Saat submit: kirim `survey_task_id = taskId` (kecuali diawali `"schedule-"` → null, ikut aturan web).
- Sukses → kembali ke `PatrolSessionScreen` dan **refresh** (padanan `invalidateQueries`).

### 5.4 Navigasi
`MainScaffold` (petugas): tambah `MainScreen.PATROL_SESSION` (+ id), `MainScreen.PATROL_TASKS`.
Pola sama seperti `DETAIL` yang sudah ada (`detailId` + `returnTab`).

---

## 6. FASE EKSEKUSI

| Fase | Isi | Verifikasi |
|---|---|---|
| **R1** | DTO `SurveyModels` + endpoint `survei` + `SurveyRepository` + `survey_task_id` di createReport/storeBatch | compile |
| **R2** | `PatrolSessionScreen` (detail sesi + tombol tambah laporan) | compile |
| **R3** | `PatrolTaskListScreen` (daftar tugas) + wiring `TugasScreen` | compile |
| **R4** | `LaporScreen`/`LaporViewModel` terima `taskId` + kirim `survey_task_id` + refresh sesi | compile |
| **R5** | Navigasi `MainScaffold` + wiring penuh | compile |
| **R6** | `assembleDebug` + verifikasi ad-hoc + (izin) uji device | build hijau |

---

## 7. RISIKO & KEPUTUSAN

1. **`taskId` sintetis `"schedule-"`** — ikuti web: jangan kirim sebagai `survey_task_id`
   (server `exists:survey_tasks,id` akan 422).
2. **Isolasi role** — `GET /survei` aman untuk petugas (di-scope server); jangan panggil endpoint supervisor.
3. **Kunci `reports_count`** — setelah lapor, detail sesi harus di-refresh agar angka bertambah.
4. **LaporScreen sudah ada** — jangan duplikasi; cukup tambah parameter opsional `taskId` (backward-compatible).
5. **Backend tak diubah** — semua sudah tersedia.

## 8. PERTANYAAN YANG PERLU DIKONFIRMASI

1. **Titik masuk**: dari tab **Tugas** (kartu jadwal → daftar sesi/task), atau tab baru "Patroli"?
   (default usulan: dari tab Tugas, mengikuti web `tugas-saya`.)
2. **Cakupan**: bangun **daftar task + detail sesi + lapor terkait** penuh (rekomendasi), atau
   hanya **detail sesi + lapor** dulu (lewati daftar task terpisah)?
3. **Foto wajib EXIF ≤2 hari** (aturan backend untuk petugas) — pastikan alur lapor patuh; konfirmasi
   apakah perlu peringatan khusus saat foto lama.

## 9. Out-of-scope
Perubahan backend, penjadwalan supervisor (sudah selesai), laporan warga, FCM deep-link.
