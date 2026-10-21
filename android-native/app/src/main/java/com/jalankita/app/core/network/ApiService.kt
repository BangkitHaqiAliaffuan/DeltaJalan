package com.jalankita.app.core.network

import okhttp3.MultipartBody
import okhttp3.RequestBody
import okhttp3.ResponseBody
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.HTTP
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.Part
import retrofit2.http.Path
import retrofit2.http.PUT
import retrofit2.http.Query
import retrofit2.http.Streaming

/** Subset endpoint Fase 1 — bertambah per fase (kontrak: routes/api.php). */
interface ApiService {

    /** Bentuk FLAT {success, message, token, user} — lihat Models.kt. */
    @POST("auth/login")
    suspend fun login(@Body body: LoginRequest): LoginResponse

    /** POST /api/auth/register — daftar akun warga. Response {success, message, data}. */
    @POST("auth/register")
    suspend fun register(@Body body: RegisterRequest): RegisterResponse

    /** POST /api/auth/google — tukar Firebase ID token dengan sesi/onboarding. */
    @POST("auth/google")
    suspend fun googleLogin(@Body body: GoogleLoginRequest): GoogleLoginResponse

    /** POST /api/auth/google/complete — selesaikan onboarding Google. */
    @POST("auth/google/complete")
    suspend fun completeGoogleOnboarding(
        @Body body: CompleteGoogleOnboardingRequest,
    ): LoginResponse

    /** POST /api/auth/phone — lengkapi phone untuk sesi Sanctum yang sudah ada. */
    @POST("auth/phone")
    suspend fun completePhone(@Body body: CompletePhoneRequest): MeResponse

    @POST("auth/logout")
    suspend fun logout(): ApiEnvelope<StatusPayload?>

    /** Bentuk FLAT {success, user}. */
    @GET("auth/me")
    suspend fun me(): MeResponse

    /**
     * `version_code` WAJIB dikirim — server menghitung `force_update`
     * dari nilai ini (default 0 = selalu force-update bila min > 0).
     */
    @GET("app/version")
    suspend fun appVersion(
        @Query("platform") platform: String = "android",
        @Query("version_code") versionCode: Int,
    ): ApiEnvelope<AppVersionDto>

    /** Kontrak: PushSubscriptionController::storeFcmToken. */
    @POST("push/fcm-token")
    suspend fun postFcmToken(@Body body: FcmTokenRequest): ApiEnvelope<StatusPayload?>

    /** Kontrak: PushSubscriptionController::removeFcmToken. */
    @HTTP(method = "DELETE", path = "push/fcm-token", hasBody = true)
    suspend fun deleteFcmToken(@Body body: FcmTokenRequest): ApiEnvelope<StatusPayload?>

    // ── Notifikasi (semua role) ──────────────────────────────────────────
    // Kontrak: NotificationController. Endpoint per-user
    // ($request->user()->notifications()) — tanpa paginasi khusus role.
    // Replikasi Frontend-stable/src/routes/notifications.tsx.

    /** GET /api/notifications?page=&per_page= (maks 50 server). */
    @GET("notifications")
    suspend fun notifications(
        @Query("page") page: Int = 1,
        @Query("per_page") perPage: Int = 20,
    ): NotifListResponse

    /** GET /api/notifications/unread-count → {data:{unread}}. */
    @GET("notifications/unread-count")
    suspend fun unreadCount(): ApiEnvelope<UnreadDto>

    /** POST /api/notifications/{id}/read — 404 bila bukan milik user. */
    @POST("notifications/{id}/read")
    suspend fun markNotifRead(@Path("id") id: String): ApiEnvelope<StatusPayload?>

    /** POST /api/notifications/read-all. */
    @POST("notifications/read-all")
    suspend fun markAllNotifRead(): ApiEnvelope<StatusPayload?>

    /** DELETE /api/notifications — hapus semua (read + unread). */
    @HTTP(method = "DELETE", path = "notifications", hasBody = false)
    suspend fun deleteAllNotif(): ApiEnvelope<StatusPayload?>

    // ── Tracking GPS petugas (Fase 3) ────────────────────────────────────
    // Kontrak: WorkerLocationController::store. Server gate role=petugas
    // (403 untuk role lain) — schedule hanya dari sesi petugas.

    /** POST /api/worker/location — 201 {data:{id}}. */
    @POST("worker/location")
    suspend fun postWorkerLocation(
        @Body body: WorkerLocationRequest,
    ): ApiEnvelope<StatusPayload?>

