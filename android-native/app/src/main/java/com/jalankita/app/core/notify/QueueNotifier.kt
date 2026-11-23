package com.jalankita.app.core.notify

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.jalankita.app.R

/**
 * Notifikasi hasil sinkronisasi antrean kiriman. Satu tempat untuk kedua worker
 * (laporan warga & hasil inspeksi) — sebelumnya salinan kode saling berbeda dan
 * alasan kegagalan dari server tidak pernah ditampilkan.
 */
object QueueNotifier {

    const val CHANNEL_ID = "offline_sync_channel"
    const val ID_WARGA_UPLOADED = 1001
    const val ID_WARGA_FAILED = 1002
    const val ID_INSPECTION_UPLOADED = 1003
    const val ID_INSPECTION_FAILED = 1004
    const val ID_QUOTA = 1005

    /** Pengguna menekan notifikasi → aplikasi terbuka dan membuka layar antrean. */
    const val EXTRA_OPEN_QUEUE = "open_queue"

    fun uploaded(context: Context, id: Int, title: String, body: String) {
        val builder = base(context, title, body, NotificationCompat.PRIORITY_DEFAULT)
        notify(context, id, builder)
    }

    /**
     * Kegagalan permanen. [reasons] berisi alasan dari server (mis. "foto
     * terlalu tua") supaya pengguna tahu apa yang harus diperbaiki, bukan
     * sekadar "gagal".
     */
    fun failed(context: Context, id: Int, count: Int, reasons: List<String>) {
        val detail = reasons.filter { it.isNotBlank() }.distinct().take(2).joinToString("; ")
        val body = buildString {
            append("$count kiriman tidak bisa dikirim.")
            if (detail.isNotBlank()) append(" Alasan: $detail")
            append(" Buka aplikasi untuk melihat.")
        }
        val builder = base(context, "Kiriman Gagal Dikirim", body, NotificationCompat.PRIORITY_HIGH)
        notify(context, id, builder)
    }

    /** Batas harian tercapai — bukan kegagalan; dikirim otomatis besok. */
    fun waitingQuota(context: Context, count: Int) {
        val builder = base(
            context,
            "Menunggu Kirim Besok",
            "$count kiriman tertunda karena batas laporan harian. Akan dikirim otomatis besok.",
            NotificationCompat.PRIORITY_LOW,
        )
        notify(context, ID_QUOTA, builder)
    }

    private fun base(
        context: Context,
        title: String,
        body: String,
        priority: Int,
    ): NotificationCompat.Builder {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            nm?.createNotificationChannel(
                NotificationChannel(CHANNEL_ID, "Sinkronisasi Kiriman", NotificationManager.IMPORTANCE_DEFAULT),
            )
        }
        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(priority)
            .setAutoCancel(true)
        openQueueIntent(context)?.let { builder.setContentIntent(it) }
        return builder
    }

    /**
     * Tap notifikasi membuka aplikasi sambil menandai "buka antrean".
     * Request code dibedakan dari notifikasi laporan biasa agar extra tidak
     * saling menimpa (FLAG_UPDATE_CURRENT memakai satu PendingIntent).
     */
    private fun openQueueIntent(context: Context): PendingIntent? {
        val intent = context.packageManager
            .getLaunchIntentForPackage(context.packageName)
            ?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            ?.putExtra(EXTRA_OPEN_QUEUE, true)
            ?: return null
        return PendingIntent.getActivity(
            context,
            REQUEST_CODE_QUEUE,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    private fun notify(context: Context, id: Int, builder: NotificationCompat.Builder) {
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return
        runCatching { nm.notify(id, builder.build()) }
    }

    private const val REQUEST_CODE_QUEUE = 4242
}
