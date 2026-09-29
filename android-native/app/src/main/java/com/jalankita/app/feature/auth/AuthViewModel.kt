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
                    SessionState.Authenticated(auth.me())
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
            loginError = "Email dan kata sandi wajib diisi."
            return
        }
        viewModelScope.launch {
            loginBusy = true
            loginError = null
            try {
                val user = auth.login(email, password)
                session = SessionState.Authenticated(user)
                email = ""
                password = ""
                uploadFcmToken()
            } catch (e: UnauthorizedException) {
                loginError = e.message
            } catch (e: Exception) {
                loginError = e.message ?: "Login gagal, coba lagi."
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
