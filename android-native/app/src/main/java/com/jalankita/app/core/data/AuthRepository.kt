package com.jalankita.app.core.data

import com.google.android.gms.tasks.Task
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseAuthException
import com.google.firebase.auth.GoogleAuthProvider
import com.jalankita.app.core.network.ApiErrorResponse
import com.jalankita.app.core.network.ApiService
import com.jalankita.app.core.network.CompleteGoogleOnboardingRequest
import com.jalankita.app.core.network.CompletePhoneRequest
import com.jalankita.app.core.network.GoogleLoginRequest
import com.jalankita.app.core.network.GoogleProfileDto
import com.jalankita.app.core.network.LoginRequest
import com.jalankita.app.core.network.RegisterRequest
import com.jalankita.app.core.network.RegisterResponse
import com.jalankita.app.core.network.UserDto
import com.squareup.moshi.Moshi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.suspendCancellableCoroutine
import retrofit2.HttpException
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/**
 * Otentikasi Sanctum — token non-expiring.
 * Kontrak backend: 401 = kredensial salah ATAU token dicabut → paksa re-login.
 * Tidak ada refresh token; jangan retry otomatis saat 401.
 */
class UnauthorizedException(message: String = "Sesi berakhir, silakan login ulang.") :
    Exception(message)

@Singleton
class AuthRepository @Inject constructor(
    private val api: ApiService,
    private val tokenStore: TokenStore,
    private val moshi: Moshi,
    private val firebaseAuth: FirebaseAuth,
) {
    val token: Flow<String?> = tokenStore.token

    suspend fun isLoggedIn(): Boolean = !tokenStore.token.first().isNullOrBlank()

    /**
     * @throws UnauthorizedException bila 401 (kredensial salah).
     * @throws Exception untuk error lain (jaringan, validasi 422, throttle 429).
     */
    suspend fun login(email: String, password: String): UserDto {
        val res = try {
            api.login(LoginRequest(email.trim(), password))
        } catch (e: HttpException) {
            if (e.code() == 401) throw UnauthorizedException("Email atau kata sandi salah.")
            throw e
        }
        val token = res.token
        val user = res.user
        if (!res.success || token.isNullOrBlank() || user == null) {
            throw Exception(res.message ?: "Login gagal, coba lagi.")
        }
        tokenStore.save(token)
        return user
    }

    suspend fun logout() {
        try {
            api.logout()
        } catch (_: Exception) {
            // Logout server best-effort — token lokal tetap dibersihkan.
        }
        tokenStore.clear()
    }

    /**
     * Login Google dua tahap: Google ID token → Firebase ID token → backend.
     * Backend memverifikasi Firebase token, bukan Google token.
     */
    suspend fun loginWithGoogle(googleIdToken: String): GoogleLoginResult {
        val firebaseToken = try {
            firebaseIdToken(googleIdToken)
        } catch (e: Exception) {
            throw Exception(firebaseErrorMessage(e))
        }

        val res = try {
            api.googleLogin(GoogleLoginRequest(firebaseToken))
        } catch (e: HttpException) {
            throw Exception(apiErrorMessage(e))
        }

        val token = res.token
        val user = res.user
        if (res.success && !token.isNullOrBlank() && user != null) {
            tokenStore.save(token)
            return GoogleLoginResult.Authenticated(user)
        }

        val onboardingToken = res.onboardingToken
        if (res.success && res.needsOnboarding && !onboardingToken.isNullOrBlank()) {
            val profile = res.profile ?: throw Exception("Profil Google tidak lengkap.")
            return GoogleLoginResult.NeedsOnboarding(
                onboardingToken = onboardingToken,
                profile = profile,
                isNewUser = res.isNewUser,
                missingFields = res.missingFields
                    ?: if (res.isNewUser) listOf("phone", "password") else listOf("phone"),
            )
        }

        throw Exception(res.message ?: "Login Google gagal. Coba lagi.")
    }

    /**
     * Selesaikan onboarding Google. Password hanya dikirim untuk akun baru;
     * akun lama tanpa phone cukup mengirim phone.
     */
    suspend fun completeGoogleOnboarding(
        onboardingToken: String,
        phone: String,
        password: String? = null,
        passwordConfirmation: String? = null,
    ): UserDto {
        val res = try {
            api.completeGoogleOnboarding(
                CompleteGoogleOnboardingRequest(
                    onboardingToken = onboardingToken,
                    phone = phone.trim(),
                    password = password,
                    passwordConfirmation = passwordConfirmation,
                ),
            )
        } catch (e: HttpException) {
            throw Exception(apiErrorMessage(e))
        }

        val token = res.token
        val user = res.user
        if (!res.success || token.isNullOrBlank() || user == null) {
            throw Exception(res.message ?: "Gagal menyelesaikan pendaftaran.")
        }
        tokenStore.save(token)
        return user
    }

    /** Lengkapi phone untuk sesi Sanctum lama (mis. login password sebelum aturan ini). */
    suspend fun completePhone(phone: String): UserDto {
        val res = try {
            api.completePhone(CompletePhoneRequest(phone.trim()))
        } catch (e: HttpException) {
            throw Exception(apiErrorMessage(e))
        }

        if (!res.success || res.user == null) {
            throw Exception(res.message ?: "Gagal menyimpan nomor telepon.")
        }
        return res.user
    }

    private suspend fun firebaseIdToken(googleIdToken: String): String {
        if (googleIdToken.isBlank()) {
            throw Exception("Token Google tidak tersedia.")
        }

        return try {
            val credential = GoogleAuthProvider.getCredential(googleIdToken, null)
            val authResult = firebaseAuth.signInWithCredential(credential).awaitTask()
            val firebaseUser = authResult.user
                ?: throw Exception("Akun Firebase tidak ditemukan.")
            firebaseUser.getIdToken(false).awaitTask().token
                ?: throw Exception("Gagal mendapatkan token Firebase.")
        } finally {
            // Jangan tinggalkan sesi Firebase aktif; aplikasi memakai Sanctum.
            firebaseAuth.signOut()
        }
    }

    private fun apiErrorMessage(e: HttpException): String {
        val body = e.response()?.errorBody()?.string()
        val parsed = runCatching {
            moshi.adapter(ApiErrorResponse::class.java).fromJson(body ?: "")
        }.getOrNull()

        val fieldError = parsed?.errors?.values?.flatten()?.firstOrNull()
        val codeMessage = when (parsed?.errorCode) {
            "FIREBASE_TOKEN_INVALID" -> "Token Google tidak valid atau kedaluwarsa. Coba lagi."
            "FIREBASE_UNAVAILABLE" -> "Layanan Google sedang bermasalah. Coba beberapa saat lagi."
            "GOOGLE_WARGA_ONLY" -> "Akun Google hanya dapat digunakan untuk akun warga."
            "ACCOUNT_BANNED" -> "Akun telah dinonaktifkan. Hubungi administrator."
            "FIREBASE_UID_CONFLICT" -> "Akun ini sudah terhubung dengan akun Google lain."
            "ONBOARDING_EXPIRED" -> "Sesi pendaftaran sudah kedaluwarsa. Silakan login Google lagi."
            "PHONE_TAKEN" -> "Nomor telepon sudah terdaftar."
            "PHONE_ALREADY_SET" -> "Nomor telepon akun sudah terisi."
            "PHONE_REQUIRED" -> "Lengkapi nomor telepon terlebih dahulu."
            "ONBOARDING_CONFLICT" -> "Email atau nomor telepon sudah terdaftar."
            else -> null
        }

        return fieldError ?: codeMessage ?: parsed?.message
            ?: "Permintaan gagal (${e.code()})."
    }

    private fun firebaseErrorMessage(e: Throwable): String = when (e) {
        is FirebaseAuthException -> when (e.errorCode) {
            "ERROR_NETWORK_REQUEST_FAILED" ->
                "Tidak dapat terhubung ke Google. Periksa koneksi internet."
            "ERROR_INVALID_CREDENTIAL" ->
                "Akun Google tidak valid. Silakan coba lagi."
            "ERROR_USER_DISABLED" ->
                "Akun Google ini dinonaktifkan."
            else -> "Gagal masuk dengan Google. Coba lagi."
        }
        else -> e.message ?: "Gagal masuk dengan Google. Coba lagi."
    }

    /**
     * @throws UnauthorizedException bila token mati (401) — pemanggil wajib
     * mengarahkan ke layar login. Token lokal ikut dibersihkan di sini.
     */
    suspend fun me(): UserDto {
        val res = try {
            api.me()
        } catch (e: HttpException) {
            if (e.code() == 401) {
                tokenStore.clear()
                throw UnauthorizedException()
            }
            throw e
        }
        return res.user ?: throw Exception("Gagal memuat profil.")
    }

    suspend fun clearSession() = tokenStore.clear()

    /**
     * Daftar akun warga — POST /api/auth/register.
     * Mengembalikan [RegisterResult] (tanpa throw) agar UI bisa menampilkan
     * pesan error validasi per-field. Server selalu membuat role='warga'.
     */
    suspend fun register(
        name: String,
        email: String,
        phone: String,
        password: String,
        passwordConfirmation: String,
    ): RegisterResult {
        return try {
            val res = api.register(
                RegisterRequest(
                    name = name.trim(),
                    email = email.trim(),
                    phone = phone.trim(),
                    password = password,
                    passwordConfirmation = passwordConfirmation,
                ),
            )
            if (res.success) {
                RegisterResult.Success(res.message ?: "Registrasi berhasil. Silakan login.")
            } else {
                val firstFieldError = res.errors?.values?.flatten()?.firstOrNull()
                RegisterResult.Error(firstFieldError ?: res.message ?: "Registrasi gagal.")
            }
        } catch (e: HttpException) {
            // FastAPI/Laravel 422 bisa tetap membawa body errors — parsir bila ada.
            val body = e.response()?.errorBody()?.string()
            val parsed = runCatching {
                moshi.adapter(RegisterResponse::class.java).fromJson(body ?: "")
            }.getOrNull()
            val msg = parsed?.errors?.values?.flatten()?.firstOrNull()
                ?: parsed?.message
                ?: "Registrasi gagal (${e.code()})."
            RegisterResult.Error(msg)
        } catch (e: Exception) {
            RegisterResult.Error(e.message ?: "Tidak dapat terhubung ke server.")
        }
    }
}

