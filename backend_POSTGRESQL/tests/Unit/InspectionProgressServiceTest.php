<?php

namespace Tests\Unit;

use App\Models\InspectionResult;
use App\Models\InspectionSession;
use App\Models\Report;
use App\Models\SurveyTaskReport;
use App\Models\User;
use App\Services\InspectionProgressService;
use Illuminate\Database\Eloquent\Collection;
use PHPUnit\Framework\TestCase;

/**
 * Kontrak `InspectionProgressService`: menerjemahkan status assignment
 * inspeksi menjadi tahap yang bisa ditampilkan supervisor, TANPA menambah
 * nilai baru pada `reports.status`.
 *
 * Semua model dibangun dengan `forceFill()` + `setRelation()`, jadi tidak
 * menyentuh database — sama seperti TriageServiceTest.
 */
class InspectionProgressServiceTest extends TestCase
{
    private InspectionProgressService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new InspectionProgressService;
    }

    /** Laporan dengan satu assignment berstatus tertentu. */
    private function reportWith(string $status, ?InspectionResult $result = null, ?InspectionSession $session = null): Report
    {
        $assignment = (new SurveyTaskReport)->forceFill([
            'id' => '01a1dfa0-c603-70f1-87e1-9a404fa6c49a',
            'report_id' => 'r-1',
            'status' => $status,
        ]);

        if ($result !== null) {
            $assignment->setRelation('result', $result);
        }
        if ($session !== null) {
            $assignment->setRelation('session', $session);
        }

        return (new Report)->forceFill(['id' => 'r-1'])
            ->setRelation('inspectionAssignments', new Collection([$assignment]));
    }

    private function makeResult(string $inspectorName, bool $sudahDireview = false): InspectionResult
    {
        $r = (new InspectionResult)->forceFill(['id' => 'i-1']);
        // `reviewed_at` diisi lewat setRawAttributes agar cast datetime tidak
        // berjalan: cast itu memanggil connection() dan test ini sengaja tanpa
        // database. Yang diuji hanya "null vs tidak null".
        $r->setRawAttributes(['id' => 'i-1', 'reviewed_at' => $sudahDireview ? '2026-11-15 12:00:00' : null] + $r->getAttributes());
        $r->setRelation('inspector', (new User)->forceFill(['name' => $inspectorName]));

        return $r;
    }

    // ── Tanpa inspeksi ───────────────────────────────────────────────────

    public function test_laporan_tanpa_assignment_berarti_none(): void
    {
        $report = (new Report)->forceFill(['id' => 'r-1'])
            ->setRelation('inspectionAssignments', new Collection);

        $this->assertSame(InspectionProgressService::NONE, $this->service->state($report));
        $this->assertNull($this->service->inspectorName($report));
        $this->assertFalse($this->service->payload($report)['has_inspection']);
    }

    // ── Pemetaan status assignment → tahap ───────────────────────────────

    public function test_assigned_berarti_menunggu_petugas(): void
    {
        $report = $this->reportWith('assigned');

        $this->assertSame(InspectionProgressService::ASSIGNED, $this->service->state($report));
        $this->assertTrue($this->service->payload($report)['has_inspection']);
    }

    public function test_started_berarti_sedang_diukur(): void
    {
        $this->assertSame(
            InspectionProgressService::STARTED,
            $this->service->state($this->reportWith('started')),
        );
    }

    public function test_submitted_berarti_menunggu_review(): void
    {
        $this->assertSame(
            InspectionProgressService::SUBMITTED,
            $this->service->state($this->reportWith('submitted', $this->makeResult('Budi'))),
        );
    }

    public function test_sudah_direview_berarti_reviewed(): void
    {
        // reviewed_at terisi menandakan supervisor sudah memutuskan.
        $report = $this->reportWith('submitted', $this->makeResult('Budi', sudahDireview: true));

        $this->assertSame(InspectionProgressService::REVIEWED, $this->service->state($report));
    }

    public function test_status_assignment_tak_dikenal_tidak_dianggap_belum_diinspeksi(): void
    {
        // Lebih jujur menyebut "dijadwalkan" daripada menyembunyikan bahwa
        // laporan ini pernah masuk jalur inspeksi.
        $this->assertSame(
            InspectionProgressService::ASSIGNED,
            $this->service->state($this->reportWith('status-aneh-dari-masa-depan')),
        );
    }

    // ── Siapa petugasnya ─────────────────────────────────────────────────

    public function test_nama_petugas_diambil_dari_hasil_inspeksi(): void
    {
        $report = $this->reportWith('submitted', $this->makeResult('Budi Santoso'));

        $this->assertSame('Budi Santoso', $this->service->inspectorName($report));
    }

    public function test_nama_petugas_diambil_dari_assignment_saat_belum_submit(): void
    {
        // Petugas sudah menekan "Mulai"; hasil belum dikirim.
        // Sumbernya `survey_task_reports.inspector_id`, BUKAN session.started_by
        // (kolom itu berisi supervisor pembuat sesi patroli).
        $assignment = (new SurveyTaskReport)->forceFill([
            'id' => '01a1dfa0-c603-70f1-87e1-9a404fa6c49a',
            'report_id' => 'r-1',
            'status' => 'started',
        ]);
        $assignment->setRelation('inspector', (new User)->forceFill(['name' => 'Andi']));

        $report = (new Report)->forceFill(['id' => 'r-1'])
            ->setRelation('inspectionAssignments', new Collection([$assignment]));

        $this->assertSame('Andi', $this->service->inspectorName($report));
    }

    /**
     * REGRESI: `inspection_sessions.started_by` berisi SUPERVISOR yang membuat
     * sesi patroli, bukan petugas yang mengukur. Memakainya sebagai sumber nama
     * akan menampilkan orang yang salah pada label "Sedang Diinspeksi".
     */
    public function test_pembuka_sesi_tidak_dipakai_sebagai_nama_petugas(): void
    {
        $session = (new InspectionSession)->forceFill(['id' => 's-1']);
        $session->setRelation('startedBy', (new User)->forceFill(['name' => 'Supervisor Salah']));

        $report = $this->reportWith('started', null, $session);

        $this->assertNull($this->service->inspectorName($report));
    }

    public function test_nama_petugas_null_saat_baru_dijadwalkan(): void
    {
        // Penugasan masih di tingkat tim, orangnya belum ditentukan.
        $this->assertNull($this->service->inspectorName($this->reportWith('assigned')));
    }

    public function test_hasil_inspeksi_lebih_diutamakan_daripada_pelaksana_awal(): void
    {
        // Bisa terjadi pergantian petugas: yang menekan "Mulai" berbeda dari
        // yang mengirim hasil. Nama pengirim data lebih akurat.
        $assignment = (new SurveyTaskReport)->forceFill([
            'id' => '01a1dfa0-c603-70f1-87e1-9a404fa6c49a',
            'report_id' => 'r-1',
            'status' => 'submitted',
        ]);
        $assignment->setRelation('inspector', (new User)->forceFill(['name' => 'Andi']));
        $assignment->setRelation('result', $this->makeResult('Budi'));

        $report = (new Report)->forceFill(['id' => 'r-1'])
            ->setRelation('inspectionAssignments', new Collection([$assignment]));

        $this->assertSame('Budi', $this->service->inspectorName($report));
    }

    // ── Inspeksi ulang ───────────────────────────────────────────────────

    public function test_assignment_terbaru_yang_dipakai_saat_inspeksi_ulang(): void
    {
        $lama = (new SurveyTaskReport)->forceFill([
            'id' => '01a1dea1-c0ba-710b-a34a-ea312becd286', 'report_id' => 'r-1', 'status' => 'submitted',
        ]);
        $lama->setRelation('result', $this->makeResult('Budi', sudahDireview: true));

        $baru = (new SurveyTaskReport)->forceFill([
            'id' => '01a1dfb0-c0ba-710b-a34a-ea312becd286', 'report_id' => 'r-1', 'status' => 'assigned',
        ]);

        $report = (new Report)->forceFill(['id' => 'r-1'])
            ->setRelation('inspectionAssignments', new Collection([$lama, $baru]));

        // Yang relevan adalah putaran yang sedang berjalan, bukan yang selesai.
        $this->assertSame(InspectionProgressService::ASSIGNED, $this->service->state($report));
    }

    public function test_payload_selalu_memuat_tiga_kunci(): void
    {
        $payload = $this->service->payload($this->reportWith('assigned'));

        $this->assertSame(['has_inspection', 'inspection_state', 'inspector_name'], array_keys($payload));
    }

    /**
     * Regresi: detail laporan supervisor tidak pernah memuat isi hasil ukur.
     *
     * `payload()` hanya mengirim tahap + nama petugas, jadi layar detail
     * menampilkan badge "Sudah Diinspeksi" tanpa catatan, dimensi, maupun foto
     * bukti petugas. `detail()` menambal itu.
     */
    public function test_detail_memuat_isi_hasil_inspeksi(): void
    {
        $assignment = (new SurveyTaskReport)->forceFill([
            'id' => '01a1dfa0-c603-70f1-87e1-9a404fa6c49a',
            'report_id' => 'r-1',
            'status' => 'submitted',
        ]);

        $result = (new InspectionResult)->forceFill([
            'id' => 'res-1',
            'report_id' => 'r-1',
            'condition' => 'Rusak Sedang',
            'notes' => 'Lubang memanjang di lajur kiri',
            'kerusakan_panjang' => '3.50',
            'kerusakan_lebar' => '5.00',
            'kerusakan_kedalaman' => '2.00',
            'jenis_perkerasan' => 'aspal',
            'kepadatan_lalu_lintas' => 'padat',
        ]);
        $result->setRelation('photos', new Collection);
        $result->setRelation('inspector', (new User)->forceFill(['id' => 1, 'name' => 'Rizky']));
        $result->setRelation('reviewer', null);

        $assignment->setRelation('result', $result);
        $assignment->setRelation('inspector', null);

        $report = (new Report)->forceFill(['id' => 'r-1'])
            ->setRelation('inspectionAssignments', new Collection([$assignment]));

        $hasil = $this->service->detail($report)['inspection_result'];

        $this->assertSame('Rusak Sedang', $hasil['condition']);
        $this->assertSame('Lubang memanjang di lajur kiri', $hasil['notes']);
        $this->assertSame('aspal', $hasil['jenis_perkerasan']);
        $this->assertSame('padat', $hasil['kepadatan_lalu_lintas']);
        $this->assertSame('Rizky', $hasil['inspector_name']);
        // Desimal harus berupa angka, bukan string "3.50" dari cast decimal.
        $this->assertSame(3.5, $hasil['kerusakan_panjang']);
        $this->assertSame([], $hasil['photos']);
    }

    public function test_detail_null_bila_belum_ada_hasil(): void
    {
        $hasil = $this->service->detail($this->reportWith('assigned'))['inspection_result'];

        $this->assertNull($hasil);
    }
}
