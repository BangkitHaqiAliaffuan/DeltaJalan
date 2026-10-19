package com.jalankita.app.core.data

import com.jalankita.app.core.network.ApiService
import com.jalankita.app.core.network.NotifItemDto
import retrofit2.HttpException
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Akses endpoint notifikasi (semua role) — replikasi notifications.tsx.
 * Endpoint per-user di server; tidak ada isolasi role yang perlu dijaga.
 * Pola mengikuti [WargaRepository]: tanpa exception, 401 → [UnauthorizedException].
 */
@Singleton
class NotifRepository @Inject constructor(
    private val api: ApiService,
) {
    /** GET /api/notifications — satu halaman + info paginasi. */
    suspend fun list(page: Int = 1, perPage: Int = 20): DashboardResult<NotifPage> =
        runCatchingNotif {
            val res = api.notifications(page = page, perPage = perPage)
            if (!res.success) throw Exception(res.message ?: "Gagal memuat notifikasi.")
            NotifPage(
                items = res.data.orEmpty(),
                total = res.meta?.total ?: res.data.orEmpty().size,
                page = res.meta?.currentPage ?: page,
                lastPage = res.meta?.lastPage ?: page,
            )
        }

    /** GET /api/notifications/unread-count — best-effort, 0 bila gagal. */
    suspend fun unread(): Int {
        return try {
            api.unreadCount().data?.unread ?: 0
        } catch (_: Exception) {
            0
        }
    }

    /** POST /api/notifications/{id}/read. */
    suspend fun markRead(id: String): DashboardResult<Unit> = runCatchingNotif {
        val res = api.markNotifRead(id)
        if (!res.success) throw Exception(res.message ?: "Gagal menandai notifikasi.")
    }

    /** POST /api/notifications/read-all. */
    suspend fun markAllRead(): DashboardResult<Unit> = runCatchingNotif {
        val res = api.markAllNotifRead()
        if (!res.success) throw Exception(res.message ?: "Gagal menandai notifikasi.")
    }

    /** DELETE /api/notifications. */
    suspend fun deleteAll(): DashboardResult<Unit> = runCatchingNotif {
        val res = api.deleteAllNotif()
        if (!res.success) throw Exception(res.message ?: "Gagal menghapus notifikasi.")
    }

    private suspend fun <T> runCatchingNotif(block: suspend () -> T): DashboardResult<T> {
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

/** Satu halaman notifikasi + info paginasi (kontrak index: meta). */
data class NotifPage(
    val items: List<NotifItemDto> = emptyList(),
    val total: Int = 0,
    val page: Int = 1,
    val lastPage: Int = 1,
)
