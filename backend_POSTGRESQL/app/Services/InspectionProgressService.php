<?php

namespace App\Services;

use App\Models\Report;
use App\Models\SurveyTaskReport;

/**
 * Menentukan tahap inspeksi sebuah laporan + petugas yang mengerjakannya.
 *
 * Kenapa terpisah dari `status` laporan:
 * `reports.status` menjawab "laporan ini ada di tahap alur kerja mana"
 * (`Menunggu Review` → `Ditugaskan` → `Sedang Diperbaiki` → `Selesai`).
 * Pertanyaan "laporan ini sedang diukur petugas atau sedang diperbaiki?"
 * BUKAN pertanyaan alur kerja — ia turunan dari ada/tidaknya assignment
 * inspeksi dan status assignment itu sendiri.
 *
 * Menyimpannya sebagai status baru berarti menyimpan satu fakta di dua
 * tempat, dan dua sumber kebenaran pasti berbeda suatu saat. Karena itu
 * nilainya dihitung di sini, tidak disimpan.
 */
class InspectionProgressService
{
    /** Belum pernah masuk jalur inspeksi lapangan. */
    public const NONE = 'none';

    /** Sudah dijadwalkan, petugas belum memulai pengukuran. */
    public const ASSIGNED = 'assigned';

    /** Petugas sudah membuka sesi di lokasi, pengukuran belum dikirim. */
    public const STARTED = 'started';

    /** Hasil pengukuran sudah dikirim, menunggu keputusan supervisor. */
    public const SUBMITTED = 'submitted';

    /** Supervisor sudah memutuskan hasil inspeksi terakhir. */
    public const REVIEWED = 'reviewed';

    /**
     * Tahap inspeksi untuk satu laporan.
     *
     * Memakai assignment TERBARU: satu laporan bisa diinspeksi ulang
     * (`reinspect`), dan yang relevan bagi supervisor adalah tahap
     * perulangan yang sedang berjalan, bukan yang sudah selesai.
     */
    public function state(Report $report): string
    {
        $assignment = $this->latestAssignment($report);

        if ($assignment === null) {
            return self::NONE;
        }

        // Hasil terakhir sudah diputuskan supervisor → inspeksi tuntas,
        // walau assignment-nya sendiri tetap berstatus `submitted`.
        // `relationLoaded()` dipakai agar tidak memicu lazy query bila relasi
        // sudah di-eager-load (atau belum tersedia sama sekali).
        $result = $assignment->relationLoaded('result') ? $assignment->result : null;
        // Atribut dibaca mentah (`getAttributes()`) tanpa cast datetime:
        // cast itu memanggil `connection()` hanya untuk memformat tanggal, dan
        // tidak diperlukan di sini — yang ditanyakan cuma "sudah direview atau
        // belum". Efek sampingnya, service ini bisa diuji tanpa database.
        $reviewedAt = $result !== null ? ($result->getAttributes()['reviewed_at'] ?? null) : null;
        if ($reviewedAt !== null) {
            return self::REVIEWED;
        }

        return match ($assignment->status) {
            'assigned' => self::ASSIGNED,
            'started' => self::STARTED,
            'submitted' => self::SUBMITTED,
            // Status tak dikenal jangan sampai membuat laporan tampak
            // "belum diinspeksi" — lebih jujur menyebut sudah dijadwalkan.
            default => self::ASSIGNED,
        };
    }

    /**
     * Nama petugas yang mengerjakan inspeksi, bila sudah diketahui.
     *
     * Sumbernya berjenjang karena data muncul bertahap:
     *  1. `inspector_id` pada hasil inspeksi — paling akurat, petugas yang
     *     benar-benar mengirim pengukuran.
     *  2. `started_by` pada sesi — petugas yang membuka sesi di lokasi,
     *     tersedia sebelum hasil dikirim.
     *  3. `null` — baru dijadwalkan; nama petugas belum bisa diketahui
     *     karena penugasan masih di tingkat tim, bukan orang.
     */
    public function inspectorName(Report $report): ?string
    {
        $assignment = $this->latestAssignment($report);

        if ($assignment === null) {
            return null;
        }

        // Relasi diperiksa dengan `relationLoaded()` supaya tidak ada lazy
        // query saat pemanggil sudah menyediakan datanya.
        $result = $assignment->relationLoaded('result') ? $assignment->result : null;
        $session = $assignment->relationLoaded('session') ? $assignment->session : null;

        $inspector = ($result !== null && $result->relationLoaded('inspector')) ? $result->inspector : null;
        if ($inspector === null && $session !== null && $session->relationLoaded('startedBy')) {
            $inspector = $session->startedBy;
        }

        return $inspector?->name;
    }

    /**
     * Versi siap-pakai untuk payload API. Aditif terhadap kontrak lama:
     * `has_inspection` dipertahankan agar klien versi sebelumnya tetap jalan.
     *
     * @return array{has_inspection: bool, inspection_state: string, inspector_name: string|null}
     */
    public function payload(Report $report): array
    {
        $state = $this->state($report);

        return [
            'has_inspection' => $state !== self::NONE,
            'inspection_state' => $state,
            'inspector_name' => $this->inspectorName($report),
        ];
    }

    /**
     * Assignment inspeksi terbaru beserta hasil & sesinya.
     *
     * Diurutkan berdasarkan `id`: model memakai `HasUuids` yang menghasilkan
     * UUIDv7 — prefix-nya bertambah seiring waktu, jadi urutan `id` = urutan
     * pembuatan. Lebih andal daripada `created_at` karena tidak bergantung pada
     * cast datetime (yang butuh koneksi DB dan menyulitkan unit test tanpa
     * database), dan tidak terpengaruh jam server yang mundur.
     *
     * Bila relasi `inspectionAssignments` sudah di-eager-load (dipakai di
     * `index()`), ambil dari memori agar tidak ada query per baris. Bila belum,
     * query langsung — jalur detail hanya memuat satu laporan.
     */
    private function latestAssignment(Report $report): ?SurveyTaskReport
    {
        if ($report->relationLoaded('inspectionAssignments')) {
            return $report->inspectionAssignments->sortByDesc('id')->first();
        }

        return SurveyTaskReport::with(['result.inspector', 'session.startedBy'])
            ->where('report_id', $report->id)
            ->orderByDesc('id')
            ->first();
    }
}