    // ── Fase 2: Alur Lapor ────────────────────────────────────────────────

    /** POST /api/analyze — multipart `file` (+ latitude/longitude opsional). */
    @Multipart
    @POST("analyze")
    suspend fun analyze(
        @Part file: MultipartBody.Part,
        @Part("latitude") latitude: RequestBody? = null,
        @Part("longitude") longitude: RequestBody? = null,
    ): AnalyzeResponse

    /** POST /api/analyze-batch — analisis banyak foto (maks 20 server; klien batasi 10). */
    @Multipart
    @POST("analyze-batch")
    suspend fun analyzeBatch(
        @Part files: List<MultipartBody.Part>,
        @Part("latitude") latitude: RequestBody,
        @Part("longitude") longitude: RequestBody,
    ): AnalyzeBatchResponse

    /**
     * POST /api/reports/batch — simpan laporan multi-foto (satu laporan utama + sub per foto).
     * Analisis diambil server-side via `batch_id`; `kerusakan_panjang[]`/`lebar[]` per foto.
     * `files` dikirim sebagai fallback (bila server tak menemukan photo_paths).
     */
    @Multipart
    @POST("reports/batch")
    suspend fun storeBatch(
        @Part("batch_id") batchId: RequestBody,
        @Part("road_name") roadName: RequestBody,
        @Part("district") district: RequestBody,
        @Part("latitude") latitude: RequestBody,
        @Part("longitude") longitude: RequestBody,
        @Part("koordinat_sumber") koordinatSumber: RequestBody,
        @Part("kerusakan_panjang[]") kerusakanPanjang: List<RequestBody>,
        @Part("kerusakan_lebar[]") kerusakanLebar: List<RequestBody>,
        @Part("catatan") catatan: RequestBody? = null,
        @Part("survey_task_id") surveyTaskId: RequestBody? = null,
        @Part files: List<MultipartBody.Part>? = null,
    ): StoreBatchResponse

    /** POST /api/reports — multipart laporan tunggal (butuh auth). */
    @Multipart
    @POST("reports")
    suspend fun createReport(
        @Part("reporter_name") reporterName: RequestBody,
        @Part("road_name") roadName: RequestBody,
        @Part("district") district: RequestBody,
        @Part("latitude") latitude: RequestBody,
        @Part("longitude") longitude: RequestBody,
        @Part("kerusakan_panjang") kerusakanPanjang: RequestBody,
        @Part("kerusakan_lebar") kerusakanLebar: RequestBody,
        @Part("catatan") catatan: RequestBody? = null,
        @Part("total_detections") totalDetections: RequestBody? = null,
        @Part("overall_severity") overallSeverity: RequestBody? = null,
        @Part("ai_raw_output") aiRawOutput: RequestBody? = null,
        @Part("image_result") imageResult: RequestBody? = null,
        /** Opsional: ikat laporan ke sesi patroli (SurveyTaskController). null = laporan biasa. */
        @Part("survey_task_id") surveyTaskId: RequestBody? = null,
        @Part image: MultipartBody.Part,
    ): CreateReportResponse

    /**
     * POST /api/v1/reports/extract-exif-gps — fallback ekstrak GPS di server.
     * Dipakai WargaLaporViewModel saat ExifValidator lokal NO_GPS (byte asli
     * diupload; PHP membaca EXIF tanpa redaksi GPS Android). Batas server 5 MB.
     */
    @Multipart
    @POST("v1/reports/extract-exif-gps")
    suspend fun extractExifGps(@Part image: MultipartBody.Part): ExifGpsResponse

    /**
     * POST /api/v1/reports/check-duplicate — publik, mode batch `photos[]`
     * (hash SHA-256 + lat/lng per foto). Response: hasil per foto + summary.
     */
    @POST("v1/reports/check-duplicate")
    suspend fun checkDuplicate(@Body body: DuplicateCheckRequest): DuplicateCheckResponse

    // ── Dashboard petugas (replikasi home.tsx) ─────────────────────────────

    /** GET /api/reports/stats — agregat scoped role (petugas: milik sendiri). */
    @GET("reports/stats")
    suspend fun reportStats(): ApiEnvelope<StatsDto>

