package com.jalankita.app.feature.auth

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.messaging.FirebaseMessaging
import com.jalankita.app.core.data.AuthRepository
import com.jalankita.app.core.data.FcmRepository
import com.jalankita.app.core.data.UnauthorizedException
import com.jalankita.app.core.data.UserRole
import com.jalankita.app.core.network.UserDto
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.launch
import javax.inject.Inject

sealed interface SessionState {
    data object Loading : SessionState
    data class Authenticated(val user: UserDto) : SessionState
    data object Unauthenticated : SessionState
}

@HiltViewModel
class AuthViewModel @Inject constructor(
    private val auth: AuthRepository,
    private val fcm: FcmRepository,
) : ViewModel() {

    var session by mutableStateOf<SessionState>(SessionState.Loading)
        private set

    var email by mutableStateOf("")
        private set
    var password by mutableStateOf("")
        private set
    var loginBusy by mutableStateOf(false)
        private set
    var loginError by mutableStateOf<String?>(null)
        private set
    var logoutBusy by mutableStateOf(false)
        private set

    init {
        refreshSession()
    }

    fun onEmailChange(v: String) { email = v; loginError = null }
    fun onPasswordChange(v: String) { password = v; loginError = null }

    /** Validasi token tersimpan ke `GET /auth/me`; 401 → Unauthenticated. */
    fun refreshSession() {
        viewModelScope.launch {
            session = SessionState.Loading
            session = try {
                if (!auth.isLoggedIn()) {
                    SessionState.Unauthenticated
                } else {
                    val me = auth.me()
                    // Sesi admin lama (sebelum gate login) ikut ditolak.
                    if (me.role == UserRole.ADMIN) {
                        runCatching { auth.logout() }
                        SessionState.Unauthenticated
                    } else {
                        SessionState.Authenticated(me)
                    }
                }
            } catch (e: UnauthorizedException) {
                SessionState.Unauthenticated
            } catch (_: Exception) {
                // Offline / server down: anggap belum login agar user bisa retry
                // lewat tombol login; token lokal TIDAK dihapus di sini.
                SessionState.Unauthenticated
            }
        }
    }

    fun login() {
        if (loginBusy) return
        if (email.isBlank() || password.isBlank()) {
            loginError = "Email/no. telepon dan kata sandi wajib diisi."
            return
        }
        viewModelScope.launch {
            loginBusy = true
            loginError = null
            try {
                val user = auth.login(email, password)
                // Tidak ada admin di aplikasi (cermin masuk.tsx:64) — admin lewat web.
                if (user.role == UserRole.ADMIN) {
                    runCatching { auth.logout() }
                    loginError = "Akun admin hanya dapat masuk lewat versi web."
                    return@launch
                }
                // Aplikasi melayani petugas, warga, dan supervisor (dashboard
                // bercabang per role di MainActivity.Root).
                session = SessionState.Authenticated(user)
                email = ""
                password = ""
                uploadFcmToken()
            } catch (e: UnauthorizedException) {
                loginError = e.message
            } catch (e: Exception) {
                // Frontend menampilkan pesan koneksi yang ramah; bedakan bila jaringan.
                loginError = e.message?.takeIf { it.isNotBlank() }
                    ?: "Tidak dapat terhubung ke server. Pastikan server berjalan."
            } finally {
                loginBusy = false
            }
        }
    }

    fun logout() {
        if (logoutBusy) return
        logoutBusy = true
        // Hapus token FCM dulu (best-effort), lalu bersihkan sesi lokal.
        removeFcmToken {
            viewModelScope.launch {
                try {
                    auth.logout()
                } finally {
                    session = SessionState.Unauthenticated
                    logoutBusy = false
                }
            }
        }
    }

    /**
     * Token FCM best-effort — kegagalan tidak menggagalkan login.
     * Pakai listener (bukan `Task.await`) agar tanpa dependensi
     * `kotlinx-coroutines-play-services` tambahan.
     */
    private fun uploadFcmToken() {
        FirebaseMessaging.getInstance().token
            .addOnSuccessListener { token ->
                viewModelScope.launch { fcm.upload(token) }
            }
    }

    private fun removeFcmToken(onDone: () -> Unit) {
        FirebaseMessaging.getInstance().token
            .addOnSuccessListener { token ->
                viewModelScope.launch {
                    fcm.remove(token)
                    onDone()
                }
            }
            .addOnFailureListener { onDone() }
            .addOnCanceledListener { onDone() }
    }
}
