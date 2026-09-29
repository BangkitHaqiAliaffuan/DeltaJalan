package com.jalankita.app.core.notify

import android.app.PendingIntent
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.jalankita.app.MainActivity
import com.jalankita.app.core.data.AuthRepository
import com.jalankita.app.core.data.FcmRepository
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Push Fase 1 — terima notifikasi + sinkronisasi token.
 * Channel `delta_jalan_general` dibuat di MainActivity (ID sama dengan
 * versi Capacitor). Deep-link ke detail laporan menyusul Fase 4 —
 * untuk sekarang tap notifikasi membuka aplikasi.
 */
@AndroidEntryPoint
class DeltaJalanMessagingService : FirebaseMessagingService() {

    @Inject lateinit var auth: AuthRepository
    @Inject lateinit var fcm: FcmRepository

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onNewToken(token: String) {
        // Hanya upload bila sudah login — upload pasca-login ditangani
        // AuthViewModel; ini untuk rotasi token saat sesi aktif.
        scope.launch {
            if (auth.isLoggedIn()) fcm.upload(token)
        }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        val title = message.notification?.title
            ?: message.data["title"] ?: "DeltaJalan"
        val body = message.notification?.body
            ?: message.data["body"] ?: return

        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            message.data["report_id"]?.let { putExtra("report_id", it) }
        }
        val pending = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val notif = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setContentIntent(pending)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build()

        try {
            NotificationManagerCompat.from(this)
                .notify(System.currentTimeMillis().toInt(), notif)
        } catch (_: SecurityException) {
            // Izin POST_NOTIFICATIONS belum diberikan — lewati diam-diam.
        }
    }

    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }

    companion object {
        const val CHANNEL_ID = "delta_jalan_general"
    }
}
