package com.jalankita.app.core.worker

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.jalankita.app.R
import com.jalankita.app.core.data.DashboardResult
import com.jalankita.app.core.data.OfflineReportQueue
import com.jalankita.app.core.data.WargaRepository
import java.io.File

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
        for (item in pending) {
            val files = item.photoPaths.map { File(it) }.filter { it.exists() }
            if (files.isEmpty()) {
                queue.remove(item.id)
                continue
            }
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
            if (res is DashboardResult.Success) {
                queue.remove(item.id)
                uploadedCount++
            }
        }

        if (uploadedCount > 0) {
            showNotification(uploadedCount)
        }

        return Result.success()
    }

    private fun showNotification(count: Int) {
        val nm = appContext.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return
        val channelId = "offline_sync_channel"
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
}
