package com.jalankita.app.core.network

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * DTO jadwal patroli (cek rutin) — kontrak: PatrolScheduleController + routes/api.php.
 * Replikasi Frontend-stable/src/types/survey.ts + hooks/usePatrolScheduleQueries.ts.
 *
 * ATURAN: hanya dipakai role supervisor/admin (kecuali list read-only petugas).
 *
 * CATATAN PENTING (hasil crosscheck):
 *  - Validasi server `hari` = **min 3** (store/update/preview), walau web memvalidasi min 2.
 *    Native WAJIB pakai min 3 agar tidak 422.
 *  - `kecamatan_list` diisi OTOMATIS dari `team.uptd.kecamatan_wilayah` (bukan dipilih user).
 *  - Field `jam_mulai/jam_selesai` default DB `09:00–16:00`; form web TIDAK mengirimnya.
 */

/** Konstanta hari (server Terima Senin..Minggu; form web hanya Senin..Sabtu). */
val PATROL_HARI: List<String> = listOf("Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu")
val PATROL_HARI_LABEL: Map<String, String> = mapOf(
    "Senin" to "Sen", "Selasa" to "Sel", "Rabu" to "Rab", "Kamis" to "Kam",
    "Jumat" to "Jum", "Sabtu" to "Sab", "Minggu" to "Min",
)
val PATROL_FREKUENSI: List<Pair<String, String>> = listOf(
    "setiap_minggu" to "Setiap Minggu",
    "dua_mingguan" to "2 Mingguan",
    "bulanan" to "Bulanan",
)
val PATROL_JENIS_TUGAS: List<Pair<String, String>> = listOf(
    "rutin" to "Rutin",
    "tindak_lanjut" to "Tindak Lanjut",
    "pengaduan" to "Pengaduan",
)

/** Minimal hari yang diterima server (store/update/preview = min:3). */
const val PATROL_MIN_HARI = 3

/**
 * Satu jadwal patroli — GET /api/patrol-schedules (list) + GET /{id} (detail).
 * `team.surveyTasks` hanya ada di detail (dengan `reports_count`).
 */
@JsonClass(generateAdapter = true)
data class PatrolSchedule(
    val id: String,
    @Json(name = "team_id") val teamId: String? = null,
    val team: PatrolTeamRef? = null,
    val hari: List<String>? = null,
    @Json(name = "kecamatan_list") val kecamatanList: List<String>? = null,
    val frekuensi: String? = null,
    @Json(name = "start_date") val startDate: String? = null,
    @Json(name = "end_date") val endDate: String? = null,
    @Json(name = "alasan_tugas") val alasanTugas: String? = null,
    val status: String? = null,
    @Json(name = "jam_mulai") val jamMulai: String? = null,
    @Json(name = "jam_selesai") val jamSelesai: String? = null,
    @Json(name = "created_by") val createdBy: Long? = null,
    @Json(name = "tasks_count") val tasksCount: Int = 0,
    @Json(name = "created_at") val createdAt: String? = null,
    @Json(name = "updated_at") val updatedAt: String? = null,
)

/** Tim di dalam jadwal — `{id, name, description, surveyTasks[]?}` (surveyTasks di detail). */
@JsonClass(generateAdapter = true)
data class PatrolTeamRef(
    val id: String? = null,
    val name: String? = null,
    val description: String? = null,
    @Json(name = "surveyTasks") val surveyTasks: List<PatrolTask>? = null,
)

/** Satu task/shift tertanggal — elemen `team.surveyTasks`. */
@JsonClass(generateAdapter = true)
data class PatrolTask(
    val id: String,
    @Json(name = "road_name") val roadName: String? = null,
    val kecamatan: String? = null,
    @Json(name = "team_id") val teamId: String? = null,
    val status: String? = null,
    @Json(name = "jam_mulai") val jamMulai: String? = null,
    @Json(name = "jam_selesai") val jamSelesai: String? = null,
    @Json(name = "tanggal_patroli") val tanggalPatroli: String? = null,
    @Json(name = "alasan_tugas") val alasanTugas: String? = null,
    @Json(name = "reports_count") val reportsCount: Int = 0,
)

/** Paginator GET /api/patrol-schedules — `{data[], current_page, last_page, total, per_page}`. */
@JsonClass(generateAdapter = true)
data class PatrolListResponse(
    val data: List<PatrolSchedule>? = null,
    @Json(name = "current_page") val currentPage: Int = 1,
    @Json(name = "last_page") val lastPage: Int = 1,
    val total: Int = 0,
    @Json(name = "per_page") val perPage: Int = 20,
)

/** Envelope detail GET /api/patrol-schedules/{id} — `{data:{...}}`. */
@JsonClass(generateAdapter = true)
data class PatrolDetailResponse(
    val data: PatrolSchedule? = null,
)

/** Envelope mutasi — `{data?, message, generated_count?}`. */
@JsonClass(generateAdapter = true)
data class PatrolMutationResponse(
    val data: PatrolSchedule? = null,
    val message: String? = null,
    @Json(name = "generated_count") val generatedCount: Int? = null,
)

/** Body create/update jadwal — `kecamatan_list` diisi otomatis dari wilayah tim. */
@JsonClass(generateAdapter = true)
data class PatrolScheduleRequest(
    @Json(name = "team_id") val teamId: String,
    val hari: List<String>,
    @Json(name = "kecamatan_list") val kecamatanList: List<String>,
    val frekuensi: String,
    @Json(name = "start_date") val startDate: String,
    @Json(name = "end_date") val endDate: String? = null,
    @Json(name = "alasan_tugas") val alasanTugas: String? = null,
)

/** Body POST /{id}/generate. */
@JsonClass(generateAdapter = true)
data class PatrolGenerateRequest(
    @Json(name = "start_date") val startDate: String,
    @Json(name = "end_date") val endDate: String,
)

/** Respons preview — `{preview:{...}}`. */
@JsonClass(generateAdapter = true)
data class PatrolPreviewResponse(
    val preview: PatrolPreview? = null,
)

@JsonClass(generateAdapter = true)
data class PatrolPreview(
    @Json(name = "total_hari") val totalHari: Int = 0,
    @Json(name = "hari_patroli") val hariPatroli: Int = 0,
    @Json(name = "kecamatan_count") val kecamatanCount: Int = 0,
    @Json(name = "estimated_tasks") val estimatedTasks: Int = 0,
    @Json(name = "start_date") val startDate: String? = null,
    @Json(name = "end_date") val endDate: String? = null,
)
