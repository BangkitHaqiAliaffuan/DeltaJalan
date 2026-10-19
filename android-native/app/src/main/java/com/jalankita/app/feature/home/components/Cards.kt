package com.jalankita.app.feature.home.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.jalankita.app.core.network.ReportItemDto
import com.jalankita.app.core.util.ImageUrl
import com.jalankita.app.ui.theme.BrandBlue
import com.jalankita.app.ui.theme.DividerLine
import com.jalankita.app.ui.theme.ErrorRed
import com.jalankita.app.ui.theme.StatTint
import com.jalankita.app.ui.theme.StatTintBorder
import com.jalankita.app.ui.theme.TextDark
import com.jalankita.app.ui.theme.TextMuted
import com.jalankita.app.ui.theme.ThumbBg

/**
 * Kartu Overview Operasional — port home.tsx:204-243.
 * Web: gradien #EEF2FF→white, border #C7D2FE, rounded-xl, aspect-square,
 * ikon+angka tengah, label bawah. Hover web → ripple native.
 */
@Composable
fun StatCard(
    icon: ImageVector,
    label: String,
    value: Int,
    color: Color,
    modifier: Modifier = Modifier,
) {
    val shape = RoundedCornerShape(12.dp)
    Column(
        modifier = modifier
            .aspectRatio(1f)
            .clip(shape)
            .background(Brush.verticalGradient(listOf(StatTint, Color.White)))
            .border(1.dp, StatTintBorder, shape)
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(24.dp))
            Spacer(Modifier.width(6.dp))
            Text(text = "$value", color = color, fontSize = 24.sp, fontWeight = FontWeight.Bold)
        }
        Spacer(Modifier.height(6.dp))
        Text(
            text = label,
            color = color.copy(alpha = 0.8f),
            fontSize = 14.sp,
            fontWeight = FontWeight.Medium,
        )
    }
}

/**
 * Kartu laporan — port jk/ReportCard (thumbnail 4:3 + judul + badge + kode +
 * status + district + mini-progress + grid meta + PCI + aksi kontekstual).
 */
