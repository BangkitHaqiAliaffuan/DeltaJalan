package com.jalankita.app.core.network

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * DTO sesi/task patroli (cek rutin) untuk PETUGAS — kontrak: SurveyTaskController.
 * Replikasi Frontend-stable/src/types/survey.ts ::SurveyTask + hooks/useSurveyQueries.ts.
 *
 * ATURAN: `GET /survei` untuk petugas OTOMATIS di-scope `team_id = me` oleh server.
 * `survey_task_id` (id task) dipakai saat membuat laporan agar laporan terikat ke sesi patroli.
 */

/** Satu sesi/task patroli — `GET /survei` (list) & `GET /survei/{id}` (detail). */
@JsonClass(generateAdapter = true)
data class SurveyTask(
    val id: String,
    @Json(name = "road_name") val roadName: String? = null,
    val kecamatan: String? = null,
    @Json(name = "road_length_m") val roadLengthM: Double? = null,
    @Json(name = "team_id") val teamId: String? = null,
    val team: SurveyTeamRef? = null,
    val priority: String? = null,
    val catatan: String? = null,
    val status: String? = null,
    @Json(name = "jam_mulai") val jamMulai: String? = null,
    @Json(name = "jam_selesai") val jamSelesai: String? = null,
    @Json(name = "tanggal_patroli") val tanggalPatroli: String? = null,
    @Json(name = "alasan_tugas") val alasanTugas: String? = null,
    @Json(name = "selesai_at") val selesaiAt: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
    @Json(name = "updated_at") val updatedAt: String? = null,
    @Json(name = "reports_count") val reportsCount: Int = 0,
    val reports: List<SurveyReport>? = null,
)

/** Tim di dalam sesi patroli. */
@JsonClass(generateAdapter = true)
data class SurveyTeamRef(
    val id: String? = null,
    val name: String? = null,
)

/** Laporan yang sudah terkait ke sesi patroli — subset `reports[]` di detail. */
@JsonClass(generateAdapter = true)
data class SurveyReport(
    val id: String,
    @Json(name = "report_code") val reportCode: String? = null,
    @Json(name = "road_name") val roadName: String? = null,
    val status: String? = null,
    @Json(name = "overall_severity") val overallSeverity: String? = null,
    @Json(name = "first_photo_url") val firstPhotoUrl: String? = null,
    @Json(name = "image_original_url") val imageOriginalUrl: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
) {
    val displayImageUrl: String? get() = firstPhotoUrl ?: imageOriginalUrl
}

/** Paginator `GET /survei` — `{data[], current_page, last_page, total}` (tanpa `success`). */
@JsonClass(generateAdapter = true)
data class SurveyListResponse(
    val data: List<SurveyTask>? = null,
    @Json(name = "current_page") val currentPage: Int = 1,
    @Json(name = "last_page") val lastPage: Int = 1,
    val total: Int = 0,
)

/** Envelope detail `GET /survei/{id}` — `{data:{...}}`. */
@JsonClass(generateAdapter = true)
data class SurveyDetailResponse(
    val data: SurveyTask? = null,
)
