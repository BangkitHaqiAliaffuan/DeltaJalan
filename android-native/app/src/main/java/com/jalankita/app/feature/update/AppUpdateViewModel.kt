package com.jalankita.app.feature.update

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.jalankita.app.BuildConfig
import com.jalankita.app.core.network.ApiService
import com.jalankita.app.core.network.AppVersionDto
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.launch
import javax.inject.Inject

/** Hasil cek versi — kontrak: ApkDownloadController::version. */
sealed interface AppUpdateState {
    data object Idle : AppUpdateState
    data object Checking : AppUpdateState
    /** Versi OK — tidak ada aksi. */
    data object Ok : AppUpdateState
    /** Ada versi baru tapi tidak wajib — dialog bisa ditutup. */
    data class SoftUpdate(val info: AppVersionDto) : AppUpdateState
    /** Di bawah minimum — layar blokir sampai update. */
    data class ForceUpdate(val info: AppVersionDto) : AppUpdateState
}

/**
 * Cek versi saat startup — GET /api/app/version?platform=android&version_code=N.
 * Endpoint publik (tanpa auth); best-effort — gagal jaringan = Ok (jangan blokir).
 */
@HiltViewModel
class AppUpdateViewModel @Inject constructor(
    private val api: ApiService,
) : ViewModel() {

    var state by mutableStateOf<AppUpdateState>(AppUpdateState.Idle)
        private set

    fun check() {
        if (state != AppUpdateState.Idle) return
        viewModelScope.launch {
            state = AppUpdateState.Checking
            state = try {
                val res = api.appVersion(
                    platform = "android",
                    versionCode = BuildConfig.VERSION_CODE,
                )
                val info = res.data
                when {
                    info == null || !res.success -> AppUpdateState.Ok
                    info.forceUpdate -> AppUpdateState.ForceUpdate(info)
                    info.latestVersionCode > BuildConfig.VERSION_CODE ->
                        AppUpdateState.SoftUpdate(info)
                    else -> AppUpdateState.Ok
                }
            } catch (_: Exception) {
                // Offline / server down: jangan blokir aplikasi.
                AppUpdateState.Ok
            }
        }
    }

    fun dismissSoft() {
        if (state is AppUpdateState.SoftUpdate) state = AppUpdateState.Ok
    }

    /** Tombol "Cek Lagi" di layar blokir — ulangi dari Idle. */
    fun retry() {
        state = AppUpdateState.Idle
        check()
    }
}
