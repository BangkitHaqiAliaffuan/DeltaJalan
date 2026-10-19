package com.jalankita.app.core.data

import com.jalankita.app.core.network.ApiService
import com.jalankita.app.core.network.PatrolScheduleDto
import com.jalankita.app.core.network.ReportItemDto
import com.jalankita.app.core.network.StatsDto
import com.jalankita.app.core.network.WargaMapData
import retrofit2.HttpException
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Akses endpoint dashboard petugas (replikasi home.tsx).
 * Pola mengikuti [ReportRepository]: tanpa exception, 401 → [UnauthorizedException].
 */
@Singleton
class DashboardRepository @Inject constructor(
    private val api: ApiService,
) {
    /** GET /api/reports/stats. */
    suspend fun stats(): DashboardResult<StatsDto> = runCatchingDashboard {
        api.reportStats().data ?: throw Exception("Statistik kosong.")
    }

    /** GET /api/reports?user_reports=true&limit= — laporan milik sendiri. */
    suspend fun myReports(limit: Int = 10): DashboardResult<List<ReportItemDto>> =
        runCatchingDashboard {
            val res = api.reports(userReports = true, limit = limit)
            if (!res.success) throw Exception(res.message ?: "Gagal memuat laporan.")
            res.data.orEmpty()
        }

    /** GET /api/reports?limit=3&team_tasks=1 — tugas tim (difilter aktif di VM). */
    suspend fun teamTasks(limit: Int = 3): DashboardResult<List<ReportItemDto>> =
        runCatchingDashboard {
            val res = api.reports(teamTasks = true, limit = limit)
            if (!res.success) throw Exception(res.message ?: "Gagal memuat tugas.")
            res.data.orEmpty()
        }

    /** GET /api/reports?user_reports=true — halaman Riwayat (dengan filter status). */
    suspend fun history(
        limit: Int = 20,
        page: Int = 1,
        status: String? = null,
        query: String? = null,
    ): DashboardResult<HistoryPage> = runCatchingDashboard {
        val res = api.reports(
            userReports = true,
            limit = limit,
            page = page,
            status = status,
            q = query?.takeIf { it.isNotBlank() },
        )
        if (!res.success) throw Exception(res.message ?: "Gagal memuat riwayat.")
        HistoryPage(
            items = res.data.orEmpty(),
            total = res.total,
            page = res.page,
            lastPage = res.lastPage,
        )
    }

    /** GET /api/reports/{id} — 403 bila bukan laporan sendiri/tim. */
    suspend fun detail(id: String): DashboardResult<ReportItemDto> = runCatchingDashboard {
        try {
            api.reportDetail(id).data ?: throw Exception("Laporan tidak ditemukan.")
        } catch (e: HttpException) {
            if (e.code() == 403) {
                throw Exception("Anda hanya dapat melihat laporan Anda sendiri atau tim Anda.")
            }
            throw e
        }
    }

    /** GET /api/patrol-schedules?team_id= — jadwal patroli tim. */
    suspend fun patrolSchedules(teamId: String?): DashboardResult<List<PatrolScheduleDto>> =
        runCatchingDashboard {
            if (teamId.isNullOrBlank()) return@runCatchingDashboard emptyList()
            api.patrolSchedules(teamId = teamId).data.orEmpty()
        }

    /** GET /api/reports/map-data — sebaran untuk tab Peta petugas. */
    suspend fun mapData(): DashboardResult<WargaMapData> = runCatchingDashboard {
        val res = api.petugasMapData()
        if (!res.success || res.data == null) throw Exception(res.message ?: "Gagal memuat peta.")
        res.data
    }

    private suspend fun <T> runCatchingDashboard(block: suspend () -> T): DashboardResult<T> {
        return try {
            DashboardResult.Success(block())
        } catch (e: HttpException) {
            if (e.code() == 401) throw UnauthorizedException()
            DashboardResult.Error("Terjadi kesalahan (${e.code()}).")
        } catch (e: UnauthorizedException) {
            throw e
        } catch (e: Exception) {
            DashboardResult.Error(e.message ?: "Tidak dapat terhubung ke server.")
        }
    }
}

/** Satu halaman riwayat + info paginasi (kontrak index: total/page/last_page). */
data class HistoryPage(
    val items: List<ReportItemDto> = emptyList(),
    val total: Int = 0,
    val page: Int = 1,
    val lastPage: Int = 1,
)

/** Hasil operasi dashboard tanpa exception (401 dilempar sebagai [UnauthorizedException]). */
sealed interface DashboardResult<out T> {
    data class Success<T>(val data: T) : DashboardResult<T>
    data class Error(val message: String) : DashboardResult<Nothing>
}
