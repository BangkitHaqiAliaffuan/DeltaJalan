package com.jalankita.app.core.network

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * DTO laporan multi-foto (batch) petugas.
 * Kontrak: AIController::analyzeBatch + ReportController::storeBatch.
 *
 * Alur: POST /analyze-batch (files[]) → simpan `batch_id` → POST /reports/batch.
 * Analisis disimpan server-side (BatchAnalysis), jadi submit tak perlu upload ulang.
 */

/** Batas keras foto per laporan (klien). Backend izinkan max:20 → 10 aman. */
const val MAX_PETUGAS_PHOTOS = 10

/** Hasil analisis satu foto dari `analyses[]`. */
@JsonClass(generateAdapter = true)
data class BatchAnalysisDto(
    @Json(name = "file_index") val fileIndex: Int = 0,
    @Json(name = "file_name") val fileName: String? = null,
    val detections: List<DetectionDto>? = null,
    val severity: String? = null,
    @Json(name = "context_valid") val contextValid: Boolean = false,
    val confidence: Double? = null,
    @Json(name = "image_result") val imageResult: String? = null,
    @Json(name = "exif_lat") val exifLat: Double? = null,
    @Json(name = "exif_lng") val exifLng: Double? = null,
    @Json(name = "has_exif_gps") val hasExifGps: Boolean = false,
    @Json(name = "exif_invalid") val exifInvalid: Boolean = false,
    @Json(name = "exif_reason") val exifReason: String? = null,
    val error: String? = null,
)

/** Respons `POST /api/analyze-batch` — TANPA `success` (persis AIController). */
@JsonClass(generateAdapter = true)
data class AnalyzeBatchResponse(
    @Json(name = "batch_id") val batchId: String? = null,
    @Json(name = "total_files") val totalFiles: Int = 0,
    @Json(name = "photos_with_exif_gps") val photosWithExifGps: Int = 0,
    @Json(name = "photos_rejected") val photosRejected: Int = 0,
    val analyses: List<BatchAnalysisDto>? = null,
    val latitude: Double? = null,
    val longitude: Double? = null,
)

/**
 * Respons `POST /api/reports/batch`.
 * Server mengembalikan `{success, message?, data?}` (envelope standar).
 */
@JsonClass(generateAdapter = true)
data class StoreBatchResponse(
    val success: Boolean? = null,
    val message: String? = null,
    val data: ReportDataDto? = null,
)
