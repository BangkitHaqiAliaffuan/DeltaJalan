package com.jalankita.app.core.network

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * DTO role supervisor — kontrak: backend_POSTGRESQL ReportController + TeamController + PciController.
 * Replikasi Frontend-stable/src/routes/supervisor/{index,review}.tsx + detail-report.tsx.
 *
 * ATURAN KERAS: file ini HANYA dipakai sesi supervisor/admin. Jangan campur dengan
 * endpoint warga. Beberapa endpoint (approve/tolak/confirm-ai/reopen) TIDAK
 * dijaga role di server — guard wajib di client (lihat SupervisorRepository).
 */

/** GET /api/reports/stats — scope supervisor hanya `assigned_supervisor_id = me` (tanpa NULL). */
@JsonClass(generateAdapter = true)
data class SupervisorStatsDto(
    val total: Int = 0,
    @Json(name = "menunggu_review") val menungguReview: Int = 0,
    val disetujui: Int = 0,
    val ditolak: Int = 0,
    @Json(name = "hasil_ai") val hasilAi: Int = 0,
    val ditugaskan: Int = 0,
    @Json(name = "sedang_diperbaiki") val sedangDiperbaiki: Int = 0,
    val selesai: Int = 0,
    @Json(name = "rusak_berat") val rusakBerat: Int = 0,
    @Json(name = "rusak_sedang") val rusakSedang: Int = 0,
    @Json(name = "rusak_ringan") val rusakRingan: Int = 0,
    @Json(name = "monthly_trend") val monthlyTrend: List<MonthlyTrendDto>? = null,
)

/** Satu titik tren bulanan — CATATAN: tanpa hasil_ai/ditugaskan (beda dari stats utama). */
@JsonClass(generateAdapter = true)
data class MonthlyTrendDto(
    val bulan: String? = null,
    val total: Int = 0,
    @Json(name = "menunggu_review") val menungguReview: Int = 0,
    val disetujui: Int = 0,
    val ditolak: Int = 0,
    @Json(name = "sedang_diperbaiki") val sedangDiperbaiki: Int = 0,
    val selesai: Int = 0,
    @Json(name = "rusak_berat") val rusakBerat: Int = 0,
)

/** GET /api/supervisor/regions — label + UPTD yang disupervisi + kecamatan gabungan. */
@JsonClass(generateAdapter = true)
data class SupervisorRegionsData(
    val uptds: List<SupervisorUptdDto>? = null,
    val label: String? = null,
    val districts: List<String>? = null,
)

@JsonClass(generateAdapter = true)
data class SupervisorUptdDto(
    val id: String? = null,
    val nama: String? = null,
    @Json(name = "kecamatan_wilayah") val kecamatanWilayah: List<String>? = null,
)

/** Satu tim dari GET /api/teams (gate supervisor+admin). */
@JsonClass(generateAdapter = true)
data class TeamDto(
    val id: String,
    val name: String? = null,
    @Json(name = "members_count") val membersCount: Int = 0,
    val uptd: TeamUptdDto? = null,
)

/**
 * Envelope GET /api/teams — server mengembalikan `{"data":[...]}` **TANPA** field
 * `success` (TeamController::index). Karena itu JANGAN pakai [ApiEnvelope] (yang
 * mewajibkan `success`) — Moshi akan gagal parse dan tim tampil kosong.
 */
@JsonClass(generateAdapter = true)
data class TeamsResponse(
    val data: List<TeamDto>? = null,
)

@JsonClass(generateAdapter = true)
data class TeamUptdDto(
    val id: String? = null,
    val nama: String? = null,
    /** Wilayah kecamatan UPTD — dipakai mengisi `kecamatan_list` jadwal patroli otomatis. */
    @Json(name = "kecamatan_wilayah") val kecamatanWilayah: List<String>? = null,
)

/** GET /api/reports/stats-by-team — per tim (tanpa scope supervisor). */
@JsonClass(generateAdapter = true)
data class TeamStatsDto(
    @Json(name = "team_id") val teamId: String? = null,
    @Json(name = "team_name") val teamName: String? = null,
    val total: Int = 0,
    val ditugaskan: Int = 0,
    @Json(name = "sedang_diperbaiki") val sedangDiperbaiki: Int = 0,
    val selesai: Int = 0,
    @Json(name = "total_panjang_m") val totalPanjangM: Double = 0.0,
    @Json(name = "total_luas_m2") val totalLuasM2: Double = 0.0,
)