@Composable
fun ReportCard(
    report: ReportItemDto,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    showDeadline: Boolean = true,
    actions: (@Composable () -> Unit)? = null,
) {
    val shape = RoundedCornerShape(12.dp)
    val late = report.terlambatReview || report.terlambatResolusi
    val duplicate = report.isDuplicate || report.duplicateScore != null
    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(shape)
            .background(Color.White)
            .border(
                width = if (late) 2.dp else 1.dp,
                color = if (late) ErrorRed
                else if (duplicate) Color(0xFFF59E0B)
                else DividerLine,
                shape = shape,
            )
            .clickable(onClick = onClick)
            .padding(16.dp),
    ) {
        // Thumbnail 4:3 + fallback ikon.
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
        } else {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .aspectRatio(4f / 3f)
                    .clip(RoundedCornerShape(8.dp))
                    .background(ThumbBg),
                contentAlignment = Alignment.Center,
            ) {
                Icon(com.jalankita.app.ui.components.AppIcon.Camera,
                    contentDescription = null, tint = Color(0xFFC4D4E6),
                    modifier = Modifier.size(48.dp))
            }
        }
        Spacer(Modifier.height(8.dp))
        // Judul + badge kanan (Terlambat / Duplikat / Warga).
        Row(verticalAlignment = Alignment.Top) {
            Text(
                text = report.roadName ?: "Nama jalan belum diisi",
                color = TextDark,
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f),
            )
            if (late || duplicate || report.source == "warga") {
                Spacer(Modifier.width(8.dp))
                Column(
                    horizontalAlignment = Alignment.End,
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                    modifier = Modifier.padding(top = 2.dp),
                ) {
                    if (late) CardMiniBadge("Terlambat", Color(0xFFFEE2E2), ErrorRed, Color(0xFFFECACA))
                    if (duplicate) CardMiniBadge("Duplikat", Color(0xFFFFFBEB), Color(0xFFD97706), Color(0xFFFDE68A))
                    if (report.source == "warga") {
                        CardMiniBadge("Warga", Color(0xFFFAF5FF), Color(0xFF7C3AED), Color(0xFFE9D5FF))
                    }
                }
            }
        }
        Spacer(Modifier.height(4.dp))
        // Kode mono + tanggal relatif.
        Row(verticalAlignment = Alignment.CenterVertically) {
            report.reportCode?.let {
                Text(text = it, color = BrandBlue, fontSize = 10.sp,
                    fontWeight = FontWeight.Bold, fontFamily = monospace())
                Spacer(Modifier.width(6.dp))
                Text("•", color = Color(0xFFCBD5E1), fontSize = 10.sp)
                Spacer(Modifier.width(6.dp))
            }
            report.createdAt?.let {
                Text(formatDateRelative(it), color = Color(0xFF94A3B8), fontSize = 10.sp)
            }
        }
        Spacer(Modifier.height(4.dp))
        // Status dot + label.
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier.size(8.dp)
                    .clip(RoundedCornerShape(999.dp))
                    .background(statusDotColor(report.status)),
            )
            Spacer(Modifier.width(6.dp))
            Text(displayStatus(report.status), color = Color(0xFF475569), fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold)
        }
        report.district?.let {
            Spacer(Modifier.height(4.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(com.jalankita.app.ui.components.AppIcon.Map,
                    contentDescription = null, tint = Color(0xFF94A3B8),
                    modifier = Modifier.size(12.dp))
                Spacer(Modifier.width(4.dp))
                Text("Kec. $it", color = Color(0xFF64748B), fontSize = 10.sp,
                    maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
        // Mini progress (Sedang Diperbaiki + estimasi).
        val est = report.estimasiHari
        if (report.status == "Sedang Diperbaiki" && est != null && est > 0) {
            Spacer(Modifier.height(8.dp))
            val count = report.progressUpdatesCount
            Text("Hari ${minOf(count + 1, est)}/$est", color = Color(0xFF1A4F8A), fontSize = 10.sp)
            Spacer(Modifier.height(4.dp))
            val pct = (count.toFloat() / est).coerceIn(0f, 1f)
            Box(
                modifier = Modifier.fillMaxWidth().height(6.dp)
                    .clip(RoundedCornerShape(999.dp)).background(Color(0xFFE2E8F0)),
            ) {
                Box(
                    modifier = Modifier.fillMaxWidth(pct).height(6.dp)
                        .clip(RoundedCornerShape(999.dp)).background(Color(0xFF1A4F8A)),
                )
            }
        }
        Spacer(Modifier.height(8.dp))
        Box(Modifier.fillMaxWidth().height(1.dp).background(Color(0xFFF1F5F9)))
        Spacer(Modifier.height(8.dp))
        // Grid meta: Tingkat • Dimensi • Deadline • Pelapor.
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Column(Modifier.weight(1f)) {
                    Text("TINGKAT", color = Color(0xFF94A3B8), fontSize = 9.sp,
                        fontWeight = FontWeight.Bold)
                    Spacer(Modifier.height(2.dp))
                    Text(report.effectiveSeverity ?: "-",
                        color = severityCardColor(report.effectiveSeverity),
                        fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                }
                Column(Modifier.weight(1f)) {
                    Text("DIMENSI", color = Color(0xFF94A3B8), fontSize = 9.sp,
                        fontWeight = FontWeight.Bold)
                    Spacer(Modifier.height(2.dp))
                    val p = report.kerusakanPanjang
                    val l = report.kerusakanLebar
                    Text(
                        if (p != null) "P: ${p}m • L: ${l ?: "-"}m" else "-",
                        color = TextDark, fontSize = 11.sp,
                    )
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Column(Modifier.weight(1f)) {
                    Text("DEADLINE", color = Color(0xFF94A3B8), fontSize = 9.sp,
                        fontWeight = FontWeight.Bold)
                    Spacer(Modifier.height(2.dp))
                    val info = com.jalankita.app.feature.supervisor.components.cardDeadline(
                        status = report.status,
                        deadlineResolusi = report.deadlineResolusi,
                        deadlineReview = report.deadlineReview,
                        show = showDeadline,
                    )
                    if (info != null) {
                        com.jalankita.app.feature.supervisor.components.CardDeadlineRow(info)
                    } else {
                        Text("-", color = TextMuted, fontSize = 11.sp)
                    }
                }
                Column(Modifier.weight(1f)) {
                    Text("PELAPOR", color = Color(0xFF94A3B8), fontSize = 9.sp,
                        fontWeight = FontWeight.Bold)
                    Spacer(Modifier.height(2.dp))
                    Text(report.reporterName ?: "-", color = TextDark, fontSize = 11.sp,
                        maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
            }
        }
        report.pciScore?.let {
            Spacer(Modifier.height(8.dp))
            com.jalankita.app.feature.supervisor.components.CardPciRow(it)
        }
        actions?.let {
            Spacer(Modifier.height(8.dp))
            Box(Modifier.fillMaxWidth().height(1.dp).background(Color(0xFFF1F5F9)))
            Spacer(Modifier.height(8.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.End),
            ) {
                it()
            }
        }
    }
}

/** Badge kecil kanan judul kartu (Terlambat / Duplikat / Warga). */
@Composable
private fun CardMiniBadge(text: String, bg: Color, fg: Color, border: Color) {
    Text(text, color = fg, fontSize = 9.sp, fontWeight = FontWeight.Bold,
        modifier = Modifier.clip(RoundedCornerShape(6.dp)).background(bg)
            .border(1.dp, border, RoundedCornerShape(6.dp))
            .padding(horizontal = 8.dp, vertical = 2.dp))
}

/** Warna teks tingkat keparahan (port ReportCard.tsx:24-29). */
private fun severityCardColor(severity: String?): Color = when {
    severity?.contains("Berat", true) == true -> Color(0xFFE11D48)
    severity?.contains("Sedang", true) == true -> Color(0xFFF97316)
    severity?.contains("Ringan", true) == true -> Color(0xFFF59E0B)
    severity?.contains("Baik", true) == true -> Color(0xFF10B981)
    else -> Color(0xFF64748B)
}

/** Varian tombol aksi kartu (port CardActions.tsx). */
enum class CardActionStyle { PRIMARY, SECONDARY, DESTRUCTIVE }

/** Tombol aksi kartu 11sp bold rounded-lg (port CardActions base). */
@Composable
fun CardActionButton(
    text: String,
    onClick: () -> Unit,
    style: CardActionStyle = CardActionStyle.SECONDARY,
    icon: ImageVector? = null,
    enabled: Boolean = true,
) {
    val shape = RoundedCornerShape(8.dp)
    val (bg, fg, border) = when (style) {
        CardActionStyle.PRIMARY -> Triple(BrandBlue, Color.White, BrandBlue)
        CardActionStyle.SECONDARY -> Triple(Color.White, BrandBlue, BrandBlue)
        CardActionStyle.DESTRUCTIVE -> Triple(Color(0xFFFFF5F5), Color(0xFFDC2626), Color(0xFFFECACA))
    }
    Row(
        modifier = Modifier
            .clip(shape)
            .background(if (enabled) bg else bg.copy(alpha = 0.4f))
            .border(1.dp, border, shape)
            .clickable(enabled = enabled, onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        icon?.let {
            Icon(it, contentDescription = null, tint = fg, modifier = Modifier.size(14.dp))
            Spacer(Modifier.width(4.dp))
        }
        Text(text, color = fg, fontSize = 11.sp, fontWeight = FontWeight.Bold)
    }
}

/** Dialog konfirmasi hapus laporan dari kartu. */
@Composable
fun DeleteConfirmDialog(
    reportCode: String?,
    loading: Boolean,
    onDismiss: () -> Unit,
    onConfirm: () -> Unit,
) {
    androidx.compose.material3.AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Hapus Laporan?", fontWeight = FontWeight.Bold, color = TextDark) },
        text = {
            Text(
                "Laporan ${reportCode ?: ""} dihapus permanen beserta fotonya. Tindakan ini tidak dapat dibatalkan.",
                fontSize = 14.sp, color = TextDark,
            )
        },
        confirmButton = {
            androidx.compose.material3.TextButton(onClick = onConfirm, enabled = !loading) {
                Text("Hapus", color = Color(0xFFDC2626), fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            androidx.compose.material3.TextButton(onClick = onDismiss) {
                Text("Batal", color = TextMuted)
            }
        },
    )
}

/** Placeholder spinner saat thumbnail Coil dimuat dari dalam kartu (dipakai bila perlu). */
@Composable
fun ImageLoadingBox(modifier: Modifier = Modifier) {
    Box(modifier.background(Color(0xFFE8F0FA)), contentAlignment = Alignment.Center) {
        CircularProgressIndicator(color = BrandBlue, modifier = Modifier.size(24.dp))
    }
}
