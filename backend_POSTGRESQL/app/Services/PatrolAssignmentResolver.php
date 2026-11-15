<?php

namespace App\Services;

use App\Models\Report;
use App\Models\SurveyTask;
use App\Models\Uptd;

/**
 * Mencarikan tugas patroli yang paling tepat untuk sebuah laporan warga.
 *
 * ── Mengapa perlu ─────────────────────────────────────────────────────────
 * `NativeInspectionController::queue()` mewajibkan `survey_task_id`; ia tidak
 * bisa menebak sendiri. Untuk auto-queue, sistem harus memilih tugas yang
 * cocok TANPA campur tangan supervisor.
 *
 * ── Dasar pencocokan ──────────────────────────────────────────────────────
 * Hanya memakai kolom yang benar-benar ada pada `survey_tasks`
 * (migrasi 2026_06_22_092903 & 2026_06_23_000004):
 *   team_id · kecamatan · tanggal_patroli · status
 *
 * CATATAN: kolom tanggal bernama `tanggal_patroli`, BUKAN `scheduled_date`.
 *
 * ── Bila tidak ada yang cocok ─────────────────────────────────────────────
 * Mengembalikan null. Pemanggil WAJIB menanganinya (lihat ReportTriageHook) —
 * jangan memaksa membuat jadwal baru, karena itu berarti mengirim petugas ke
 * jalan yang belum direncanakan.
 */
class PatrolAssignmentResolver
{
    /**
     * Tugas patroli terdekat yang masih aktif untuk laporan ini, atau null.
     *
     * Urutan prioritas: tanggal patroli paling dekat lebih dulu, supaya
     * laporan tidak tertahan sampai jadwal yang jauh.
     */
    public function resolve(Report $report): ?SurveyTask
    {
        $district = trim((string) $report->district);
        if ($district === '') {
            return null;
        }

        $teamId = Uptd::resolveTeamIdByDistrict($district);
        if (! $teamId) {
            return null;
        }

        return SurveyTask::query()
            ->where('team_id', $teamId)
            ->where('status', 'aktif')
            ->where('kecamatan', $district)
            // `>=` hari ini: jadwal yang sudah lewat tidak boleh dipakai.
            ->whereDate('tanggal_patroli', '>=', now()->toDateString())
            ->orderBy('tanggal_patroli')
            ->orderBy('created_at')
            ->first();
    }
}
