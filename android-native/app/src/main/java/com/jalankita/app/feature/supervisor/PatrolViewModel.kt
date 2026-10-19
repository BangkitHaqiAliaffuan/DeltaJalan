package com.jalankita.app.feature.supervisor

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.jalankita.app.core.data.DashboardResult
import com.jalankita.app.core.data.PatrolRepository
import com.jalankita.app.core.data.UnauthorizedException
import com.jalankita.app.core.network.PATROL_MIN_HARI
import com.jalankita.app.core.network.PatrolPreview
import com.jalankita.app.core.network.PatrolSchedule
import com.jalankita.app.core.network.PatrolScheduleRequest
import com.jalankita.app.core.network.TeamDto
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.launch
import java.time.LocalDate
import javax.inject.Inject

/**
 * Form state jadwal patroli — dipakai modal create & edit.
 * `kecamatanList` diisi otomatis dari wilayah UPTD tim (bukan input manual user).
 */
data class PatrolFormState(
    val teamId: String = "",
    val hari: List<String> = emptyList(),
    val kecamatanList: List<String> = emptyList(),
    val frekuensi: String = "setiap_minggu",
    val startDate: String = LocalDate.now().toString(),
    val endDate: String = "",
    val alasanTugas: String = "rutin",
) {
    /** Validasi klien — server butuh hari ≥ 3 (lihat PATROL_MIN_HARI). */
    fun validate(): String? = when {
        teamId.isBlank() -> "Pilih tim satgas."
        hari.size < PATROL_MIN_HARI -> "Pilih minimal $PATROL_MIN_HARI hari dalam seminggu."
        kecamatanList.isEmpty() -> "Kecamatan belum terisi (tim belum punya wilayah UPTD)."
        startDate.isBlank() -> "Tanggal mulai wajib diisi."
        else -> null
    }
}

/**
 * State jadwal patroli supervisor — replikasi usePatrolScheduleQueries.ts + index.tsx.
 * Hanya menyentuh endpoint patrol supervisor (isolasi role).
 */
