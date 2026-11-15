package com.jalankita.app.feature.supervisor

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.jalankita.app.core.data.DashboardResult
import com.jalankita.app.core.data.InspectionRepository
import com.jalankita.app.core.data.UnauthorizedException
import com.jalankita.app.core.network.InspectionQueueCandidateDto
import dagger.hilt.android.lifecycle.HiltViewModel
import java.util.UUID
import javax.inject.Inject
import kotlinx.coroutines.launch

/**
 * Antrean inspeksi: memilih laporan yang belum punya assignment aktif lalu
 * memasukkannya ke sesi inspeksi milik satu `SurveyTask` (`survey_task_id`).
 *
 * Supervisor memakai ini dari detail sesi patroli: laporan yang diantrekan
 * langsung muncul sebagai tugas petugas pada `GET /inspection-tasks`.
 *
 * Sumber kandidat adalah `GET /inspection-queues/candidates`. Sebelumnya
 * daftar diambil dari `GET /reports?status=menunggu review` yang juga memuat
 * laporan yang sedang/sudah diinspeksi, sehingga setiap percobaan mengantrekan
 * ulang berakhir 409. Penyaringan sekarang dilakukan server.
 */
@HiltViewModel
class InspectionQueueViewModel @Inject constructor(
    private val inspectionRepo: InspectionRepository,
) : ViewModel() {

    var candidates by mutableStateOf<List<InspectionQueueCandidateDto>>(emptyList())
        private set
    var loading by mutableStateOf(false)
        private set
    var submitting by mutableStateOf(false)
        private set
    var error by mutableStateOf<String?>(null)
        private set
    var message by mutableStateOf<String?>(null)
        private set
    var sessionExpired by mutableStateOf(false)
        private set

    private var loaded = false

    // Idempotency key dipertahankan selama pilihan + task tidak berubah, supaya
    // retry setelah gagal jaringan tidak membuat sesi inspeksi kedua.
    private var retryKey: String? = null
    private var retrySignature: String? = null

    fun open() {
        if (!loaded && !loading) load()
    }

    fun load(force: Boolean = false) {
        if (loading || (loaded && !force)) return
        viewModelScope.launch {
            loading = true
            error = null
            try {
                when (val response = inspectionRepo.candidates(limit = CANDIDATE_LIMIT)) {
                    is DashboardResult.Success -> {
                        candidates = response.data
                        loaded = true
                    }
                    is DashboardResult.Error -> error = response.message
                }
            } catch (_: UnauthorizedException) {
                sessionExpired = true
            } catch (e: Exception) {
                error = e.message ?: "Gagal memuat kandidat inspeksi."
            } finally {
                loading = false
            }
        }
    }

    fun retry() = load(force = true)

    fun queue(taskId: String, reportIds: List<String>, onQueued: () -> Unit = {}) {
        if (submitting) return
        val ids = reportIds.distinct().sorted()
        if (ids.isEmpty()) {
            error = "Pilih minimal 1 laporan."
            return
        }
        if (taskId.isBlank()) {
            error = "Sesi patroli tidak diketahui."
            return
        }

        val signature = taskId + '|' + ids.joinToString(",")
        val key = if (signature == retrySignature && retryKey != null) {
            retryKey!!
        } else {
            UUID.randomUUID().toString().also {
                retrySignature = signature
                retryKey = it
            }
        }

        viewModelScope.launch {
            submitting = true
            error = null
            try {
                when (val response = inspectionRepo.queue(taskId, ids, key)) {
                    is DashboardResult.Success -> {
                        // Server sudah menandai laporan `Ditugaskan`, jadi cukup
                        // muat ulang daftar agar kandidat tersisa akurat.
                        candidates = candidates.filterNot { it.id in ids }
                        message = "${ids.size} laporan masuk antrean inspeksi."
                        retryKey = null
                        retrySignature = null
                        onQueued()
                        load(force = true)
                    }
                    is DashboardResult.Error -> error = response.message
                }
            } catch (_: UnauthorizedException) {
                sessionExpired = true
            } catch (e: Exception) {
                error = e.message ?: "Gagal mengantrekan laporan."
            } finally {
                submitting = false
            }
        }
    }

    fun consumeError() {
        error = null
    }

    fun consumeMessage() {
        message = null
    }

    private companion object {
        const val CANDIDATE_LIMIT = 30
    }
}
