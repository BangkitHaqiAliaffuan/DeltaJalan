package com.jalankita.app.core.worker

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.location.Location
import android.location.LocationManager
import android.os.BatteryManager
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import androidx.work.CoroutineWorker
import androidx.work.WorkManager
import androidx.work.ForegroundInfo
import androidx.work.WorkerParameters
import com.jalankita.app.R
import com.jalankita.app.core.network.ApiService
import com.jalankita.app.core.network.WorkerLocationRequest
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeout
import retrofit2.HttpException
import java.io.IOException
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import kotlin.coroutines.resume

/**
 * Upload lokasi petugas tiap 15 menit (Fase 3) — POST /api/worker/location.
 *
 * Keputusan sadar (tanpa dependensi baru):
 * - Lokasi via framework LocationManager (tanpa play-services-location):
 *   coba fix AKTIF singkat (getCurrentLocation, API 30+) lalu fallback ke
 *   last-known GPS + Network. Fix aktif membuat data tidak selalu kosong
 *   seperti getLastKnownLocation saja.
 * - Hanya jalan pada jam kerja 06:00–18:00 WIB; di luar itu skip sunyi.
 * - Worker dipromosikan jadi foreground service agar tidak dibunuh OEM
 *   saat background dan pengguna melihat tracking sedang aktif.
 *
 * Pemetaan kegagalan (P1):
 * - 401/403 (token mati / role berubah) → [Result.success]: retry buta hanya
 *   membebani server. Tracking dihentikan, ditulis ke log.
 * - 422 (validasi) → [Result.success]: data tidak akan pernah valid.
 * - 5xx / IOException / error lain → [Result.retry]:/network, coba lagi
 *   dengan backoff.
 * - Tanpa token / tanpa izin / tanpa lokasi → [Result.success] + log: ini
 *   kondisi normal "skip periode ini", bukan kegagalan.
 */
