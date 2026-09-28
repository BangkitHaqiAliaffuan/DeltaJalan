package com.jalankita.app.core.network

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/** Envelope standar backend: {success, message?, data?, errors?}. */
@JsonClass(generateAdapter = true)
data class ApiEnvelope<T>(
    val success: Boolean,
    val message: String? = null,
    val data: T? = null,
)

@JsonClass(generateAdapter = true)
data class LoginRequest(
    val email: String,
    val password: String,
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

@JsonClass(generateAdapter = true)
data class LoginResponse(
    val token: String,
    val user: UserDto,
)

/** GET /api/app/version — config-based, tanpa auth. */
@JsonClass(generateAdapter = true)
data class AppVersionDto(
    @Json(name = "min_version_code") val minVersionCode: Int,
    @Json(name = "latest_version_code") val latestVersionCode: Int,
    @Json(name = "apk_url") val apkUrl: String,
    @Json(name = "force_update") val forceUpdate: Boolean,
)
