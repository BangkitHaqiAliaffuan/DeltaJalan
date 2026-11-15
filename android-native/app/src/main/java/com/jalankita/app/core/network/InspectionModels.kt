package com.jalankita.app.core.network

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class InspectionTaskListResponse(val data: InspectionTaskPage? = null)

@JsonClass(generateAdapter = true)
data class InspectionTaskPage(
    val data: List<InspectionAssignmentDto>? = null,
    @Json(name = "current_page") val currentPage: Int = 1,
    @Json(name = "last_page") val lastPage: Int = 1,
    val total: Int = 0,
    @Json(name = "per_page") val perPage: Int = 20,
    val from: Int? = null,
    val to: Int? = null,
)

@JsonClass(generateAdapter = true)
data class InspectionAssignmentResponse(val data: InspectionAssignmentDto? = null)

@JsonClass(generateAdapter = true)
data class InspectionSessionResponse(val data: InspectionSessionDto? = null)

@JsonClass(generateAdapter = true)
data class InspectionAssignmentActionResponse(val data: InspectionAssignmentDto? = null)

@JsonClass(generateAdapter = true)
data class InspectionResultResponse(val data: InspectionResultDto? = null)

@JsonClass(generateAdapter = true)
data class InspectionPendingResponse(val data: InspectionResultPage? = null)

@JsonClass(generateAdapter = true)
data class InspectionResultPage(
    val data: List<InspectionResultDto>? = null,
    @Json(name = "current_page") val currentPage: Int = 1,
    @Json(name = "last_page") val lastPage: Int = 1,
    val total: Int = 0,
    @Json(name = "per_page") val perPage: Int = 20,
    val from: Int? = null,
    val to: Int? = null,
)

@JsonClass(generateAdapter = true)
data class InspectionQueueRequest(
    @Json(name = "survey_task_id") val surveyTaskId: String? = null,
    @Json(name = "report_ids") val reportIds: List<String>,
    @Json(name = "idempotency_key") val idempotencyKey: String? = null,
)

/**
 * Kandidat antrean inspeksi dari `GET /inspection-queues/candidates`.
 * Server sudah mengecualikan laporan yang punya assignment aktif, jadi klien
 * tidak perlu menebak-nebak lagi (dulu memakai `GET /reports` + filter lokal).
 */
@JsonClass(generateAdapter = true)
data class InspectionQueueCandidatesResponse(
    val success: Boolean = true,
    val message: String? = null,
    val data: List<InspectionQueueCandidateDto>? = null,
    val total: Int = 0,
    val page: Int = 1,
    @Json(name = "last_page") val lastPage: Int = 1,
)

@JsonClass(generateAdapter = true)
data class InspectionQueueCandidateDto(
    val id: String,
    @Json(name = "report_code") val reportCode: String? = null,
    @Json(name = "reporter_name") val reporterName: String? = null,
    @Json(name = "road_name") val roadName: String? = null,
    val district: String? = null,
    val status: String? = null,
    val source: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
)

@JsonClass(generateAdapter = true)
data class InspectionReviewRequest(
    val action: String,
    @Json(name = "review_notes") val reviewNotes: String? = null,
)

object InspectionReviewAction {
    const val ACCEPT = "accept"
    const val RETURN = "return"
    const val REINSPECT = "reinspect"
    const val REJECT = "reject"
}

/** Common fields of accept/return/reject result and reinspection session. */
@JsonClass(generateAdapter = true)
data class InspectionReviewData(
    val id: String? = null,
    @Json(name = "survey_task_report_id") val surveyTaskReportId: String? = null,
    @Json(name = "report_id") val reportId: String? = null,
    @Json(name = "inspector_id") val inspectorId: Long? = null,
    val result: String? = null,
    val condition: String? = null,
    val notes: String? = null,
    val latitude: Double? = null,
    val longitude: Double? = null,
    @Json(name = "reviewed_by") val reviewedBy: Long? = null,
    @Json(name = "review_notes") val reviewNotes: String? = null,
    @Json(name = "reviewed_at") val reviewedAt: String? = null,
    val photos: List<InspectionPhotoDto>? = null,
    val report: InspectionReportDto? = null,
    val assignment: InspectionAssignmentDto? = null,
    @Json(name = "survey_task_id") val surveyTaskId: String? = null,
    @Json(name = "patrol_schedule_id") val patrolScheduleId: String? = null,
    @Json(name = "team_id") val teamId: String? = null,
    @Json(name = "started_by") val startedBy: Long? = null,
    @Json(name = "schedule_type") val scheduleType: String? = null,
    val status: String? = null,
    @Json(name = "started_at") val startedAt: String? = null,
    @Json(name = "submitted_at") val submittedAt: String? = null,
    val assignments: List<InspectionAssignmentDto>? = null,
)

@JsonClass(generateAdapter = true)
data class InspectionReviewResponse(val data: InspectionReviewData? = null)

@JsonClass(generateAdapter = true)
data class InspectionSessionDto(
    val id: String,
    @Json(name = "survey_task_id") val surveyTaskId: String? = null,
    @Json(name = "patrol_schedule_id") val patrolScheduleId: String? = null,
    @Json(name = "team_id") val teamId: String? = null,
    @Json(name = "started_by") val startedBy: Long? = null,
    @Json(name = "schedule_type") val scheduleType: String? = null,
    val status: String? = null,
    @Json(name = "started_at") val startedAt: String? = null,
    @Json(name = "submitted_at") val submittedAt: String? = null,
    @Json(name = "idempotency_key") val idempotencyKey: String? = null,
    val team: InspectionTeamDto? = null,
    val task: InspectionSurveyTaskDto? = null,
    val assignments: List<InspectionAssignmentDto>? = null,
    @Json(name = "created_at") val createdAt: String? = null,
    @Json(name = "updated_at") val updatedAt: String? = null,
)

