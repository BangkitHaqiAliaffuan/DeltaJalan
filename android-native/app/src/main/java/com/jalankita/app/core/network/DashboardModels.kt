package com.jalankita.app.core.network

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Model dashboard petugas — kontrak: backend_POSTGRESQL
 * ReportController::stats, ReportController::index, PatrolScheduleController::index.
 * Replikasi Frontend-stable/src/hooks/useReportQueries.ts + src/routes/home.tsx.
 */

/** GET /api/reports/stats — bentuk `{success, data:{...}}` (cache 60 dtk server). */
@JsonClass(generateAdapter = true)
data class StatsDto(
    val total: Int = 0,
    @Json(name = "menunggu_review") val menungguReview: Int = 0,
    @Json(name = "hasil_ai") val hasilAi: Int = 0,
    val disetujui: Int = 0,
    val ditolak: Int = 0,
    val ditugaskan: Int = 0,
    @Json(name = "sedang_diperbaiki") val sedangDiperbaiki: Int = 0,
    val selesai: Int = 0,
    @Json(name = "rusak_berat") val rusakBerat: Int = 0,
    @Json(name = "rusak_sedang") val rusakSedang: Int = 0,
    @Json(name = "rusak_ringan") val rusakRingan: Int = 0,
)

/**
 * Satu item GET /api/reports — subset field yang dipakai kartu dashboard.
 * Kontrak: ReportController.php::index (map baris 925-971).
 */
@JsonClass(generateAdapter = true)
data class ReportItemDto(
    val id: String,
    @Json(name = "report_code") val reportCode: String? = null,
    @Json(name = "reporter_name") val reporterName: String? = null,
    @Json(name = "road_name") val roadName: String? = null,
    val district: String? = null,
    @Json(name = "overall_severity") val overallSeverity: String? = null,
    @Json(name = "ai_severity") val aiSeverity: String? = null,
    val status: String? = null,
    val source: String? = null,
    @Json(name = "image_original_url") val imageOriginalUrl: String? = null,
    @Json(name = "image_result_url") val imageResultUrl: String? = null,
    @Json(name = "first_photo_url") val firstPhotoUrl: String? = null,
    @Json(name = "assigned_team_name") val assignedTeamName: String? = null,
    /** Id tim pelaksana (kontrak show:index; untuk gate tombol eksekusi vs teamId user). */
    @Json(name = "assigned_team_id") val assignedTeamId: String? = null,
    // ── Detail kaya (kontrak show(); diabaikan index() — Moshi abaikan unknown) ──
    val latitude: Double? = null,
    val longitude: Double? = null,
    @Json(name = "full_address") val fullAddress: String? = null,
    @Json(name = "system_notes") val systemNotes: String? = null,
    val priority: String? = null,
    @Json(name = "total_detections") val totalDetections: Int? = null,
    @Json(name = "catatan_petugas") val catatanPetugas: String? = null,
    val rating: Int? = null,
    @Json(name = "rating_comment") val ratingComment: String? = null,
    @Json(name = "after_photo_url") val afterPhotoUrl: String? = null,
    @Json(name = "after_photo_notes") val afterPhotoNotes: String? = null,
    @Json(name = "perbaikan_dimulai_at") val perbaikanDimulaiAt: String? = null,
    @Json(name = "perbaikan_selesai_at") val perbaikanSelesaiAt: String? = null,
    val pelaksana: String? = null,
    val photos: List<PetugasPhotoDto>? = null,
    @Json(name = "after_photos") val afterPhotos: List<PetugasAfterPhotoDto>? = null,
    @Json(name = "duplicate_of") val duplicateOf: PetugasDuplicateOfDto? = null,
    @Json(name = "status_history") val statusHistory: List<PetugasStatusHistoryDto>? = null,
    @Json(name = "kerusakan_panjang") val kerusakanPanjang: Double? = null,
    @Json(name = "kerusakan_lebar") val kerusakanLebar: Double? = null,
    val description: String? = null,
    @Json(name = "progress_updates_count") val progressUpdatesCount: Int = 0,
    @Json(name = "deadline_review") val deadlineReview: String? = null,
    @Json(name = "deadline_resolusi") val deadlineResolusi: String? = null,
    @Json(name = "terlambat_review") val terlambatReview: Boolean = false,
    @Json(name = "terlambat_resolusi") val terlambatResolusi: Boolean = false,
    @Json(name = "status_deadline") val statusDeadline: String? = null,
    @Json(name = "pci_score") val pciScore: Double? = null,
    @Json(name = "is_duplicate") val isDuplicate: Boolean = false,
    @Json(name = "duplicate_score") val duplicateScore: Double? = null,
    @Json(name = "estimasi_hari") val estimasiHari: Int? = null,
    @Json(name = "created_at") val createdAt: String? = null,
) {
    /** Foto utama untuk thumbnail — prioritas sama dengan web (result → original). */
    val displayImageUrl: String?
        get() = imageResultUrl ?: imageOriginalUrl ?: firstPhotoUrl

    /** Severity efektif — replikasi home.tsx: overall_severity ?? ai_severity. */
    val effectiveSeverity: String?
        get() = overallSeverity ?: aiSeverity
}

/**
 * GET /api/reports — envelope `{success, data:[...], total, page, last_page}`.
 * Kontrak: ReportController.php:973-979.
 */
@JsonClass(generateAdapter = true)
data class ReportListResponse(
    val success: Boolean,
    val message: String? = null,
    val data: List<ReportItemDto>? = null,
    val total: Int = 0,
    val page: Int = 1,
    @Json(name = "last_page") val lastPage: Int = 1,
)