/** GET /api/pci/overview — non-admin di-scope `assigned_supervisor_id = me`. */
@JsonClass(generateAdapter = true)
data class PciOverviewData(
    val districts: List<PciDistrictDto>? = null,
    val kabupaten: PciKabupatenDto? = null,
)

@JsonClass(generateAdapter = true)
data class PciDistrictDto(
    val district: String? = null,
    val total: Int = 0,
    @Json(name = "avg_pci") val avgPci: Double? = null,
    @Json(name = "min_pci") val minPci: Double? = null,
    @Json(name = "max_pci") val maxPci: Double? = null,
    val kritis: Int = 0,
)

@JsonClass(generateAdapter = true)
data class PciKabupatenDto(
    @Json(name = "total_laporan") val totalLaporan: Int = 0,
    @Json(name = "avg_pci") val avgPci: Double? = null,
    val kritis: Int = 0,
)

/**
 * Detail GET /api/reports/{id} untuk supervisor — `{success, data:{...}}`.
 * Field berlebih diabaikan Moshi. Beda dari detail warga: ada `duplicate_of`,
 * `system_notes`, `priority`, `source`; TANPA rating-only flow.
 */
@JsonClass(generateAdapter = true)
data class SupervisorReportDetail(
    val id: String,
    @Json(name = "report_code") val reportCode: String? = null,
    @Json(name = "reporter_name") val reporterName: String? = null,
    @Json(name = "road_name") val roadName: String? = null,
    val district: String? = null,
    val latitude: Double? = null,
    val longitude: Double? = null,
    @Json(name = "full_address") val fullAddress: String? = null,
    @Json(name = "overall_severity") val overallSeverity: String? = null,
    @Json(name = "ai_severity") val aiSeverity: String? = null,
    val status: String? = null,
    val source: String? = null,
    val description: String? = null,
    @Json(name = "system_notes") val systemNotes: String? = null,
    val priority: String? = null,
    @Json(name = "pci_score") val pciScore: Double? = null,
    @Json(name = "kerusakan_panjang") val kerusakanPanjang: Double? = null,
    @Json(name = "kerusakan_lebar") val kerusakanLebar: Double? = null,
    @Json(name = "image_original_url") val imageOriginalUrl: String? = null,
    @Json(name = "image_result_url") val imageResultUrl: String? = null,
    @Json(name = "first_photo_url") val firstPhotoUrl: String? = null,
    @Json(name = "after_photo_url") val afterPhotoUrl: String? = null,
    @Json(name = "after_photo_notes") val afterPhotoNotes: String? = null,
    @Json(name = "assigned_team_id") val assignedTeamId: String? = null,
    @Json(name = "assigned_team_name") val assignedTeamName: String? = null,
    @Json(name = "assignor_name") val assignorName: String? = null,
    @Json(name = "catatan_petugas") val catatanPetugas: String? = null,
    val rating: Int? = null,
    @Json(name = "rating_comment") val ratingComment: String? = null,
    @Json(name = "estimasi_hari") val estimasiHari: Int? = null,
    @Json(name = "total_detections") val totalDetections: Int? = null,
    @Json(name = "deadline_review") val deadlineReview: String? = null,
    @Json(name = "deadline_resolusi") val deadlineResolusi: String? = null,
    @Json(name = "terlambat_review") val terlambatReview: Boolean = false,
    @Json(name = "terlambat_resolusi") val terlambatResolusi: Boolean = false,
    @Json(name = "perbaikan_dimulai_at") val perbaikanDimulaiAt: String? = null,
    @Json(name = "perbaikan_selesai_at") val perbaikanSelesaiAt: String? = null,
    @Json(name = "progress_updates_count") val progressUpdatesCount: Int = 0,
    @Json(name = "status_deadline") val statusDeadline: String? = null,
    @Json(name = "kerusakan_panjang_note") val kerusakanPanjangNote: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
    @Json(name = "photos") val photos: List<SupervisorPhotoDto>? = null,
    @Json(name = "after_photos") val afterPhotos: List<SupervisorPhotoDto>? = null,
    @Json(name = "duplicate_of") val duplicateOf: DuplicateOfDto? = null,
    @Json(name = "status_history") val statusHistory: List<StatusHistoryDto>? = null,
    @Json(name = "progress_updates") val progressUpdates: List<ProgressUpdateDto>? = null,
) {
    val effectiveSeverity: String? get() = overallSeverity ?: aiSeverity

    /** Foto utama untuk thumbnail — result → original → first photo. */
    val displayImageUrl: String?
        get() = imageResultUrl ?: imageOriginalUrl ?: firstPhotoUrl
}