/** Hasil registrasi tanpa exception — UI menampilkan pesan yang tepat. */
sealed interface RegisterResult {
    data class Success(val message: String) : RegisterResult
    data class Error(val message: String) : RegisterResult
}

/** Hasil login Google: sesi siap dipakai, atau perlu onboarding phone/password. */
sealed interface GoogleLoginResult {
    data class Authenticated(val user: UserDto) : GoogleLoginResult

    data class NeedsOnboarding(
        val onboardingToken: String,
        val profile: GoogleProfileDto,
        val isNewUser: Boolean,
        val missingFields: List<String>,
    ) : GoogleLoginResult
}

/** Bridge Task Google Play Services tanpa menambah coroutines-play-services. */
private suspend fun <T> Task<T>.awaitTask(): T = suspendCancellableCoroutine { cont ->
    addOnCompleteListener { task ->
        if (!cont.isActive) return@addOnCompleteListener
        val error = task.exception
        when {
            task.isCanceled -> cont.resumeWithException(
                Exception("Permintaan Google dibatalkan."),
            )
            error != null -> cont.resumeWithException(error)
            else -> {
                val result = task.result
                if (result != null) cont.resume(result)
                else cont.resumeWithException(Exception("Respons Google kosong."))
            }
        }
    }
}

/** Peran yang dikenali backend (AuthController + seeder). */
object UserRole {
    const val PETUGAS = "petugas"
    const val SUPERVISOR = "supervisor"
    const val ADMIN = "admin"
    const val WARGA = "warga"

    /** Label ramah untuk ditampilkan di UI. */
    fun label(role: String?): String = when (role) {
        PETUGAS -> "Petugas"
        SUPERVISOR -> "Supervisor"
        ADMIN -> "Admin"
        WARGA -> "Warga"
        else -> role ?: "Pengguna"
    }
}
