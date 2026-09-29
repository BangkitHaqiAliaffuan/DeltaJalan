package com.jalankita.app.core.data

import com.jalankita.app.core.network.ApiService
import com.jalankita.app.core.network.LoginRequest
import com.jalankita.app.core.network.UserDto
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
}
