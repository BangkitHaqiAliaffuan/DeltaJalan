package com.jalankita.app.core.network

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Model warga — kontrak: backend_POSTGRESQL
 * WargaReportController::index/show/rate/checkRemaining/store.
 * Replikasi Frontend-stable/src/routes/warga/index.tsx + layar laporan warga.
 */

/**
 * Satu item GET /api/warga/reports.
 * Kontrak: WargaReportController.php:297-322. Catatan: TANPA image_original_url
 * dan TANPA lat/lng (hanya first_photo_url).
 */
@JsonClass(generateAdapter = true)
data class WargaReportDto(
    val id: String,
    @Json(name = "report_code") val reportCode: String? = null,
    @Json(name = "reporter_name") val reporterName: String? = null,
    @Json(name = "road_name") val roadName: String? = null,
    val district: String? = null,
    @Json(name = "overall_severity") val overallSeverity: String? = null,
    @Json(name = "ai_severity") val aiSeverity: String? = null,
    val status: String? = null,
    val source: String? = null,
    @Json(name = "first_photo_url") val firstPhotoUrl: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
    @Json(name = "progress_updates_count") val progressUpdatesCount: Int = 0,
    @Json(name = "kerusakan_panjang") val kerusakanPanjang: Double? = null,
    @Json(name = "kerusakan_lebar") val kerusakanLebar: Double? = null,
    @Json(name = "terlambat_review") val terlambatReview: Boolean = false,
    @Json(name = "terlambat_resolusi") val terlambatResolusi: Boolean = false,
    @Json(name = "pci_score") val pciScore: Double? = null,
) {
    val displayImageUrl: String? get() = firstPhotoUrl
    val effectiveSeverity: String? get() = overallSeverity ?: aiSeverity
}

@JsonClass(generateAdapter = true)
data class WargaMeta(
    @Json(name = "current_page") val currentPage: Int = 1,
    @Json(name = "last_page") val lastPage: Int = 1,
    @Json(name = "per_page") val perPage: Int = 10,
    val total: Int = 0,
)

/**
 * GET /api/warga/reports — envelope `{success, data[], meta{...}}`.
 * Kontrak: WargaReportController.php:324-333.
 */
@JsonClass(generateAdapter = true)
data class WargaListResponse(
    val success: Boolean,
    val message: String? = null,
    val data: List<WargaReportDto>? = null,
    val meta: WargaMeta? = null,
)

/** Satu foto di detail — photos[] / after_photos[]. */
@JsonClass(generateAdapter = true)
data class WargaPhotoDto(
    val id: String? = null,
    val url: String? = null,
    @Json(name = "image_url") val imageUrl: String? = null,
    @Json(name = "sort_order") val sortOrder: Int = 0,
) {
    val displayUrl: String? get() = url ?: imageUrl
}

/** Satu update progres harian — kontrak: WargaReportController::show transform progress_updates. */
@JsonClass(generateAdapter = true)
data class ProgressUpdateDto(
    val id: String? = null,
    @Json(name = "foto_url") val fotoUrl: String? = null,
    val catatan: String? = null,
    @Json(name = "user_name") val userName: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
    @Json(name = "day_number") val dayNumber: Int = 1,
)

/** Satu baris timeline status. */
@JsonClass(generateAdapter = true)
data class TimelineDto(
    @Json(name = "old_status") val oldStatus: String? = null,
    @Json(name = "new_status") val newStatus: String? = null,
    val notes: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
    @Json(name = "actor_name") val actorName: String? = null,
    @Json(name = "actor_role") val actorRole: String? = null,
)

/**
 * Detail GET /api/warga/reports/{id} — `{success, data:{report, timeline}}`.
 * Kontrak: WargaReportController.php:391-397. Field berlebih diabaikan Moshi.
 */
@JsonClass(generateAdapter = true)
data class WargaDetailReport(
    val id: String,
    @Json(name = "report_code") val reportCode: String? = null,
    @Json(name = "reporter_name") val reporterName: String? = null,
    @Json(name = "road_name") val roadName: String? = null,
    val district: String? = null,
    @Json(name = "full_address") val fullAddress: String? = null,
    @Json(name = "overall_severity") val overallSeverity: String? = null,
    @Json(name = "ai_severity") val aiSeverity: String? = null,
    val status: String? = null,
    val description: String? = null,
    @Json(name = "kerusakan_panjang") val kerusakanPanjang: Double? = null,
    @Json(name = "kerusakan_lebar") val kerusakanLebar: Double? = null,
    val photos: List<WargaPhotoDto>? = null,
    @Json(name = "after_photos") val afterPhotos: List<WargaPhotoDto>? = null,
    @Json(name = "image_original_url") val imageOriginalUrl: String? = null,
    @Json(name = "image_result_url") val imageResultUrl: String? = null,
    @Json(name = "first_photo_url") val firstPhotoUrl: String? = null,
    val rating: Int? = null,
    @Json(name = "rating_comment") val ratingComment: String? = null,
    @Json(name = "rated_at") val ratedAt: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
    @Json(name = "assigned_team_name") val assignedTeamName: String? = null,
    val latitude: Double? = null,
    val longitude: Double? = null,
    @Json(name = "pci_score") val pciScore: Double? = null,
    @Json(name = "progress_updates") val progressUpdates: List<ProgressUpdateDto>? = null,
) {
    val effectiveSeverity: String? get() = overallSeverity ?: aiSeverity
    val canRate: Boolean get() = status == "Selesai" && ratedAt == null
}