/** Info laporan duplikat (hanya muncul di detail). */
@JsonClass(generateAdapter = true)
data class DuplicateOfDto(
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

/** Satu baris timeline status (kaya: event/label/actor). */
@JsonClass(generateAdapter = true)
data class StatusHistoryDto(
    val event: String? = null,
    val label: String? = null,
    val status: String? = null,
    @Json(name = "old_status") val oldStatus: String? = null,
    val timestamp: String? = null,
    @Json(name = "actor_name") val actorName: String? = null,
    @Json(name = "actor_role") val actorRole: String? = null,
    val notes: String? = null,
)

/** Satu foto di detail supervisor (kaya: exif + ai per foto). */
@JsonClass(generateAdapter = true)
data class SupervisorPhotoDto(
    val id: String? = null,
    val url: String? = null,
    @Json(name = "image_url") val imageUrl: String? = null,
    @Json(name = "image_original_url") val imageOriginalUrl: String? = null,
    @Json(name = "image_result_url") val imageResultUrl: String? = null,
    @Json(name = "ai_jenis_kerusakan") val aiJenisKerusakan: String? = null,
    @Json(name = "ai_severity") val aiSeverity: String? = null,
    @Json(name = "ai_confidence") val aiConfidence: Double? = null,
    @Json(name = "total_detections") val totalDetections: Int? = null,
    @Json(name = "mobileclip_score") val mobileclipScore: Double? = null,
    @Json(name = "mobileclip_label") val mobileclipLabel: String? = null,
    @Json(name = "kerusakan_panjang") val kerusakanPanjang: Double? = null,
    @Json(name = "kerusakan_lebar") val kerusakanLebar: Double? = null,
    @Json(name = "photo_taken_at") val photoTakenAt: String? = null,
    @Json(name = "sort_order") val sortOrder: Int = 0,
    val latitude: Double? = null,
    val longitude: Double? = null,
) {
    val displayUrl: String? get() = url ?: imageUrl ?: imageResultUrl ?: imageOriginalUrl
    val originalUrl: String? get() = imageOriginalUrl ?: url ?: imageUrl
    val resultUrl: String? get() = imageResultUrl
}

/** Body POST approve / approve-and-assign / confirm-ai. */
@JsonClass(generateAdapter = true)
data class TriageActionRequest(
    val priority: String? = null,
    @Json(name = "assigned_team_id") val assignedTeamId: String? = null,
)

/** Body POST tolak — alasan wajib (max 100), catatan opsional (max 500, di-enforce client). */
@JsonClass(generateAdapter = true)
data class TolakRequest(
    val alasan: String,
    val catatan: String? = null,
)

/**
 * Envelope aksi triase — server membalas `{success, message, data:{status}}`,
 * `approve-and-assign` bisa mengembalikan `needs_team:true` pada 422.
 */
@JsonClass(generateAdapter = true)
data class TriageActionResponse(
    val success: Boolean = false,
    val message: String? = null,
    @Json(name = "needs_team") val needsTeam: Boolean = false,
    val data: TriageStatusData? = null,
)

@JsonClass(generateAdapter = true)
data class TriageStatusData(
    val status: String? = null,
)

/** Body POST bulk-approve: ids daftar uuid laporan. */
@JsonClass(generateAdapter = true)
data class BulkIdsRequest(
    val ids: List<String>,
)

/** Body POST bulk-tolak: alasan wajib, maks 500 karakter (di-enforce client). */
@JsonClass(generateAdapter = true)
data class BulkTolakRequest(
    val ids: List<String>,
    val alasan: String,
)

/** Envelope aksi massal: success, message, data approved_count/rejected_count. */
@JsonClass(generateAdapter = true)
data class BulkActionResult(
    val success: Boolean = false,
    val message: String? = null,
    val data: BulkCountData? = null,
)

@JsonClass(generateAdapter = true)
data class BulkCountData(
    @Json(name = "approved_count") val approvedCount: Int = 0,
    @Json(name = "rejected_count") val rejectedCount: Int = 0,
)
