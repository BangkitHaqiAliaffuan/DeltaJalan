package com.jalankita.app.feature.home

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.jalankita.app.core.data.DashboardResult
import com.jalankita.app.core.data.InspectionRepository
import com.jalankita.app.core.data.UnauthorizedException
import com.jalankita.app.core.network.InspectionAssignmentDto
import com.jalankita.app.core.network.InspectionTaskPage
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.launch

@HiltViewModel
class InspectionViewModel @Inject constructor(
    private val repository: InspectionRepository,
) : ViewModel() {
    var page by mutableStateOf<InspectionTaskPage?>(null)
        private set
    var detail by mutableStateOf<InspectionAssignmentDto?>(null)
        private set
    var loading by mutableStateOf(false)
        private set
    var error by mutableStateOf<String?>(null)
        private set
    var sessionExpired by mutableStateOf(false)
        private set
    var startSucceeded by mutableStateOf(false)
        private set

    fun consumeStartSuccess() { startSucceeded = false }

    fun load(date: String? = null, force: Boolean = false) {
        if (loading && !force) return
        viewModelScope.launch {
            loading = true
            error = null
            try {
                when (val result = repository.getTasks(date)) {
                    is DashboardResult.Success -> page = result.data
                    is DashboardResult.Error -> error = result.message
                }
            } catch (_: UnauthorizedException) {
                sessionExpired = true
            } catch (e: Exception) {
                error = e.message ?: "Gagal memuat tugas inspeksi."
            } finally {
                loading = false
            }
        }
    }

    fun loadDetail(assignmentId: String) {
        viewModelScope.launch {
            loading = true
            error = null
            try {
                when (val result = repository.getTask(assignmentId)) {
                    is DashboardResult.Success -> detail = result.data
                    is DashboardResult.Error -> error = result.message
                }
            } catch (_: UnauthorizedException) {
                sessionExpired = true
            } catch (e: Exception) {
                error = e.message ?: "Gagal memuat detail inspeksi."
            } finally {
                loading = false
            }
        }
    }

    fun start(assignmentId: String) {
        viewModelScope.launch {
            loading = true
            error = null
            try {
                when (val result = repository.startTask(assignmentId)) {
                    is DashboardResult.Success -> {
                        detail = result.data
                        startSucceeded = true
                    }
                    is DashboardResult.Error -> error = result.message
                }
            } catch (_: UnauthorizedException) {
                sessionExpired = true
            } catch (e: Exception) {
                error = e.message ?: "Gagal memulai inspeksi."
            } finally {
                loading = false
            }
        }
    }

    fun clearError() { error = null }
}
