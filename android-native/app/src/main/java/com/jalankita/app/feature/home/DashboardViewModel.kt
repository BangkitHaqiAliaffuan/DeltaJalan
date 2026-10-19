package com.jalankita.app.feature.home

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import android.content.Context
import android.net.Uri
import com.jalankita.app.core.data.DashboardRepository
import com.jalankita.app.core.data.DashboardResult
import com.jalankita.app.core.data.HistoryPage
import com.jalankita.app.core.data.ReportRepository
import com.jalankita.app.core.data.ReportResult
import com.jalankita.app.core.data.SurveyRepository
import com.jalankita.app.core.data.UnauthorizedException
import com.jalankita.app.core.network.PatrolScheduleDto
import com.jalankita.app.core.network.ProgressItemDto
import com.jalankita.app.core.network.ReportItemDto
import com.jalankita.app.core.network.StatsDto
import com.jalankita.app.core.network.SurveyTask
import com.jalankita.app.core.network.UpdateReportRequest
import com.jalankita.app.core.network.UserDto
import com.jalankita.app.core.util.ExifValidator
import com.jalankita.app.core.util.ImageCompressor
import dagger.hilt.android.lifecycle.HiltViewModel
import java.io.File
import java.util.Calendar
import kotlinx.coroutines.async
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * State dashboard Beranda petugas — replikasi src/routes/home.tsx.
 * Interval refresh mengikuti web: stats ~30 dtk, recent ~120 dtk →
 * layar memicu [refresh] berkala tiap 60 dtk saat tampil.
 */
