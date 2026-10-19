package com.jalankita.app.feature.warga

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.jalankita.app.core.network.WargaReportDto
import com.jalankita.app.core.util.ImageUrl
import com.jalankita.app.feature.home.components.StatusBadge
import com.jalankita.app.feature.home.components.formatDateShort
import com.jalankita.app.feature.home.components.monospace
import com.jalankita.app.feature.home.components.statusLabel
import com.jalankita.app.ui.theme.BrandBlue
import com.jalankita.app.ui.theme.DividerLine
import com.jalankita.app.ui.theme.ErrorRed
import com.jalankita.app.ui.theme.TextDark
import com.jalankita.app.ui.theme.TextMuted
import com.jalankita.app.ui.theme.ThumbBg

/** Bottom nav 3 tab warga — meniru WARGA_ITEMS (Beranda/Peta/Laporan). */
@Composable
fun WargaBottomNav(
    selected: WargaTab,
    onSelect: (WargaTab) -> Unit,
    modifier: Modifier = Modifier,
) {
    val bottomInset = WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding()
    Row(
        modifier = modifier
            .fillMaxWidth()
            .background(Color.White)
            .padding(bottom = bottomInset),
    ) {
        WargaTab.values().forEach { tab ->
            val active = tab == selected
            Column(
                modifier = Modifier
                    .weight(1f)
                    .height(64.dp)
                    .clickable(onClick = { onSelect(tab) })
                    .padding(top = 2.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                androidx.compose.foundation.layout.                Box(
                    modifier = Modifier
                        .size(width = 24.dp, height = 2.dp)
                        .background(if (active) BrandBlue else Color.Transparent),
                )
                Icon(
                    imageVector = tab.icon,
                    contentDescription = tab.label,
                    tint = if (active) BrandBlue else TextMuted,
                    modifier = Modifier.size(22.dp),
                )
                Text(
                    text = tab.label,
                    color = if (active) BrandBlue else TextMuted,
                    fontSize = 12.sp,
                    fontWeight = if (active) FontWeight.SemiBold else FontWeight.Normal,
                )
            }
        }
    }
}

/**
 * Kartu laporan warga — gaya jk/ReportCard (thumbnail + kode + jalan + badge).
 * Beda DTO dari versi petugas (tanpa image_original_url/lat-lng).
 */
@Composable
fun WargaReportCard(
    report: WargaReportDto,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    onDelete: (() -> Unit)? = null,
) {
    val shape = RoundedCornerShape(12.dp)
    val late = report.terlambatReview || report.terlambatResolusi
    Column(
        modifier = modifier
            .fillMaxWidth()
            .shadow(2.dp, shape)
            .clip(shape)
            .background(Color.White)
            .border(
                width = if (late) 2.dp else 1.dp,
                color = if (late) ErrorRed else DividerLine,
                shape = shape,
            )
            .clickable(onClick = onClick)
            .padding(12.dp),
    ) {
        val imageUrl = ImageUrl.resolve(report.displayImageUrl)
        if (imageUrl != null) {
            AsyncImage(
                model = imageUrl,
                contentDescription = report.roadName,
                contentScale = ContentScale.Crop,
                modifier = Modifier
                    .fillMaxWidth()
                    .aspectRatio(4f / 3f)
                    .clip(RoundedCornerShape(8.dp))
                    .background(ThumbBg),
            )
            Spacer(Modifier.height(8.dp))
        }
        report.reportCode?.let {
            Text(it, color = TextMuted, fontSize = 12.sp, fontFamily = monospace())
        }
        Text(
            text = report.roadName ?: "Nama jalan belum diisi",
            color = TextDark,
            fontSize = 16.sp,
            fontWeight = FontWeight.SemiBold,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        val meta = listOfNotNull(
            report.district?.let { "Kec. $it" },
            report.createdAt?.let { formatDateShort(it) },
        ).joinToString(" • ")
        if (meta.isNotEmpty()) {
            Text(text = meta, color = TextMuted, fontSize = 13.sp)
        }
        Spacer(Modifier.height(8.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            StatusBadge(raw = report.effectiveSeverity)
            StatusBadge(raw = report.status, labelOverride = statusLabel(report.status))
        }
        if (onDelete != null) {
            Spacer(Modifier.height(8.dp))
            Text(
                text = "Hapus",
                color = Color(0xFFDC2626),
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier
                    .clip(RoundedCornerShape(6.dp))
                    .clickable(onClick = onDelete)
                    .padding(horizontal = 10.dp, vertical = 6.dp),
            )
        }
    }
}
