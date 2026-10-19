package com.jalankita.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.jalankita.app.ui.components.AppIcon

/**
 * Banner konteks sesi cek rutin (patroli) — port web `upload.tsx`:907-913 / 1041-1047 /
 * 1136-1142:
 *   "Upload laporan untuk:"  →  <nama jalan>  →  "Kec. <kecamatan>"
 *
 * Dipakai di SETIAP tahap alur lapor-petugas dari sesi patroli:
 *  - LaporScreen (pilih foto)
 *  - AiResultScreen (form + submit)
 *
 * Hanya dirender oleh pemanggil bila laporan berasal dari sesi patroli
 * (`surveyTaskId != null`), sehingga laporan biasa dari Beranda tetap bersih.
 */
@Composable
fun PatrolContextBanner(
    roadName: String?,
    kecamatan: String?,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(
                Brush.horizontalGradient(listOf(Color(0xFF1E40AF), Color(0xFF2E68D8))),
            )
            .padding(16.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier
                    .clip(RoundedCornerShape(6.dp))
                    .background(Color.White.copy(alpha = 0.18f))
                    .padding(horizontal = 8.dp, vertical = 3.dp),
            ) {
                Text(
                    "CEK RUTIN",
                    color = Color.White,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.6.sp,
                )
            }
            Spacer(Modifier.size(8.dp))
            Icon(AppIcon.CalendarMonth, null, tint = Color(0xFFBFDBFE), modifier = Modifier.size(14.dp))
            Spacer(Modifier.size(4.dp))
            Text("Laporan Patroli", color = Color(0xFFBFDBFE), fontSize = 12.sp)
        }
        Spacer(Modifier.height(8.dp))
        Text("Upload laporan untuk:", color = Color(0xFFBFDBFE), fontSize = 13.sp)
        Spacer(Modifier.height(2.dp))
        Text(
            roadName?.takeIf { it.isNotBlank() } ?: "Lokasi Patroli",
            color = Color.White,
            fontSize = 17.sp,
            fontWeight = FontWeight.Bold,
        )
        kecamatan?.takeIf { it.isNotBlank() }?.let {
            Spacer(Modifier.height(2.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(AppIcon.Map, null, tint = Color(0xFFBFDBFE), modifier = Modifier.size(14.dp))
                Spacer(Modifier.size(4.dp))
                Text("Kec. $it", color = Color(0xFFBFDBFE), fontSize = 13.sp)
            }
        }
    }
}