@JsonClass(generateAdapter = true)
data class InspectionSurveyTaskDto(
    val id: String,
    @Json(name = "road_name") val roadName: String? = null,
    val kecamatan: String? = null,
    @Json(name = "road_length_m") val roadLengthM: Double? = null,
    @Json(name = "team_id") val teamId: String? = null,
    val priority: String? = null,
    val catatan: String? = null,
    val status: String? = null,
    @Json(name = "jam_mulai") val jamMulai: String? = null,
    @Json(name = "jam_selesai") val jamSelesai: String? = null,
    @Json(name = "tanggal_patroli") val tanggalPatroli: String? = null,
    @Json(name = "alasan_tugas") val alasanTugas: String? = null,
    @Json(name = "selesai_at") val selesaiAt: String? = null,
    @Json(name = "patrol_schedule_id") val patrolScheduleId: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
    @Json(name = "updated_at") val updatedAt: String? = null,
)

@JsonClass(generateAdapter = true)
data class InspectionTeamDto(
    val id: String,
    val name: String? = null,
    val description: String? = null,
    @Json(name = "uptd_id") val uptdId: String? = null,
)

@JsonClass(generateAdapter = true)
data class InspectionAssignmentDto(
    val id: String,
    @Json(name = "survey_task_id") val surveyTaskId: String? = null,
    @Json(name = "inspection_session_id") val inspectionSessionId: String? = null,
    @Json(name = "report_id") val reportId: String? = null,
    @Json(name = "team_id") val teamId: String? = null,
    val status: String? = null,
    @Json(name = "assigned_at") val assignedAt: String? = null,
    @Json(name = "started_at") val startedAt: String? = null,
    @Json(name = "submitted_at") val submittedAt: String? = null,
    /** Hanya terisi untuk assignment sesi `reinspection` (alasan dari hasil sebelumnya). */
    @Json(name = "previous_review_notes") val previousReviewNotes: String? = null,
    val report: InspectionReportDto? = null,
    val session: InspectionSessionDto? = null,
    val result: InspectionResultDto? = null,
)

@JsonClass(generateAdapter = true)
data class InspectionReportDto(
    val id: String,
    @Json(name = "user_id") val userId: Long? = null,
    @Json(name = "report_code") val reportCode: String? = null,
    @Json(name = "reporter_name") val reporterName: String? = null,
    @Json(name = "road_name") val roadName: String? = null,
    val district: String? = null,
    val latitude: Double? = null,
    val longitude: Double? = null,
    @Json(name = "image_original_path") val imageOriginalPath: String? = null,
    @Json(name = "image_result_path") val imageResultPath: String? = null,
    @Json(name = "image_original_url") val imageOriginalUrl: String? = null,
    @Json(name = "image_result_url") val imageResultUrl: String? = null,
    @Json(name = "total_detections") val totalDetections: Int? = null,
    @Json(name = "overall_severity") val overallSeverity: String? = null,
    @Json(name = "ai_severity") val aiSeverity: String? = null,
    val status: String? = null,
    val source: String? = null,
    val description: String? = null,
    @Json(name = "survey_task_id") val surveyTaskId: String? = null,
)

@JsonClass(generateAdapter = true)
data class InspectionResultDto(
    val id: String,
    @Json(name = "survey_task_report_id") val surveyTaskReportId: String? = null,
    @Json(name = "report_id") val reportId: String? = null,
    @Json(name = "inspector_id") val inspectorId: Long? = null,
    val result: String? = null,
    val condition: String? = null,
    val notes: String? = null,
    // Dimensi hasil ukur petugas (meter). Null = tidak diukur.
    @Json(name = "kerusakan_panjang") val kerusakanPanjang: Double? = null,
    @Json(name = "kerusakan_lebar") val kerusakanLebar: Double? = null,
    @Json(name = "kerusakan_kedalaman") val kerusakanKedalaman: Double? = null,
    val latitude: Double? = null,
    val longitude: Double? = null,
    @Json(name = "reviewed_by") val reviewedBy: Long? = null,
    @Json(name = "review_notes") val reviewNotes: String? = null,
    @Json(name = "reviewed_at") val reviewedAt: String? = null,
    val report: InspectionReportDto? = null,
    val assignment: InspectionAssignmentDto? = null,
    val photos: List<InspectionPhotoDto>? = null,
)

@JsonClass(generateAdapter = true)
data class InspectionPhotoDto(
    val id: String,
    @Json(name = "inspection_result_id") val inspectionResultId: String? = null,
    val path: String? = null,
    val url: String? = null,
    val sha256: String? = null,
    @Json(name = "sort_order") val sortOrder: Int = 0,
    val latitude: Double? = null,
    val longitude: Double? = null,
    @Json(name = "taken_at") val takenAt: String? = null,
) {
    val displayUrl: String? get() = url ?: path
}

@JsonClass(generateAdapter = true)
data class InspectionErrorResponse(
    val message: String? = null,
    val errors: Map<String, List<String>>? = null,
)
