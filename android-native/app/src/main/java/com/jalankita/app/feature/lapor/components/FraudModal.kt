package com.jalankita.app.feature.lapor.components

import androidx.compose.material3.AlertDialog
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
    AlertDialog(
        onDismissRequest = onDismiss,
        icon = {
            Icon(AppIcon.Error, contentDescription = null, tint = ErrorRed)
        },
        title = {
            Text(
                alert.title,
                fontFamily = Manrope,
                fontWeight = FontWeight.ExtraBold,
                fontSize = 20.sp,
                color = TextDark,
            )
        },
        text = { Text(alert.message, style = DeltaJalanTypography.bodySmall, color = TextDark) },
        confirmButton = {
            Button(
                onClick = onDismiss,
                colors = ButtonDefaults.buttonColors(containerColor = ErrorRed),
            ) {
                Text("Mengerti", color = Color.White)
            }
        },
        dismissButton = {
            val label = alert.actionLabel
            val action = alert.onAction
            if (label != null && action != null) {
                Button(
                    onClick = action,
                    colors = ButtonDefaults.buttonColors(containerColor = Color.White),
                ) {
                    Text(label, color = ErrorRed)
                }
            }
        },
        containerColor = Color.White,
    )
}