    /**
     * GET /api/reports — daftar laporan.
     * `user_reports=true` → milik sendiri (Laporan Terbaru/Riwayat).
     * `team_tasks=1` → laporan tim (Tugas Perbaikan Aktif).
     */
    @GET("reports")
    suspend fun reports(
        @Query("user_reports") userReports: Boolean? = null,
        @Query("team_tasks") teamTasks: Boolean? = null,
        @Query("limit") limit: Int? = null,
        @Query("page") page: Int? = null,
        @Query("status") status: String? = null,
        @Query("q") q: String? = null,
    ): ReportListResponse

    /** GET /api/reports/{id} — detail satu laporan (403 bila bukan milik/tim). */
    @GET("reports/{id}")
    suspend fun reportDetail(@Path("id") id: String): ApiEnvelope<ReportItemDto>

    /**
     * GET /api/reports/map-data — sebaran untuk tab Peta petugas.
     * Endpoint tanpa gate role di server (kontrak: ReportController::mapData);
     * metode terpisah dari wargaMapData/supervisorMapData agar sesi petugas
     * tidak menyentuh repository role lain.
     */
    @GET("reports/map-data")
    suspend fun petugasMapData(): ApiEnvelope<WargaMapData>

    // ── Eksekusi lapangan petugas (replikasi home.tsx / tugas-saya.tsx) ─────
    // Kontrak: ReportController::mulai, updateProgress, getProgress, complete.
    // JANGAN tertukar dengan mulaiReview (milik supervisor) yang sudah ada.

    /**
     * POST /api/reports/{id}/mulai — status harus Ditugaskan + tim sama.
     * Body JSON {catatan?, estimasi_selesai_hari? (1-90)} → Sedang Diperbaiki.
     */
    @POST("reports/{id}/mulai")
    suspend fun mulaiReport(
        @Path("id") id: String,
        @Body body: MulaiRequest,
    ): ApiEnvelope<StatusPayload?>

    /**
     * POST /api/reports/{id}/progress — status harus Sedang Diperbaiki + tim sama.
     * Multipart `foto` (image ≤5MB) + `catatan?`. Server memvalidasi tanggal
     * EXIF (422 PHOTO_TOO_OLD / PHOTO_NO_EXIF_DATE / dst).
     */
    @Multipart
    @POST("reports/{id}/progress")
    suspend fun uploadProgress(
        @Path("id") id: String,
        @Part foto: MultipartBody.Part,
        @Part("catatan") catatan: RequestBody?,
    ): ApiEnvelope<StatusPayload?>

    /** GET /api/reports/{id}/progress — riwayat progres untuk timeline. */
    @GET("reports/{id}/progress")
    suspend fun reportProgress(@Path("id") id: String): ApiEnvelope<List<ProgressItemDto>>

    /**
     * POST /api/reports/{id}/complete — status harus Sedang Diperbaiki + tim sama.
     * Multipart `after_photo[]` (≥1, image ≤5MB) + `catatan?` → Selesai.
     * TIDAK ada field material/volume/luas (kontrak complete:2735-2739).
     */
    @Multipart
    @POST("reports/{id}/complete")
    suspend fun completeReport(
        @Path("id") id: String,
        @Part("catatan") catatan: RequestBody?,
        @Part foto: List<MultipartBody.Part>,
    ): ApiEnvelope<StatusPayload?>

    // ── Edit draft laporan petugas (replikasi edit-report.tsx) ──────────────
    // Kontrak: mulaiEdit → PUT update (JSON) → batalEdit.

    /** POST /api/reports/{id}/mulai-edit — petugas + milik sendiri + Menunggu Review → Diedit. */
    @POST("reports/{id}/mulai-edit")
    suspend fun mulaiEdit(@Path("id") id: String): ApiEnvelope<StatusPayload?>

    /** POST /api/reports/{id}/batal-edit — Diedit → Menunggu Review. */
    @POST("reports/{id}/batal-edit")
    suspend fun batalEdit(@Path("id") id: String): ApiEnvelope<StatusPayload?>

    /**
     * PUT /api/reports/{id} — JSON (BUKAN multipart): {catatan?, road_name?,
     * district?, kerusakan_panjang, kerusakan_lebar} → Menunggu Review.
     * Angka wajib non-null (aturan required_without:photos server).
     */
    @PUT("reports/{id}")
    suspend fun updateReport(
        @Path("id") id: String,
        @Body body: UpdateReportRequest,
    ): ApiEnvelope<UpdateReportData>

    // ── Sesi/task patroli (petugas) — cek rutin ────────────────────────────
    // Kontrak: SurveyTaskController. GET /survei otomatis di-scope team_id petugas.

