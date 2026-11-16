<?php

namespace App\Services;

use App\Models\Report;

/**
 * Penentu apakah sebuah laporan perlu diverifikasi lapangan (inspeksi)
 * sebelum dieksekusi, atau boleh langsung direview supervisor.
 *
 * ── Mengapa hanya dua kolom ────────────────────────────────────────────────
 * Keputusan ini HANYA memakai `overall_severity` dan `pci_score` karena
 * keduanya terbukti terisi di produksi. Dua kolom lain sengaja TIDAK dipakai:
 *
 *  - `ai_confidence` : NULL pada payload produksi, dan untuk data lama diisi
 *                      angka ACAK oleh BackfillPhotoData (0.65 + mt_rand()).
 *                      Memakainya = keputusan operasional di atas data palsu.
 *  - `ai_jenis_kerusakan` : juga NULL pada payload produksi.
 *
 * Bila kelak kedua kolom itu terisi konsisten, tambahkan sebagai penguat —
 * bukan sebagai pengganti.
 *
 * ── Sifat kelas ────────────────────────────────────────────────────────────
 * Tanpa state, tanpa dependensi, tanpa I/O. Aman dipanggil dari controller,
 * job, maupun artisan command.
 */
class TriageService
{
    /**
     * Batas bawah kategori "Rusak Sedang" pada PciService::CONDITION_MAP.
     *
     * Sengaja ditulis ulang (bukan mengambil milik PciService) karena
     * PciService memakainya sebagai rentang KATEGORI internal, sedangkan di
     * sini maknanya AMBANG KEPUTUSAN. Dua hal berbeda; menyatukannya akan
     * membuat perubahan kosmetik pada kategori PCI ikut mengubah alur kerja
     * lapangan secara diam-diam.
     */
    public const PCI_INSPECTION_THRESHOLD = 50.0;

    /** Dipakai konsisten oleh UI, log, dan test. */
    public const SEVERITY_BERAT = 'Rusak Berat';

    /**
     * Apakah laporan wajib diverifikasi petugas di lapangan lebih dulu.
     *
     * Aturan (keputusan sesi 2026-11-15):
     *  1. Laporan petugas  → TIDAK pernah inspeksi (petugas sudah di lokasi).
     *  2. Severity "Rusak Berat" → SELALU inspeksi, apa pun PCI-nya.
     *  3. PCI NULL         → inspeksi (jangan menebak; arah aman).
     *  4. PCI < 50         → inspeksi. Tepat 50 TIDAK (pakai `<`, bukan `<=`).
     *  5. Selain itu       → langsung review supervisor.
     */
    public function needsInspection(Report $report): bool
    {
        // (1) Petugas sudah berada di lokasi saat melapor.
        if ($this->isPetugasReport($report)) {
            return false;
        }

        // (2) Kerusakan berat selalu diverifikasi, meski PCI tinggi.
        if ($report->overall_severity === self::SEVERITY_BERAT) {
            return true;
        }

        $pci = $this->pci($report);

        // (3) PCI tidak tersedia → jangan menebak.
        if ($pci === null) {
            return true;
        }

        // (4) Di bawah ambang → perlu pengukuran dimensi.
        return $pci < self::PCI_INSPECTION_THRESHOLD;
    }

    /**
     * Alasan dalam Bahasa Indonesia, untuk log dan label UI supervisor.
     *
     * Selalu mengembalikan kalimat yang bisa dibaca operator — jangan
     * mengembalikan string kosong, karena UI memakainya sebagai tooltip.
     */
    public function reason(Report $report): string
    {
        if ($this->isPetugasReport($report)) {
            return 'Laporan petugas; petugas sudah berada di lokasi.';
        }

        if ($report->overall_severity === self::SEVERITY_BERAT) {
            return 'Kerusakan berat; perlu verifikasi volume dan kondisi lapangan.';
        }

        $pci = $this->pci($report);

        if ($pci === null) {
            return 'PCI belum tersedia; verifikasi lapangan dianjurkan.';
        }

        if ($pci < self::PCI_INSPECTION_THRESHOLD) {
            return 'PCI di bawah ambang; perlu pengukuran dimensi.';
        }

        return 'Kerusakan rutin; dapat langsung dieksekusi.';
    }

    /**
     * Kategori singkat untuk badge UI: `inspeksi` atau `langsung`.
     * Dipisah dari needsInspection() agar UI tidak menebak dari boolean.
     */
    public function track(Report $report): string
    {
        return $this->needsInspection($report) ? 'inspeksi' : 'langsung';
    }

    /**
     * `source` laporan petugas.
     *
     * Dibandingkan longgar (trim + lowercase) karena nilai kolom berasal dari
     * masukan yang berbeda-beda jalur; salah kaprah di sini akan membuat
     * laporan petugas ikut masuk antrean inspeksi.
     */
    private function isPetugasReport(Report $report): bool
    {
        return strtolower(trim((string) $report->source)) === 'petugas';
    }

    /**
     * PCI sebagai float|null.
     *
     * PENTING: kolom `pci_score` di-cast `decimal:2` pada model Report, sehingga
     * Eloquent mengembalikan STRING (contoh "20.75"), bukan float. Membandingkan
     * string dengan float di PHP bisa menghasilkan hasil tak terduga, dan
     * kode lain di repo ini pun selalu menulis `(float) $report->pci_score`.
     * Semua akses PCI WAJIB lewat helper ini.
     */
    private function pci(Report $report): ?float
    {
        $value = $report->pci_score;

        if ($value === null || $value === '') {
            return null;
        }

        if (! is_numeric($value)) {
            return null;
        }

        return (float) $value;
    }
}
