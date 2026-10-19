package com.jalankita.app.feature.supervisor

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.jalankita.app.core.data.DashboardResult
import com.jalankita.app.core.data.SupervisorRepository
import com.jalankita.app.core.data.TriageException
import com.jalankita.app.core.data.TriageOutcome
import com.jalankita.app.core.data.UnauthorizedException
import com.jalankita.app.core.network.PciOverviewData
import com.jalankita.app.core.network.ReportItemDto
import com.jalankita.app.core.network.SupervisorRegionsData
import com.jalankita.app.core.network.SupervisorReportDetail
import com.jalankita.app.core.network.SupervisorStatsDto
import com.jalankita.app.core.network.TeamDto
import com.jalankita.app.core.network.TeamStatsDto
import com.jalankita.app.core.util.ReportDownloader
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.io.File
import javax.inject.Inject

/** Status yang boleh disetujui/ditolak (transisi ketat server). */
private val TRIAGE_STATUSES = setOf("Menunggu Review", "Ditinjau")

/**
 * State supervisor — replikasi supervisor/index.tsx + review.tsx + detail-report.tsx.
 * Hanya menyentuh endpoint supervisor (isolasi role, lihat SupervisorRepository).
 *
 * CATATAN scope server: `GET /reports` = `assigned_supervisor_id = me OR NULL`;
 * `stats` = `me` SAJA (lebih sempit) — angka kedua endpoint sengaja berbeda.
 */
