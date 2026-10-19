package com.jalankita.app.feature.warga

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.jalankita.app.core.data.DashboardResult
import com.jalankita.app.core.data.UnauthorizedException
import com.jalankita.app.core.data.WargaRepository
import com.jalankita.app.core.data.WargaSubmitException
import com.jalankita.app.core.network.MapReportDto
import com.jalankita.app.core.network.RemainingDto
import com.jalankita.app.core.network.UserDto
import com.jalankita.app.core.network.WargaDetailData
import com.jalankita.app.core.network.WargaReportDto
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import javax.inject.Inject

/** Statistik dashboard warga — replikasi warga/index.tsx:20,33-40. */
data class WargaStats(
    val total: Int = 0,
    val diproses: Int = 0,
    val selesai: Int = 0,
    val ditolak: Int = 0,
)

/** Status yang diproses menurut web: Menunggu Review/Ditinjau/Disetujui/Sedang Diperbaiki. */
private val DIPROSES = setOf("Menunggu Review", "Ditinjau", "Disetujui", "Sedang Diperbaiki")

/**
 * State warga — replikasi warga/index.tsx + layar warga/laporan.
 * Hanya menyentuh endpoint warga (isolasi role, lihat WargaRepository).
 */
@HiltViewModel
class WargaViewModel @Inject constructor(
    private val repo: WargaRepository,
) : ViewModel() {

    // ── Dashboard ──────────────────────────────────────────────────────────
    var recent by mutableStateOf<List<WargaReportDto>>(emptyList())
        private set
    var stats by mutableStateOf(WargaStats())
        private set
    var loading by mutableStateOf(true)
        private set
    var refreshing by mutableStateOf(false)
        private set

    // ── Riwayat ────────────────────────────────────────────────────────────
    var history by mutableStateOf<List<WargaReportDto>>(emptyList())
        private set
    var historyTotal by mutableStateOf(0)
        private set
    var historyPage by mutableStateOf(1)
        private set
    var historyLastPage by mutableStateOf(1)
        private set
    var historyLoading by mutableStateOf(false)
        private set
    var historyFilter by mutableStateOf<String?>(null)
        private set
    var historyQuery by mutableStateOf("")
        private set

    // ── Detail + rating ────────────────────────────────────────────────────
    var detail by mutableStateOf<WargaDetailData?>(null)
        private set
    var detailLoading by mutableStateOf(false)
        private set
    var ratingBusy by mutableStateOf(false)
        private set
    var ratingDone by mutableStateOf(false)
        private set

    // ── Peta sebaran ───────────────────────────────────────────────────────
    var mapReports by mutableStateOf<List<MapReportDto>>(emptyList())
        private set
    var mapStatsTotal by mutableStateOf(0)
        private set
    var mapLoading by mutableStateOf(false)
        private set
    var mapError by mutableStateOf<String?>(null)
        private set

    // ── Kuota ──────────────────────────────────────────────────────────────
    var remaining by mutableStateOf<RemainingDto?>(null)
        private set

    var errorMessage by mutableStateOf<String?>(null)
        private set
    var sessionExpired by mutableStateOf(false)
        private set

    private var searchJob: Job? = null

    fun consumeError() { errorMessage = null }

    /** Dashboard: 5 terbaru + statistik klien (warga/index.tsx:22-49). */
    fun refreshDashboard(user: UserDto, force: Boolean = false) {
        if (refreshing && !force) return
        viewModelScope.launch {
            if (recent.isEmpty()) loading = true else refreshing = true
            try {
                when (val r = repo.reports(perPage = 5)) {
                    is DashboardResult.Success -> {
                        val items = r.data.data.orEmpty()
                        recent = items
                        stats = WargaStats(
                            total = r.data.meta?.total ?: items.size,
                            diproses = items.count { it.status in DIPROSES },
                            selesai = items.count { it.status == "Selesai" },
                            ditolak = items.count { it.status == "Ditolak" },
                        )
                    }
                    is DashboardResult.Error -> {
                        if (recent.isEmpty()) errorMessage = r.message
                    }
                }
            } catch (_: UnauthorizedException) {
                sessionExpired = true
            } catch (e: Exception) {
                if (recent.isEmpty()) errorMessage = e.message
            } finally {
                loading = false
                refreshing = false
            }
        }
    }

    /** Riwayat + filter status warga (Semua/Diproses/Selesai/Ditolak) + cari. */
    fun loadHistory(reset: Boolean = false) {
        if (historyLoading) return
        viewModelScope.launch {
            historyLoading = true
            try {
                val page = if (reset) 1 else historyPage + 1
                when (val r = repo.reports(
                    perPage = 20,
                    page = page,
                    status = historyFilter,
                    query = historyQuery,
                )) {
                    is DashboardResult.Success -> {
                        val items = r.data.data.orEmpty()
                        history = if (page == 1) items else history + items
                        historyTotal = r.data.meta?.total ?: history.size
                        historyPage = r.data.meta?.currentPage ?: page
                        historyLastPage = r.data.meta?.lastPage ?: page
                    }
                    is DashboardResult.Error -> errorMessage = r.message
                }
            } catch (_: UnauthorizedException) {
                sessionExpired = true
            } catch (e: Exception) {
                errorMessage = e.message
            } finally {
                historyLoading = false
            }
        }
    }

    fun applyHistoryFilter(status: String?) {
        if (historyFilter == status) return
        historyFilter = status
        history = emptyList()
        historyPage = 1
        loadHistory()
    }

    fun updateHistoryQuery(q: String) {
        historyQuery = q
        // Debounce 500ms ala web (warga/laporan setTimeout setQuery).
        searchJob?.cancel()
        searchJob = viewModelScope.launch {
            delay(500)
            history = emptyList()
            historyPage = 1
            loadHistory()
        }
    }
    fun submitHistoryQuery() {
        searchJob?.cancel()
        history = emptyList()
        historyPage = 1
        loadHistory()
    }

    /** Hapus laporan sendiri — sukses → muat ulang riwayat. */
    var deleteBusy by mutableStateOf(false)
        private set

    fun hapus(id: String) {
        if (deleteBusy) return
        viewModelScope.launch {
            deleteBusy = true
            try {
                when (val r = repo.hapus(id)) {
                    is DashboardResult.Success -> loadHistory(reset = true)
                    is DashboardResult.Error -> errorMessage = r.message
                }
            } catch (_: UnauthorizedException) {
                sessionExpired = true
            } catch (e: Exception) {
                errorMessage = e.message
            } finally {
                deleteBusy = false
            }
        }
    }

    /** Detail + timeline. */
    fun loadDetail(id: String) {
        viewModelScope.launch {
            detail = null
            ratingDone = false
            detailLoading = true
            try {
                when (val r = repo.detail(id)) {
                    is DashboardResult.Success -> detail = r.data
                    is DashboardResult.Error -> errorMessage = r.message
                }
            } catch (_: UnauthorizedException) {
                sessionExpired = true
            } catch (e: Exception) {
                errorMessage = e.message
            } finally {
                detailLoading = false
            }
        }
    }

    fun clearDetail() { detail = null }

    /** Rating 1-5 + komentar (hanya Selesai & sekali — server 422 bila tidak). */
    fun submitRating(id: String, rating: Int, comment: String) {
        if (ratingBusy) return
        viewModelScope.launch {
            ratingBusy = true
            try {
                when (val r = repo.rate(id, rating, comment)) {
                    is DashboardResult.Success -> {
                        ratingDone = true
                        loadDetail(id)
                    }
                    is DashboardResult.Error -> errorMessage = r.message
                }
            } catch (_: UnauthorizedException) {
                sessionExpired = true
            } catch (e: Exception) {
                errorMessage = e.message
            } finally {
                ratingBusy = false
            }
        }
    }

    /** Peta sebaran: marker ringan + total (replikasi warga/peta.tsx). */
    fun loadMap(force: Boolean = false) {
        if (mapLoading) return
        if (!force && mapReports.isNotEmpty()) return
        viewModelScope.launch {
            mapLoading = true
            mapError = null
            try {
                when (val r = repo.mapData()) {
                    is DashboardResult.Success -> {
                        mapReports = r.data.reports.orEmpty()
                            .filter { it.latitude != null && it.longitude != null }
                        mapStatsTotal = r.data.stats?.total ?: mapReports.size
                    }
                    is DashboardResult.Error -> {
                        if (mapReports.isEmpty()) mapError = r.message
                    }
                }
            } catch (_: UnauthorizedException) {
                sessionExpired = true
            } catch (e: Exception) {
                if (mapReports.isEmpty()) mapError = e.message ?: "Gagal memuat peta."
            } finally {
                mapLoading = false
            }
        }
    }

    /** Sisa kuota harian (gate layar lapor). */
    fun loadRemaining() {
        viewModelScope.launch {
            try {
                when (val r = repo.remaining()) {
                    is DashboardResult.Success -> remaining = r.data
                    is DashboardResult.Error -> errorMessage = r.message
                }
            } catch (_: UnauthorizedException) {
                sessionExpired = true
            } catch (_: Exception) {
                // Kuota gagal dimuat → biarkan lapor jalan; server tetap menegakkan.
                remaining = null
            }
        }
    }
}
