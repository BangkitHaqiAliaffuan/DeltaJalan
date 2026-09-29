package com.jalankita.app.core.data

import android.os.Build
import com.jalankita.app.core.network.ApiService
import com.jalankita.app.core.network.FcmTokenRequest
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Sinkronisasi token FCM ke server — best-effort, tidak pernah melempar.
 * Kontrak: PushSubscriptionController::{storeFcmToken, removeFcmToken}.
 * Server membatasi 5 token FCM per user (terlama dihapus otomatis).
 */
@Singleton
class FcmRepository @Inject constructor(
    private val api: ApiService,
) {
    private fun deviceInfo(): Map<String, String> = mapOf(
        "brand" to Build.BRAND,
        "model" to Build.MODEL,
        "os" to "Android ${Build.VERSION.RELEASE}",
        "sdk" to Build.VERSION.SDK_INT.toString(),
    )

    suspend fun upload(token: String) {
        try {
            api.postFcmToken(FcmTokenRequest(token, deviceInfo()))
        } catch (_: Exception) {
            // Best-effort: token di-refresh otomatis oleh FCM di lain waktu.
        }
    }

    suspend fun remove(token: String) {
        try {
            api.deleteFcmToken(FcmTokenRequest(token))
        } catch (_: Exception) {
            // Best-effort saat logout.
        }
    }
}
