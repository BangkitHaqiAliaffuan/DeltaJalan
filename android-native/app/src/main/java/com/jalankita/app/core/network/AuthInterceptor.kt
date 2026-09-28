package com.jalankita.app.core.network

import com.jalankita.app.core.data.TokenStore
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import okhttp3.Interceptor
import okhttp3.Response
import javax.inject.Inject

/**
 * Menyuntik `Authorization: Bearer <token>` ke setiap request terautentikasi.
 * Kontrak: Sanctum tanpa refresh — 401 berarti token mati → paksa re-login
 * (ditangani di lapisan repository, bukan di sini).
 */
class AuthInterceptor @Inject constructor(
    private val tokenStore: TokenStore,
) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val token = runBlocking { tokenStore.token.first() }
        val request = if (token.isNullOrBlank()) {
            chain.request()
        } else {
            chain.request().newBuilder()
                .header("Authorization", "Bearer $token")
                .header("Accept", "application/json")
                .build()
        }
        return chain.proceed(request)
    }
}
