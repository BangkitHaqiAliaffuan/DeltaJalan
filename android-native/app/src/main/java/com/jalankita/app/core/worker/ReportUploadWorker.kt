package com.jalankita.app.core.worker

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.jalankita.app.R
import com.jalankita.app.core.data.DashboardResult
import com.jalankita.app.core.data.OfflineReportQueue
import com.jalankita.app.core.data.UnauthorizedException
import com.jalankita.app.core.data.WargaRepository
import com.jalankita.app.core.data.WargaSubmitException
import java.io.File

/**
 * Mengunggah laporan warga yang tersimpan offline saat koneksi kembali.
 *
 * Aturan kegagalan (P1):
 * - Gagal TRANSIEN (jaringan/server) → item TETAP di antrian dan worker
 *   mengembalikan [Result.retry] supaya WorkManager mencoba lagi dengan
 *   backoff. Sebelumnya worker selalu [Result.success] sehingga laporan
 *   menggantung selamanya tanpa percobaan ulang.
 * - Gagal PERMANEN (4xx validasi, 401 sesi mati, berkas foto hilang) →
 *   retry tidak akan pernah berhasil, jadi item dikeluarkan dari antrian
 *   dan pengguna diberi tahu lewat notifikasi (bukan dibuang diam-diam).
 *   Catatan: [WargaRepository.submit] melempar [java.io.IOException] untuk
 *   408/429/5xx sehingga error server sesaat TIDAK masuk kategori ini.
 * - Exception per item ditangkap agar satu item bermasalah tidak
 *   menggagalkan seluruh antrian.
 */
class ReportUploadWorker(
    private val appContext: Context,
    params: WorkerParameters,
    private val queue: OfflineReportQueue,
    private val wargaRepo: WargaRepository,
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result {
        val pending = queue.list()
        if (pending.isEmpty()) return Result.success()

        var uploadedCount = 0
        var transientFailures = 0
        var permanentFailures = 0

        for (item in pending) {
            val files = item.photoPaths.map { File(it) }.filter { it.exists() }
            if (files.isEmpty()) {
                // Berkas hilang (cache dibersihkan sistem) → tidak akan pernah
                // terkirim, keluarkan dari antrian dan laporkan ke pengguna.
                queue.remove(item.id)
                permanentFailures++
                continue
            }
            try {
                val res = wargaRepo.submit(
                    reporterName = item.reporterName,
                    roadName = item.roadName,
                    district = item.district,
                    latitude = item.latitude,
                    longitude = item.longitude,
                    description = item.description,
                    panjang = item.panjang,
                    lebar = item.lebar,
                    fullAddress = item.fullAddress,
                    imageFiles = files,
                )
                when (res) {
                    is DashboardResult.Success -> {
                        queue.remove(item.id)
                        uploadedCount++
                    }
                    // Error jaringan/server → coba lagi nanti.
                    is DashboardResult.Error -> transientFailures++
                }
            } catch (_: WargaSubmitException) {
                // 422 validasi (mis. DUPLICATE_IMAGE / PHOTO_TOO_OLD) → retry
                // tidak menolong; keluarkan + beri tahu pengguna.
                queue.remove(item.id)
                permanentFailures++
            } catch (_: UnauthorizedException) {
                // 401 sesi mati → pengguna harus login ulang; retry buta
                // hanya membebani server.
                queue.remove(item.id)
                permanentFailures++
            } catch (e: Exception) {
                // Termasuk IOException dari 408/429/5xx dan gangguan jaringan.
                Log.w(TAG, "Upload gagal sementara: ${e.message}")
                transientFailures++
            }
        }

        if (uploadedCount > 0) showNotification(uploadedCount)
        if (permanentFailures > 0) showFailureNotification(permanentFailures)

        return if (transientFailures > 0) Result.retry() else Result.success()
    }

    private fun showNotification(count: Int) {
        val nm = appContext.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return
        val channelId = CHANNEL_ID
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "Sinkronisasi Laporan Offline",
                NotificationManager.IMPORTANCE_DEFAULT,
            )
            nm.createNotificationChannel(channel)
        }

        val notif = NotificationCompat.Builder(appContext, channelId)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("Laporan Terkirim")
            .setContentText("$count laporan offline berhasil diunggah.")
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)
            .build()

        nm.notify(1001, notif)
    }

    /** Notifikasi kegagalan permanen — pengguna harus tahu laporannya tidak terkirim. */
    private fun showFailureNotification(count: Int) {
        val nm = appContext.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Sinkronisasi Laporan Offline",
                NotificationManager.IMPORTANCE_DEFAULT,
            )
            nm.createNotificationChannel(channel)
        }

        val builder = NotificationCompat.Builder(appContext, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("Laporan Gagal Dikirim")
            .setContentText(
                "$count laporan offline ditolak server atau sesinya berakhir. " +
                    "Buka aplikasi dan buat ulang laporannya.",
            )
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)

        // Tap notifikasi membuka aplikasi — sebelumnya tidak ada contentIntent
        // sehingga notifikasi tidak melakukan apa pun saat disentuh.
        openAppIntent()?.let { builder.setContentIntent(it) }

        nm.notify(1002, builder.build())
    }

    /** Intent pembuka aplikasi dari notifikasi (null bila launcher tidak ada). */
    private fun openAppIntent(): PendingIntent? {
        val intent = appContext.packageManager
            .getLaunchIntentForPackage(appContext.packageName)
            ?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            ?: return null
        return PendingIntent.getActivity(
            appContext,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    private companion object {
        const val CHANNEL_ID = "offline_sync_channel"
        const val TAG = "ReportUploadWorker"
    }
}