    /** GET /api/survei — daftar sesi patroli tim. `tanggal_patroli=today` untuk hari ini. */
    @GET("survei")
    suspend fun surveyTasks(
        @Query("status") status: String? = null,
        @Query("tanggal_patroli") tanggalPatroli: String? = null,
        @Query("q") q: String? = null,
        @Query("per_page") perPage: Int = 50,
    ): SurveyListResponse

    /** GET /api/survei/{id} — detail sesi + laporan terkait. 403 bila bukan tim sendiri. */
    @GET("survei/{id}")
    suspend fun surveyTaskDetail(@Path("id") id: String): SurveyDetailResponse

    /** GET /api/patrol-schedules — jadwal patroli (filter ?team_id=). */
    @GET("patrol-schedules")
    suspend fun patrolSchedules(
        @Query("team_id") teamId: String? = null,
        @Query("status") status: String? = null,
    ): ApiEnvelope<List<PatrolScheduleDto>>

    // ── Patroli supervisor (role:supervisor/admin) — jadwal cek rutin ──────
    // Kontrak: PatrolScheduleController. Semua gate supervisor/admin di server.

    /** GET /api/patrol-schedules — paginator (supervisor: semua, tanpa scope tim). */
    @GET("patrol-schedules")
    suspend fun patrolScheduleList(
        @Query("team_id") teamId: String? = null,
        @Query("status") status: String? = null,
        @Query("per_page") perPage: Int = 50,
    ): PatrolListResponse

    /**
     * GET /api/patrol-schedules/preview — estimasi jumlah shift.
     * PENTING: endpoint ini GET (routes/api.php:361) walau memvalidasi body →
     * parameter WAJIB dikirim sebagai query, bukan @Body (GET tak boleh body).
     */
    @GET("patrol-schedules/preview")
    suspend fun patrolPreview(
        @Query("start_date") startDate: String,
        @Query("end_date") endDate: String? = null,
        @Query("frekuensi") frekuensi: String,
        @Query("hari") hari: List<String>,
        @Query("kecamatan_list") kecamatanList: List<String>,
    ): PatrolPreviewResponse

    /** POST /api/patrol-schedules — buat jadwal (server auto-generate task). 409 bila tim sudah aktif. */
    @POST("patrol-schedules")
    suspend fun createPatrolSchedule(@Body body: PatrolScheduleRequest): PatrolMutationResponse

    /** GET /api/patrol-schedules/{id} — detail + team.surveyTasks (withCount reports). */
    @GET("patrol-schedules/{id}")
    suspend fun patrolScheduleDetail(@Path("id") id: String): PatrolDetailResponse

    /** PUT /api/patrol-schedules/{id} — perbarui (regenerate task bila pola berubah). */
    @PUT("patrol-schedules/{id}")
    suspend fun updatePatrolSchedule(
        @Path("id") id: String,
        @Body body: PatrolScheduleRequest,
    ): PatrolMutationResponse

    /** DELETE /api/patrol-schedules/{id}. */
    @HTTP(method = "DELETE", path = "patrol-schedules/{id}", hasBody = false)
    suspend fun deletePatrolSchedule(@Path("id") id: String): PatrolMutationResponse

    /** POST /api/patrol-schedules/{id}/generate — 422 bila jadwal nonaktif. */
    @POST("patrol-schedules/{id}/generate")
    suspend fun generatePatrolTasks(
        @Path("id") id: String,
        @Body body: PatrolGenerateRequest,
    ): PatrolMutationResponse

    /** POST /api/patrol-schedules/{id}/toggle — aktif ↔ nonaktif. */
    @POST("patrol-schedules/{id}/toggle")
    suspend fun togglePatrolSchedule(@Path("id") id: String): PatrolMutationResponse

    // ── Warga (role:warga) ─────────────────────────────────────────────────
    // ATURAN KERAS: endpoint ini HANYA dipanggil sesi warga. Token warga
    // dilarang menyentuh endpoint petugas (stats/index tanpa filter role).