/** Satu jadwal patroli — kontrak: src/types/survey.ts ::PatrolSchedule. */
@JsonClass(generateAdapter = true)
data class PatrolScheduleDto(
    val id: String,
    @Json(name = "team_id") val teamId: String? = null,
    val hari: List<String>? = null,
    @Json(name = "kecamatan_list") val kecamatanList: List<String>? = null,
    val frekuensi: String? = null,
    @Json(name = "start_date") val startDate: String? = null,
    @Json(name = "end_date") val endDate: String? = null,
    @Json(name = "alasan_tugas") val alasanTugas: String? = null,
    val status: String? = null,
    @Json(name = "jam_mulai") val jamMulai: String? = null,
    @Json(name = "jam_selesai") val jamSelesai: String? = null,
    @Json(name = "tasks_count") val tasksCount: Int = 0,
)

// ── Eksekusi lapangan petugas ─────────────────────────────────────────────
// Kontrak: ReportController::mulai, updateProgress, getProgress, complete,
// mulaiEdit, batalEdit, update.

/** POST /api/reports/{id}/mulai — body. Keduanya opsional di server. */
@JsonClass(generateAdapter = true)
data class MulaiRequest(
    val catatan: String? = null,
    @Json(name = "estimasi_selesai_hari") val estimasiSelesaiHari: Int? = null,
)

/** Satu item GET /api/reports/{id}/progress (timeline pengerjaan). */
@JsonClass(generateAdapter = true)
data class ProgressItemDto(
    val id: Long? = null,
    @Json(name = "foto_url") val fotoUrl: String? = null,
    val catatan: String? = null,
    @Json(name = "user_name") val userName: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
    @Json(name = "day_number") val dayNumber: Int? = null,
)

/**
 * PUT /api/reports/{id} — body JSON (bukan multipart).
 * Angka wajib non-null (aturan `required_without:photos` server).
 */
@JsonClass(generateAdapter = true)
data class UpdateReportRequest(
    val catatan: String? = null,
    @Json(name = "road_name") val roadName: String? = null,
    val district: String? = null,
    @Json(name = "kerusakan_panjang") val kerusakanPanjang: Double,
    @Json(name = "kerusakan_lebar") val kerusakanLebar: Double,
)

/** PUT /api/reports/{id} — data respons sukses. */
@JsonClass(generateAdapter = true)
data class UpdateReportData(
    val id: String? = null,
    val status: String? = null,
    @Json(name = "kerusakan_panjang") val kerusakanPanjang: Double? = null,
    @Json(name = "kerusakan_lebar") val kerusakanLebar: Double? = null,
    @Json(name = "catatan_petugas") val catatanPetugas: String? = null,
    @Json(name = "road_name") val roadName: String? = null,
    val district: String? = null,
)

// ── Detail kaya petugas (kontrak show(); bentuk meniru SupervisorModels,
// dipakai sesi petugas agar isolasi role terjaga) ─────────────────────────

/** Satu foto di detail (EXIF + AI per foto). Kontrak: show():1062-1083. */
@JsonClass(generateAdapter = true)
data class PetugasPhotoDto(
    val id: String? = null,
    @Json(name = "image_original_url") val imageOriginalUrl: String? = null,
    @Json(name = "image_result_url") val imageResultUrl: String? = null,
    @Json(name = "ai_jenis_kerusakan") val aiJenisKerusakan: String? = null,
    @Json(name = "ai_severity") val aiSeverity: String? = null,
    @Json(name = "ai_confidence") val aiConfidence: Double? = null,
    @Json(name = "total_detections") val totalDetections: Int? = null,
    @Json(name = "mobileclip_score") val mobileclipScore: Double? = null,
    @Json(name = "mobileclip_label") val mobileclipLabel: String? = null,
    @Json(name = "quality_scores") val qualityScores: QualityScoresDto? = null,
    @Json(name = "kerusakan_panjang") val kerusakanPanjang: Double? = null,
    @Json(name = "kerusakan_lebar") val kerusakanLebar: Double? = null,
    @Json(name = "photo_taken_at") val photoTakenAt: String? = null,
    @Json(name = "sort_order") val sortOrder: Int = 0,
    val latitude: Double? = null,
    val longitude: Double? = null,
) {
    val displayUrl: String? get() = imageResultUrl ?: imageOriginalUrl
}

/** Skor kualitas foto (kontrak: imageQualityCheck.ts). */
@JsonClass(generateAdapter = true)
data class QualityScoresDto(
    val status: String? = null,
    @Json(name = "blurScore") val blurScore: Double? = null,
    @Json(name = "meanBrightness") val meanBrightness: Double? = null,
)

/** Satu foto after (kunci minimal). Kontrak: show():1031-1035. */
@JsonClass(generateAdapter = true)
data class PetugasAfterPhotoDto(
    val id: String? = null,
    val url: String? = null,
    @Json(name = "sort_order") val sortOrder: Int = 0,
)

/** Info laporan duplikat. Kontrak: show():1089-1099. */
@JsonClass(generateAdapter = true)
data class PetugasDuplicateOfDto(
    val id: String? = null,
    @Json(name = "report_code") val reportCode: String? = null,
    @Json(name = "road_name") val roadName: String? = null,
    val district: String? = null,
    val latitude: Double? = null,
    val longitude: Double? = null,
    val score: Double? = null,
    @Json(name = "match_type") val matchType: String? = null,
    val status: String? = null,
)

/** Satu baris timeline status. Kontrak: show():1102-1111. */
@JsonClass(generateAdapter = true)
data class PetugasStatusHistoryDto(
    val event: String? = null,
    val label: String? = null,
    val status: String? = null,
    @Json(name = "old_status") val oldStatus: String? = null,
    val timestamp: String? = null,
    @Json(name = "actor_name") val actorName: String? = null,
    @Json(name = "actor_role") val actorRole: String? = null,
    val notes: String? = null,
)
