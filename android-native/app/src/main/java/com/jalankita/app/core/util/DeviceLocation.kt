package com.jalankita.app.core.util

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationManager
import android.os.Build
import androidx.core.content.ContextCompat
import kotlin.coroutines.resume
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeout

/**
 * Lokasi perangkat sekali-ambil untuk kebutuhan UI (foreground).
 *
 * Kenapa ada: foto yang diambil lewat aplikasi kamera pihak ketiga **tidak
 * dijamin** membawa EXIF GPS — banyak kamera hanya menulis tag lokasi bila
 * pengaturan "tag lokasi" milik aplikasi kamera itu aktif, terlepas dari
 * pengaturan lokasi sistem. Tanpa cadangan ini, [PhotoCapture.stampLocation]
 * tidak bisa menambal dan foto ditolak validator EXIF.
 *
 * Sengaja memakai `LocationManager` bawaan framework (sama seperti
 * `core/worker/LocationWorker`) alih-alih play-services-location: aplikasi ini
 * tidak menarik dependensi itu, dan `getCurrentLocation` sudah tersedia sejak
 * API 30 (perangkat target Android 12).
 */
object DeviceLocation {

    /** Fix yang lebih tua dari ini dianggap basi — lebih baik gagal terang-terangan. */
    private const val STALE_MS = 30 * 60 * 1000L

    private const val DEFAULT_TIMEOUT_MS = 8_000L

    /** Izin lokasi (kasar pun cukup untuk stempel EXIF). */
    fun hasPermission(context: Context): Boolean {
        val fine = ContextCompat.checkSelfPermission(
            context, Manifest.permission.ACCESS_FINE_LOCATION,
        ) == PackageManager.PERMISSION_GRANTED
        val coarse = ContextCompat.checkSelfPermission(
            context, Manifest.permission.ACCESS_COARSE_LOCATION,
        ) == PackageManager.PERMISSION_GRANTED
        return fine || coarse
    }

    /**
     * Koordinat terbaru perangkat, atau `null` bila tidak ada izin / GPS mati /
     * tidak ada fix dalam 30 menit terakhir.
     *
     * Urutan: fix aktif singkat (API 30+) → `getLastKnownLocation` GPS/Network
     * yang masih segar. Tidak pernah memblokir lebih dari [timeoutMs].
     */
    suspend fun current(
        context: Context,
        timeoutMs: Long = DEFAULT_TIMEOUT_MS,
    ): Pair<Double, Double>? {
        if (!hasPermission(context)) return null
        val lm = context.applicationContext
            .getSystemService(Context.LOCATION_SERVICE) as? LocationManager
            ?: return null

        val aktif = runCatching { currentFix(lm, timeoutMs) }.getOrNull()
        val lokasi = aktif ?: lastKnownFresh(lm) ?: return null
        return lokasi.latitude to lokasi.longitude
    }

    private suspend fun currentFix(lm: LocationManager, timeoutMs: Long): Location? {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return null
        val provider = when {
            runCatching { lm.isProviderEnabled(LocationManager.GPS_PROVIDER) }.getOrDefault(false) ->
                LocationManager.GPS_PROVIDER
            runCatching { lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER) }
                .getOrDefault(false) -> LocationManager.NETWORK_PROVIDER
            else -> return null
        }
        return try {
            withTimeout(timeoutMs) {
                suspendCancellableCoroutine { cont ->
                    val signal = android.os.CancellationSignal()
                    lm.getCurrentLocation(provider, signal, android.os.AsyncTask.THREAD_POOL_EXECUTOR) { loc ->
                        if (cont.isActive) cont.resume(loc)
                    }
                    cont.invokeOnCancellation { signal.cancel() }
                }
            }
        } catch (_: SecurityException) {
            // Izin dicabut di tengah jalan (mis. pengguna menolak lewat setelan):
            // jangan melempar ke pemanggil yang sedang menyiapkan foto.
            null
        }
    }

    private fun lastKnownFresh(lm: LocationManager): Location? {
        val kandidat = listOf(
            LocationManager.GPS_PROVIDER,
            LocationManager.NETWORK_PROVIDER,
        ).mapNotNull { p ->
            try {
                if (lm.isProviderEnabled(p)) lm.getLastKnownLocation(p) else null
            } catch (_: SecurityException) {
                null
            } catch (_: IllegalArgumentException) {
                // Provider tidak ada di perangkat ini.
                null
            }
        }
        val terbaru = kandidat.maxByOrNull { it.time } ?: return null
        return terbaru.takeIf { System.currentTimeMillis() - it.time <= STALE_MS }
    }
}