    /**
     * POST /api/warga/reports — multipart laporan warga (maks 3 foto).
     * TANPA captcha_token (server hanya verifikasi bila token dikirim) dan
     * TANPA field AI (server auto-AI sinkron). Kontrak: store():42-57.
     */
    @Multipart
    @POST("warga/reports")
    suspend fun wargaSubmit(
        @Part("reporter_name") reporterName: RequestBody,
        @Part("road_name") roadName: RequestBody,
        @Part("district") district: RequestBody,
        @Part("latitude") latitude: RequestBody,
        @Part("longitude") longitude: RequestBody,
        @Part("description") description: RequestBody? = null,
        @Part("kerusakan_panjang") kerusakanPanjang: RequestBody? = null,
        @Part("kerusakan_lebar") kerusakanLebar: RequestBody? = null,
        @Part("full_address") fullAddress: RequestBody? = null,
        @Part images: List<MultipartBody.Part>,
    ): WargaSubmitResponse

    /**
     * GET /api/warga/reports — riwayat sendiri. Filter status istimewa:
     * 'Diproses' (4 status), 'Selesai', atau severity. Kontrak: index():260-334.
     */
    @GET("warga/reports")
    suspend fun wargaReports(
        @Query("per_page") perPage: Int? = null,
        @Query("page") page: Int? = null,
        @Query("status") status: String? = null,
        @Query("q") q: String? = null,
    ): WargaListResponse

    /** GET /api/warga/reports/{id} — detail + timeline. */
    @GET("warga/reports/{id}")
    suspend fun wargaDetail(@Path("id") id: String): ApiEnvelope<WargaDetailData>

    /** POST /api/warga/reports/{id}/rating — rating 1-5 + komentar opsional. */
    @POST("warga/reports/{id}/rating")
    suspend fun wargaRate(
        @Path("id") id: String,
        @Body body: RatingRequest,
    ): ApiEnvelope<RatingResultData?>

    /** GET /api/v1/reports/remaining — sisa kuota (authed: limit user 5/hari). */
    @GET("v1/reports/remaining")
    suspend fun remaining(): ApiEnvelope<RemainingDto>

    /**
     * GET /api/reports/map-data — sebaran laporan + agregat kecamatan.
     * Bisa diakses token warga (tanpa batasan role di server).
     * Kontrak: ReportController::mapData.
     */
    @GET("reports/map-data")
    suspend fun wargaMapData(): ApiEnvelope<WargaMapData>

    // ── Supervisor (role:supervisor/admin) ─────────────────────────────────
    // ATURAN KERAS: endpoint triase di bawah sebagian TIDAK dijaga role di
    // server (approve/tolak/confirm-ai/reopen). Guard wajib di client —
    // lihat SupervisorRepository + komentar per metode.

    /**
     * GET /api/reports — daftar triase supervisor.
     * Scope server: `assigned_supervisor_id = me OR NULL`, exclude `Diedit`.
     * sort_by: pci_score | deadline_review | deadline_resolusi | created_at | priority.
     */
    @GET("reports")
    suspend fun supervisorReports(
        @Query("status") status: String? = null,
        @Query("q") q: String? = null,
        @Query("source") source: String? = null,
        @Query("severity") severity: String? = null,
        @Query("uptd_id") uptdId: String? = null,
        @Query("pci") pci: String? = null,
        @Query("sort_by") sortBy: String? = null,
        @Query("limit") limit: Int? = null,
        @Query("page") page: Int? = null,
    ): ReportListResponse

    /** GET /api/reports/{id} — supervisor bebas (gate 403 hanya untuk petugas). */
    @GET("reports/{id}")
    suspend fun supervisorReportDetail(@Path("id") id: String): ApiEnvelope<SupervisorReportDetail>

    /** GET /api/reports/stats — scope supervisor (assigned_supervisor_id = me). */
    @GET("reports/stats")
    suspend fun supervisorStats(): ApiEnvelope<SupervisorStatsDto>

    /** GET /api/reports/stats-by-team — per tim (tanpa scope supervisor). */
    @GET("reports/stats-by-team")
    suspend fun supervisorStatsByTeam(): ApiEnvelope<List<TeamStatsDto>>

    /** GET /api/reports/map-data — peta supervisor (auth wajib). */
    @GET("reports/map-data")
    suspend fun supervisorMapData(): ApiEnvelope<WargaMapData>

    /** GET /api/supervisor/regions — 403 untuk non-supervisor (admin pun 403). */
    @GET("supervisor/regions")
    suspend fun supervisorRegions(): ApiEnvelope<SupervisorRegionsData>

    /** GET /api/teams — gate supervisor+admin (response `{data:[]}` TANPA `success`). */
    @GET("teams")
    suspend fun teams(): TeamsResponse

