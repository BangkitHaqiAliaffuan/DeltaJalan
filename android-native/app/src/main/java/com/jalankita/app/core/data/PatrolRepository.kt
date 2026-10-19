package com.jalankita.app.core.data

import com.jalankita.app.core.network.ApiService
import com.jalankita.app.core.network.PatrolGenerateRequest
import com.jalankita.app.core.network.PatrolMutationResponse
import com.jalankita.app.core.network.PatrolPreview
import com.jalankita.app.core.network.PatrolSchedule
import com.jalankita.app.core.network.PatrolScheduleRequest
import retrofit2.HttpException
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Akses endpoint jadwal patroli supervisor (role:supervisor/admin) — replikasi
 * Frontend-stable/src/hooks/usePatrolScheduleQueries.ts.
 *
 * ATURAN:
 *  - Server menolak `hari` < 3 (422). Guard di form (PATROL_MIN_HARI).
 *  - `store` 409 bila tim sudah punya jadwal aktif → petakan pesan jelas.
 *  - `generate` 422 bila jadwal nonaktif.
 *  - JANGAN panggil endpoint ini dari sesi warga/petugas (kecuali list read-only
 *    petugas via ApiService.patrolSchedules yang sudah ada).
 */
@Singleton
class PatrolRepository @Inject constructor(
    private val api: ApiService,
) {
    /** GET /api/patrol-schedules — daftar jadwal (paginator). */
    suspend fun list(teamId: String? = null, status: String? = null): DashboardResult<List<PatrolSchedule>> =
        runCatchingPatrol {
            val res = api.patrolScheduleList(
                teamId = teamId?.takeIf { it.isNotBlank() },
                status = status?.takeIf { it.isNotBlank() },
                perPage = 50,
            )
            res.data.orEmpty()
        }

    /** GET /api/patrol-schedules/{id} — detail + surveyTasks. */
    suspend fun detail(id: String): DashboardResult<PatrolSchedule> = runCatchingPatrol {
        api.patrolScheduleDetail(id).data ?: throw Exception("Jadwal tidak ditemukan.")
    }

    /** GET /api/patrol-schedules/preview — estimasi (query param, bukan body). */
    suspend fun preview(
        startDate: String,
        endDate: String?,
        frekuensi: String,
        hari: List<String>,
        kecamatanList: List<String>,
    ): DashboardResult<PatrolPreview> = runCatchingPatrol {
        api.patrolPreview(
            startDate = startDate,
            endDate = endDate?.takeIf { it.isNotBlank() },
            frekuensi = frekuensi,
            hari = hari,
            kecamatanList = kecamatanList,
        ).preview ?: throw Exception("Preview tidak tersedia.")
    }

    /** POST /api/patrol-schedules — 201; 409 bila tim sudah punya jadwal aktif. */
    suspend fun create(body: PatrolScheduleRequest): DashboardResult<String> = runCatchingPatrol {
        val res = api.createPatrolSchedule(body)
        res.message ?: "Jadwal patroli dibuat."
    }

    /** PUT /api/patrol-schedules/{id}. */
    suspend fun update(id: String, body: PatrolScheduleRequest): DashboardResult<String> = runCatchingPatrol {
        val res = api.updatePatrolSchedule(id, body)
        res.message ?: "Jadwal patroli diperbarui."
    }

    /** DELETE /api/patrol-schedules/{id}. */
    suspend fun delete(id: String): DashboardResult<String> = runCatchingPatrol {
        val res = api.deletePatrolSchedule(id)
        res.message ?: "Jadwal patroli dihapus."
    }

    /** POST /api/patrol-schedules/{id}/toggle. */
    suspend fun toggle(id: String): DashboardResult<String> = runCatchingPatrol {
        val res = api.togglePatrolSchedule(id)
        res.message ?: "Status jadwal diubah."
    }

    /** POST /api/patrol-schedules/{id}/generate — 422 bila jadwal nonaktif. */
    suspend fun generate(id: String, startDate: String, endDate: String): DashboardResult<String> =
        runCatchingPatrol {
            val res = api.generatePatrolTasks(id, PatrolGenerateRequest(startDate, endDate))
            res.message ?: "Shift digenerate."
        }

    private suspend fun <T> runCatchingPatrol(block: suspend () -> T): DashboardResult<T> {
        return try {
            DashboardResult.Success(block())
        } catch (e: kotlinx.coroutines.CancellationException) {
            throw e
        } catch (e: HttpException) {
            if (e.code() == 401) throw UnauthorizedException()
            when (e.code()) {
                403 -> throw Exception("Akses ditolak. Hanya supervisor yang dapat mengatur jadwal.")
                409 -> throw Exception("Tim satgas ini sudah memiliki jadwal aktif.")
                422 -> throw Exception(parseValidationMessage(e))
                else -> DashboardResult.Error("Terjadi kesalahan (${e.code()}).")
            }
        } catch (e: UnauthorizedException) {
            throw e
        } catch (e: Exception) {
            DashboardResult.Error(e.message ?: "Tidak dapat terhubung ke server.")
        }
    }

    /**
     * Ambil pesan validasi server (422). Best-effort: body berbentuk
     * `{message, errors:{field:[...]}}` → prioritaskan error pertama, else message.
     */
    private fun parseValidationMessage(e: HttpException): String {
        val fallback = "Data tidak valid (422)."
        return try {
            val raw = e.response()?.errorBody()?.string().takeUnless { it.isNullOrBlank() } ?: return fallback
            val obj = org.json.JSONObject(raw)
            val errors = obj.optJSONObject("errors")
            if (errors != null && errors.length() > 0) {
                val firstKey = errors.keys().asSequence().first()
                val arr = errors.optJSONArray(firstKey)
                val first = arr?.optString(0)
                if (!first.isNullOrBlank()) return first
            }
            obj.optString("message").takeIf { it.isNotBlank() } ?: fallback
        } catch (_: Exception) {
            fallback
        }
    }
}
