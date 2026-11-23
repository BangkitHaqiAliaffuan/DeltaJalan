<?php

namespace App\Http\Controllers;

use App\Models\InspectionResult;
use App\Models\InspectionSession;
use App\Models\Report;
use App\Models\SurveyTask;
use App\Models\SurveyTaskReport;
use App\Services\GeographicService;
use App\Services\InspectionPhotoGuard;
use App\Services\PhotoMetadataService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class NativeInspectionController extends Controller
{
    /** Status assignment yang terlihat sebagai "tugas berjalan" oleh petugas. */
    private const ACTIVE = ['assigned', 'started'];

    /**
     * Status assignment yang membuat sebuah laporan TIDAK boleh diantrekan lagi.
     * `submitted` ikut dihitung: hasilnya masih menunggu review supervisor, jadi
     * mengantrekannya ulang akan membuat dua rantai inspeksi untuk satu laporan.
     * Jangan dipakai untuk daftar tugas petugas — di sana `submitted` memang
     * harus hilang dari daftar (lihat [index]).
     */
    private const BLOCKING = ['assigned', 'started', 'submitted'];

    public function __construct(
        private readonly PhotoMetadataService $metadata,
    ) {}

    private function petugas(Request $request, SurveyTaskReport $assignment): ?JsonResponse
    {
        $user = $request->user();

        return ($user->role !== 'petugas' || $assignment->team_id !== $user->team_id)
            ? response()->json(['message' => 'Forbidden'], 403) : null;
    }

    private function supervisorScope(Request $request, SurveyTaskReport $assignment): bool
    {
        $user = $request->user();
        if ($user->role === 'admin') {
            return true;
        }
        if ($user->role !== 'supervisor') {
            return false;
        }
        $uptdId = $assignment->session?->team?->uptd_id;

        return $uptdId !== null && $user->supervisedUptds()->whereKey($uptdId)->exists();
    }

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = SurveyTaskReport::with(['report', 'session.task'])
            ->whereIn('status', self::ACTIVE)
            ->whereHas('session', fn ($session) => $session->where('status', 'active'));
        if ($request->filled('date')) {
            $query->whereHas('session.task', fn ($task) => $task->whereDate('tanggal_patroli', $request->string('date')->toString()));
        }
        if ($user->role === 'petugas') {
            $query->where('team_id', $user->team_id);
        } elseif ($user->role === 'supervisor') {
            $ids = $user->supervisedUptds()->pluck('uptd.id');
            $query->whereHas('session.team', fn ($team) => $team->whereIn('uptd_id', $ids));
        } elseif ($user->role !== 'admin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        return response()->json(['data' => $query->latest()->paginate(min((int) $request->get('per_page', 20), 100))]);
    }

    /**
     * GET /api/inspection-queues/candidates
     *
     * Sumber tunggal kandidat antrean inspeksi. Sebelumnya klien memakai
     * `GET /reports?status=menunggu review`, yang juga mengembalikan laporan
     * yang sedang/sudah diinspeksi (assignment aktif) sehingga supervisor
     * menerima 409 saat mengantrekannya. Filter di sini mengecualikan laporan
     * yang sudah punya assignment pada [self::BLOCKING].
     */
    public function candidates(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! in_array($user->role, ['supervisor', 'admin'], true)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $limit = min(max((int) $request->get('limit', 30), 1), 50);
        $page = max((int) $request->get('page', 1), 1);

        $query = Report::query()
            ->whereIn('status', ['Menunggu Review', 'Ditinjau'])
            ->whereNotExists(function ($sub) {
                $sub->select(DB::raw(1))
                    ->from('survey_task_reports')
                    ->whereColumn('survey_task_reports.report_id', 'reports.id')
                    ->whereIn('survey_task_reports.status', self::BLOCKING);
            });

        // Cakupan supervisor disamakan dengan `ReportController::index` supaya
        // daftar kandidat sama dengan daftar triase yang biasa mereka lihat.
        if ($user->role === 'supervisor') {
            $query->where(function ($q) use ($user) {
                $q->where('assigned_supervisor_id', $user->id)
                    ->orWhereNull('assigned_supervisor_id');
            });
        }

        $total = (clone $query)->count();
        $reports = $query->orderByDesc('created_at')
            ->orderByDesc('report_code')
            ->skip(($page - 1) * $limit)
            ->take($limit)
            ->get();

        return response()->json([
            'success' => true,
            'data' => $reports->map(fn (Report $report) => [
                'id' => $report->id,
                'report_code' => $report->report_code,
                'reporter_name' => $report->reporter_name,
                'road_name' => $report->road_name,
                'district' => $report->district,
                'status' => $report->status,
                'source' => $report->source,
                'created_at' => $report->created_at?->toIso8601String(),
            ])->values(),
            'total' => $total,
            'page' => $page,
            'last_page' => max(1, (int) ceil($total / $limit)),
        ]);
    }

    public function show(Request $request, SurveyTaskReport $assignment): JsonResponse
    {
        $assignment->load('session.team');
        $user = $request->user();
        if ($user->role === 'petugas') {
            if (($response = $this->petugas($request, $assignment)) !== null) {
                return $response;
            }
        } elseif (! in_array($user->role, ['supervisor', 'admin'], true) || ! $this->supervisorScope($request, $assignment)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $assignment->load(['report', 'session.team', 'result.photos']);
        // Inspeksi ulang: assignment baru belum punya hasil sendiri, jadi alasan
        // supervisor diambil dari hasil terakhir laporan yang sama agar petugas
        // tahu apa yang harus diulang di lokasi.
        if ($assignment->session?->schedule_type === 'reinspection') {
            $previous = InspectionResult::where('report_id', $assignment->report_id)
                ->where('survey_task_report_id', '!=', $assignment->id)
                ->whereNotNull('reviewed_at')
                ->latest('reviewed_at')
                ->first();
            if ($previous) {
                $assignment->setAttribute('previous_review_notes', $previous->review_notes);
            }
        }

        return response()->json(['data' => $assignment]);
    }

    public function queue(Request $request, ?InspectionSession $session = null): JsonResponse
    {
        $user = $request->user();
        if (! in_array($user->role, ['supervisor', 'admin'], true)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }
        $v = $request->validate([
            'survey_task_id' => 'nullable|exists:survey_tasks,id', 'report_ids' => 'required|array|min:1',
            'report_ids.*' => 'uuid|exists:reports,id', 'idempotency_key' => 'nullable|string|max:120',
        ]);
        $taskId = $session?->survey_task_id ?? ($v['survey_task_id'] ?? null);
        if ($taskId === null) {
            return response()->json(['message' => 'survey_task_id wajib diisi.'], 422);
        }
        $task = SurveyTask::with('team')->findOrFail($taskId);
        if ($session && ($session->status !== 'active' || $session->survey_task_id !== $task->id)) {
            return response()->json(['message' => 'Sesi tidak cocok.'], 422);
        }
        if ($user->role === 'supervisor' && ! $user->supervisedUptds()->whereKey($task->team->uptd_id)->exists()) {
            return response()->json(['message' => 'Forbidden'], 403);
        }
        $reportIds = array_values(array_unique($v['report_ids']));
        sort($reportIds, SORT_STRING);
        $fingerprint = hash('sha256', $task->id.'|'.implode(',', $reportIds));
        $key = $v['idempotency_key'] ?? 'queue:'.$fingerprint;
        $queued = $this->queueReportIds($task, $reportIds, $user->id, $session, $key, $fingerprint);

        return response()->json(['data' => $queued->fresh()->load('assignments')], 201);
    }

    /**
     * Inti pengantrean laporan ke sesi inspeksi — dipakai jalur HTTP (`queue()`)
     * DAN jalur otomatis (`ReportTriageHook`).
     *
     * `$actorId` diberikan EKSPLISIT, bukan dibaca dari `request()`:
     * pada auto-queue tidak ada request supervisor, dan memanggil `request()`
     * di dalam transaksi berisiko memakai konteks yang salah.
     */
    private function queueReportIds(
        SurveyTask $task,
        array $reportIds,
        int $actorId,
        ?InspectionSession $session = null,
        ?string $key = null,
        ?string $fingerprint = null,
    ): InspectionSession {
        $key ??= 'queue:'.($fingerprint ?? hash('sha256', $task->id.'|'.implode(',', $reportIds)));

        return DB::transaction(function () use ($session, $task, $reportIds, $fingerprint, $key, $actorId) {
            if ($session) {
                $current = InspectionSession::whereKey($session->id)->lockForUpdate()->firstOrFail();
            } else {
                // The unique index on (survey_task_id, idempotency_key) closes the
                // PostgreSQL gap-lock hole: insertOrIgnore lets a concurrent
                // request wait for and reuse the winner instead of raising 500.
                DB::table('inspection_sessions')->insertOrIgnore([
                    'id' => (string) Str::uuid(),
                    'survey_task_id' => $task->id,
                    'patrol_schedule_id' => $task->patrol_schedule_id,
                    'team_id' => $task->team_id,
                    'started_by' => $actorId,
                    'schedule_type' => 'report_inspection',
                    'status' => 'active',
                    'started_at' => now(),
                    'idempotency_key' => $key,
                    'request_fingerprint' => $fingerprint,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                $current = InspectionSession::where('survey_task_id', $task->id)
                    ->where('idempotency_key', $key)
                    ->lockForUpdate()
                    ->firstOrFail();
            }
            if ($current->request_fingerprint !== null && $current->request_fingerprint !== $fingerprint) {
                abort(409, 'Idempotency key dipakai untuk payload berbeda.');
            }
            if ($current->request_fingerprint === null) {
                $current->update(['request_fingerprint' => $fingerprint]);
            }
            foreach ($reportIds as $reportId) {
                // Lock the parent report before checking the partial-unique
                // assignment index. A missing assignment row cannot be locked;
                // the report row serializes competing queue transactions.
                $report = Report::whereKey($reportId)->lockForUpdate()->firstOrFail();
                $active = SurveyTaskReport::where('report_id', $reportId)->whereIn('status', self::BLOCKING)->lockForUpdate()->first();
                if ($active && $active->inspection_session_id !== $current->id) {
                    abort(409, 'Report sudah memiliki assignment aktif.');
                }
                SurveyTaskReport::firstOrCreate(
                    ['inspection_session_id' => $current->id, 'report_id' => $reportId],
                    ['id' => (string) Str::uuid(), 'survey_task_id' => $task->id, 'team_id' => $task->team_id, 'status' => 'assigned', 'assigned_at' => now()]
                );
                // Laporan yang diantrekan sedang ditangani petugas di lapangan.
                // Tanpa perubahan status ini laporan tetap "Menunggu Review"
                // sehingga supervisor bisa approve/tolak dari triase web
                // sementara inspeksi masih berjalan. Memakai model (bukan mass
                // update) supaya `ReportObserver` menulis status_log.
                if (in_array($report->status, ['Menunggu Review', 'Ditinjau'], true)) {
                    $report->update(['status' => 'Ditugaskan']);
                }
            }

            return $current;
        });
    }

    /**
     * Titik masuk untuk auto-queue dari luar controller (ReportTriageHook).
     *
     * Tidak melakukan pemeriksaan role: pemanggil sudah memutuskan berdasarkan
     * triase. Pengaman tetap ada di level data — `queueReportIds()` menolak
     * bila laporan sudah punya assignment aktif (409).
     */
    public function enqueueForReport(SurveyTask $task, Report $report, int $actorId): void
    {
        $this->queueReportIds($task, [$report->id], $actorId);
    }

    /**
     * Batalkan antrean inspeksi untuk satu laporan (T2.4).
     *
     * Dipakai ketika auto-queue salah menilai — mis. lubang kecil yang
     * terhitung besar. Hanya boleh untuk assignment yang BELUM dikerjakan
     * petugas; menghapus tugas yang sedang berjalan berarti menghapus bukti.
     *
     * Efek: assignment dihapus, sesi ikut dihapus BILA tidak menyisakan
     * assignment lain, dan laporan kembali ke `Menunggu Review` agar muncul
     * lagi di daftar kandidat supervisor.
     */
    public function cancel(Request $request, SurveyTaskReport $assignment): JsonResponse
    {
        $user = $request->user();
        if (! in_array($user->role, ['supervisor', 'admin'], true) || ! $this->supervisorScope($request, $assignment)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if ($assignment->status !== 'assigned') {
            return response()->json([
                'message' => 'Tugas sudah dimulai atau selesai; tidak dapat dibatalkan.',
                'status' => $assignment->status,
            ], 422);
        }

        $reportId = $assignment->report_id;
        $sessionId = $assignment->inspection_session_id;

        DB::transaction(function () use ($assignment, $sessionId, $reportId) {
            $assignment->delete();

            // Sesi hanya dibuang bila tidak ada tugas lain yang tersisa.
            $tersisa = SurveyTaskReport::where('inspection_session_id', $sessionId)->exists();
            if (! $tersisa) {
                InspectionSession::whereKey($sessionId)->delete();
            }

            // Kembalikan status agar laporan muncul lagi di kandidat supervisor.
            // Memakai model (bukan mass update) supaya ReportObserver menulis
            // status_log.
            $report = Report::find($reportId);
            if ($report && in_array($report->status, ['Ditugaskan', 'Ditinjau'], true)) {
                $report->update(['status' => 'Menunggu Review']);
            }
        });

        Log::info('DeltaJalan: antrean inspeksi dibatalkan supervisor.', [
            'assignment_id' => $assignment->id,
            'report_id' => $reportId,
            'cancelled_by' => $user->name,
        ]);

        return response()->json(['success' => true, 'message' => 'Antrean inspeksi dibatalkan.']);
    }

    public function start(Request $request, SurveyTaskReport $assignment): JsonResponse
    {
        if (($response = $this->petugas($request, $assignment)) !== null) {
            return $response;
        }
        $inspectorId = $request->user()->id;
        $updated = DB::transaction(function () use ($assignment, $inspectorId) {
            $a = SurveyTaskReport::whereKey($assignment->id)->lockForUpdate()->firstOrFail();
            if (! in_array($a->status, ['assigned', 'started'], true)) {
                abort(422, 'Assignment tidak dapat dimulai.');
            }
            // Catat SIAPA yang mengerjakan. Tanpa ini supervisor hanya bisa
            // menebak dari `session.started_by`, yang berisi supervisor
            // pembuat sesi patroli — bukan petugas yang mengukur.
            // Saat sudah `started`, petugas pertama dipertahankan agar klik
            // ulang tidak mengubah riwayat pelaksana.
            $a->update([
                'status' => 'started',
                'started_at' => $a->started_at ?: now(),
                'inspector_id' => $a->inspector_id ?: $inspectorId,
            ]);

            return $a;
        });

        return response()->json(['data' => $updated->fresh()->load('report')]);
    }

    public function submit(Request $request, SurveyTaskReport $assignment): JsonResponse
    {
        if (($response = $this->petugas($request, $assignment)) !== null) {
            return $response;
        }
        $v = $request->validate([
            'idempotency_key' => 'required|string|max:120', 'condition' => 'nullable|string|max:40', 'notes' => 'nullable|string|max:5000',
            // Dimensi hasil ukur petugas (meter). Opsional: petugas tanpa meteran
            // tidak boleh dipaksa mengarang angka.
            'kerusakan_panjang' => 'nullable|numeric|min:0.01|max:100',
            'kerusakan_lebar' => 'nullable|numeric|min:0.01|max:100',
            'kerusakan_kedalaman' => 'nullable|numeric|min:0.01|max:100',
            // Karakteristik lokasi. Opsional: petugas yang ragu tidak dipaksa memilih.
            'jenis_perkerasan' => ['nullable', Rule::in(InspectionResult::JENIS_PERKERASAN)],
            'kepadatan_lalu_lintas' => ['nullable', Rule::in(InspectionResult::KEPADATAN_LALU_LINTAS)],
            'latitude' => 'nullable|numeric', 'longitude' => 'nullable|numeric', 'photos' => 'required|array|min:1', 'photos.*' => 'required|image|max:5120',
        ]);
        $files = $request->file('photos');
        $laporan = Report::whereKey($assignment->report_id)->first(['id', 'latitude', 'longitude', 'system_notes']);
        [$lat, $lng, $metadata, $hashes, $guard] = $this->validateFiles(
            $files,
            $v['latitude'] ?? null,
            $v['longitude'] ?? null,
            $laporan?->latitude,
            $laporan?->longitude,
        );

        // Penjaga lokasi: tolak foto yang jauh dari titik laporan atau
        // tersebar antar foto. Tolak keras hanya untuk kasus kasar (>1 km),
        // sisanya jadi peringatan supaya supervisor yang memutuskan.
        if ($guard['reject'] !== null) {
            abort(422, $guard['reject']);
        }
        // Dimensi WAJIB ikut fingerprint. Tanpa ini, submit ulang dengan dimensi
        // berbeda dianggap "payload sama" dan pengukuran baru hilang diam-diam.
        $fingerprint = hash('sha256', json_encode([
            'assignment' => $assignment->id, 'condition' => $v['condition'] ?? null, 'notes' => $v['notes'] ?? null,
            'dimensi' => [
                $this->dim($v['kerusakan_panjang'] ?? null),
                $this->dim($v['kerusakan_lebar'] ?? null),
                $this->dim($v['kerusakan_kedalaman'] ?? null),
            ],
            // Sama seperti dimensi: koreksi jenis perkerasan / kepadatan harus
            // mengubah fingerprint, kalau tidak submit ulang dianggap "payload sama".
            'jenis_perkerasan' => $v['jenis_perkerasan'] ?? null,
            'kepadatan_lalu_lintas' => $v['kepadatan_lalu_lintas'] ?? null,
            'lat' => $lat, 'lng' => $lng, 'photos' => $hashes,
        ], JSON_THROW_ON_ERROR));
        $result = DB::transaction(function () use ($request, $assignment, $v, $files, $lat, $lng, $metadata, $fingerprint, $guard) {
            $a = SurveyTaskReport::whereKey($assignment->id)->lockForUpdate()->firstOrFail();
            $existing = InspectionResult::where('inspector_id', $request->user()->id)->where('idempotency_key', $v['idempotency_key'])->lockForUpdate()->first();
            if ($existing) {
                if ($existing->request_fingerprint !== $fingerprint) {
                    abort(409, 'Idempotency key dipakai untuk payload/foto berbeda.');
                }

                return $existing->load('photos');
            }
            if (! in_array($a->status, ['assigned', 'started'], true)) {
                abort(422, 'Assignment sudah diproses.');
            }
            $result = InspectionResult::create([
                'survey_task_report_id' => $a->id, 'report_id' => $a->report_id, 'inspector_id' => $request->user()->id, 'result' => 'submitted',
                'condition' => $v['condition'] ?? null, 'notes' => $v['notes'] ?? null, 'latitude' => $lat, 'longitude' => $lng,
                'kerusakan_panjang' => $this->dim($v['kerusakan_panjang'] ?? null),
                'kerusakan_lebar' => $this->dim($v['kerusakan_lebar'] ?? null),
                'kerusakan_kedalaman' => $this->dim($v['kerusakan_kedalaman'] ?? null),
                'jenis_perkerasan' => $v['jenis_perkerasan'] ?? null,
                'kepadatan_lalu_lintas' => $v['kepadatan_lalu_lintas'] ?? null,
                'idempotency_key' => $v['idempotency_key'], 'request_fingerprint' => $fingerprint,
            ]);
            foreach ($files as $i => $photo) {
                $gps = $metadata[$i]['gps'];
                $result->photos()->create(['path' => $photo->store('inspection', 'public'), 'sha256' => hash_file('sha256', $photo->getRealPath()), 'sort_order' => $i, 'latitude' => $gps['lat'] ?? $lat, 'longitude' => $gps['lng'] ?? $lng, 'taken_at' => $metadata[$i]['taken_at']]);
            }
            $a->update([
                'status' => 'submitted',
                'submitted_at' => now(),
                // Jalur submit tanpa "Mulai" tetap harus mencatat pelaksananya,
                // supaya nama petugas tidak kosong di label supervisor.
                'inspector_id' => $a->inspector_id ?: $request->user()->id,
            ]);
            Report::whereKey($a->report_id)->update(['status' => 'Ditinjau']);

            // Peringatan lokasi (mis. foto 350 m dari titik laporan) dicatat
            // di system_notes agar tetap terbaca oleh supervisor, tidak hanya
            // tampil sesaat di respons kirim. Tidak menimpa catatan lama.
            if (! empty($guard['warnings'])) {
                $catatanLama = Report::whereKey($a->report_id)->value('system_notes');
                $gabungan = trim(implode(' | ', array_filter([$catatanLama, implode(' | ', $guard['warnings'])])));
                Report::whereKey($a->report_id)->update(['system_notes' => $gabungan]);
            }

            return $result->load('photos');
        });

        return response()->json(['data' => $result, 'warnings' => $guard['warnings']], $result->wasRecentlyCreated ? 201 : 200);
    }

    /**
     * @param  mixed  $reportLat  Lintang titik laporan warga; null bila laporan lama tidak punya koordinat.
     * @param  mixed  $reportLng  Bujur titik laporan warga.
     * @return array{0: float, 1: float, 2: array, 3: array, 4: array{reject: ?string, warnings: array}}
     */
    private function validateFiles(
        array $files,
        mixed $fallbackLat,
        mixed $fallbackLng,
        mixed $reportLat = null,
        mixed $reportLng = null,
    ): array {
        $fallbackLat = $fallbackLat !== null ? (float) $fallbackLat : null;
        $fallbackLng = $fallbackLng !== null ? (float) $fallbackLng : null;
        if (($fallbackLat === null) !== ($fallbackLng === null)) {
            abort(422, 'Koordinat fallback harus lengkap.');
        }
        $metadata = [];
        $hashes = [];
        $lat = $fallbackLat;
        $lng = $fallbackLng;
        foreach ($files as $file) {
            $date = $this->metadata->validateCaptureDate($file);
            if ($date['status'] !== 'valid') {
                abort(422, $date['message']);
            }
            $gps = $this->metadata->extractGps($file);
            if ($gps && ! GeographicService::isInSidoarjo($gps['lat'], $gps['lng'])) {
                abort(422, 'GPS foto berada di luar wilayah Sidoarjo.');
            }
            if ($gps && $lat === null) {
                $lat = $gps['lat'];
                $lng = $gps['lng'];
            }
            $metadata[] = ['gps' => $gps, 'taken_at' => $date['photo_date']];
            $hashes[] = hash_file('sha256', $file->getRealPath());
        }
        if ($lat === null || $lng === null || ! GeographicService::isInSidoarjo($lat, $lng)) {
            abort(422, 'Koordinat berada di luar wilayah Kabupaten Sidoarjo atau tidak tersedia.');
        }

        // ── Penjaga jarak ────────────────────────────────────────────────
        // Diperiksa SETELAH semua foto punya metadata, karena aturannya
        // membandingkan antar foto juga (satu kunjungan, bukan campuran).
        $guard = (new InspectionPhotoGuard)->review(
            $reportLat !== null ? (float) $reportLat : null,
            $reportLng !== null ? (float) $reportLng : null,
            array_map(static fn (array $m): array => [
                'lat' => $m['gps']['lat'] ?? null,
                'lng' => $m['gps']['lng'] ?? null,
            ], $metadata),
        );

        return [$lat, $lng, $metadata, $hashes, $guard];
    }

    public function discovered(Request $request, InspectionSession $session): JsonResponse
    {
        $user = $request->user();
        if ($user->role !== 'petugas' || $session->team_id !== $user->team_id || $session->status !== 'active') {
            return response()->json(['message' => 'Sesi tidak aktif atau Forbidden'], 403);
        }
        $v = $request->validate(['idempotency_key' => 'required|string|max:120', 'road_name' => 'required|string|max:255', 'district' => 'required|string|max:100', 'latitude' => 'nullable|numeric', 'longitude' => 'nullable|numeric', 'photo' => 'required|image|max:5120', 'description' => 'nullable|string|max:5000']);
        $photo = $request->file('photo');
        $date = $this->metadata->validateCaptureDate($photo);
        if ($date['status'] !== 'valid') {
            abort(422, $date['message']);
        }
        $gps = $this->metadata->extractGps($photo);
        if ($gps && ! GeographicService::isInSidoarjo($gps['lat'], $gps['lng'])) {
            abort(422, 'GPS foto berada di luar wilayah Sidoarjo.');
        }
        $lat = $gps['lat'] ?? ($v['latitude'] ?? null);
        $lng = $gps['lng'] ?? ($v['longitude'] ?? null);
        if ($lat === null || $lng === null || ! GeographicService::isInSidoarjo((float) $lat, (float) $lng)) {
            abort(422, 'Koordinat berada di luar wilayah Kabupaten Sidoarjo atau tidak tersedia.');
        }
        $fingerprint = hash('sha256', json_encode(['session' => $session->id, 'road_name' => $v['road_name'], 'district' => $v['district'], 'lat' => $lat, 'lng' => $lng, 'description' => $v['description'] ?? null, 'photo' => hash_file('sha256', $photo->getRealPath())], JSON_THROW_ON_ERROR));
        $result = DB::transaction(function () use ($request, $session, $v, $photo, $lat, $lng, $gps, $date, $fingerprint) {
            $existing = InspectionResult::where('inspector_id', $request->user()->id)->where('idempotency_key', $v['idempotency_key'])->lockForUpdate()->first();
            if ($existing) {
                if ($existing->request_fingerprint !== $fingerprint) {
                    abort(409, 'Idempotency key dipakai untuk payload/foto berbeda.');
                }

                return $existing->load(['report', 'assignment', 'photos']);
            }
            $report = Report::create(['user_id' => $request->user()->id, 'report_code' => 'INS-'.strtoupper(substr(str_replace('-', '', (string) Str::uuid()), 0, 12)), 'reporter_name' => $request->user()->name, 'road_name' => $v['road_name'], 'district' => $v['district'], 'latitude' => $lat, 'longitude' => $lng, 'image_original_path' => $photo->store('reports', 'public'), 'source' => 'petugas', 'description' => $v['description'] ?? null, 'status' => 'Ditinjau', 'survey_task_id' => $session->survey_task_id]);
            $assignment = SurveyTaskReport::create(['id' => (string) Str::uuid(), 'survey_task_id' => $session->survey_task_id, 'inspection_session_id' => $session->id, 'report_id' => $report->id, 'team_id' => $session->team_id, 'status' => 'submitted', 'submitted_at' => now()]);
            $inspection = InspectionResult::create(['survey_task_report_id' => $assignment->id, 'report_id' => $report->id, 'inspector_id' => $request->user()->id, 'result' => 'submitted', 'latitude' => $lat, 'longitude' => $lng, 'idempotency_key' => $v['idempotency_key'], 'request_fingerprint' => $fingerprint, 'notes' => $v['description'] ?? null]);
            $inspection->photos()->create(['path' => $report->image_original_path, 'sha256' => hash_file('sha256', $photo->getRealPath()), 'sort_order' => 0, 'latitude' => $gps['lat'] ?? $lat, 'longitude' => $gps['lng'] ?? $lng, 'taken_at' => $date['photo_date']]);

            return $inspection->load(['report', 'assignment', 'photos']);
        });

        return response()->json(['data' => $result], $result->wasRecentlyCreated ? 201 : 200);
    }

    public function pending(Request $request): JsonResponse
    {
        if (! in_array($request->user()->role, ['supervisor', 'admin'], true)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }
        $query = InspectionResult::with(['report', 'photos', 'assignment.session.team'])->where('result', 'submitted');
        if ($request->user()->role === 'supervisor') {
            $ids = $request->user()->supervisedUptds()->pluck('uptd.id');
            $query->whereHas('assignment.session.team', fn ($team) => $team->whereIn('uptd_id', $ids));
        }

        return response()->json(['data' => $query->latest()->paginate(20)]);
    }

    public function review(Request $request, InspectionResult $result): JsonResponse
    {
        if (! in_array($request->user()->role, ['supervisor', 'admin'], true)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }
        $v = $request->validate([
            'action' => ['required', Rule::in(['accept', 'return', 'reinspect', 'reject'])],
            // Alasan wajib untuk keputusan yang mengubah pekerjaan petugas.
            // `accept` boleh tanpa catatan; sisanya harus jelas agar petugas tahu
            // apa yang harus diperbaiki/diulang.
            'review_notes' => [
                'string', 'max:5000',
                Rule::requiredIf(fn () => in_array($request->input('action'), ['return', 'reinspect', 'reject'], true)),
                // Alasan yang wajib juga harus cukup jelas, bukan sekadar spasi.
                Rule::when(
                    in_array($request->input('action'), ['return', 'reinspect', 'reject'], true),
                    ['min:5'],
                ),
            ],
        ]);
        $result->load('assignment.session.team');
        if ($request->user()->role === 'supervisor' && ! $this->supervisorScope($request, $result->assignment)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }
        $updated = DB::transaction(function () use ($result, $request, $v) {
            $locked = InspectionResult::with('assignment.session.team')->whereKey($result->id)->lockForUpdate()->firstOrFail();
            $assignment = $locked->assignment;
            $report = Report::whereKey($locked->report_id)->lockForUpdate()->firstOrFail();
            $action = $v['action'];
            $notes = $v['review_notes'] ?? null;
            $reviewFields = ['reviewed_by' => $request->user()->id, 'review_notes' => $notes, 'reviewed_at' => now()];

            if ($action === 'reinspect') {
                $key = 'reinspection:'.$locked->id;
                $fingerprint = hash('sha256', json_encode(['action' => $action, 'review_notes' => $notes], JSON_THROW_ON_ERROR));
                $existing = InspectionSession::where('survey_task_id', $assignment->survey_task_id)->where('idempotency_key', $key)->lockForUpdate()->first();
                if ($existing) {
                    if ($existing->request_fingerprint !== $fingerprint) {
                        abort(409, 'Reinspection idempotency key dipakai untuk payload berbeda.');
                    }

                    return $existing->load('assignments');
                }
                if ($locked->result !== 'submitted') {
                    abort(422, 'Hasil inspeksi sudah direview.');
                }
                $newSession = InspectionSession::create(['id' => (string) Str::uuid(), 'survey_task_id' => $assignment->survey_task_id, 'patrol_schedule_id' => $assignment->session->patrol_schedule_id, 'team_id' => $assignment->team_id, 'started_by' => $request->user()->id, 'schedule_type' => 'reinspection', 'status' => 'active', 'started_at' => now(), 'idempotency_key' => $key, 'request_fingerprint' => $fingerprint]);
                SurveyTaskReport::create(['id' => (string) Str::uuid(), 'survey_task_id' => $assignment->survey_task_id, 'inspection_session_id' => $newSession->id, 'report_id' => $assignment->report_id, 'team_id' => $assignment->team_id, 'status' => 'assigned', 'assigned_at' => now()]);
                // Hasil lama tetap tersimpan sebagai histori, tetapi ditandai sudah
                // direview supaya tidak muncul terus di /inspection-results/pending.
                $locked->update(['result' => 'reinspection_requested'] + $reviewFields);
                $report->update(['status' => 'Ditugaskan']);

                return $newSession->load('assignments');
            }

            if ($locked->result !== 'submitted') {
                abort(422, 'Hasil inspeksi sudah direview.');
            }

            if ($action === 'return') {
                // Data/bukti kurang: petugas melanjutkan assignment yang sama dan
                // mengirim hasil baru; hasil yang dikembalikan tetap jadi histori.
                // Status laporan tetap `Ditugaskan` (bukan `Menunggu Review`):
                // pekerjaan belum selesai, dan kalau dikembalikan ke antrean
                // triase supervisor bisa menyetujuinya dari web sementara
                // assignment-nya masih berjalan.
                $locked->update(['result' => 'returned'] + $reviewFields);
                $assignment->update(['status' => 'started', 'submitted_at' => null]);
                $report->update(['status' => 'Ditugaskan']);

                return $locked->fresh(['report', 'photos']);
            }

            if ($action === 'accept') {
                $locked->update(['result' => 'accepted'] + $reviewFields);
                $assignment->update(['status' => 'accepted']);

                // ── Kepadatan lalu lintas → prioritas laporan ──────────────
                // Petugas melihat langsung kondisi lokasi; tebakan supervisor
                // dari foto jauh lebih lemah. Nilai ini hanya dipakai bila
                // petugas MENGISI kepadatan — kalau kosong, prioritas yang
                // sudah ada (mis. ditetapkan supervisor saat approve) tetap
                // dipertahankan, bukan ditimpa default.
                $prioritasDariLokasi = InspectionResult::KEPADATAN_KE_PRIORITAS[$locked->kepadatan_lalu_lintas] ?? null;

                $report->update($prioritasDariLokasi
                    ? ['status' => 'Disetujui', 'priority' => $prioritasDariLokasi]
                    : ['status' => 'Disetujui']);

                return $locked->fresh(['report', 'photos']);
            }

            $locked->update(['result' => 'rejected'] + $reviewFields);
            $assignment->update(['status' => 'not_verified']);
            $report->update(['status' => 'Ditolak']);

            return $locked->fresh(['report', 'photos']);
        });

        return response()->json(['data' => $updated]);
    }

    /**
     * Normalisasi satu nilai dimensi (meter) untuk fingerprint & penyimpanan.
     *
     * Dua alasan perlu dinormalisasi:
     *  1. Klien bisa mengirim `1.5`, `"1.5"`, atau `"1.50"` untuk angka yang sama.
     *     Tanpa normalisasi, fingerprint berbeda → server menolak submit ulang
     *     dengan 409 padahal isinya identik.
     *  2. Nilai kosong / 0 dibuang menjadi `null`, BUKAN 0. Dimensi 0 meter
     *     berarti "tidak diukur", bukan "tidak ada kerusakan".
     */
    private function dim(mixed $value): ?float
    {
        if ($value === null || $value === '' || ! is_numeric($value)) {
            return null;
        }

        $float = round((float) $value, 2);

        return $float > 0 ? $float : null;
    }
}
