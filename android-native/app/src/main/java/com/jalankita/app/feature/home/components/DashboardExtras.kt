package com.jalankita.app.feature.home.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.jalankita.app.core.network.PatrolScheduleDto
import com.jalankita.app.ui.components.AppIcon
import com.jalankita.app.ui.theme.BrandBlue
import com.jalankita.app.ui.theme.TextDark
import com.jalankita.app.ui.theme.TextMuted

/**
 * Dua aksi cepat — port home.tsx:353-376.
 * Upload = bg primary putih; Laporan Saya = putih border #E2E8F0.
 */
@Composable
fun QuickActions(
    onUpload: () -> Unit,
    onHistory: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        val shape = RoundedCornerShape(8.dp)
        // Tinggi minimum eksplisit & sama di kedua kartu agar selalu sejajar.
        val cardSize = Modifier.weight(1f).heightIn(min = 76.dp)
        Row(
            modifier = cardSize
                .clip(shape)
                .background(BrandBlue)
                .clickable(onClick = onUpload)
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(AppIcon.UploadPhoto, contentDescription = null, tint = Color.White,
                modifier = Modifier.size(28.dp))
            Spacer(Modifier.width(12.dp))
            Column {
                Text("Upload Laporan", color = Color.White, fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold)
                Text("Ambil foto & analisis", color = Color.White.copy(alpha = 0.7f),
                    fontSize = 12.sp)
            }
        }
        Row(
            modifier = cardSize
                .clip(shape)
                .background(Color.White)
                .border(1.dp, Color(0xFFE2E8F0), shape)
                .clickable(onClick = onHistory)
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(AppIcon.Description, contentDescription = null, tint = BrandBlue,
                modifier = Modifier.size(28.dp))
            Spacer(Modifier.width(12.dp))
            Column {
                Text("Laporan Saya", color = TextDark, fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold)
                Text("Lihat riwayat", color = TextMuted, fontSize = 12.sp)
            }
        }
    }
}

/** Ringkasan jadwal patroli ringkas — port PatrolScheduleCard compact (home.tsx:263-267). */
@Composable
fun PatrolCompactCard(
    schedules: List<PatrolScheduleDto>,
    modifier: Modifier = Modifier,
) {
    val shape = RoundedCornerShape(12.dp)
    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(shape)
            .background(Color.White)
            .border(1.dp, Color(0xFFE2E8F0), shape)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        schedules.take(2).forEach { s ->
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(AppIcon.CalendarMonth, contentDescription = null, tint = BrandBlue,
                    modifier = Modifier.size(20.dp))
                Spacer(Modifier.width(8.dp))
                Column(Modifier.weight(1f)) {
                    Text(
                        text = s.kecamatanList?.take(3)?.joinToString(", ") ?: "Semua kecamatan",
                        color = TextDark, fontSize = 14.sp, fontWeight = FontWeight.SemiBold,
                    )
                    Text(
                        text = listOfNotNull(
                            s.hari?.joinToString(", "),
                            listOfNotNull(s.jamMulai, s.jamSelesai)
                                .joinToString("–").takeIf { it.isNotBlank() },
                        ).joinToString(" • "),
                        color = TextMuted, fontSize = 12.sp,
                    )
                }
                StatusBadge(raw = s.status ?: "aktif")
            }
        }
    }
}

/** Header + footer kartu "Laporan Terbaru" — port home.tsx:380-389,464-470. */
@Composable
fun LatestHeader(
    total: Int,
    count: Int,
    onSeeAll: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(topStart = 12.dp, topEnd = 12.dp))
                .background(Color(0xFFF8FAFC))
                .border(1.dp, Color(0xFFE2E8F0))
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = "Laporan Terbaru",
                color = TextDark, fontSize = 15.sp, fontWeight = FontWeight.Bold,
                modifier = Modifier.weight(1f),
            )
            Row(
                modifier = Modifier.clickable(onClick = onSeeAll),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("Lihat Semua", color = BrandBlue, fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold)
                Icon(AppIcon.ChevronRight, contentDescription = null, tint = BrandBlue,
                    modifier = Modifier.size(18.dp))
            }
        }
        if (count > 0) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFFF8FAFC))
                    .border(1.dp, Color(0xFFE2E8F0))
                    .padding(horizontal = 16.dp, vertical = 12.dp),
            ) {
                Text(
                    text = "Menampilkan $count dari $total laporan",
                    color = TextMuted, fontSize = 12.sp, fontWeight = FontWeight.Medium,
                )
            }
            Spacer(Modifier.height(12.dp))
        }
    }
}

/** Empty state laporan — port home.tsx:416-425. */
@Composable
fun RecentEmptyCard(modifier: Modifier = Modifier) {
    val shape = RoundedCornerShape(12.dp)
    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(shape)
            .background(Color.White)
            .border(1.dp, Color(0xFFE2E8F0), shape)
            .padding(vertical = 64.dp, horizontal = 16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            modifier = Modifier
                .size(48.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(Color(0xFFF1F5F9)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(AppIcon.Inbox, contentDescription = null, tint = TextMuted,
                modifier = Modifier.size(22.dp))
        }
        Spacer(Modifier.height(16.dp))
        Text("Belum ada laporan", fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.height(4.dp))
        Text("Upload laporan pertama Anda untuk mulai.", color = TextMuted, fontSize = 13.sp)
    }
}
