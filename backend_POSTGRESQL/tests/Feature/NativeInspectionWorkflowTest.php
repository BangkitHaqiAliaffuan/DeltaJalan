<?php

namespace Tests\Feature;

use App\Models\InspectionResult;
use App\Models\InspectionSession;
use App\Models\PatrolSchedule;
use App\Models\Report;
use App\Models\SurveyTask;
use App\Models\SurveyTaskReport;
use App\Models\Team;
use App\Models\User;
use App\Services\GeographicService;
use App\Services\PhotoMetadataService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Laravel\Sanctum\Sanctum;
use Mockery\MockInterface;
use Tests\TestCase;

class NativeInspectionWorkflowTest extends TestCase
{
    use RefreshDatabase;

    /**
     * 1x1 JPEG valid. Dipakai lewat `createWithContent()` supaya test tidak
     * bergantung pada ekstensi GD (yang tidak selalu ada di mesin dev/CI).
     */
    private const MINIMAL_JPEG = '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';

    private const REVIEW_REASON = 'Data dan bukti belum lengkap.';

    private bool $photoMetadataMocked = false;

    public function test_sidoarjo_validation_uses_shared_boundary_behavior(): void
    {
        $this->assertTrue(GeographicService::isInSidoarjo(-7.25, 112.50));
        $this->assertFalse(GeographicService::isInSidoarjo(-7.24, 112.50));
        $this->assertFalse(GeographicService::isInSidoarjo(-7.65, 112.96));
    }

