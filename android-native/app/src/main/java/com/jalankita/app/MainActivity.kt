package com.jalankita.app

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.ContextCompat
import androidx.lifecycle.viewmodel.compose.viewModel
import com.jalankita.app.feature.auth.AuthViewModel
import com.jalankita.app.feature.auth.HomeScreen
import com.jalankita.app.feature.auth.LoginScreen
import com.jalankita.app.feature.auth.SessionState
import dagger.hilt.android.AndroidEntryPoint

/**
 * Scaffold Fase 1 — login/logout + channel notifikasi.
 * Navigasi berbasis state sesi (tanpa navigation-compose, menyusul bila
 * jumlah layar bertambah di Fase 2+). 401 dari server → [SessionState.Unauthenticated].
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
                    Root()
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
// viewModel() memakai Hilt-generated factory via @AndroidEntryPoint —
// tanpa perlu artefak hilt-navigation-compose tambahan.
private fun Root(vm: AuthViewModel = viewModel()) {
    RequestNotificationPermission()
    when (val s = vm.session) {
        SessionState.Loading -> Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center,
        ) {
            CircularProgressIndicator()
        }
        SessionState.Unauthenticated -> LoginScreen(vm)
        is SessionState.Authenticated -> HomeScreen(user = s.user, vm = vm)
    }
}

/**
 * Android 13+ wajib izin runtime POST_NOTIFICATIONS agar push tampil.
 * Diminta sekali saat aplikasi dibuka; penolakan tidak blocking.
 */
@Composable
private fun RequestNotificationPermission() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return
    val context = LocalContext.current
    val launcher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { }
    LaunchedEffect(Unit) {
        if (ContextCompat.checkSelfPermission(
                context, Manifest.permission.POST_NOTIFICATIONS,
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            launcher.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }
}
