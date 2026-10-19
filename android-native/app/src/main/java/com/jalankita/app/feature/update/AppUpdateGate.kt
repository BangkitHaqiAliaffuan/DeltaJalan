package com.jalankita.app.feature.update

import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.net.toUri
import com.jalankita.app.ui.components.AppIcon
import com.jalankita.app.ui.components.BrandPrimaryButton
import com.jalankita.app.ui.components.BrandSecondaryButton
import com.jalankita.app.ui.theme.BrandBlue
import com.jalankita.app.ui.theme.TextDark
import com.jalankita.app.ui.theme.TextMuted

/**
 * Lapisan update — dipasang di Root() sebelum konten role.
 * ForceUpdate = layar blokir penuh (tanpa back). SoftUpdate = dialog tutup.
 *
 * Unduhan via browser (ACTION_VIEW ke apk_url server). Sideload dalam
 * aplikasi (PackageInstaller + REQUEST_INSTALL_PACKAGES) pekerjaan lanjutan —
 * lihat Fase 4 rencana-native-android §8.4.
 */

/** Buka URL unduhan APK di browser — aman bila URL kosong/rusak. */
private fun openDownloader(url: String, open: (Intent) -> Unit) {
    if (url.isBlank()) return
    runCatching {
        open(Intent(Intent.ACTION_VIEW, url.toUri()))
    }
}

@Composable
fun AppUpdateGate(
    state: AppUpdateState,
    onRecheck: () -> Unit,
    onDismissSoft: () -> Unit,
    onDownload: (String) -> Unit,
) {
    val context = LocalContext.current
    fun safeDownload(url: String) {
        if (url.isBlank()) return
        runCatching {
            onDownload(url)
        }
    }
    when (state) {
        is AppUpdateState.ForceUpdate -> ForceUpdateScreen(
            apkUrl = state.info.apkUrl,
            onDownload = { safeDownload(state.info.apkUrl) },
            onRecheck = onRecheck,
        )
        is AppUpdateState.SoftUpdate -> {
            AlertDialog(
                onDismissRequest = onDismissSoft,
                title = { Text("Versi Baru Tersedia", fontWeight = FontWeight.Bold, color = TextDark) },
                text = { Text("Perbarui aplikasi untuk mendapatkan perbaikan terbaru.") },
                confirmButton = {
                    TextButton(
                        onClick = {
                            openDownloader(state.info.apkUrl) { context.startActivity(it) }
                        },
                        enabled = state.info.apkUrl.isNotBlank(),
                    ) { Text("Unduh", color = BrandBlue, fontWeight = FontWeight.Bold) }
                },
                dismissButton = {
                    TextButton(onClick = onDismissSoft) { Text("Nanti", color = TextMuted) }
                },
            )
        }
        else -> Unit
    }
}

@Composable
private fun ForceUpdateScreen(
    apkUrl: String,
    onDownload: () -> Unit,
    onRecheck: () -> Unit,
) {
    // Back sistem diblokir — tidak ada BackHandler di sini.
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF5F7FA))
            .padding(horizontal = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Box(
            modifier = Modifier
                .size(72.dp)
                .clip(RoundedCornerShape(18.dp))
                .background(Color.White)
                .padding(16.dp),
            contentAlignment = Alignment.Center,
        ) {
            Icon(AppIcon.SystemUpdate, contentDescription = null, tint = BrandBlue, modifier = Modifier.size(40.dp))
        }
        Spacer(Modifier.height(24.dp))
        Text(
            text = "Pembaruan Wajib",
            color = TextDark,
            fontSize = 20.sp,
            fontWeight = FontWeight.Bold,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(8.dp))
        Text(
            text = "Versi aplikasi ini sudah terlalu lama dan tidak didukung. " +
                "Unduh versi terbaru untuk melanjutkan.",
            color = TextMuted,
            fontSize = 14.sp,
            textAlign = TextAlign.Center,
            lineHeight = 20.sp,
        )
        Spacer(Modifier.height(24.dp))
        BrandPrimaryButton(
            text = "Unduh APK",
            onClick = onDownload,
            enabled = apkUrl.isNotBlank(),
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(12.dp))
        BrandSecondaryButton(
            text = "Cek Lagi",
            onClick = onRecheck,
            modifier = Modifier.fillMaxWidth(),
        )
        if (apkUrl.isBlank()) {
            Spacer(Modifier.height(12.dp))
            Text(
                text = "Tautan unduhan belum dikonfigurasi server.",
                color = Color(0xFFE11D48),
                fontSize = 12.sp,
            )
        }
    }
}
