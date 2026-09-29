package com.jalankita.app.core.network

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/** Envelope standar backend untuk endpoint yang membungkus payload di `data`. */
@JsonClass(generateAdapter = true)
data class ApiEnvelope<T>(
    val success: Boolean,
    val message: String? = null,
    val data: T? = null,
)

/**
 * POST /api/auth/login — backend mengembalikan bentuk FLAT
 * `{success, message, token, user}` (bukan envelope `data`).
 * Kontrak: backend_POSTGRESQL/app/Http/Controllers/AuthController.php ::login.
 */
@JsonClass(generateAdapter = true)
data class LoginResponse(
    val success: Boolean,
    val message: String? = null,
    val token: String? = null,
    val user: UserDto? = null,
)

/**
 * GET /api/auth/me — bentuk FLAT `{success, user}`.
 * Kontrak: AuthController.php ::me.
 */
@JsonClass(generateAdapter = true)
data class MeResponse(
    val success: Boolean,
    val user: UserDto? = null,
)

@JsonClass(generateAdapter = true)
data class LoginRequest(
    val email: String,
    val password: String,
)

@JsonClass(generateAdapter = true)
data class FcmTokenRequest(
    @Json(name = "fcm_token") val fcmToken: String,
    @Json(name = "device_info") val deviceInfo: Map<String, String>? = null,
)

@JsonClass(generateAdapter = true)
data class UserDto(
    val id: Long,
    val name: String,
    val email: String?,
    val phone: String?,
    val role: String,
    @Json(name = "role_label") val roleLabel: String?,
    @Json(name = "team_id") val teamId: Long?,
    @Json(name = "team_name") val teamName: String?,
)

/** GET /api/app/version — config-based, tanpa auth. */
@JsonClass(generateAdapter = true)
data class AppVersionDto(
    @Json(name = "min_version_code") val minVersionCode: Int,
    @Json(name = "latest_version_code") val latestVersionCode: Int,
    @Json(name = "apk_url") val apkUrl: String,
    @Json(name = "force_update") val forceUpdate: Boolean,
)