@HiltViewModel
class PatrolViewModel @Inject constructor(
    private val repo: PatrolRepository,
    private val supervisorRepo: com.jalankita.app.core.data.SupervisorRepository,
) : ViewModel() {

    // ── Daftar ─────────────────────────────────────────────────────────────
    var schedules by mutableStateOf<List<PatrolSchedule>>(emptyList())
        private set
    var listLoading by mutableStateOf(true)
        private set
    var refreshing by mutableStateOf(false)
        private set

    /** Tim untuk picker (dari SupervisorRepository.teams — sudah termasuk uptd.kecamatan_wilayah). */
    var teams by mutableStateOf<List<TeamDto>>(emptyList())
        private set

    // ── Detail ─────────────────────────────────────────────────────────────
    var detail by mutableStateOf<PatrolSchedule?>(null)
        private set
    var detailLoading by mutableStateOf(false)
        private set

    // ── Preview ────────────────────────────────────────────────────────────
    var preview by mutableStateOf<PatrolPreview?>(null)
        private set
    var previewLoading by mutableStateOf(false)
        private set

    // ── Mutasi ─────────────────────────────────────────────────────────────
    var busy by mutableStateOf(false)
        private set
    var message by mutableStateOf<String?>(null)
        private set

    var errorMessage by mutableStateOf<String?>(null)
        private set
    var sessionExpired by mutableStateOf(false)
        private set

    fun consumeError() { errorMessage = null }
    fun consumeMessage() { message = null }
    fun clearPreview() { preview = null }

    /** Tim yang belum punya jadwal aktif (untuk picker create — server 409 bila duplikat). */
    fun availableTeams(): List<TeamDto> {
        val activeTeamIds = schedules.filter { it.status == "aktif" }.mapNotNull { it.teamId }.toSet()
        return teams.filter { it.id !in activeTeamIds }
    }

    // ── Muat ───────────────────────────────────────────────────────────────

    /** Muat daftar jadwal + tim. `force` untuk pull-to-refresh. */
    fun load(force: Boolean = false) {
        if (refreshing && !force) return
        viewModelScope.launch {
            if (schedules.isEmpty()) listLoading = true else refreshing = true
            try {
                when (val r = repo.list()) {
                    is DashboardResult.Success -> schedules = r.data
                    is DashboardResult.Error -> if (schedules.isEmpty()) errorMessage = r.message
                }
                when (val t = supervisorRepo.teams()) {
                    is DashboardResult.Success -> teams = t.data
                    is DashboardResult.Error -> Unit
                }
            } catch (_: UnauthorizedException) {
                sessionExpired = true
            } catch (e: Exception) {
                if (schedules.isEmpty()) errorMessage = e.message
            } finally {
                listLoading = false
                refreshing = false
            }
        }
    }

    /** Muat detail jadwal (kalender + surveyTasks). */
    fun loadDetail(id: String) {
        viewModelScope.launch {
            detail = null
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

    /** Preview estimasi shift (endpoint GET). Diam-diam diabaikan bila gagal. */
    fun loadPreview(form: PatrolFormState) {
        if (form.validate() != null) {
            preview = null
            return
        }
        viewModelScope.launch {
            previewLoading = true
            try {
                when (val r = repo.preview(
                    startDate = form.startDate,
                    endDate = form.endDate.takeIf { it.isNotBlank() },
                    frekuensi = form.frekuensi,
                    hari = form.hari,
                    kecamatanList = form.kecamatanList,
                )) {
                    is DashboardResult.Success -> preview = r.data
                    is DashboardResult.Error -> preview = null
                }
            } catch (_: UnauthorizedException) {
                sessionExpired = true
            } catch (_: Exception) {
                preview = null
            } finally {
                previewLoading = false
            }
        }
    }

    // ── Mutasi ─────────────────────────────────────────────────────────────

    /** Buat jadwal. Sukses → refresh daftar + pesan. */
    fun create(form: PatrolFormState, onDone: () -> Unit = {}) {
        val err = form.validate()
        if (err != null) { errorMessage = err; return }
        runMutation(onDone) {
            repo.create(
                PatrolScheduleRequest(
                    teamId = form.teamId,
                    hari = form.hari,
                    kecamatanList = form.kecamatanList,
                    frekuensi = form.frekuensi,
                    startDate = form.startDate,
                    endDate = form.endDate.takeIf { it.isNotBlank() },
                    alasanTugas = form.alasanTugas,
                ),
            )
        }
    }

    /** Perbarui jadwal. */
    fun update(id: String, form: PatrolFormState, onDone: () -> Unit = {}) {
        val err = form.validate()
        if (err != null) { errorMessage = err; return }
        runMutation(onDone) {
            repo.update(
                id,
                PatrolScheduleRequest(
                    teamId = form.teamId,
                    hari = form.hari,
                    kecamatanList = form.kecamatanList,
                    frekuensi = form.frekuensi,
                    startDate = form.startDate,
                    endDate = form.endDate.takeIf { it.isNotBlank() },
                    alasanTugas = form.alasanTugas,
                ),
            )
        }
    }

    /** Aktif/nonaktif jadwal. */
    fun toggle(id: String) {
        runMutation {
            repo.toggle(id)
        }
    }

    /** Hapus jadwal. */
    fun delete(id: String, onDone: () -> Unit = {}) {
        runMutation(onDone) { repo.delete(id) }
    }

    /** Generate shift untuk rentang tanggal. */
    fun generate(id: String, startDate: String, endDate: String, onDone: () -> Unit = {}) {
        if (startDate.isBlank() || endDate.isBlank()) {
            errorMessage = "Isi dari dan sampai tanggal."
            return
        }
        runMutation(onDone) { repo.generate(id, startDate, endDate) }
    }

    /**
     * Jalankan mutasi yang mengembalikan pesan sukses. Sukses → set `message`,
     * muat ulang daftar/detail, lalu panggil `onDone()`. Gagal → `errorMessage`.
     */
    private fun runMutation(onDone: () -> Unit = {}, block: suspend () -> DashboardResult<String>) {
        if (busy) return
        viewModelScope.launch {
            busy = true
            try {
                when (val r = block()) {
                    is DashboardResult.Success -> {
                        message = r.data
                        onDone()
                        load(force = true)
                        detail?.let { loadDetail(it.id) }
                    }
                    is DashboardResult.Error -> errorMessage = r.message
                }
            } catch (_: UnauthorizedException) {
                sessionExpired = true
            } catch (e: Exception) {
                errorMessage = e.message
            } finally {
                busy = false
            }
        }
    }
}
