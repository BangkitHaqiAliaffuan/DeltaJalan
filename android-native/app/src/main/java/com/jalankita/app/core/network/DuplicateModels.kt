package com.jalankita.app.core.network

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/** Satu foto untuk pengecekan duplikat (hash SHA-256 + koordinat opsional). */
@JsonClass(generateAdapter = true)
data class DuplicateCheckPhoto(
    val hash: String? = null,
    val lat: Double? = null,
    val lng: Double? = null,
)

/** Body POST /api/v1/reports/check-duplicate (mode batch). */
@JsonClass(generateAdapter = true)
data class DuplicateCheckRequest(
    val latitude: Double? = null,
    val longitude: Double? = null,
    val photos: List<DuplicateCheckPhoto> = emptyList(),
)

/** Payload laporan yang terdeteksi duplikat (kontrak: DuplicateCheckService::reportPayload). */
@JsonClass(generateAdapter = true)
data class DuplicateReportDto(
    val id: String? = null,
    @Json(name = "report_code") val reportCode: String? = null,
    @Json(name = "road_name") val roadName: String? = null,
    val district: String? = null,
    val latitude: Double? = null,
    val longitude: Double? = null,
    val status: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
    val distance: Double? = null,
)

/** Klasifikasi satu foto: valid | spatial_dup | hash_dup. */
@JsonClass(generateAdapter = true)
data class DuplicateResultDto(
    val index: Int = 0,
    @Json(name = "class") val className: String = "valid",
    val report: DuplicateReportDto? = null,
    val distance: Double? = null,
)

@JsonClass(generateAdapter = true)
data class DuplicateSummaryDto(
    @Json(name = "duplicate_count") val duplicateCount: Int = 0,
    @Json(name = "valid_count") val validCount: Int = 0,
    @Json(name = "all_duplicates") val allDuplicates: Boolean = false,
)

/** Response POST /api/v1/reports/check-duplicate (kontrak: ReportController::checkDuplicate). */
@JsonClass(generateAdapter = true)
data class DuplicateCheckResponse(
    @Json(name = "has_active_report") val hasActiveReport: Boolean = false,
    val report: DuplicateReportDto? = null,
    @Json(name = "nearest_distance_meters") val nearestDistanceMeters: Double? = null,
    val results: List<DuplicateResultDto> = emptyList(),
    val summary: DuplicateSummaryDto? = null,
)

/** Ringkasan duplikat siap tampil di UI (dari [DuplicateCheckResponse]). */
data class DuplicateWarning(
    val reportCode: String?,
    val status: String?,
    val roadName: String?,
    val distanceMeters: Double?,
    val classLabel: String,
)

/** Konversi response → warning UI; null bila tidak ada duplikat. */
fun DuplicateCheckResponse.toWarning(): DuplicateWarning? {
    val firstDup = results.firstOrNull { it.className != "valid" }
    val rep = firstDup?.report ?: report
    if (firstDup == null && rep == null) return null
    return DuplicateWarning(
        reportCode = rep?.reportCode,
        status = rep?.status,
        roadName = rep?.roadName,
        distanceMeters = firstDup?.distance ?: rep?.distance,
        classLabel = firstDup?.className ?: "spatial_dup",
    )
}