@HiltViewModel
class DashboardViewModel @Inject constructor(
    private val repo: DashboardRepository,
    private val surveyRepo: SurveyRepository,
    private val execRepo: ReportRepository,
) : ViewModel() {

    var stats by mutableStateOf<StatsDto?>(null)
        private set
    var recent by mutableStateOf<List<ReportItemDto>>(emptyList())
        private set
    var teamTasks by mutableStateOf<List<ReportItemDto>>(emptyList())
        private set
    var schedules by mutableStateOf<List<PatrolScheduleDto>>(emptyList())
        private set

    var loading by mutableStateOf(true)
        private set
    var refreshing by mutableStateOf(false)
        private set
    /** Pesan error non-401 untuk snackbar (web menelan error; native menampilkannya). */
    var errorMessage by mutableStateOf<String?>(null)
        private set
    /** true bila 401 — MainActivity mengarahkan ke login. */
    var sessionExpired by mutableStateOf(false)
        private set

    // ── Riwayat (tab Laporan) ──────────────────────────────────────────────
    var history by mutableStateOf<List<ReportItemDto>>(emptyList())
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

    // ── Detail read-only ───────────────────────────────────────────────────
    var detail by mutableStateOf<ReportItemDto?>(null)
        private set
    var detailLoading by mutableStateOf(false)
        private set

    // ── Peta (tab PETA petugas) ────────────────────────────────────────────
    var mapReports by mutableStateOf<List<com.jalankita.app.core.network.MapReportDto>>(emptyList())
        private set
    var mapStatsTotal by mutableStateOf(0)
        private set
    var mapLoading by mutableStateOf(false)
        private set
    var mapError by mutableStateOf<String?>(null)
        private set

    fun consumeError() { errorMessage = null }

    /**
     * Muat ulang seluruh kartu Beranda paralel (stats + recent + tasks + patrol).
     * Dipakai saat pertama tampil, pull-to-refresh, dan interval berkala.
     */
    fun refresh(user: UserDto, force: Boolean = false) {
        if (refreshing && !force) return
        viewModelScope.launch {
            if (stats == null) loading = true else refreshing = true
            try {
                val statsD = async { repo.stats() }
                val recentD = async { repo.myReports(limit = 10) }
                val tasksD = async { repo.teamTasks(limit = 3) }
                val patrolD = async { repo.patrolSchedules(user.teamId) }

                var failed: String? = null
                when (val r = statsD.await()) {
                    is DashboardResult.Success -> stats = r.data
                    is DashboardResult.Error -> failed = r.message
                }
                when (val r = recentD.await()) {
                    is DashboardResult.Success -> recent = r.data
                    is DashboardResult.Error -> failed = r.message
                }
                when (val r = tasksD.await()) {
                    is DashboardResult.Success -> teamTasks = r.data
                    is DashboardResult.Error -> failed = r.message
                }
                when (val r = patrolD.await()) {
                    is DashboardResult.Success -> schedules = r.data
                    is DashboardResult.Error -> failed = r.message
                }
                // Hanya tampilkan error bila SEMUA sumber gagal (parsial tetap tampil).
                if (stats == null && recent.isEmpty() && teamTasks.isEmpty()) {
                    errorMessage = failed
                }
            } catch (_: UnauthorizedException) {
                sessionExpired = true
            } catch (e: Exception) {
                if (stats == null) errorMessage = e.message
            } finally {
                loading = false
                refreshing = false
            }
        }
    }

    /** Tugas aktif: status Ditugaskan/Sedang Diperbaiki, maks 3 (home.tsx:123-125). */
    val activeTasks: List<ReportItemDto>
        get() = teamTasks
            .filter { it.status == "Ditugaskan" || it.status == "Sedang Diperbaiki" }
            .take(3)

    var allTeamTasks by mutableStateOf<List<ReportItemDto>>(emptyList())
        private set
    var allTeamTasksLoading by mutableStateOf(false)
        private set

    /** Daftar penuh tugas tim untuk tab Tugas (melebihi limit=3 Beranda). */
    fun loadAllTeamTasks() {
        if (allTeamTasksLoading) return
        viewModelScope.launch {
            allTeamTasksLoading = true
            try {
                when (val r = repo.teamTasks(limit = 20)) {
                    is DashboardResult.Success -> allTeamTasks = r.data
                    is DashboardResult.Error -> errorMessage = r.message
                }
            } catch (_: UnauthorizedException) {
                sessionExpired = true
            } catch (e: Exception) {
                errorMessage = e.message
            } finally {
                allTeamTasksLoading = false
            }
        }
    }

    /** 5 laporan terbaru (home.tsx:428). */
    val latestFive: List<ReportItemDto>
        get() = recent.take(5)

    // ── Sesi patroli (cek rutin) — untuk tab Tugas petugas ────────────────

    /** Daftar sesi patroli tim (GET /survei; server scope team_id petugas). */
    var surveys by mutableStateOf<List<SurveyTask>>(emptyList())
        private set
    var surveysLoading by mutableStateOf(false)
        private set

    /** Detail sesi terpilih + laporan terkait. */
    var surveyDetail by mutableStateOf<SurveyTask?>(null)
        private set
    var surveyDetailLoading by mutableStateOf(false)
        private set

    /** Muat daftar sesi patroli tim. */
    fun loadSurveys() {
        if (surveysLoading) return
        viewModelScope.launch {
            surveysLoading = true
            try {
                when (val r = surveyRepo.list()) {
                    is DashboardResult.Success -> surveys = r.data
                    is DashboardResult.Error -> errorMessage = r.message
                }
            } catch (_: UnauthorizedException) {
                sessionExpired = true
            } catch (e: Exception) {
                errorMessage = e.message
            } finally {
                surveysLoading = false
            }
        }
    }

    /** Muat detail sesi patroli (untuk layar detail + refresh setelah lapor). */
    fun loadSurveyDetail(id: String) {
        viewModelScope.launch {
            surveyDetail = null
            surveyDetailLoading = true
            try {
                when (val r = surveyRepo.detail(id)) {
                    is DashboardResult.Success -> surveyDetail = r.data
                    is DashboardResult.Error -> errorMessage = r.message
                }
            } catch (_: UnauthorizedException) {
                sessionExpired = true
            } catch (e: Exception) {
                errorMessage = e.message
            } finally {
                surveyDetailLoading = false
            }
        }
    }

    fun clearSurveyDetail() { surveyDetail = null }

    /**
     * Segarkan sesi + daftar setelah laporan baru (padanan invalidateQueries web):
     * angka `reports_count` dan daftar laporan harus ikut bertambah.
     */
    fun refreshAfterLapor(surveyId: String) {
        loadSurveyDetail(surveyId)
        loadSurveys()
    }

    /** Muat halaman riwayat; reset=true mulai dari halaman 1 (ganti filter/cari). */
    fun loadHistory(reset: Boolean = false) {
        if (historyLoading) return
        viewModelScope.launch {
            historyLoading = true
            try {
                val page = if (reset) 1 else historyPage + 1
                if (reset) {
                    history = emptyList()
                    historyPage = 1
                }
                when (val r = repo.history(
                    limit = 20,
                    page = page,
                    status = historyFilter,
                    query = historyQuery,
                )) {
                    is DashboardResult.Success -> {
                        val p: HistoryPage = r.data
                        history = if (page == 1) p.items else history + p.items
                        historyTotal = p.total
                        historyPage = p.page
                        historyLastPage = p.lastPage
                    }
                    is DashboardResult.Error -> {
                        errorMessage = r.message
                    }
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
        loadHistory(reset = true)
    }

    fun updateHistoryQuery(q: String) {
        historyQuery = q
    }

    fun submitHistoryQuery() = loadHistory(reset = true)

    /** Muat detail satu laporan untuk layar read-only. */
    fun loadDetail(id: String) {
        viewModelScope.launch {
            detail = null
            detailLoading = true
            try {
                when (val r = repo.detail(id)) {
                    is DashboardResult.Success -> detail = r.data
                    is DashboardResult.Error -> {
                        errorMessage = r.message
                    }
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

    // ── Eksekusi lapangan (Mulai / Progress / Selesai / Edit / Hapus) ───────
    // Pola error mengikuti ReportRepository.parseError: pesan server tampil
    // apa adanya (termasuk 403 beda tim / 422 status / error_code EXIF).

    /** true saat aksi tulis berjalan (tombol dikunci). */
    var actionLoading by mutableStateOf(false)
        private set
    /** Pesan error aksi terakhir untuk snackbar/dialog. */
    var actionError by mutableStateOf<String?>(null)
        private set
    /** Pesan sukses aksi terakhir untuk snackbar. */
    var actionSuccess by mutableStateOf<String?>(null)
        private set
    /** Riwayat progres laporan terbuka (timeline pengerjaan). */
    var progressList by mutableStateOf<List<ProgressItemDto>>(emptyList())
        private set
    var progressLoading by mutableStateOf(false)
        private set

    fun consumeActionError() { actionError = null }
    fun consumeActionSuccess() { actionSuccess = null }

    /** Segarkan detail + daftar setelah mutasi (padanan invalidateQueries web). */
    private fun refreshAfterMutation(id: String) {
        loadDetail(id)
        loadHistory(reset = true)
        loadAllTeamTasks()
        // Kartu Beranda (activeTasks/latestFive) memakai teamTasks/recent —
        // tanpa ini kartu tetap berstatus lama dan sukses terlihat seperti gagal.
        refreshHomeLists()
    }

    /** Muat ulang kartu Beranda (teamTasks limit 3 + recent) setelah mutasi. */
    private fun refreshHomeLists() {
        viewModelScope.launch {
            when (val r = repo.teamTasks(limit = 3)) {
                is DashboardResult.Success -> teamTasks = r.data
                is DashboardResult.Error -> Unit
            }
            when (val r = repo.myReports(limit = 10)) {
                is DashboardResult.Success -> recent = r.data
                is DashboardResult.Error -> Unit
            }
        }
    }

    private fun fail(e: Throwable, fallback: String) {
        actionError = e.message ?: fallback
    }

    /** POST mulai — Ditugaskan → Sedang Diperbaiki. */
    fun mulai(id: String, estimasiHari: Int?, catatan: String?) {
        if (actionLoading) return
        viewModelScope.launch {
            actionLoading = true
            try {
                when (val r = execRepo.mulai(id, catatan, estimasiHari)) {
                    is ReportResult.Success -> {
                        actionSuccess = "Perbaikan telah dimulai."
                        refreshAfterMutation(id)
                    }
                    is ReportResult.Error -> actionError = r.error.message
                }
            } catch (_: UnauthorizedException) {
                sessionExpired = true
            } catch (e: Exception) {
                fail(e, "Gagal memulai pengerjaan.")
            } finally {
                actionLoading = false
            }
        }
    }

    /**
     * Siapkan foto galeri untuk upload progres/after: validasi tanggal EXIF
     * DULU (kompresi membuang EXIF), lalu kompres. Null bila ditolak —
     * [actionError] sudah diisi pesan yang siap tampil.
     */
    fun siapkanFoto(
        context: Context,
        uri: Uri,
        checkDate: Boolean,
    ): File? {
        if (checkDate) {
            val v = ExifValidator.validate(context, uri, requireGps = false, checkDate = true)
            if (!v.isValid) {
                actionError = v.message
                return null
            }
        }
        return ImageCompressor.compressToFile(context, uri)
            ?: run { actionError = "Gagal memproses foto. Coba lagi."; null }
    }

    /** POST progress — upload 1 foto + catatan (status harus Sedang Diperbaiki). */
    fun kirimProgress(id: String, foto: File, catatan: String?) {
        if (actionLoading) return
        viewModelScope.launch {
            actionLoading = true
            try {
                when (val r = execRepo.uploadProgress(id, foto, catatan)) {
                    is ReportResult.Success -> {
                        actionSuccess = "Progress berhasil diupdate."
                        refreshAfterMutation(id)
                        muatProgress(id)
                    }
                    is ReportResult.Error -> actionError = r.error.message
                }
            } catch (_: UnauthorizedException) {
                sessionExpired = true
            } catch (e: Exception) {
                fail(e, "Gagal mengunggah progres.")
            } finally {
                actionLoading = false
            }
        }
    }

    /** POST complete — selesaikan dengan ≥1 foto after (status harus Sedang Diperbaiki). */
    fun selesaikan(id: String, foto: List<File>, catatan: String?) {
        if (actionLoading) return
        viewModelScope.launch {
            actionLoading = true
            try {
                when (val r = execRepo.complete(id, foto, catatan)) {
                    is ReportResult.Success -> {
                        actionSuccess = "Laporan berhasil diselesaikan."
                        refreshAfterMutation(id)
                    }
                    is ReportResult.Error -> actionError = r.error.message
                }
            } catch (_: UnauthorizedException) {
                sessionExpired = true
            } catch (e: Exception) {
                fail(e, "Gagal menyelesaikan laporan.")
            } finally {
                actionLoading = false
            }
        }
    }

    /** GET progress — muat riwayat untuk timeline. */
    fun muatProgress(id: String) {
        viewModelScope.launch {
            progressLoading = true
            try {
                when (val r = execRepo.progress(id)) {
                    is ReportResult.Success -> progressList = r.data
                    is ReportResult.Error -> progressList = emptyList()
                }
            } catch (_: Exception) {
                progressList = emptyList()
            } finally {
                progressLoading = false
            }
        }
    }

    fun clearProgress() { progressList = emptyList() }

    // ── Edit draft (Menunggu Review ↔ Diedit) ────────────────────────────────

    /** POST mulai-edit — kunci draft. True bila sukses (panggil lanjutkan PUT). */
    fun mulaiEdit(id: String, onOk: () -> Unit) {
        if (actionLoading) return
        viewModelScope.launch {
            actionLoading = true
            try {
                when (val r = execRepo.mulaiEdit(id)) {
                    is ReportResult.Success -> {
                        loadDetail(id)
                        onOk()
                    }
                    is ReportResult.Error -> actionError = r.error.message
                }
            } catch (_: UnauthorizedException) {
                sessionExpired = true
            } catch (e: Exception) {
                fail(e, "Laporan tidak dapat diedit.")
            } finally {
                actionLoading = false
            }
        }
    }

    /** PUT update — simpan perubahan lalu kembali ke Menunggu Review. */
    fun simpanEdit(id: String, body: UpdateReportRequest) {
        if (actionLoading) return
        viewModelScope.launch {
            actionLoading = true
            try {
                when (val r = execRepo.updateReport(id, body)) {
                    is ReportResult.Success -> {
                        actionSuccess = "Laporan berhasil diperbarui."
                        refreshAfterMutation(id)
                    }
                    is ReportResult.Error -> actionError = r.error.message
                }
            } catch (_: UnauthorizedException) {
                sessionExpired = true
            } catch (e: Exception) {
                fail(e, "Gagal menyimpan perubahan.")
            } finally {
                actionLoading = false
            }
        }
    }

    /** POST batal-edit — Diedit → Menunggu Review. */
    fun batalEdit(id: String) {
        if (actionLoading) return
        viewModelScope.launch {
            actionLoading = true
            try {
                when (val r = execRepo.batalEdit(id)) {
                    is ReportResult.Success -> refreshAfterMutation(id)
                    is ReportResult.Error -> actionError = r.error.message
                }
            } catch (_: UnauthorizedException) {
                sessionExpired = true
            } catch (e: Exception) {
                fail(e, "Gagal membatalkan edit.")
            } finally {
                actionLoading = false
            }
        }
    }

    /** DELETE laporan sendiri — sukses → [onOk] (kembali + segarkan daftar). */
    fun hapus(id: String, onOk: () -> Unit) {
        if (actionLoading) return
        viewModelScope.launch {
            actionLoading = true
            try {
                when (val r = execRepo.hapus(id)) {
                    is ReportResult.Success -> {
                        actionSuccess = "Laporan berhasil dihapus."
                        loadHistory(reset = true)
                        loadAllTeamTasks()
                        onOk()
                    }
                    is ReportResult.Error -> actionError = r.error.message
                }
            } catch (_: UnauthorizedException) {
                sessionExpired = true
            } catch (e: Exception) {
                fail(e, "Gagal menghapus laporan.")
            } finally {
                actionLoading = false
            }
        }
    }

    /**
     * Muat sebaran peta (GET /reports/map-data) — pola WargaViewModel.loadMap.
     * Hanya marker berkoordinat yang dipakai; error hanya tampil bila daftar kosong.
     */
    fun loadMap(force: Boolean = false) {
        if (mapLoading) return
        if (!force && mapReports.isNotEmpty()) return
        viewModelScope.launch {
            mapLoading = true
            mapError = null
            try {
                when (val r = repo.mapData()) {
                    is DashboardResult.Success -> {
                        val items = r.data.reports.orEmpty()
                            .filter { it.latitude != null && it.longitude != null }
                        mapReports = items
                        mapStatsTotal = r.data.stats?.total ?: items.size
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
}


/** Sapaan berbasis jam — replikasi home.tsx:155-162. */
fun greetingForNow(): String {
    return when (Calendar.getInstance().get(Calendar.HOUR_OF_DAY)) {
        in 0..9 -> "Selamat Pagi"
        in 10..14 -> "Selamat Siang"
        else -> "Selamat Sore"
    }
}
