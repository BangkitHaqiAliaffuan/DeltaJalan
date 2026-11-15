package com.jalankita.app.feature.supervisor

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.jalankita.app.core.data.DashboardResult
import com.jalankita.app.core.data.InspectionRepository
import com.jalankita.app.core.data.UnauthorizedException
import com.jalankita.app.core.network.InspectionResultDto
import com.jalankita.app.core.network.InspectionReviewAction
import com.jalankita.app.core.network.InspectionReviewData
import kotlinx.coroutines.launch
import javax.inject.Inject
import dagger.hilt.android.lifecycle.HiltViewModel

@HiltViewModel
class InspectionReviewViewModel @Inject constructor(
    private val repository: InspectionRepository,
) : ViewModel() {
    var results by mutableStateOf<List<InspectionResultDto>>(emptyList())
        private set
    var loading by mutableStateOf(false)
        private set
    var error by mutableStateOf<String?>(null)
        private set
    var message by mutableStateOf<String?>(null)
        private set
    var sessionExpired by mutableStateOf(false)
        private set
    var lastReview by mutableStateOf<InspectionReviewData?>(null)
        private set
    /** Id hasil yang sedang diproses — mencegah tap ganda pada item yang sama. */
    var reviewingId by mutableStateOf<String?>(null)
        private set

    fun load() {
        if (loading) return
        viewModelScope.launch {
            loading = true; error = null
            try {
                when (val response = repository.pending()) {
                    is DashboardResult.Success -> results = response.data.data.orEmpty()
                    is DashboardResult.Error -> error = response.message
                }
            } catch (_: UnauthorizedException) { sessionExpired = true }
            catch (e: Exception) { error = e.message ?: "Gagal memuat hasil inspeksi." }
            finally { loading = false }
        }
    }

    fun review(resultId: String, action: String, notes: String?) {
        if (loading) return
        viewModelScope.launch {
            var succeeded = false
            loading = true; error = null; reviewingId = resultId
            try {
                when (val response = repository.review(resultId, action, notes)) {
                    is DashboardResult.Success -> {
                        lastReview = response.data
                        results = results.filterNot { it.id == resultId }
                        succeeded = true
                        message = when (action) {
                            InspectionReviewAction.REINSPECT -> "Inspeksi ulang dibuat."
                            InspectionReviewAction.ACCEPT -> "Hasil inspeksi diterima."
                            InspectionReviewAction.RETURN -> "Hasil dikembalikan ke petugas."
                            else -> "Hasil inspeksi ditolak."
                        }
                    }
                    is DashboardResult.Error -> error = response.message
                }
            } catch (_: UnauthorizedException) { sessionExpired = true }
            catch (e: Exception) { error = e.message ?: "Review inspeksi gagal." }
            finally { loading = false; reviewingId = null }
            // Muat ulang setelah sukses: keputusan review mengubah status assignment
            // dan bisa memunculkan/menghilangkan item pada halaman ini.
            if (succeeded) load()
        }
    }

    fun consumeMessage() { message = null }
    fun consumeError() { error = null }
}