@HiltViewModel
class SupervisorViewModel @Inject constructor(
    private val repo: SupervisorRepository,
    private val downloader: ReportDownloader,
) : ViewModel() {

    // ── Dashboard ──────────────────────────────────────────────────────────
    var regions by mutableStateOf<SupervisorRegionsData?>(null)
        private set
    var stats by mutableStateOf<SupervisorStatsDto?>(null)
        private set
    var pci by mutableStateOf<PciOverviewData?>(null)
        private set
    var teams by mutableStateOf<List<TeamDto>>(emptyList())
        private set
    var teamStats by mutableStateOf<List<TeamStatsDto>>(emptyList())
        private set
    var dashboardLoading by mutableStateOf(false)
        private set
    var refreshing by mutableStateOf(false)
        private set

    // ── List triase ────────────────────────────────────────────────────────
    var reports by mutableStateOf<List<ReportItemDto>>(emptyList())
        private set
    var listLoading by mutableStateOf(false)
        private set
    var listTotal by mutableStateOf(0)
        private set
    var listPage by mutableStateOf(1)
        private set
    var listLastPage by mutableStateOf(1)
        private set
    /** Filter status awal = tab default "menunggu" agar tab & data konsisten sejak awal. */
    var filterStatus by mutableStateOf<String?>("Menunggu Review")
        private set
    var filterSource by mutableStateOf<String?>(null)
        private set
    var sortBy by mutableStateOf("deadline_review")
        private set
    var query by mutableStateOf("")
        private set

    /** Tab aktif dashboard — "menunggu"/"disetujui"/"ditugaskan"/"sedang_diperbaiki"/"ditolak"/"semua". */
    var tabKey by mutableStateOf("menunggu")
        private set

    // ── Detail ─────────────────────────────────────────────────────────────
    var detail by mutableStateOf<SupervisorReportDetail?>(null)
        private set
    var detailLoading by mutableStateOf(false)
        private set

    // ── Aksi ───────────────────────────────────────────────────────────────
    var actionBusy by mutableStateOf(false)
        private set
    var actionMessage by mutableStateOf<String?>(null)
        private set
    /** true bila aksi butuh picker tim (422 `needs_team` dari approve-and-assign). */
    var needsTeam by mutableStateOf(false)
        private set

    // ── Seleksi massal (bulk triage) ───────────────────────────────────────
    var selectionMode by mutableStateOf(false)
        private set
    var selectedIds by mutableStateOf<Set<String>>(emptySet())
        private set
    var bulkBusy by mutableStateOf(false)
        private set

    /** Hasil pengukuran/debug: total marker peta (bila peta dibuka). */
    var mapTotal by mutableStateOf(0)
        private set

    var errorMessage by mutableStateOf<String?>(null)
        private set
    var sessionExpired by mutableStateOf(false)
        private set

    private var searchJob: Job? = null
    private var autoRefreshJob: Job? = null
    private var listJob: Job? = null

    fun consumeError() { errorMessage = null }
    fun consumeMessage() { actionMessage = null }
    fun clearNeedsTeam() { needsTeam = false }

    // ── Dashboard ──────────────────────────────────────────────────────────
    private var dashboardJob: kotlinx.coroutines.Job? = null

    /** Muat seluruh data dashboard supervisor (regions/stats/pci/teams/teamStats). */
    fun loadDashboard(force: Boolean = false) {
        if (dashboardLoading && !force) return
        dashboardJob?.cancel()
        dashboardJob = viewModelScope.launch {
            if (regions == null && stats == null) dashboardLoading = true else refreshing = true
            try {
                when (val r = repo.regions()) {
                    is DashboardResult.Success -> regions = r.data
                    is DashboardResult.Error -> if (regions == null) errorMessage = r.message
                }
                when (val r = repo.stats()) {
                    is DashboardResult.Success -> stats = r.data
                    is DashboardResult.Error -> Unit
                }
                when (val r = repo.pciOverview()) {
                    is DashboardResult.Success -> pci = r.data
                    is DashboardResult.Error -> Unit
                }
                when (val r = repo.teams()) {
                    is DashboardResult.Success -> teams = r.data
                    is DashboardResult.Error -> Unit
                }
                when (val r = repo.statsByTeam()) {
                    is DashboardResult.Success -> teamStats = r.data
                    is DashboardResult.Error -> Unit
                }
            } catch (_: UnauthorizedException) {
                sessionExpired = true
            } catch (e: Exception) {
                if (regions == null) errorMessage = e.message
            } finally {
                dashboardLoading = false
                refreshing = false
            }
        }
    }

    // ── List triase ────────────────────────────────────────────────────────

    /**
     * Muat/append daftar triase.
     * - `reset = true`  → mulai dari halaman 1 (filter/pencarian baru, pull-to-refresh).
     * - `overridePage`  → lompat ke halaman tertentu (paginasi).
     * - keduanya kosong → append halaman berikutnya (infinite scroll).
     *
     * CATATAN: `listPage` TIDAK boleh di-set di pemanggil sebelum fungsi ini —
     * fungsi ini yang menentukan halaman & menyimpan hasilnya. Sempat ada bug:
     * pemanggil men-set `listPage = 1` lalu memanggil `loadReports()` (tanpa reset),
     * sehingga halaman dihitung `1 + 1 = 2` → data kosong.
     */
    fun loadReports(reset: Boolean = false, overridePage: Int? = null) {
        // Request baru membatalkan yang lama agar filter terakhir yang menang
        // (mencegah guard listLoading membuat klik tab diabaikan → layar kosong).
        listJob?.cancel()
        listJob = viewModelScope.launch {
            listLoading = true
            try {
                val page = when {
                    overridePage != null -> overridePage
                    reset -> 1
                    else -> listPage + 1
                }
                when (val r = repo.reports(
                    status = filterStatus,
                    query = query,
                    source = filterSource,
                    sortBy = sortBy.takeIf { it.isNotBlank() },
                    limit = PAGE_SIZE,
                    page = page,
                )) {
                    is DashboardResult.Success -> {
                        val items = r.data.data.orEmpty()
                        // Halaman 1 ATAU lompat halaman eksplisit → GANTI daftar.
                        // Hanya append saat memuat halaman berikutnya tanpa override.
                        reports = if (page == 1 || overridePage != null) items else reports + items
                        listTotal = r.data.total
                        listPage = r.data.page
                        listLastPage = r.data.lastPage
                    }
                    is DashboardResult.Error -> errorMessage = r.message
                }
            } catch (_: kotlinx.coroutines.CancellationException) {
                // Dibatalkan oleh request yang lebih baru — jangan sentuh state.
                throw kotlinx.coroutines.CancellationException("loadReports superseded")
            } catch (_: UnauthorizedException) {
                sessionExpired = true
            } catch (e: Exception) {
                errorMessage = e.message
            } finally {
                listLoading = false
            }
        }
    }

    /** Filter status baru → selalu reset ke halaman 1. Reload juga bila daftar kosong. */
    fun applyStatusFilter(status: String?) {
        if (filterStatus == status && reports.isNotEmpty()) return
        filterStatus = status
        reports = emptyList()
        loadReports(reset = true)
    }

    /** Filter sumber baru → selalu reset ke halaman 1. Reload juga bila daftar kosong. */
    fun applySourceFilter(source: String?) {
        if (filterSource == source && reports.isNotEmpty()) return
        filterSource = source
        reports = emptyList()
        loadReports(reset = true)
    }

    /**
     * Pilih tab dashboard — map ke status + sort (port index.tsx filter per tab):
     * menunggu→sort deadline_review; sedang_diperbaiki→sort deadline_resolusi;
     * ditugaskan/ditolak/semua→tanpa sort (default server).
     */
    fun selectTab(key: String) {
        if (tabKey == key && reports.isNotEmpty()) return
        tabKey = key
        filterStatus = when (key) {
            "menunggu" -> "Menunggu Review"
            "disetujui" -> "Disetujui"
            "ditugaskan" -> "Ditugaskan"
            "sedang_diperbaiki" -> "Sedang Diperbaiki"
            "ditolak" -> "Ditolak"
            else -> null
        }
        sortBy = when (key) {
            "menunggu" -> "deadline_review"
            "sedang_diperbaiki" -> "deadline_resolusi"
            else -> ""
        }
        reports = emptyList()
        loadReports(reset = true)
    }

    /** Lompat ke halaman tertentu (paginasi prev/next). */
    fun goToPage(page: Int) {
        if (page < 1 || page > listLastPage || listLoading) return
        loadReports(reset = false, overridePage = page)
    }

    /** Debounce 500ms ala web (supervisor/index.tsx search TANPA debounce → native tambah). */
    fun updateQuery(q: String) {
        query = q
        searchJob?.cancel()
        searchJob = viewModelScope.launch {
            delay(500)
            reports = emptyList()
            loadReports(reset = true)
        }
    }

    fun submitQuery() {
        searchJob?.cancel()
        reports = emptyList()
        loadReports(reset = true)
    }

    /**
     * Auto-refresh list triase tiap [intervalMs] (default 30 dtk).
     * CATATAN: web TIDAK punya polling — ini keputusan desain native.
     * Scope ke pemanggil composable; jangan reset scroll/filter saat refresh.
     */
    fun startAutoRefresh(intervalMs: Long = 30_000L) {
        if (autoRefreshJob?.isActive == true) return
        autoRefreshJob = viewModelScope.launch {
            while (true) {
                delay(intervalMs)
                if (listLoading) continue
                loadReports(reset = true)
            }
        }
    }

    fun stopAutoRefresh() {
        autoRefreshJob?.cancel()
        autoRefreshJob = null
    }

    // ── Detail ─────────────────────────────────────────────────────────────

    /**
     * Buka detail: muat + auto `mulai-review` bila status Menunggu Review/Ditinjau.
     * `mulai-review` idempoten (status lain → 200 tanpa mutasi); ambil detail lagi
     * setelahnya bila status berubah agar timeline terbaru.
     */
    fun loadDetail(id: String) {
        viewModelScope.launch {
            detail = null
            detailLoading = true
            try {
                when (val r = repo.detail(id)) {
                    is DashboardResult.Success -> {
                        detail = r.data
                        val st = r.data.status
                        if (st != null && TRIAGE_STATUSES.contains(st)) {
                            // Idempoten — aman. Bila sukses, muat ulang agar status = Ditinjau.
                            when (repo.mulaiReview(id)) {
                                is DashboardResult.Success -> {
                                    val again = repo.detail(id)
                                    if (again is DashboardResult.Success) detail = again.data
                                }
                                is DashboardResult.Error -> Unit
                            }
                        }
                    }
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

    // ── Aksi triase ────────────────────────────────────────────────────────

    /**
     * Setujui — routing otomatis per `source` (repo). Bila 422 `needs_team`,
     * set flag agar UI membuka picker tim; simpan id untuk retry.
     */
    fun approve(
        id: String,
        source: String?,
        priority: String?,
        assignedTeamId: String? = null,
        onDone: (String?) -> Unit = {},
    ) {
        if (actionBusy) return
        viewModelScope.launch {
            actionBusy = true
            try {
                when (val r = repo.approve(id, source, priority, assignedTeamId)) {
                    is DashboardResult.Success -> {
                        needsTeam = false
                        actionMessage = "Laporan berhasil disetujui."
                        onDone(r.data.status)
                        afterTriageMutation()
                    }
                    is DashboardResult.Error -> errorMessage = r.message
                }
            } catch (e: TriageException) {
                if (e.needsTeam) {
                    needsTeam = true
                    actionMessage = e.message
                } else {
                    errorMessage = e.message
                }
            } catch (_: UnauthorizedException) {
                sessionExpired = true
            } catch (e: Exception) {
                errorMessage = e.message
            } finally {
                actionBusy = false
            }
        }
    }

    /** Tolak — alasan wajib (≤100), catatan opsional (≤500); client enforce. */
    fun tolak(id: String, alasan: String, catatan: String?, onDone: (String?) -> Unit = {}) {
        if (actionBusy) return
        viewModelScope.launch {
            actionBusy = true
            try {
                when (val r = repo.tolak(id, alasan, catatan)) {
                    is DashboardResult.Success -> {
                        actionMessage = "Laporan ditolak."
                        onDone(r.data.status)
                        afterTriageMutation()
                    }
                    is DashboardResult.Error -> errorMessage = r.message
                }
            } catch (e: TriageException) {
                errorMessage = e.message
            } catch (_: UnauthorizedException) {
                sessionExpired = true
            } catch (e: Exception) {
                errorMessage = e.message
            } finally {
                actionBusy = false
            }
        }
    }

    // ── Seleksi massal (bulk triage) ───────────────────────────────────────

    /** Toggle mode pilih; keluar mode → bersihkan seleksi. */
    fun toggleSelectionMode() {
        selectionMode = !selectionMode
        if (!selectionMode) selectedIds = emptySet()
    }

    fun toggleSelected(id: String) {
        selectedIds = if (selectedIds.contains(id)) selectedIds - id else selectedIds + id
    }

    fun clearSelection() { selectedIds = emptySet() }

    fun exitSelection() {
        selectionMode = false
        selectedIds = emptySet()
    }

    /**
     * Laporan boleh di-bulk-approve HANYA bila sumbernya petugas (atau null).
     * warga/telegram wajib lewat approve-and-assign per-laporan (pick tim),
     * jika tidak → berstatus Disetujui tanpa `assigned_team_id` (orphan).
     */
    fun isBulkApprovable(report: ReportItemDto): Boolean =
        report.source != "warga" && report.source != "telegram"

    /**
     * Setujui massal: hanya mengirim id laporan petugas; laporan warga/telegram
     * dalam seleksi dilewati dan dilaporkan jumlahnya.
     */
    fun bulkApproveSelected() {
        if (bulkBusy) return
        val selected = reports.filter { selectedIds.contains(it.id) }
        val approvable = selected.filter { isBulkApprovable(it) }
        val skipped = selected.size - approvable.size
        if (approvable.isEmpty()) {
            errorMessage = "Laporan warga/telegram tidak bisa disetujui massal — buka detail untuk tugaskan tim."
            return
        }
        viewModelScope.launch {
            bulkBusy = true
            try {
                when (val r = repo.bulkApprove(approvable.map { it.id })) {
                    is DashboardResult.Success -> {
                        actionMessage = buildString {
                            append("${r.data} laporan disetujui")
                            if (skipped > 0) append(" ($skipped warga/telegram dilewati — setujui manual).")
                            else append(".")
                        }
                        exitSelection()
                        afterTriageMutation()
                    }
                    is DashboardResult.Error -> errorMessage = r.message
                }
            } catch (_: UnauthorizedException) {
                sessionExpired = true
            } catch (e: Exception) {
                errorMessage = e.message
            } finally {
                bulkBusy = false
            }
        }
    }

    /** Tolak massal — `alasan` wajib (maks 500). */
    fun bulkTolakSelected(alasan: String) {
        if (bulkBusy) return
        if (selectedIds.isEmpty()) return
        if (alasan.isBlank()) {
            errorMessage = "Alasan penolakan wajib diisi."
            return
        }
        val ids = selectedIds.toList()
        viewModelScope.launch {
            bulkBusy = true
            try {
                when (val r = repo.bulkTolak(ids, alasan)) {
                    is DashboardResult.Success -> {
                        actionMessage = "${r.data} laporan ditolak."
                        exitSelection()
                        afterTriageMutation()
                    }
                    is DashboardResult.Error -> errorMessage = r.message
                }
            } catch (_: UnauthorizedException) {
                sessionExpired = true
            } catch (e: Exception) {
                errorMessage = e.message
            } finally {
                bulkBusy = false
            }
        }
    }

    /** Konfirmasi hasil AI → tugaskan tim. GUARD: hanya untuk source warga/telegram. */
    fun confirmAi(id: String, onDone: (String?) -> Unit = {}) {
        val src = detail?.source
        if (src != null && src != "warga" && src != "telegram") {
            errorMessage = "Konfirmasi AI hanya untuk laporan warga/telegram."
            return
        }
        if (actionBusy) return
        viewModelScope.launch {
            actionBusy = true
            try {
                when (val r = repo.confirmAi(id)) {
                    is DashboardResult.Success -> {
                        actionMessage = "Laporan dikonfirmasi & tim ditugaskan."
                        onDone(r.data.status)
                        afterTriageMutation()
                    }
                    is DashboardResult.Error -> errorMessage = r.message
                }
            } catch (e: TriageException) {
                // hardFail: tak ada retry manual di endpoint confirm-ai.
                errorMessage = if (e.hardFail) {
                    "${e.message} Arahkan ke detail untuk penugasan manual."
                } else {
                    e.message
                }
            } catch (_: UnauthorizedException) {
                sessionExpired = true
            } catch (e: Exception) {
                errorMessage = e.message
            } finally {
                actionBusy = false
            }
        }
    }

    /** Hapus laporan (supervisor; 4 status per kontrak backend). */
    fun deleteReport(id: String, onDone: () -> Unit = {}) {
        if (actionBusy) return
        viewModelScope.launch {
            actionBusy = true
            try {
                when (val r = repo.deleteReport(id)) {
                    is DashboardResult.Success -> {
                        actionMessage = "Laporan dihapus."
                        reports = reports.filterNot { it.id == id }
                        if (detail?.id == id) detail = null
                        onDone()
                        loadReports(reset = true)
                    }
                    is DashboardResult.Error -> errorMessage = r.message
                }
            } catch (_: UnauthorizedException) {
                sessionExpired = true
            } catch (e: Exception) {
                errorMessage = e.message
            } finally {
                actionBusy = false
            }
        }
    }

    /**
     * Setelah mutasi triase: refresh antrean + invalidasi stats.
     * (Drawer review web tidak memanggil mulai-review; status antrean tidak
     * berubah sendiri → butuh refresh eksplisit — lihat PLAN Risiko 2.)
     */
    private fun afterTriageMutation() {
        loadReports(reset = true)
        viewModelScope.launch {
            when (val r = repo.stats()) {
                is DashboardResult.Success -> stats = r.data
                is DashboardResult.Error -> Unit
            }
        }
    }

    fun loadMapTotal() {
        viewModelScope.launch {
            when (val r = repo.mapData()) {
                is DashboardResult.Success -> mapTotal = r.data.stats?.total ?: r.data.reports?.size ?: 0
                is DashboardResult.Error -> Unit
            }
        }
    }

    /** Ambil data peta (reports + total) untuk tab Peta supervisor. */
    suspend fun mapData(): DashboardResult<Pair<List<com.jalankita.app.core.network.MapReportDto>, Int>> {
        return try {
            when (val r = repo.mapData()) {
                is DashboardResult.Success -> {
                    val items = r.data.reports.orEmpty()
                        .filter { it.latitude != null && it.longitude != null }
                    DashboardResult.Success(items to (r.data.stats?.total ?: items.size))
                }
                is DashboardResult.Error -> DashboardResult.Error(r.message)
            }
        } catch (_: UnauthorizedException) {
            sessionExpired = true
            DashboardResult.Error("Sesi berakhir.")
        } catch (e: Exception) {
            DashboardResult.Error(e.message ?: "Gagal memuat peta.")
        }
    }

    var exportLoading by mutableStateOf(false)
        private set

    fun exportReport(format: String, month: Int, year: Int, onComplete: (File?) -> Unit = {}) {
        if (exportLoading) return
        exportLoading = true
        viewModelScope.launch {
            val result = downloader.downloadMonthlyReport(format, month, year)
            exportLoading = false
            result.onSuccess { file ->
                actionMessage = "Rekap ${format.uppercase()} berhasil diunduh."
                downloader.openFile(file)
                onComplete(file)
            }.onFailure { err ->
                errorMessage = "Gagal mengunduh rekap: ${err.message}"
                onComplete(null)
            }
        }
    }

    override fun onCleared() {
        stopAutoRefresh()
        super.onCleared()
    }

    companion object {
        const val PAGE_SIZE = 20
    }
}
