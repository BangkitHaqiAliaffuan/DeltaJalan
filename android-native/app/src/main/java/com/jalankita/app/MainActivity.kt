package com.jalankita.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import dagger.hilt.android.AndroidEntryPoint

/**
 * Scaffold Fase 1 — struktur + channel notifikasi.
 * Layar fitur (login, lapor, dst.) menyusul per docs/rencana-native-android.md §8.
 * Channel ID identik dengan versi Capacitor agar token FCM server tetap valid.
 */
@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        createNotificationChannel()
        enableEdgeToEdge()
        setContent {
            MaterialTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    PlaceholderScreen()
                }
            }
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val channel = NotificationChannel(
            "delta_jalan_general",
            "Notifikasi Umum",
            NotificationManager.IMPORTANCE_HIGH,
        ).apply {
            description = "Notifikasi laporan, tugas, dan pengumuman umum"
        }
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }
}

@Composable
private fun PlaceholderScreen() {
    Text("DeltaJalan Native — scaffold Fase 1")
}
