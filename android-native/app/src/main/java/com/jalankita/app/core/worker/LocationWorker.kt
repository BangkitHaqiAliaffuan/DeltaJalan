package com.jalankita.app.core.worker

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationManager
import android.os.BatteryManager
import androidx.core.content.ContextCompat
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.jalankita.app.core.network.ApiService
import com.jalankita.app.core.network.WorkerLocationRequest
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * Upload lokasi petugas tiap 15 menit (Fase 3) — POST /api/worker/location.
 *
 * Keputusan sadar (tanpa dependensi baru):
 * - Lokasi via framework LocationManager (tanpa play-services-location):
 *   ambil last-known GPS + Network yang terbaru. Tanpa fix aktif agar hemat
 *   baterai; akurasi cukup untuk "lokasi terakhir tim" (nearest memakai
 *   data < 1 jam).
 * - Hanya jalan pada jam kerja 06:00–18:00 WIB; di luar itu skip sunyi.
 * - Tanpa izin lokasi / tanpa token / gagal jaringan → success (tunggu
 *   periode berikutnya, jangan backoff spam). 401/403 → failure.
 */
class LocationWorker(
    ctx: Context,
    params: WorkerParameters,
    private val api: ApiService,
    private val bearerToken: String?,
) : CoroutineWorker(ctx, params) {

    override suspend fun doWork(): Result {
        if (bearerToken.isNullOrBlank()) return Result.success()
        if (!inWorkHours()) return Result.success()
        if (!hasLocationPermission()) return Result.success()

        val loc = freshestLocation() ?: return Result.success()
        val battery = batteryLevel()
        return try {
            val res = api.postWorkerLocation(
                WorkerLocationRequest(
                    latitude = loc.latitude,
                    longitude = loc.longitude,
                    batteryLevel = battery,
                    trackedAt = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).format(Date()),
                ),
            )
            if (res.success) Result.success() else Result.failure()
        } catch (e: retrofit2.HttpException) {
            // 401 token mati / 403 role berubah — jangan retry buta.
            Result.failure()
        } catch (_: Exception) {
            Result.success()
        }
    }

    /** Jam kerja 06:00–18:00 WIB (cermin "15 mnt jam kerja" rencana §4). */
    private fun inWorkHours(): Boolean {
        val cal = Calendar.getInstance(TimeZone.getTimeZone("Asia/Jakarta"))
        val h = cal.get(Calendar.HOUR_OF_DAY)
        return h in 6 until 18
    }

    private fun hasLocationPermission(): Boolean {
        val fine = ContextCompat.checkSelfPermission(
            applicationContext, Manifest.permission.ACCESS_FINE_LOCATION,
        ) == PackageManager.PERMISSION_GRANTED
        val coarse = ContextCompat.checkSelfPermission(
            applicationContext, Manifest.permission.ACCESS_COARSE_LOCATION,
        ) == PackageManager.PERMISSION_GRANTED
        if (!fine && !coarse) return false
        // Worker jalan saat background — Android 10+ butuh izin background
        // agar getLastKnownLocation tidak selalu null.
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
            return ContextCompat.checkSelfPermission(
                applicationContext, Manifest.permission.ACCESS_BACKGROUND_LOCATION,
            ) == PackageManager.PERMISSION_GRANTED
        }
        return true
    }

    /** Fix terakhir GPS + Network, pilih yang terbaru (maks 30 menit). */
    private fun freshestLocation(): Location? {
        val lm = applicationContext.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
            ?: return null
        val candidates = listOf(
            LocationManager.GPS_PROVIDER,
            LocationManager.NETWORK_PROVIDER,
        ).mapNotNull { p ->
            try {
                if (lm.isProviderEnabled(p)) lm.getLastKnownLocation(p) else null
            } catch (_: SecurityException) {
                null
            }
        }
        val best = candidates.maxByOrNull { it.time } ?: return null
        if (System.currentTimeMillis() - best.time > 30 * 60 * 1000) return null
        return best
    }

    private fun batteryLevel(): Int? {
        val bm = applicationContext.getSystemService(Context.BATTERY_SERVICE) as? BatteryManager
        val pct = bm?.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY) ?: -1
        return pct.takeIf { it in 0..100 }
    }
}
