<?php

namespace App\Services;

use App\Models\Report;
use App\Models\SurveyTaskReport;
use Illuminate\Support\Carbon;

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
     * Nama petugas yang mengerjakan inspeksi.
     *
     * Sumbernya berjenjang sesuai kapan data tersedia:
     *  1. `inspection_results.inspector_id` — petugas yang mengirim pengukuran.
     *  2. `survey_task_reports.inspector_id` — petugas yang menekan "Mulai",
     *     tersedia sejak tahap `started` sebelum hasil dikirim.
     *  3. `null` — assignment hasil auto-queue: penugasan masih di tingkat tim.
     *
     * SENGAJA TIDAK memakai `session.started_by`: kolom itu berisi SUPERVISOR
     * yang membuat sesi patroli, bukan petugas yang mengukur. Memakainya akan
     * menampilkan nama orang yang salah pada label "Sedang Diinspeksi".
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

        $inspector = ($result !== null && $result->relationLoaded('inspector')) ? $result->inspector : null;
        if ($inspector === null && $assignment->relationLoaded('inspector')) {
            $inspector = $assignment->inspector;
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
     * Isi hasil inspeksi untuk layar DETAIL laporan.
     *
     * `payload()` sengaja ringan karena dipakai di daftar (bisa ratusan baris
     * sekaligus). Data di sini hanya untuk satu laporan, jadi boleh lengkap:
     * catatan petugas, dimensi hasil ukur, karakteristik lokasi, dan foto
     * bukti. Tanpa ini supervisor hanya melihat badge "Sudah Diinspeksi"
     * tanpa isi apa pun — hasil pengukuran petugas tidak pernah terbaca dari
     * layar detail laporan.
     *
     * @return array{inspection_result: array<string, mixed>|null}
     */
    public function detail(Report $report): array
    {
        $assignment = $this->latestAssignment($report);

        // Dibaca dari relasi yang SUDAH dimuat. `latestAssignment()` di jalur
        // detail selalu memakai `with('result.inspector')`, jadi relasinya ada;
        // membaca lewat properti tanpa cek akan memicu query malas (dan gagal
        // pada pengujian tanpa database).
        $result = ($assignment !== null && $assignment->relationLoaded('result'))
            ? $assignment->result
            : null;

        if ($result === null) {
            return ['inspection_result' => null];
        }

        // Dimuat satu per satu HANYA bila belum ada di memori. `loadMissing()`
        // tidak dipakai karena tetap menyentuh koneksi pada kondisi tertentu,
        // dan service ini harus bisa diuji tanpa database.
        foreach (['photos', 'inspector', 'reviewer'] as $relasi) {
            if (! $result->relationLoaded($relasi)) {
                $result->load($relasi);
            }
        }

        // Relasi `inspector` di hasil didahulukan; bila kosong (submit lama),
        // pakai petugas yang menekan "Mulai".
        $inspector = $result->inspector
            ?? ($assignment->relationLoaded('inspector') ? $assignment->inspector : null);

        // Desimal dibaca sebagai string oleh cast `decimal:2`; klien butuh angka.
        $angka = static function ($nilai): ?float {
            return $nilai === null || $nilai === '' ? null : (float) $nilai;
        };

        return ['inspection_result' => [
            'id' => $result->id,
            'condition' => $result->condition,
            'notes' => $result->notes,
            'kerusakan_panjang' => $angka($result->kerusakan_panjang),
            'kerusakan_lebar' => $angka($result->kerusakan_lebar),
            'kerusakan_kedalaman' => $angka($result->kerusakan_kedalaman),
            'jenis_perkerasan' => $result->jenis_perkerasan,
            'kepadatan_lalu_lintas' => $result->kepadatan_lalu_lintas,
            'latitude' => $angka($result->latitude),
            'longitude' => $angka($result->longitude),
            'review_notes' => $result->review_notes,
            'reviewed_at' => $this->waktuIso($result, 'reviewed_at'),
            'reviewer_name' => $result->reviewer?->name,
            'inspector_name' => $inspector?->name,
            'photos' => $result->photos
                ->sortBy('sort_order')
                ->map(fn ($foto) => [
                    'id' => $foto->id,
                    'url' => $foto->url,
                    'sort_order' => (int) $foto->sort_order,
                ])
                ->values()
                ->all(),
        ]];
    }

    /**
     * Tanggal ISO-8601 dari atribut mentah.
     *
     * Dibaca lewat `getAttributes()` + `Carbon::parse` agar tidak memakai cast
     * datetime model — cast itu memanggil koneksi DB dan membuat service ini
     * tidak bisa diuji tanpa database.
     */
    private function waktuIso(object $model, string $kolom): ?string
    {
        $nilai = $model->getAttributes()[$kolom] ?? null;

        return $nilai === null ? null : Carbon::parse($nilai)->toIso8601String();
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

        return SurveyTaskReport::with(['result.inspector', 'inspector'])
            ->where('report_id', $report->id)
            ->orderByDesc('id')
            ->first();
    }
}
