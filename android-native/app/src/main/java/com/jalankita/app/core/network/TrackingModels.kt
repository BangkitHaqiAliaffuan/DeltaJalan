package com.jalankita.app.core.network

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Tracking GPS petugas — kontrak: backend_POSTGRESQL
 * WorkerLocationController::store. Server gate role (403 non-petugas).
 * `tracked_at` format `Y-m-d H:i:s` (nullable → server pakai now()).
 */
@JsonClass(generateAdapter = true)
data class WorkerLocationRequest(
    val latitude: Double,
    val longitude: Double,
    @Json(name = "battery_level") val batteryLevel: Int? = null,
    @Json(name = "tracked_at") val trackedAt: String? = null,
)
