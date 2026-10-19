package com.jalankita.app.core.data

import com.jalankita.app.core.network.ApiService
import com.jalankita.app.core.network.LoginRequest
import com.jalankita.app.core.network.RegisterRequest
import com.jalankita.app.core.network.RegisterResponse
import com.jalankita.app.core.network.UserDto
import com.squareup.moshi.Moshi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import retrofit2.HttpException
import javax.inject.Inject
import javax.inject.Singleton

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