    public function test_supervisor_schedule_mutations_are_scoped_at_runtime(): void
    {
        [$supervisor, , $inScopeTeam] = $this->teamFixture(supervisorInScope: true, attachPetugas: false);
        $outsideUptdId = (string) Str::uuid();
        DB::table('uptd')->insert([
            'id' => $outsideUptdId,
            'nama' => 'UPTD Di Luar Scope',
            'kecamatan_wilayah' => json_encode(['Krian']),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $outsideTeam = Team::create([
            'id' => (string) Str::uuid(),
            'name' => 'Tim Di Luar Scope',
            'uptd_id' => $outsideUptdId,
        ]);
        $inScopeSchedule = $this->createSchedule($inScopeTeam, $supervisor);
        $outsideSchedule = $this->createSchedule($outsideTeam, $supervisor);

        Sanctum::actingAs($supervisor);

        $this->postJson('/api/patrol-schedules/'.$inScopeSchedule->id.'/toggle')
            ->assertOk();
        $this->assertDatabaseHas('patrol_schedules', [
            'id' => $inScopeSchedule->id,
            'status' => 'nonaktif',
        ]);

        $this->postJson('/api/patrol-schedules/'.$outsideSchedule->id.'/toggle')
            ->assertForbidden();
        $this->assertDatabaseHas('patrol_schedules', [
            'id' => $outsideSchedule->id,
            'status' => 'aktif',
        ]);

        $this->deleteJson('/api/patrol-schedules/'.$outsideSchedule->id)
            ->assertForbidden();
        $this->assertDatabaseHas('patrol_schedules', ['id' => $outsideSchedule->id]);

        $this->deleteJson('/api/patrol-schedules/'.$inScopeSchedule->id)
            ->assertOk();
        $this->assertDatabaseMissing('patrol_schedules', ['id' => $inScopeSchedule->id]);
    }

    public function test_generated_inspection_session_can_be_bound_by_queue_without_fixed_fingerprint(): void
    {
        [$supervisor, $petugas, $team] = $this->teamFixture(supervisorInScope: true, attachPetugas: false);
        Sanctum::actingAs($supervisor);
        $startDate = now()->addDay()->toDateString();

        $scheduleResponse = $this->postJson('/api/patrol-schedules', [
            'team_id' => $team->id,
            'hari' => ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'],
            'kecamatan_list' => ['Sidoarjo'],
            'frekuensi' => 'setiap_minggu',
            'start_date' => $startDate,
            'end_date' => $startDate,
            'alasan_tugas' => 'rutin',
            'schedule_type' => 'report_inspection',
        ])->assertCreated();

        $scheduleId = $scheduleResponse->json('data.id');
        $task = SurveyTask::where('patrol_schedule_id', $scheduleId)->firstOrFail();
        $session = InspectionSession::where('survey_task_id', $task->id)->firstOrFail();
        $this->assertNull($session->request_fingerprint);

        $report = $this->createReport($task, $petugas);

        $this->postJson('/api/inspection-sessions/'.$session->id.'/queue', [
            'report_ids' => [$report->id],
        ])->assertCreated()
            ->assertJsonPath('data.id', $session->id);

        $fingerprint = hash('sha256', $task->id.'|'.$report->id);
        $this->assertDatabaseHas('inspection_sessions', [
            'id' => $session->id,
            'request_fingerprint' => $fingerprint,
        ]);
        $this->assertDatabaseHas('survey_task_reports', [
            'inspection_session_id' => $session->id,
            'report_id' => $report->id,
            'status' => 'assigned',
        ]);

        $this->postJson('/api/inspection-sessions/'.$session->id.'/queue', [
            'report_ids' => [$report->id],
        ])->assertCreated();

        $this->assertSame(1, SurveyTaskReport::where('inspection_session_id', $session->id)->count());
    }

    public function test_queue_without_session_reuses_session_and_assignment_for_same_idempotency_key(): void
    {
        [$supervisor, , $task, $report] = $this->inspectionFixture(supervisorInScope: true);
        Sanctum::actingAs($supervisor);
        $payload = [
            'survey_task_id' => $task->id,
            'report_ids' => [$report->id],
            'idempotency_key' => 'queue-retry-same-natural-key',
        ];

        $first = $this->postJson('/api/inspection-queues', $payload)->assertCreated();
        $second = $this->postJson('/api/inspection-queues', $payload)->assertCreated();

        $this->assertSame($first->json('data.id'), $second->json('data.id'));
        $this->assertSame(1, InspectionSession::where('survey_task_id', $task->id)
            ->where('idempotency_key', $payload['idempotency_key'])
            ->count());
        $this->assertSame(1, SurveyTaskReport::where('inspection_session_id', $first->json('data.id'))
            ->where('report_id', $report->id)
            ->count());
    }

    public function test_queue_with_different_idempotency_key_conflicts_without_duplicate_assignment(): void
    {
        [$supervisor, , $task, $report] = $this->inspectionFixture(supervisorInScope: true);
        Sanctum::actingAs($supervisor);
        $basePayload = [
            'survey_task_id' => $task->id,
            'report_ids' => [$report->id],
        ];

        $this->postJson('/api/inspection-queues', $basePayload + [
            'idempotency_key' => 'queue-first-natural-key',
        ])->assertCreated();

        $this->postJson('/api/inspection-queues', $basePayload + [
            'idempotency_key' => 'queue-different-natural-key',
        ])->assertStatus(409);

        $this->assertDatabaseCount('inspection_sessions', 1);
        $this->assertDatabaseCount('survey_task_reports', 1);
        $this->assertDatabaseHas('survey_task_reports', [
            'report_id' => $report->id,
            'status' => 'assigned',
        ]);
    }

    public function test_queue_candidates_exclude_reports_with_blocking_assignment(): void
    {
        [$supervisor, $petugas, $task] = $this->inspectionFixture(supervisorInScope: true);
        $available = $this->createReport($task, $petugas);
        $assigned = $this->createReport($task, $petugas);
        $submitted = $this->createReport($task, $petugas);

        $session = $this->createSession($task, $petugas, 'report_inspection');
        $this->createAssignment($session, $task, $assigned);
        $this->submittedInspection($task, $submitted, $petugas);

        Sanctum::actingAs($supervisor);

        // Hanya laporan tanpa assignment yang menghalangi antrean yang boleh
        // muncul — `assigned`, `started`, dan `submitted` semuanya dikecualikan.
        $this->getJson('/api/inspection-queues/candidates')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $available->id)
            ->assertJsonPath('data.0.status', 'Menunggu Review')
            ->assertJsonPath('total', 1);
    }

    public function test_queue_rejects_report_that_already_has_submitted_assignment(): void
    {
        [$supervisor, $petugas, $task, $report] = $this->inspectionFixture(supervisorInScope: true);
        $this->submittedInspection($task, $report, $petugas);
        Sanctum::actingAs($supervisor);

        // Hasil inspeksi pertama masih menunggu review; mengantrekan ulang akan
        // membuat dua rantai inspeksi untuk laporan yang sama.
        $this->postJson('/api/inspection-queues', [
            'survey_task_id' => $task->id,
            'report_ids' => [$report->id],
            'idempotency_key' => 'queue-after-submit',
        ])->assertStatus(409);

        $this->assertSame(1, SurveyTaskReport::where('report_id', $report->id)->count());
    }

    public function test_queue_marks_report_as_assigned_and_removes_it_from_candidates(): void
    {
        [$supervisor, , $task, $report] = $this->inspectionFixture(supervisorInScope: true);
        Sanctum::actingAs($supervisor);

        $this->postJson('/api/inspection-queues', [
            'survey_task_id' => $task->id,
            'report_ids' => [$report->id],
        ])->assertCreated();

        // Status `Ditugaskan` membuat triase web tidak bisa approve/tolak
        // laporan yang sedang dikerjakan petugas.
        $this->assertDatabaseHas('reports', ['id' => $report->id, 'status' => 'Ditugaskan']);
        $this->getJson('/api/inspection-queues/candidates')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_queue_authorization_rejects_supervisor_outside_assigned_uptd(): void
    {
        [$supervisor, , $task, $report] = $this->inspectionFixture();
        Sanctum::actingAs($supervisor);

        $this->postJson('/api/inspection-queues', [
            'survey_task_id' => $task->id,
            'report_ids' => [$report->id],
        ])->assertForbidden();

        $this->assertDatabaseCount('inspection_sessions', 0);
        $this->assertDatabaseCount('survey_task_reports', 0);
    }

    public function test_discovered_report_requires_active_session_and_persists_aggregate_with_review_status(): void
    {
        [, $petugas, $task, $report] = $this->inspectionFixture(supervisorInScope: true);
        $inactiveSession = $this->createSession($task, $petugas, 'report_inspection', 'submitted');
        Sanctum::actingAs($petugas);

        $this->postJson('/api/inspection-sessions/'.$inactiveSession->id.'/discovered-reports', [
            'idempotency_key' => 'discovered-inactive',
            'road_name' => 'Jalan Contoh',
            'district' => 'Sidoarjo',
            'latitude' => -7.25,
            'longitude' => 112.50,
        ])->assertForbidden();

        $activeSession = $this->createSession($task, $petugas, 'report_inspection');
        Storage::fake('public');
        $this->mockPhotoMetadata();

        $response = $this->post('/api/inspection-sessions/'.$activeSession->id.'/discovered-reports', [
            'idempotency_key' => 'discovered-active',
            'road_name' => 'Jalan Contoh',
            'district' => 'Sidoarjo',
            'latitude' => -7.25,
            'longitude' => 112.50,
            'description' => 'Temuan baru saat inspeksi.',
            'photo' => $this->fakeInspectionPhoto('discovered.jpg'),
        ], ['Accept' => 'application/json']);

        $response->assertCreated();
        $discovered = Report::where('source', 'petugas')->firstOrFail();
        $this->assertDatabaseHas('reports', [
            'id' => $discovered->id,
            'status' => 'Ditinjau',
            'survey_task_id' => $task->id,
            'source' => 'petugas',
        ]);
        $assignment = SurveyTaskReport::where('report_id', $discovered->id)->firstOrFail();
        $this->assertSame('submitted', $assignment->status);
        $result = InspectionResult::where('report_id', $discovered->id)->firstOrFail();
        $this->assertSame('submitted', $result->result);
        $this->assertDatabaseHas('inspection_photos', [
            'inspection_result_id' => $result->id,
        ]);
        Storage::disk('public')->assertExists($discovered->image_original_path);
        $this->assertDatabaseHas('reports', ['id' => $report->id, 'status' => 'Menunggu Review']);
    }

    public function test_submit_is_idempotent_for_same_payload_and_conflicts_for_different_payload(): void
    {
        [, $petugas, $task, $report] = $this->inspectionFixture(supervisorInScope: true);
        $session = $this->createSession($task, $petugas, 'report_inspection');
        $assignment = $this->createAssignment($session, $task, $report);
        Storage::fake('public');
        Sanctum::actingAs($petugas);

        $first = $this->submitInspection($assignment, ['idempotency_key' => 'submit-idempotent']);
        $first->assertCreated();
        $resultId = $first->json('data.id');

        $retry = $this->submitInspection($assignment, ['idempotency_key' => 'submit-idempotent']);
        $retry->assertOk()->assertJsonPath('data.id', $resultId);
        $this->assertSame(1, InspectionResult::where('survey_task_report_id', $assignment->id)->count());

        $this->submitInspection($assignment, [
            'idempotency_key' => 'submit-idempotent',
            'notes' => 'Catatan berbeda pada key yang sama',
        ])->assertStatus(409);

        $this->assertSame(1, InspectionResult::where('survey_task_report_id', $assignment->id)->count());
        $this->assertDatabaseHas('survey_task_reports', ['id' => $assignment->id, 'status' => 'submitted']);
        $this->assertDatabaseHas('reports', ['id' => $report->id, 'status' => 'Ditinjau']);
    }

    public function test_submitted_assignment_leaves_petugas_task_list(): void
    {
        [, $petugas, $task, $report] = $this->inspectionFixture(supervisorInScope: true);
        $session = $this->createSession($task, $petugas, 'report_inspection');
        $assignment = $this->createAssignment($session, $task, $report);
        Storage::fake('public');
        Sanctum::actingAs($petugas);

        $this->getJson('/api/inspection-tasks')->assertOk()->assertJsonCount(1, 'data.data');

        $this->submitInspection($assignment)->assertCreated();

        // Assignment yang sudah dikirim tidak boleh menumpuk di daftar tugas petugas.
        $this->getJson('/api/inspection-tasks')->assertOk()->assertJsonCount(0, 'data.data');
    }

    public function test_review_requires_minimum_reason_for_return_reinspect_and_reject(): void
    {
        foreach (['return', 'reinspect', 'reject'] as $action) {
            [$supervisor, $petugas, $task, $report] = $this->inspectionFixture(supervisorInScope: true);
            [, , $result] = $this->submittedInspection($task, $report, $petugas);
            Sanctum::actingAs($supervisor);

            $this->postJson('/api/inspection-results/'.$result->id.'/review', ['action' => $action])
                ->assertStatus(422)
                ->assertJsonValidationErrors('review_notes');

            $this->postJson('/api/inspection-results/'.$result->id.'/review', [
                'action' => $action,
                'review_notes' => 'ok',
            ])->assertStatus(422)->assertJsonValidationErrors('review_notes');

            $this->postJson('/api/inspection-results/'.$result->id.'/review', [
                'action' => 'aksi-tidak-dikenal',
                'review_notes' => self::REVIEW_REASON,
            ])->assertStatus(422)->assertJsonValidationErrors('action');

            $this->assertDatabaseHas('inspection_results', [
                'id' => $result->id,
                'result' => 'submitted',
                'reviewed_at' => null,
            ]);

            $this->postJson('/api/inspection-results/'.$result->id.'/review', [
                'action' => $action,
                'review_notes' => self::REVIEW_REASON,
            ])->assertOk();
        }
    }

    public function test_accept_without_reason_marks_assignment_accepted_and_report_approved(): void
    {
        [$supervisor, $petugas, $task, $report] = $this->inspectionFixture(supervisorInScope: true);
        [, $assignment, $result] = $this->submittedInspection($task, $report, $petugas);
        Sanctum::actingAs($supervisor);

        $this->postJson('/api/inspection-results/'.$result->id.'/review', ['action' => 'accept'])
            ->assertOk()
            ->assertJsonPath('data.result', 'accepted');

        $this->assertDatabaseHas('survey_task_reports', ['id' => $assignment->id, 'status' => 'accepted']);
        $this->assertDatabaseHas('reports', ['id' => $report->id, 'status' => 'Disetujui']);
        $this->assertSame($supervisor->id, $result->fresh()->reviewed_by);

        // Sudah direview → tidak boleh direview dua kali dan tidak lagi pending.
        $this->postJson('/api/inspection-results/'.$result->id.'/review', ['action' => 'accept'])
            ->assertStatus(422);
        $this->getJson('/api/inspection-results/pending')->assertOk()->assertJsonCount(0, 'data.data');
    }

    public function test_reject_marks_assignment_not_verified_and_report_rejected(): void
    {
        [$supervisor, $petugas, $task, $report] = $this->inspectionFixture(supervisorInScope: true);
        [, $assignment, $result] = $this->submittedInspection($task, $report, $petugas);
        Sanctum::actingAs($supervisor);

        $this->postJson('/api/inspection-results/'.$result->id.'/review', [
            'action' => 'reject',
            'review_notes' => self::REVIEW_REASON,
        ])->assertOk()->assertJsonPath('data.result', 'rejected');

        $this->assertDatabaseHas('survey_task_reports', ['id' => $assignment->id, 'status' => 'not_verified']);
        $this->assertDatabaseHas('reports', ['id' => $report->id, 'status' => 'Ditolak']);
        $this->assertDatabaseHas('inspection_results', [
            'id' => $result->id,
            'reviewed_by' => $supervisor->id,
            'review_notes' => self::REVIEW_REASON,
        ]);
    }

    public function test_return_lets_petugas_resubmit_without_losing_history(): void
    {
        [$supervisor, $petugas, $task, $report] = $this->inspectionFixture(supervisorInScope: true);
        $session = $this->createSession($task, $petugas, 'report_inspection');
        $assignment = $this->createAssignment($session, $task, $report);
        Storage::fake('public');
        Sanctum::actingAs($petugas);

        $firstId = $this->submitInspection($assignment, ['idempotency_key' => 'submit-first'])
            ->assertCreated()
            ->json('data.id');

        Sanctum::actingAs($supervisor);
        $this->postJson('/api/inspection-results/'.$firstId.'/review', [
            'action' => 'return',
            'review_notes' => self::REVIEW_REASON,
        ])->assertOk();

        $this->assertDatabaseHas('survey_task_reports', [
            'id' => $assignment->id,
            'status' => 'started',
            'submitted_at' => null,
        ]);
        $this->assertDatabaseHas('inspection_results', ['id' => $firstId, 'result' => 'returned']);
        // Pekerjaan belum selesai, jadi laporan tetap ditugaskan — bukan
        // dikembalikan ke antrean triase supervisor.
        $this->assertDatabaseHas('reports', ['id' => $report->id, 'status' => 'Ditugaskan']);

        // Petugas harus melihat alasan pengembalian pada detail assignment.
        Sanctum::actingAs($petugas);
        $this->getJson('/api/inspection-tasks/'.$assignment->id)
            ->assertOk()
            ->assertJsonPath('data.result.result', 'returned')
            ->assertJsonPath('data.result.review_notes', self::REVIEW_REASON);

        $secondId = $this->submitInspection($assignment, [
            'idempotency_key' => 'submit-second',
            'notes' => 'Bukti sudah dilengkapi',
        ])->assertCreated()->json('data.id');

        $this->assertNotSame($firstId, $secondId);
        $this->assertSame(2, InspectionResult::where('survey_task_report_id', $assignment->id)->count());
        $this->assertDatabaseHas('survey_task_reports', ['id' => $assignment->id, 'status' => 'submitted']);
        $this->assertDatabaseHas('reports', ['id' => $report->id, 'status' => 'Ditinjau']);

        // Relasi `result` mengembalikan hasil terbaru, bukan hasil yang dikembalikan.
        $this->assertSame($secondId, $assignment->fresh()->result->id);
        $this->assertSame('submitted', $assignment->fresh()->result->result);
    }

    public function test_reinspect_marks_old_result_as_reviewed_and_exposes_reason_to_new_assignment(): void
    {
        [$supervisor, $petugas, $task, $report] = $this->inspectionFixture(supervisorInScope: true);
        [$session, , $result] = $this->submittedInspection($task, $report, $petugas);
        Sanctum::actingAs($supervisor);
        $payload = ['action' => 'reinspect', 'review_notes' => self::REVIEW_REASON];

        $first = $this->postJson('/api/inspection-results/'.$result->id.'/review', $payload)->assertOk();
        $newSessionId = $first->json('data.id');

        $this->assertNotSame($session->id, $newSessionId);
        $this->assertDatabaseHas('inspection_results', [
            'id' => $result->id,
            'result' => 'reinspection_requested',
            'reviewed_by' => $supervisor->id,
            'review_notes' => self::REVIEW_REASON,
        ]);
        $this->assertDatabaseHas('survey_task_reports', [
            'inspection_session_id' => $newSessionId,
            'report_id' => $report->id,
            'status' => 'assigned',
        ]);
        $this->assertDatabaseHas('reports', ['id' => $report->id, 'status' => 'Ditugaskan']);

        // Hasil yang sudah direview tidak boleh muncul lagi sebagai pending.
        $this->getJson('/api/inspection-results/pending')->assertOk()->assertJsonCount(0, 'data.data');

        // Retry idempoten dengan payload sama, konflik bila payload berbeda.
        $this->postJson('/api/inspection-results/'.$result->id.'/review', $payload)
            ->assertOk()
            ->assertJsonPath('data.id', $newSessionId);
        $this->postJson('/api/inspection-results/'.$result->id.'/review', [
            'action' => 'reinspect',
            'review_notes' => 'Alasan berbeda untuk key yang sama.',
        ])->assertStatus(409);

        $this->assertSame(1, InspectionSession::where('idempotency_key', 'reinspection:'.$result->id)->count());
        $this->assertSame(1, SurveyTaskReport::where('inspection_session_id', $newSessionId)->count());

        // Petugas harus melihat alasan inspeksi ulang pada assignment baru.
        $newAssignmentId = SurveyTaskReport::where('inspection_session_id', $newSessionId)->value('id');
        $this->getJson('/api/inspection-tasks/'.$newAssignmentId)
            ->assertOk()
            ->assertJsonPath('data.session.schedule_type', 'reinspection')
            ->assertJsonPath('data.previous_review_notes', self::REVIEW_REASON);
    }

    public function test_pending_lists_only_submitted_results_inside_supervisor_uptd(): void
    {
        [$supervisor, $petugas, $task, $report] = $this->inspectionFixture(supervisorInScope: true);
        [, , $result] = $this->submittedInspection($task, $report, $petugas);
        Sanctum::actingAs($supervisor);

        $this->getJson('/api/inspection-results/pending')
            ->assertOk()
            ->assertJsonCount(1, 'data.data')
            ->assertJsonPath('data.data.0.id', $result->id);

        [, $outsidePetugas, $outsideTask, $outsideReport] = $this->inspectionFixture();
        $this->submittedInspection($outsideTask, $outsideReport, $outsidePetugas);

        // Supervisor hanya melihat hasil dari UPTD yang dia awasi.
        $this->getJson('/api/inspection-results/pending')->assertOk()->assertJsonCount(1, 'data.data');
    }

    /** @return array{0:User,1:User,2:Team} */
    private function teamFixture(bool $supervisorInScope = false, bool $attachPetugas = true): array
    {
        $supervisor = User::factory()->create(['role' => 'supervisor']);
        $petugas = User::factory()->create(['role' => 'petugas']);

        $uptdId = (string) Str::uuid();
        DB::table('uptd')->insert([
            'id' => $uptdId,
            'nama' => 'UPTD Test',
            'kecamatan_wilayah' => json_encode(['Sidoarjo']),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $team = Team::create([
            'id' => (string) Str::uuid(),
            'name' => 'Tim Test',
            'uptd_id' => $uptdId,
        ]);
        if ($attachPetugas) {
            $petugas->team()->associate($team);
            $petugas->save();
        }
        if ($supervisorInScope) {
            DB::table('supervisor_uptd')->insert([
                'user_id' => $supervisor->id,
                'uptd_id' => $uptdId,
                'priority' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        return [$supervisor, $petugas, $team];
    }

    /** @return array{0:User,1:User,2:SurveyTask,3:Report} */
    private function inspectionFixture(bool $supervisorInScope = false): array
    {
        [$supervisor, $petugas, $team] = $this->teamFixture($supervisorInScope);
        $task = SurveyTask::create([
            'id' => (string) Str::uuid(),
            'team_id' => $team->id,
            'road_name' => 'Jalan Test',
            'kecamatan' => 'Sidoarjo',
            'tanggal_patroli' => now()->toDateString(),
            'jam_mulai' => '09:00',
            'jam_selesai' => '16:00',
            'alasan_tugas' => 'rutin',
            'status' => 'aktif',
        ]);
        $report = $this->createReport($task, $petugas);

        return [$supervisor, $petugas, $task, $report];
    }

    private function createSchedule(Team $team, User $creator): PatrolSchedule
    {
        return PatrolSchedule::create([
            'id' => (string) Str::uuid(),
            'team_id' => $team->id,
            'hari' => ['Senin', 'Selasa', 'Rabu'],
            'kecamatan_list' => ['Sidoarjo'],
            'frekuensi' => 'setiap_minggu',
            'start_date' => now()->addDay()->toDateString(),
            'end_date' => now()->addDay()->toDateString(),
            'alasan_tugas' => 'rutin',
            'status' => 'aktif',
            'created_by' => $creator->id,
            'schedule_type' => 'patrol',
        ]);
    }

    private function createReport(SurveyTask $task, User $petugas): Report
    {
        return Report::create([
            'id' => (string) Str::uuid(),
            'user_id' => $petugas->id,
            'report_code' => 'TEST-'.strtoupper(Str::random(10)),
            'reporter_name' => 'Petugas Test',
            'road_name' => 'Jalan Test',
            'district' => 'Sidoarjo',
            'latitude' => -7.25,
            'longitude' => 112.50,
            'status' => 'Menunggu Review',
            'survey_task_id' => $task->id,
        ]);
    }

    private function createSession(SurveyTask $task, User $startedBy, string $scheduleType, string $status = 'active'): InspectionSession
    {
        return InspectionSession::create([
            'id' => (string) Str::uuid(),
            'survey_task_id' => $task->id,
            'team_id' => $task->team_id,
            'started_by' => $startedBy->id,
            'schedule_type' => $scheduleType,
            'status' => $status,
            'started_at' => now(),
        ]);
    }

    private function createAssignment(InspectionSession $session, SurveyTask $task, Report $report, string $status = 'assigned'): SurveyTaskReport
    {
        return SurveyTaskReport::create([
            'id' => (string) Str::uuid(),
            'survey_task_id' => $task->id,
            'inspection_session_id' => $session->id,
            'report_id' => $report->id,
            'team_id' => $task->team_id,
            'status' => $status,
            'assigned_at' => now(),
            'submitted_at' => $status === 'submitted' ? now() : null,
        ]);
    }

    /**
     * Assignment + hasil inspeksi yang sudah dikirim petugas, siap direview.
     *
     * @return array{0:InspectionSession,1:SurveyTaskReport,2:InspectionResult}
     */
    private function submittedInspection(SurveyTask $task, Report $report, User $petugas): array
    {
        $session = $this->createSession($task, $petugas, 'report_inspection');
        $assignment = $this->createAssignment($session, $task, $report, 'submitted');
        $report->update(['status' => 'Ditinjau']);
        $result = InspectionResult::create([
            'id' => (string) Str::uuid(),
            'survey_task_report_id' => $assignment->id,
            'report_id' => $report->id,
            'inspector_id' => $petugas->id,
            'result' => 'submitted',
            'condition' => 'Rusak Ringan',
            'notes' => 'Catatan petugas',
            'idempotency_key' => 'submitted-'.$assignment->id,
            'request_fingerprint' => hash('sha256', 'submitted-result-'.$assignment->id),
        ]);

        return [$session, $assignment, $result];
    }

    private function submitInspection(SurveyTaskReport $assignment, array $overrides = []): TestResponse
    {
        $this->mockPhotoMetadata();

        return $this->post('/api/inspection-tasks/'.$assignment->id.'/submit', array_merge([
            'idempotency_key' => 'submit-'.$assignment->id,
            'condition' => 'Rusak Ringan',
            'notes' => 'Catatan petugas',
            'latitude' => -7.25,
            'longitude' => 112.50,
            'photos' => [$this->fakeInspectionPhoto()],
        ], $overrides), ['Accept' => 'application/json']);
    }

    private function fakeInspectionPhoto(string $name = 'bukti.jpg'): UploadedFile
    {
        return UploadedFile::fake()->createWithContent($name, base64_decode(self::MINIMAL_JPEG));
    }

    /** Foto inspeksi divalidasi lewat service; test memakai metadata "valid" yang deterministik. */
    private function mockPhotoMetadata(): void
    {
        if ($this->photoMetadataMocked) {
            return;
        }
        $this->photoMetadataMocked = true;
        $this->mock(PhotoMetadataService::class, function (MockInterface $mock): void {
            $mock->shouldReceive('validateCaptureDate')->andReturn([
                'status' => 'valid',
                'message' => 'Tanggal foto valid.',
                'photo_date' => now()->toDateString(),
            ]);
            $mock->shouldReceive('extractGps')->andReturn(null);
        });
    }
}
