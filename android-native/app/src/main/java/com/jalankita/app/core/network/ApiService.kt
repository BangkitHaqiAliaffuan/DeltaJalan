package com.jalankita.app.core.network

import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.HTTP
import retrofit2.http.POST
import retrofit2.http.Query

/** Subset endpoint Fase 1 — bertambah per fase (kontrak: routes/api.php). */
interface ApiService {

    /** Bentuk FLAT {success, message, token, user} — lihat Models.kt. */
    @POST("auth/login")
    suspend fun login(@Body body: LoginRequest): LoginResponse

    @POST("auth/logout")
    suspend fun logout(): ApiEnvelope<Unit>

    /** Bentuk FLAT {success, user}. */
    @GET("auth/me")
    suspend fun me(): MeResponse

    /**
     * `version_code` WAJIB dikirim — server menghitung `force_update`
     * dari nilai ini (default 0 = selalu force-update bila min > 0).
     */
    @GET("app/version")
    suspend fun appVersion(
        @Query("platform") platform: String = "android",
        @Query("version_code") versionCode: Int,
    ): ApiEnvelope<AppVersionDto>

    /** Kontrak: PushSubscriptionController::storeFcmToken. */
    @POST("push/fcm-token")
    suspend fun postFcmToken(@Body body: FcmTokenRequest): ApiEnvelope<Unit>

    /** Kontrak: PushSubscriptionController::removeFcmToken. */
    @HTTP(method = "DELETE", path = "push/fcm-token", hasBody = true)
    suspend fun deleteFcmToken(@Body body: FcmTokenRequest): ApiEnvelope<Unit>
}
