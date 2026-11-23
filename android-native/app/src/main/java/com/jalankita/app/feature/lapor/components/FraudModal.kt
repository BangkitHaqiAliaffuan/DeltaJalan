package com.jalankita.app.feature.lapor.components

import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import com.jalankita.app.feature.lapor.FraudAlert
import com.jalankita.app.ui.components.AppIcon
import com.jalankita.app.ui.components.JkDialog
import com.jalankita.app.ui.theme.DeltaJalanTypography
import com.jalankita.app.ui.theme.ErrorRed
import com.jalankita.app.ui.theme.Manrope
import com.jalankita.app.ui.theme.TextDark

/**
 * Modal peringatan foto (replikasi `fraudModal` di upload.tsx):
 * judul + pesan mengapa foto ditolak, tombol tutup, dan tombol aksi
 * opsional bila [FraudAlert.actionLabel]/[FraudAlert.onAction] diisi
 * (mis. "Pilih via File" untuk retry SAF saat NO_GPS Photo Picker).
 */
@Composable
fun FraudModal(alert: FraudAlert?, onDismiss: () -> Unit) {
    if (alert == null) return
    JkDialog(
        title = alert.title,
        onDismissRequest = onDismiss,
        primaryLabel = "Mengerti",
        onPrimary = onDismiss,
        primaryColor = ErrorRed,
        // Tombol aksi opsional (mis. "Pilih via File" saat GPS tidak ada).
        // Bila tidak diisi, slot sekunder menjadi tombol tutup biasa.
        secondaryLabel = alert.actionLabel ?: "Tutup",
        onSecondary = alert.onAction,
        icon = AppIcon.Error,
    ) {
        Text(alert.message, style = DeltaJalanTypography.bodySmall, color = TextDark)
    }
}
