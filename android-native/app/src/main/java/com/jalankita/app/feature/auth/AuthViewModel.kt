package com.jalankita.app.feature.auth

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.messaging.FirebaseMessaging
import com.jalankita.app.core.data.AuthRepository
import com.jalankita.app.core.data.FcmRepository
import com.jalankita.app.core.data.GoogleLoginResult
import com.jalankita.app.core.data.UnauthorizedException
import com.jalankita.app.core.data.UserRole
import com.jalankita.app.core.network.GoogleProfileDto
import com.jalankita.app.core.network.UserDto
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.launch
import javax.inject.Inject

sealed interface SessionState {
    data object Loading : SessionState
    data class Authenticated(val user: UserDto) : SessionState

    /** Login Google berhasil, tetapi akun baru / phone lama belum lengkap. */
    data class NeedsOnboarding(
        val onboardingToken: String,
        val profile: GoogleProfileDto,
        val isNewUser: Boolean,
        val missingFields: List<String>,
    ) : SessionState

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
    var googleBusy by mutableStateOf(false)
        private set
    var loginError by mutableStateOf<String?>(null)
        private set
    var logoutBusy by mutableStateOf(false)
        private set

    // ── Onboarding Google / phone wajib ──────────────────────────────────
    var onboardingPhone by mutableStateOf("")
        private set
    var onboardingPassword by mutableStateOf("")
        private set
    var onboardingPasswordConfirmation by mutableStateOf("")
        private set
    var onboardingPhoneError by mutableStateOf<String?>(null)
        private set
    var onboardingError by mutableStateOf<String?>(null)
        private set
    var onboardingBusy by mutableStateOf(false)
        private set

    init {
        refreshSession()
    }

    fun onEmailChange(v: String) { email = v; loginError = null }
    fun onPasswordChange(v: String) { password = v; loginError = null }

    fun onGoogleError(message: String) {
        loginError = message
    }

    fun loginWithGoogle(googleIdToken: String) {
        if (googleBusy || loginBusy) return
        viewModelScope.launch {
            googleBusy = true
            loginError = null
            try {
                when (val result = auth.loginWithGoogle(googleIdToken)) {
                    is GoogleLoginResult.Authenticated -> {
                        session = SessionState.Authenticated(result.user)
                        email = ""
                        password = ""
                        uploadFcmToken()
                    }
                    is GoogleLoginResult.NeedsOnboarding -> {
                        clearOnboardingFields()
                        session = SessionState.NeedsOnboarding(
                            onboardingToken = result.onboardingToken,
                            profile = result.profile,
                            isNewUser = result.isNewUser,
                            missingFields = result.missingFields,
                        )
                    }
                }
            } catch (e: UnauthorizedException) {
                loginError = e.message
            } catch (e: Exception) {
                loginError = e.message?.takeIf { it.isNotBlank() }
                    ?: "Tidak dapat terhubung ke server. Coba lagi."
            } finally {
                googleBusy = false
            }
        }
    }

    fun onOnboardingPhoneChange(v: String) {
        onboardingPhone = v
        onboardingPhoneError = null
        onboardingError = null
    }

    fun onOnboardingPasswordChange(v: String) {
        onboardingPassword = v
        onboardingError = null
    }

    fun onOnboardingPasswordConfirmChange(v: String) {
        onboardingPasswordConfirmation = v
        onboardingError = null
    }

    fun validateOnboardingPhoneOnBlur() {
        if (onboardingPhone.isBlank()) {
            onboardingPhoneError = null
            return
        }
        val result = validateIndonesianPhone(onboardingPhone)
        if (result.valid) {
            onboardingPhone = result.normalized
            onboardingPhoneError = null
        } else {
            onboardingPhoneError = result.error
        }
    }

    /** Selesaikan onboarding Google: phone wajib, password hanya untuk akun baru. */
    fun completeOnboarding() {
        if (onboardingBusy) return
        val current = session as? SessionState.NeedsOnboarding ?: return

        onboardingError = null
        val phoneResult = validateIndonesianPhone(onboardingPhone)
        if (!phoneResult.valid) {
            onboardingPhoneError = phoneResult.error
            onboardingError = "Perbaiki kesalahan pada form."
            return
        }
        onboardingPhone = phoneResult.normalized
        onboardingPhoneError = null

        if (current.isNewUser) {
            if (onboardingPassword.length < 8) {
                onboardingError = "Kata sandi minimal 8 karakter."
                return
            }
            if (onboardingPassword != onboardingPasswordConfirmation) {
                onboardingError = "Konfirmasi kata sandi tidak cocok."
                return
            }
        }

        viewModelScope.launch {
            onboardingBusy = true
            try {
                val user = auth.completeGoogleOnboarding(
                    onboardingToken = current.onboardingToken,
                    phone = phoneResult.normalized,
                    password = if (current.isNewUser) onboardingPassword else null,
                    passwordConfirmation = if (current.isNewUser) {
                        onboardingPasswordConfirmation
                    } else {
                        null
                    },
                )
                session = SessionState.Authenticated(user)
                clearOnboardingFields()
                uploadFcmToken()
            } catch (e: Exception) {
                onboardingError = e.message?.takeIf { it.isNotBlank() }
                    ?: "Gagal menyimpan data. Coba lagi."
            } finally {
                onboardingBusy = false
            }
        }
    }

    /** Untuk sesi Sanctum lama yang belum punya phone (login password). */
    fun completePhone() {
        if (onboardingBusy) return

        onboardingError = null
        val phoneResult = validateIndonesianPhone(onboardingPhone)
        if (!phoneResult.valid) {
            onboardingPhoneError = phoneResult.error
            onboardingError = "Perbaiki kesalahan pada form."
            return
        }
        onboardingPhone = phoneResult.normalized
        onboardingPhoneError = null

        viewModelScope.launch {
            onboardingBusy = true
            try {
                val user = auth.completePhone(phoneResult.normalized)
                session = SessionState.Authenticated(user)
                clearOnboardingFields()
                uploadFcmToken()
            } catch (e: Exception) {
                onboardingError = e.message?.takeIf { it.isNotBlank() }
                    ?: "Gagal menyimpan nomor telepon. Coba lagi."
            } finally {
                onboardingBusy = false
            }
        }
    }

    fun cancelOnboarding() {
        session = SessionState.Unauthenticated
        clearOnboardingFields()
        loginError = null
    }

    private fun clearOnboardingFields() {
        onboardingPhone = ""
        onboardingPassword = ""
        onboardingPasswordConfirmation = ""
        onboardingPhoneError = null
        onboardingError = null
    }

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
        if (loginBusy || googleBusy) return
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
                clearOnboardingFields()
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
                    clearOnboardingFields()
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
