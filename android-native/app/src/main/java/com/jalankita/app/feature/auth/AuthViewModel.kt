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
import com.jalankita.app.core.data.OnboardingResult
import com.jalankita.app.core.data.ResendResult
import com.jalankita.app.core.data.UnauthorizedException
import com.jalankita.app.core.data.UserRole
import com.jalankita.app.core.network.GoogleProfileDto
import com.jalankita.app.core.network.UserDto
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
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

    /**
     * Pendaftaran sudah divalidasi dan kode OTP sudah dikirim ke email.
     * Belum ada token Sanctum — akun baru lahir setelah kode dimasukkan.
     */
    data class NeedsOtpVerification(
        val registrationToken: String,
        val email: String,
        val source: OtpSource,
    ) : SessionState

    data object Unauthenticated : SessionState
}

/** Asal challenge OTP — menentukan tujuan tombol "batalkan". */
enum class OtpSource { REGISTER, GOOGLE }

// Salinan config/registration.php di backend. Kalau backend berubah, ubah di sini juga.
private const val OTP_CODE_LENGTH = 6
private const val OTP_RESEND_COOLDOWN_SECONDS = 60

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

    // ── Verifikasi OTP email (daftar manual & Google) ────────────────────
    var otpCode by mutableStateOf("")
        private set
    var otpError by mutableStateOf<String?>(null)
        private set
    var otpInfo by mutableStateOf<String?>(null)
        private set
    var otpBusy by mutableStateOf(false)
        private set
    var otpResendCooldown by mutableStateOf(0)
        private set

    /** Job hitung mundur tombol "kirim ulang" — dibatalkan saat challenge berganti. */
    private var cooldownJob: Job? = null

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
                when (
                    val result = auth.completeGoogleOnboarding(
                        onboardingToken = current.onboardingToken,
                        phone = phoneResult.normalized,
                        password = if (current.isNewUser) onboardingPassword else null,
                        passwordConfirmation = if (current.isNewUser) {
                            onboardingPasswordConfirmation
                        } else {
                            null
                        },
                    )
                ) {
                    is OnboardingResult.Authenticated -> {
                        session = SessionState.Authenticated(result.user)
                        clearOnboardingFields()
                        uploadFcmToken()
                    }

                    // Akun baru: nomor telepon sudah tersimpan di challenge,
                    // tinggal kode OTP. Belum ada token Sanctum.
                    is OnboardingResult.NeedsVerification -> {
                        clearOnboardingFields()
                        startOtpSession(
                            registrationToken = result.registrationToken,
                            email = result.email,
                            source = OtpSource.GOOGLE,
                        )
                    }
                }
            } catch (e: Exception) {
                onboardingError = e.message?.takeIf { it.isNotBlank() }
                    ?: "Gagal menyimpan data. Coba lagi."
            } finally {
                onboardingBusy = false
            }
        }
    }

    // ── Verifikasi OTP email ─────────────────────────────────────────────

    /**
     * Masuk ke layar OTP setelah langkah 1 daftar manual berhasil.
     * Dipanggil [RegisterScreen] lewat callback `onRegistered`.
     */
    fun startRegistrationOtp(registrationToken: String, email: String) {
        startOtpSession(registrationToken, email, OtpSource.REGISTER)
    }

    private fun startOtpSession(registrationToken: String, email: String, source: OtpSource) {
        clearOtpFields()
        session = SessionState.NeedsOtpVerification(
            registrationToken = registrationToken,
            email = email,
            source = source,
        )
        startCooldown()
    }

    fun onOtpCodeChange(v: String) {
        // Hanya digit, maksimal sepanjang kode.
        otpCode = v.filter(Char::isDigit).take(OTP_CODE_LENGTH)
        otpError = null
        otpInfo = null
    }

    fun verifyOtp() {
        if (otpBusy) return
        val current = session as? SessionState.NeedsOtpVerification ?: return

        if (otpCode.length < OTP_CODE_LENGTH) {
            otpError = "Masukkan $OTP_CODE_LENGTH digit kode verifikasi."
            return
        }

        viewModelScope.launch {
            otpBusy = true
            otpError = null
            otpInfo = null
            try {
                val user = auth.verifyRegistration(current.registrationToken, otpCode)
                cooldownJob?.cancel()
                clearOtpFields()
                session = SessionState.Authenticated(user)
                uploadFcmToken()
            } catch (e: Exception) {
                otpError = e.message?.takeIf { it.isNotBlank() }
                    ?: "Verifikasi gagal. Coba lagi."
            } finally {
                otpBusy = false
            }
        }
    }

    fun resendOtp() {
        if (otpBusy || otpResendCooldown > 0) return
        val current = session as? SessionState.NeedsOtpVerification ?: return

        viewModelScope.launch {
            otpBusy = true
            otpError = null
            otpInfo = null
            when (val result = auth.resendRegistrationCode(current.registrationToken)) {
                is ResendResult.Sent -> {
                    otpInfo = result.message
                    otpCode = ""
                    startCooldown()
                }

                // Server masih menghitung mundur — selaraskan UI agar tombol
                // tidak bisa ditekan berulang.
                is ResendResult.Cooldown -> {
                    otpError = result.message
                    startCooldown()
                }

                // Gagal jaringan / token mati: JANGAN nyalakan hitung mundur,
                // user harus bisa langsung mencoba lagi.
                is ResendResult.Failed -> otpError = result.message
            }
            otpBusy = false
        }
    }

    fun cancelOtp() {
        cooldownJob?.cancel()
        clearOtpFields()
        session = SessionState.Unauthenticated
    }

    private fun clearOtpFields() {
        otpCode = ""
        otpError = null
        otpInfo = null
        otpResendCooldown = 0
    }

    /** Hitung mundur tombol kirim ulang; nilai awal dari [OTP_RESEND_COOLDOWN_SECONDS]. */
    private fun startCooldown() {
        cooldownJob?.cancel()
        // Nilai awal diset SINKRON, bukan di dalam coroutine: kalau tidak,
        // ada jeda satu dispatch sebelum otpResendCooldown terisi, dan di situ
        // otpBusy sudah false — tombol kirim ulang sempat bisa ditekan lagi.
        otpResendCooldown = OTP_RESEND_COOLDOWN_SECONDS
        cooldownJob = viewModelScope.launch {
            while (otpResendCooldown > 0) {
                delay(1_000)
                otpResendCooldown -= 1
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
