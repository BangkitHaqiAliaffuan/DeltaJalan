package com.jalankita.app.core.worker

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.jalankita.app.R
import com.jalankita.app.core.data.DashboardResult
import com.jalankita.app.core.data.DiscoveredReportRequest
import com.jalankita.app.core.data.InspectionRepository
import com.jalankita.app.core.data.InspectionSubmitRequest
import com.jalankita.app.core.data.OfflineInspectionQueue
import com.jalankita.app.core.data.PendingInspectionResult
import com.jalankita.app.core.data.UnauthorizedException
import java.io.File
import kotlinx.coroutines.CancellationException

/**
 * Mengunggah hasil inspeksi (dan temuan lapangan) yang tersimpan offline.
 *
 * Aturan kegagalan disamakan dengan [ReportUploadWorker]:
 * - Gagal TRANSIEN (jaringan/server) → item tetap di antrean dan worker
 *   mengembalikan [Result.retry] agar WorkManager mencoba lagi.
 * - Gagal PERMANEN (401/403/422, sesi inspeksi hilang, foto hilang) → item
 *   dibuang **dan** pengguna diberi notifikasi. Sebelumnya item hanya
 *   ditandai `terminal` tanpa pernah diberitahukan dan fotonya tidak dihapus,
 *   sehingga petugas mengira hasil inspeksinya sudah terkirim.
 */
class InspectionUploadWorker(
    private val appContext: Context,
    params: WorkerParameters,
    private val queue: OfflineInspectionQueue,
    private val repository: InspectionRepository,
) : CoroutineWorker(appContext, params) {
    override suspend fun doWork(): Result {
        val pending = queue.list()
        if (pending.isEmpty()) return Result.success()

        var uploaded = 0
        var permanentFailures = 0
        var transientFailures = 0

        for (item in pending) {
            // Item `terminal` dari versi sebelumnya: tidak pernah dicoba lagi,
            // jadi dibersihkan + dilaporkan sekali di sini.
            if (item.terminal) {
                discard(item)
                permanentFailures++
                continue
            }
            val files = item.photoPaths.map(::File).filter(File::exists)
            val sessionId = item.sessionId
            if (item.discovered && sessionId.isNullOrBlank()) {
                discard(item)
                permanentFailures++
                continue
            }
            if (files.isEmpty()) {
                discard(item)
                permanentFailures++
                continue
            }

            val result = try {
                if (item.discovered) {
                    repository.createDiscoveredReport(
                        sessionId.orEmpty(),
                        DiscoveredReportRequest(
                            idempotencyKey = item.idempotencyKey,
                            roadName = item.roadName.orEmpty(),
                            district = item.district.orEmpty(),
                            latitude = item.latitude,
                            longitude = item.longitude,
                            description = item.notes,
                            photo = files.single(),
                        ),
                    )
                } else {
                    repository.submitResult(
                        item.assignmentId,
                        InspectionSubmitRequest(
                            idempotencyKey = item.idempotencyKey,
                            condition = item.condition,
                            notes = item.notes,
                            // Dimensi ikut dikirim ulang; tanpa ini hasil ukur
                            // petugas yang dibuat saat offline akan hilang.
                            kerusakanPanjang = item.kerusakanPanjang,
                            kerusakanLebar = item.kerusakanLebar,
                            kerusakanKedalaman = item.kerusakanKedalaman,
                            latitude = item.latitude,
                            longitude = item.longitude,
                            photos = files,
                        ),
                    )
                }
            } catch (_: UnauthorizedException) {
                // Sesi mati: retry buta hanya membebani server dan data tidak
                // akan pernah terkirim tanpa login ulang.
                discard(item)
                permanentFailures++
                continue
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                transientFailures++
                queue.update(item.copy(retryCount = item.retryCount + 1, lastError = e.message))
                continue
            }

            when (result) {
                is DashboardResult.Success -> {
                    discard(item)
                    uploaded++
                }
                is DashboardResult.Error -> {
                    val terminal = result.message.contains("401") ||
                        result.message.contains("403") ||
                        result.message.contains("422") ||
                        result.message.contains("Forbidden", ignoreCase = true)
                    if (terminal) {
                        discard(item)
                        permanentFailures++
                    } else {
                        transientFailures++
                        queue.update(
                            item.copy(
                                retryCount = item.retryCount + 1,
                                lastError = result.message,
                            ),
                        )
                    }
                }
            }
        }

        if (uploaded > 0) showNotification(uploaded)
        if (permanentFailures > 0) showFailureNotification(permanentFailures)

        return if (transientFailures > 0) Result.retry() else Result.success()
    }

    /**
     * Buang item dari antrean + hapus salinan foto di cache. Foto sudah
     * terkirim (atau tidak akan pernah bisa terkirim), jadi menyimpannya hanya
     * memenuhi penyimpanan.
     */
    private suspend fun discard(item: PendingInspectionResult) {
        item.photoPaths.forEach { path -> runCatching { File(path).delete() } }
        queue.remove(item.id)
    }

    private fun showNotification(count: Int) {
        val builder = baseBuilder("Hasil Inspeksi Terkirim", "$count hasil inspeksi offline berhasil diunggah.")
        builder.setPriority(NotificationCompat.PRIORITY_DEFAULT)
        notify(NOTIF_ID_SUCCESS, builder)
    }

    /** Notifikasi kegagalan permanen — pengguna harus tahu hasilnya tidak terkirim. */
    private fun showFailureNotification(count: Int) {
        val builder = baseBuilder(
            "Hasil Inspeksi Gagal Dikirim",
            "$count hasil inspeksi ditolak server atau sesinya berakhir. " +
                "Buka aplikasi dan kirim ulang hasil inspeksinya.",
        )
        builder.setPriority(NotificationCompat.PRIORITY_HIGH)
        openAppIntent()?.let { builder.setContentIntent(it) }
        notify(NOTIF_ID_FAILURE, builder)
    }

    private fun baseBuilder(title: String, body: String): NotificationCompat.Builder {
        val nm = appContext.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
        if (nm != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            nm.createNotificationChannel(
                NotificationChannel(
                    CHANNEL_ID,
                    "Sinkronisasi Inspeksi Offline",
                    NotificationManager.IMPORTANCE_DEFAULT,
                ),
            )
        }
        val builder = NotificationCompat.Builder(appContext, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
        openAppIntent()?.let { builder.setContentIntent(it) }
        return builder
    }

    private fun notify(id: Int, builder: NotificationCompat.Builder) {
        val nm = appContext.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return
        try {
            nm.notify(id, builder.build())
        } catch (_: SecurityException) {
            // Izin POST_NOTIFICATIONS belum diberikan — lewati diam-diam.
        }
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
        const val CHANNEL_ID = "inspection_sync_channel"
        const val NOTIF_ID_SUCCESS = 1003
        const val NOTIF_ID_FAILURE = 1004
    }
}
