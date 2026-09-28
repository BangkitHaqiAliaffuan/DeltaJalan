package com.jalankita.app.core.network

import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Query

/** Subset endpoint Fase 1 — bertambah per fase (kontrak: routes/api.php). */
interface ApiService {

    @POST("auth/login")
    suspend fun login(@Body body: LoginRequest): ApiEnvelope<LoginResponse>

    @POST("auth/logout")
    suspend fun logout(): ApiEnvelope<Unit>

    @GET("auth/me")
    suspend fun me(): ApiEnvelope<UserDto>

    @GET("app/version")
    suspend fun appVersion(
        @Query("platform") platform: String = "android",
    ): ApiEnvelope<AppVersionDto>
}