    /** GET /api/pci/overview — non-admin di-scope assigned_supervisor_id = me. */
    @GET("pci/overview")
    suspend fun pciOverview(): ApiEnvelope<PciOverviewData>

    /**
     * POST /api/reports/{id}/mulai-review — supervisor+admin; idempoten
     * (status lain → 200 "OK." tanpa mutasi). Aman dipanggil tiap buka detail.
     */
    @POST("reports/{id}/mulai-review")
    suspend fun mulaiReview(@Path("id") id: String): ApiEnvelope<StatusPayload?>

    /**
     * POST /api/reports/{id}/approve — TANPA cek role di server.
     * HANYA untuk `source == petugas` (langsung Ditugaskan ke tim pelapor).
     * `source in [warga, telegram]` → pakai approve-and-assign.
     */
    @POST("reports/{id}/approve")
    suspend fun approveReport(
        @Path("id") id: String,
        @Body body: TriageActionRequest,
    ): TriageActionResponse

    /**
     * POST /api/reports/{id}/approve-and-assign — HANYA `source in [warga, telegram]`.
     * 422 `needs_team:true` bila tim tak terpetakan → picker tim lalu ulangi.
     */
    @POST("reports/{id}/approve-and-assign")
    suspend fun approveAndAssign(
        @Path("id") id: String,
        @Body body: TriageActionRequest,
    ): TriageActionResponse

    /**
     * POST /api/reports/{id}/tolak — TANPA cek role. Status harus
     * Menunggu Review/Ditinjau; `alasan` wajib ≤100, `catatan` ≤500.
     */
    @POST("reports/{id}/tolak")
    suspend fun tolakReport(
        @Path("id") id: String,
        @Body body: TolakRequest,
    ): TriageActionResponse

    /**
     * POST /api/reports/{id}/confirm-ai — status harus `Hasil AI`.
     * TANPA cek role DAN tanpa cek source → guard client wajib memastikan
     * hanya dipanggil untuk `source in [warga, telegram]`.
     * 422 tanpa `needs_team` bila tim tak terpetakan (tak ada retry manual).
     */
    @POST("reports/{id}/confirm-ai")
    suspend fun confirmAi(@Path("id") id: String): TriageActionResponse

    /** POST /api/reports/{id}/analyze-ai — status harus `Hasil AI`. Sinkron, bisa 502. */
    @POST("reports/{id}/analyze-ai")
    suspend fun analyzeAi(@Path("id") id: String): ApiEnvelope<StatusPayload?>

    /**
     * POST /api/reports/bulk-approve — supervisor/admin; hanya status
     * Menunggu Review/Ditinjau. PENTING: server set `Disetujui` TANPA menugaskan
     * tim → client WAJIB hanya mengirim laporan `source == petugas` (laporan
     * warga/telegram harus lewat approve-and-assign per laporan).
     */
    @POST("reports/bulk-approve")
    suspend fun bulkApprove(@Body body: BulkIdsRequest): BulkActionResult

    /** POST /api/reports/bulk-tolak — supervisor/admin; `alasan` wajib (maks 500). */
    @POST("reports/bulk-tolak")
    suspend fun bulkTolak(@Body body: BulkTolakRequest): BulkActionResult

    /** DELETE /api/reports/{id}/duplicate — supervisor only; 404 tanpa marking. */
    @HTTP(method = "DELETE", path = "reports/{id}/duplicate", hasBody = false)
    suspend fun deleteDuplicate(@Path("id") id: String): ApiEnvelope<StatusPayload?>

    /**
     * DELETE /api/reports/{id} — `user_id == me OR role == supervisor`;
     * status Menunggu Review/Ditinjau/Diedit/Ditolak (else 422).
     */
    @HTTP(method = "DELETE", path = "reports/{id}", hasBody = false)
    suspend fun deleteReport(@Path("id") id: String): ApiEnvelope<StatusPayload?>

    /** GET /api/reports/export/monthly-pdf — unduh rekap PDF bulanan (supervisor/admin). */
    @Streaming
    @GET("reports/export/monthly-pdf")
    suspend fun exportMonthlyPdf(
        @Query("month") month: Int,
        @Query("year") year: Int,
    ): ResponseBody

    /** GET /api/reports/export/monthly-excel — unduh rekap Excel bulanan (supervisor/admin). */
    @Streaming
    @GET("reports/export/monthly-excel")
    suspend fun exportMonthlyExcel(
        @Query("month") month: Int,
        @Query("year") year: Int,
    ): ResponseBody
}
