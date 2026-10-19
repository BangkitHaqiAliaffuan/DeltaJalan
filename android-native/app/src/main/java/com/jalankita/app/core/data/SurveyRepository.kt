package com.jalankita.app.core.data

import com.jalankita.app.core.network.ApiService
import com.jalankita.app.core.network.SurveyTask
import retrofit2.HttpException
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Akses endpoint sesi/task patroli (cek rutin) — kontrak: SurveyTaskController.
 * Dipakai role petugas (server otomatis scope `team_id = me`) dan supervisor.
 *
 * ATURAN: `GET /survei` TIDAK mengembalikan `success` (paginator polos) — sudah
 * ditangani [com.jalankita.app.core.network.SurveyListResponse] data-only.
 */
@Singleton
class SurveyRepository @Inject constructor(
    private val api: ApiService,
) {
    /** GET /api/survei — daftar sesi patroli. */
    suspend fun list(
        status: String? = null,
        tanggalPatroli: String? = null,
        query: String? = null,
    ): DashboardResult<List<SurveyTask>> = runCatchingSurvey {
        api.surveyTasks(
            status = status?.takeIf { it.isNotBlank() },
            tanggalPatroli = tanggalPatroli?.takeIf { it.isNotBlank() },
            q = query?.takeIf { it.isNotBlank() },
        ).data.orEmpty()
    }

    /** GET /api/survei/{id} — detail sesi + laporan terkait. */
    suspend fun detail(id: String): DashboardResult<SurveyTask> = runCatchingSurvey {
        api.surveyTaskDetail(id).data ?: throw Exception("Sesi patroli tidak ditemukan.")
    }

    private suspend fun <T> runCatchingSurvey(block: suspend () -> T): DashboardResult<T> {
        return try {
            DashboardResult.Success(block())
        } catch (e: kotlinx.coroutines.CancellationException) {
            throw e
        } catch (e: HttpException) {
            if (e.code() == 401) throw UnauthorizedException()
            when (e.code()) {
                403 -> throw Exception("Akses ditolak. Sesi ini bukan milik tim Anda.")
                404 -> throw Exception("Sesi patroli tidak ditemukan.")
                else -> DashboardResult.Error("Terjadi kesalahan (${e.code()}).")
            }
        } catch (e: UnauthorizedException) {
            throw e
        } catch (e: Exception) {
            DashboardResult.Error(e.message ?: "Tidak dapat terhubung ke server.")
        }
    }
}