class LocationWorker(
    ctx: Context,
    params: WorkerParameters,
    private val api: ApiService,
    private val bearerToken: String?,
) : CoroutineWorker(ctx, params) {

    override suspend fun doWork(): Result {
        if (bearerToken.isNullOrBlank()) {
            Log.w(TAG, "Lewati: sesi tidak ada (token kosong).")
            return Result.success()
        }
        if (!inWorkHours()) return Result.success()
        if (!hasLocationPermission()) {
            Log.w(TAG, "Lewati: izin lokasi (termasuk background) belum diberikan.")
            return Result.success()
        }

        // Promosi ke foreground TIDAK boleh menggagalkan pengiriman lokasi.
        // Sejak Android 12 app tidak boleh memulai FGS dari background
        // (ForegroundServiceStartNotAllowedException) — dan worker ini justru
        // berjalan saat app di background. Tanpa guard, exception keluar dari
        // doWork() dan seluruh periode tracking hilang.
        try {
            setForeground(buildForegroundInfo())
        } catch (e: CancellationException) {
            throw e // pembatalan worker jangan ditelan
        } catch (e: Exception) {
            Log.w(
                TAG,
                "Foreground service tidak bisa dimulai (${e.javaClass.simpleName}): " +
                    "${e.message} — lanjut kirim lokasi tanpa notifikasi persisten.",
            )
        }

        val loc = freshestLocation() ?: run {
            Log.w(TAG, "Lewati: tidak ada lokasi yang bisa diambil.")
            return Result.success()
        }
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
            if (res.success) {
                Result.success()
            } else {
                // Server balas 2xx tapi success=false — perlakukan sebagai
                // transient supaya tidak kehilangan lokasi.
                Log.w(TAG, "Server menolak lokasi: ${res.message}")
                Result.retry()
            }
        } catch (e: HttpException) {
            when (e.code()) {
                401, 403 -> {
                    Log.w(TAG, "Sesi/role tidak valid (${e.code()}) — tracking dihentikan.")
                    stopTracking()
                    Result.success()
                }
                422 -> {
                    Log.w(TAG, "Data lokasi tidak valid — tidak diulang.")
                    Result.success()
                }
                else -> {
                    Log.w(TAG, "Server error (${e.code()}) — coba lagi nanti.")
                    Result.retry()
                }
            }
        } catch (e: IOException) {
            Log.w(TAG, "Jaringan bermasalah: ${e.message}")
            Result.retry()
        } catch (e: TimeoutCancellationException) {
            Log.w(TAG, "Permintaan lokasi timeout.")
            Result.retry()
        } catch (e: Exception) {
            Log.w(TAG, "Gagal mengirim lokasi: ${e.message}")
            Result.retry()
        }
    }

    /**
     * Hentikan work periodik saat token mati / role berubah. Tanpa ini worker
     * tetap bangun tiap 15 menit selamanya (mencoba FGS + notifikasi) walau
     * hasilnya selalu ditolak server.
     */
    private fun stopTracking() {
        runCatching {
            WorkManager.getInstance(applicationContext)
                .cancelUniqueWork(LocationTracking.WORK_NAME)
        }.onFailure {
            Log.w(TAG, "Gagal menghentikan tracking periodik: ${it.message}")
        }
    }

    /** Notifikasi foreground service agar tracking terlihat & tidak dibunuh OEM. */
    private fun buildForegroundInfo(): ForegroundInfo {
        val nm = applicationContext.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
        if (nm != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Pelacakan Lokasi Petugas",
                NotificationManager.IMPORTANCE_LOW,
            )
            nm.createNotificationChannel(channel)
        }

        val notif = NotificationCompat.Builder(applicationContext, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("Pelacakan lokasi aktif")
            .setContentText("DeltaJalan mengirim posisi petugas secara berkala.")
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .setSilent(true)
            .build()

        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ForegroundInfo(
                NOTIF_ID,
                notif,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION,
            )
        } else {
            ForegroundInfo(NOTIF_ID, notif)
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

    /**
     * Fix AKTIF singkat (API 30+) bila provider tersedia; fallback ke
     * last-known GPS + Network yang terbaru (maks 30 menit).
     */
    private suspend fun freshestLocation(): Location? {
        val lm = applicationContext.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
            ?: return null

        val active = requestCurrentLocation(lm)
        if (active != null) return active

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

    /** Android 11+ (API 30): ambil satu fix terkini tanpa memblokir lama. */
    private suspend fun requestCurrentLocation(lm: LocationManager): Location? {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return null
        val provider = when {
            runCatching { lm.isProviderEnabled(LocationManager.GPS_PROVIDER) }.getOrDefault(false) ->
                LocationManager.GPS_PROVIDER
            runCatching { lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER) }.getOrDefault(false) ->
                LocationManager.NETWORK_PROVIDER
            else -> return null
        }
        return try {
            withTimeout(CURRENT_FIX_TIMEOUT_MS) {
                suspendCancellableCoroutine { cont ->
                    val cancellation = android.os.CancellationSignal()
                    lm.getCurrentLocation(
                        provider,
                        cancellation,
                        applicationContext.mainExecutor,
                    ) { loc ->
                        if (cont.isActive) cont.resume(loc)
                    }
                    cont.invokeOnCancellation { cancellation.cancel() }
                }
            }
        } catch (_: TimeoutCancellationException) {
            null
        } catch (_: SecurityException) {
            null
        } catch (_: Exception) {
            null
        }
    }

    private fun batteryLevel(): Int? {
        val bm = applicationContext.getSystemService(Context.BATTERY_SERVICE) as? BatteryManager
        val pct = bm?.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY) ?: -1
        return pct.takeIf { it in 0..100 }
    }

    private companion object {
        const val TAG = "LocationWorker"
        const val CHANNEL_ID = "location_tracking_channel"
        const val NOTIF_ID = 2001
        const val CURRENT_FIX_TIMEOUT_MS = 8_000L
    }
}
