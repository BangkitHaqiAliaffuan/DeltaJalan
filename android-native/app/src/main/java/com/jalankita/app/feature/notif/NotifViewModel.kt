package com.jalankita.app.feature.notif

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.jalankita.app.core.data.DashboardResult
import com.jalankita.app.core.data.NotifRepository
import com.jalankita.app.core.data.UnauthorizedException
import com.jalankita.app.core.network.NotifItemDto
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.launch
import javax.inject.Inject

/** Nilai filter = `data.type` server (cermin types[] notifications.tsx). */
val NOTIF_FILTERS: List<Pair<String, String?>> = listOf(
    "Semua" to null,
    "Laporan Baru" to "report_created",
    "Disetujui" to "report_approved",
    "Ditolak" to "report_rejected",
    "Tugas Baru" to "upr_assigned",
    "Perbaikan Selesai" to "repair_completed",
    "Diedit" to "report_edited",
    "Triage" to "triage_updated",
    "Dibuka Kembali" to "report_reopened",
    "Aksi Massal" to "bulk_action",
    "Patroli Baru" to "patrol_task_generated",
    "Pengingat Patroli" to "patrol_morning_reminder",
    "Patroli Selesai" to "patrol_evening_reminder",
)

/**
 * State layar Notifikasi — replikasi notifications.tsx (filter client-side,
 * tandai dibaca, hapus semua, muat lebih banyak). Dipakai 3 scaffold
 * (petugas/warga/supervisor) — endpoint per-user, tanpa sekat role.
 */
@HiltViewModel
class NotifViewModel @Inject constructor(
    private val repo: NotifRepository,
) : ViewModel() {

    var items by mutableStateOf<List<NotifItemDto>>(emptyList())
        private set
    var loading by mutableStateOf(false)
        private set
    var refreshing by mutableStateOf(false)
        private set
    var page by mutableStateOf(1)
        private set
    var lastPage by mutableStateOf(1)
        private set
    var total by mutableStateOf(0)
        private set
    var filter by mutableStateOf<String?>(null)
        private set
    var unread by mutableStateOf(0)
        private set
    var deleteBusy by mutableStateOf(false)
        private set
    var sessionExpired by mutableStateOf(false)
        private set
    var errorMessage by mutableStateOf<String?>(null)
        private set

    /** Item tampil setelah filter client-side (cermin web: filter per halaman). */
    val visibleItems: List<NotifItemDto>
        get() {
            val f = filter ?: return items
            return items.filter { it.data?.type == f }
        }

    fun consumeError() {
        errorMessage = null
    }

    /**
     * Bersihkan state milik user lama — dipanggil saat sesi berganti
     * (logout/login). Instance VM activity-scoped dipakai 3 role; tanpa ini
     * notifikasi user lama tampil ke user baru sampai refresh manual.
     */
    fun clear() {
        items = emptyList()
        page = 1
        lastPage = 1
        total = 0
        filter = null
        unread = 0
        errorMessage = null
    }

    fun loadUnread() {
        viewModelScope.launch {
            unread = repo.unread()
        }
    }

    fun load(reset: Boolean = false) {
        if (loading) return
        viewModelScope.launch {
            loading = true
            if (reset) refreshing = true
            try {
                val p = if (reset) 1 else page + 1
                when (val r = repo.list(page = p)) {
                    is DashboardResult.Success -> {
                        items = if (reset || p == 1) r.data.items else items + r.data.items
                        page = r.data.page
                        lastPage = r.data.lastPage
                        total = r.data.total
                    }
                    is DashboardResult.Error -> errorMessage = r.message
                }
            } catch (e: UnauthorizedException) {
                sessionExpired = true
            } catch (e: Exception) {
                errorMessage = e.message ?: "Tidak dapat terhubung ke server."
            } finally {
                loading = false
                refreshing = false
            }
        }
    }

    fun applyFilter(value: String?) {
        filter = value
    }

    /** Tap item → tandai dibaca (cermin handleRead web; tanpa navigasi). */
    fun markRead(item: NotifItemDto) {
        if (!item.isUnread) return
        viewModelScope.launch {
            try {
                when (val r = repo.markRead(item.id)) {
                    is DashboardResult.Success -> {
                        items = items.map {
                            if (it.id == item.id) it.copy(readAt = "now") else it
                        }
                        if (unread > 0) unread -= 1
                    }
                    is DashboardResult.Error -> errorMessage = r.message
                }
            } catch (e: UnauthorizedException) {
                sessionExpired = true
            } catch (e: Exception) {
                errorMessage = e.message ?: "Tidak dapat terhubung ke server."
            }
        }
    }

    fun markAllRead() {
        viewModelScope.launch {
            try {
                when (val r = repo.markAllRead()) {
                    is DashboardResult.Success -> {
                        items = items.map { it.copy(readAt = it.readAt ?: "now") }
                        unread = 0
                    }
                    is DashboardResult.Error -> errorMessage = r.message
                }
            } catch (e: UnauthorizedException) {
                sessionExpired = true
            } catch (e: Exception) {
                errorMessage = e.message ?: "Tidak dapat terhubung ke server."
            }
        }
    }

    fun deleteAll(onDone: () -> Unit = {}) {
        if (deleteBusy) return
        viewModelScope.launch {
            deleteBusy = true
            try {
                when (val r = repo.deleteAll()) {
                    is DashboardResult.Success -> {
                        items = emptyList()
                        page = 1
                        lastPage = 1
                        total = 0
                        unread = 0
                        onDone()
                    }
                    is DashboardResult.Error -> errorMessage = r.message
                }
            } catch (e: UnauthorizedException) {
                sessionExpired = true
            } catch (e: Exception) {
                errorMessage = e.message ?: "Tidak dapat terhubung ke server."
            } finally {
                deleteBusy = false
            }
        }
    }
}