@JsonClass(generateAdapter = true)
data class WargaDetailData(
    val report: WargaDetailReport? = null,
    val timeline: List<TimelineDto>? = null,
)

/** POST /api/warga/reports/{id}/rating — body. Kontrak: rate():647-650. */
@JsonClass(generateAdapter = true)
data class RatingRequest(
    val rating: Int,
    val comment: String? = null,
)

/**
 * POST /api/warga/reports/{id}/rating — data `{rating, rating_comment}`.
 * PENGGANTI `Map<String, Any?>` (ObjectJsonAdapter rapuh: koersi angka, tak
 * bersahabat codegen).
 */
@JsonClass(generateAdapter = true)
data class RatingResultData(
    val rating: Int? = null,
    @Json(name = "rating_comment") val ratingComment: String? = null,
)

/** GET /api/v1/reports/remaining — data. Kontrak: checkRemaining():737-744. */
@JsonClass(generateAdapter = true)
data class RemainingDto(
    val remaining: Int = 0,
    val limit: Int = 5,
    val reached: Boolean = false,
)

/** Laporan hasil submit — subset field (berlebih diabaikan). */
@JsonClass(generateAdapter = true)
data class SubmittedReportDto(
    val id: String? = null,
    @Json(name = "report_code") val reportCode: String? = null,
    @Json(name = "road_name") val roadName: String? = null,
    val district: String? = null,
    val status: String? = null,
)

/**
 * POST /api/warga/reports — envelope + 422 (error_code + existing_report).
 * Bentuk error mengikuti ApiErrorResponse; sukses membawa [WargaSubmitData].
 */
@JsonClass(generateAdapter = true)
data class WargaSubmitResponse(
    val success: Boolean,
    val message: String? = null,
    @Json(name = "error_code") val errorCode: String? = null,
    val errors: Map<String, List<String>>? = null,
    @Json(name = "existing_report") val existingReport: ExistingReportDto? = null,
    val data: WargaSubmitData? = null,
)
@JsonClass(generateAdapter = true)
data class WargaSubmitData(
    val report: SubmittedReportDto? = null,
    @Json(name = "total_photos") val totalPhotos: Int = 0,
    val warnings: List<String>? = null,
    @Json(name = "ai_severity") val aiSeverity: String? = null,
    @Json(name = "ai_total_detections") val aiTotalDetections: Int = 0,
)

/**
 * GET /api/reports/map-data — sebaran untuk Peta Interaktif.
 * Kontrak: ReportController::mapData. `districts` berbentuk objek keyed nama
 * kecamatan; `reports` maksimal 1000 marker ringan (lat/lng wajib non-null).
 */
@JsonClass(generateAdapter = true)
data class MapReportDto(
    val id: String,
    val latitude: Double? = null,
    val longitude: Double? = null,
    val status: String? = null,
    @Json(name = "overall_severity") val overallSeverity: String? = null,
    @Json(name = "ai_severity") val aiSeverity: String? = null,
    @Json(name = "road_name") val roadName: String? = null,
    val district: String? = null,
    @Json(name = "first_photo_url") val firstPhotoUrl: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
) {
    /** Severity efektif + warna marker (port severityBadge web). */
    val effectiveSeverity: String? get() = overallSeverity ?: aiSeverity
    val markerKind: MarkerKind get() = MarkerKind.fromSeverity(effectiveSeverity)
}

/** Kategori warna marker peta. */
enum class MarkerKind(val color: Long) {
    BERAT(0xFFE11D48),
    SEDANG(0xFFF97316),
    RINGAN(0xFFF59E0B),
    LAIN(0xFF64748B),
    ;

    companion object {
        fun fromSeverity(severity: String?): MarkerKind {
            val s = severity?.lowercase().orEmpty()
            return when {
                "berat" in s -> BERAT
                "sedang" in s -> SEDANG
                "ringan" in s -> RINGAN
                else -> LAIN
            }
        }
    }
}

@JsonClass(generateAdapter = true)
data class MapDistrictDto(
    val district: String? = null,
    val total: Int = 0,
    @Json(name = "rusak_berat") val rusakBerat: Int = 0,
    @Json(name = "rusak_sedang") val rusakSedang: Int = 0,
    @Json(name = "rusak_ringan") val rusakRingan: Int = 0,
)

@JsonClass(generateAdapter = true)
data class MapStatsDto(
    val total: Int = 0,
)

@JsonClass(generateAdapter = true)
data class WargaMapData(
    val districts: Map<String, MapDistrictDto>? = null,
    val reports: List<MapReportDto>? = null,
    val stats: MapStatsDto? = null,
)
