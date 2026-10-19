package com.jalankita.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.jalankita.app.core.network.DuplicateWarning
import com.jalankita.app.ui.theme.TextDark
import com.jalankita.app.ui.theme.TextMuted
import com.jalankita.app.ui.theme.WarningAmber
import com.jalankita.app.ui.theme.WarningBg
import com.jalankita.app.ui.theme.WarningBorder
import java.util.Locale

/**
 * Kartu peringatan duplikat laporan (spatial/hash) — non-blokir: pengguna tetap
 * dapat melanjutkan submit sebagai bukti pendukung.
 */
@Composable
fun DuplicateWarningCard(
    warning: DuplicateWarning,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val reason = when (warning.classLabel) {
        "hash_dup" -> "Foto ini identik dengan foto pada laporan lain."
        else -> "Lokasi kerusakan ini sudah pernah dilaporkan."
    }
    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(WarningBg)
            .border(1.dp, WarningBorder, RoundedCornerShape(10.dp))
            .padding(12.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(AppIcon.Warning, contentDescription = null, tint = WarningAmber, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(8.dp))
            Text(
                "Kemungkinan Duplikat",
                color = TextDark,
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.weight(1f),
            )
            Icon(
                AppIcon.Delete,
                contentDescription = "Tutup",
                tint = TextMuted,
                modifier = Modifier.size(18.dp).clickable(onClick = onDismiss),
            )
        }
        Spacer(Modifier.height(6.dp))
        Text(reason, color = TextDark, fontSize = 12.sp)
        if (warning.reportCode != null) {
            Spacer(Modifier.height(4.dp))
            Text(
                buildString {
                    append("Kode: ${warning.reportCode}")
                    warning.status?.let { append(" • Status: $it") }
                    warning.distanceMeters?.let { append(" • %.1f m".format(Locale.US, it)) }
                },
                color = TextMuted,
                fontSize = 11.sp,
                fontFamily = FontFamily.Monospace,
            )
        }
        Spacer(Modifier.height(4.dp))
        Text(
            "Laporan Anda tetap dapat dikirim sebagai bukti pendukung.",
            color = TextMuted,
            fontSize = 11.sp,
        )
    }
}
