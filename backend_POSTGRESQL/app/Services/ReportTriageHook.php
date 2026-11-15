<?php

namespace App\Services;

use App\Http\Controllers\NativeInspectionController;
use App\Models\Report;
use Illuminate\Support\Facades\Log;

/**
 * Menyambungkan triase ke pengantrean inspeksi saat laporan warga dibuat.
 *
 * ── Tiga jalur ────────────────────────────────────────────────────────────
 *  A. Tidak perlu inspeksi  → laporan dibiarkan `Menunggu Review`
 *                             (supervisor me-review langsung).
 *  B. Perlu inspeksi + ada jadwal patroli → otomatis masuk antrean tugas petugas.
 *  C. Perlu inspeksi + TIDAK ada jadwal → laporan tetap tersimpan, diberi
 *                             penanda `[PERLU INSPEKSI]` agar supervisor
 *                             menanganinya manual.
 *
 * ── Prinsip: laporan warga tidak boleh gagal karena triase ────────────────
 * Pemanggil WAJIB membungkus `handle()` dengan try/catch. Apa pun yang gagal
 * di sini, laporan yang sudah tersimpan harus tetap ada — kehilangan laporan
 * warga jauh lebih buruk daripada antrean yang tidak terbentuk.
 */
class ReportTriageHook
{
    /** Penanda di `system_notes` ketika belum ada jadwal patroli yang cocok. */
    public const NEEDS_INSPECTION_MARKER = '[PERLU INSPEKSI]';

    public function __construct(
        private readonly TriageService $triage,
        private readonly PatrolAssignmentResolver $resolver,
    ) {}

    /**
     * @return string salah satu: 'langsung', 'diantrekan', 'tertunda'
     */
    public function handle(Report $report): string
    {
        if (! $this->triage->needsInspection($report)) {
            return 'langsung';
        }

        $task = $this->resolver->resolve($report);

        if (! $task) {
            $this->markPending($report);

            return 'tertunda';
        }

        app(NativeInspectionController::class)->enqueueForReport(
            task: $task,
            report: $report,
            actorId: $this->actorId($report),
        );

        Log::info('DeltaJalan: laporan warga otomatis diantrekan untuk inspeksi.', [
            'report_code' => $report->report_code,
            'survey_task_id' => $task->id,
            'tanggal_patroli' => $task->tanggal_patroli,
        ]);

        return 'diantrekan';
    }

    /**
     * Tandai laporan butuh inspeksi tetapi belum ada jadwal patroli.
     *
     * Memakai marker teks di `system_notes` (bukan kolom baru) supaya tidak
     * perlu migrasi dan langsung terlihat di layar supervisor.
     */
    private function markPending(Report $report): void
    {
        // Jangan menumpuk penanda bila dipanggil lebih dari sekali.
        if (str_contains((string) $report->system_notes, self::NEEDS_INSPECTION_MARKER)) {
            return;
        }

        $note = self::NEEDS_INSPECTION_MARKER
            .' Belum ada jadwal patroli untuk kecamatan '.$report->district
            .'. Perlu penjadwalan manual oleh supervisor.';

        $report->update([
            'system_notes' => $report->system_notes
                ? $report->system_notes.' | '.$note
                : $note,
        ]);

        Log::warning('DeltaJalan: laporan perlu inspeksi tetapi belum ada jadwal patroli.', [
            'report_code' => $report->report_code,
            'district' => $report->district,
        ]);
    }

    /**
     * Pelaku pencatatan sesi inspeksi.
     *
     * `inspection_sessions.started_by` adalah foreign key ke `users`, jadi
     * harus id yang valid. Pelapor warga biasanya punya user_id; laporan
     * Telegram/anonim tidak, sehingga jatuh ke supervisor yang memegang
     * laporan tersebut. Bila keduanya kosong, gunakan id terkecil yang ada
     * sebagai pengaman terakhir agar FK tidak dilanggar.
     */
    private function actorId(Report $report): int
    {
        return (int) ($report->user_id ?? $report->assigned_supervisor_id ?? 1);
    }
}
