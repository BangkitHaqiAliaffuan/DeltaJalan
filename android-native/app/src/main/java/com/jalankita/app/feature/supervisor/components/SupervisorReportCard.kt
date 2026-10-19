package com.jalankita.app.feature.supervisor.components

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
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.jalankita.app.core.network.ReportItemDto
import com.jalankita.app.core.util.ImageUrl
import com.jalankita.app.feature.home.components.displayStatus
import com.jalankita.app.feature.home.components.formatDateRelative
import com.jalankita.app.feature.home.components.statusDotColor
import com.jalankita.app.ui.components.AppIcon
import com.jalankita.app.ui.theme.TextDark
import com.jalankita.app.ui.theme.TextMuted

/**
 * Port penuh Frontend-stable/src/components/jk/ReportCard.tsx untuk supervisor.
 *
 * Struktur (urut sama dgn web):
 *  thumbnail 4:3 → [header: jalan + badge Terlambat/Duplikat/Warga] → kode·waktu →
 *  dot status → (Ditolak: info auto-hapus) → lokasi → (progress bar bila Sedang Diperbaiki) →
 *  divider → grid 2 kolom (Tingkat/Dimensi/[Deadline]/Pelapor) → PCI → actions.
 *
 * Border: terlambat 2px merah > duplikat 1px amber > normal 1px abu.
 * TIDAK mengubah kartu petugas/warga (komponen terpisah).
 */
private val BRAND_BLUE = Color(0xFF1E40AF)
private val SLATE_400 = Color(0xFF94A3B8)
private val SLATE_500 = Color(0xFF64748B)
private val SLATE_600 = Color(0xFF475569)
private val DIVIDER = Color(0xFFF1F5F9)
private val BORDER = Color(0xFFE2E8F0)
private val AMBER = Color(0xFFD97706)
private val PURPLE = Color(0xFF7C3AED)
private val RED = Color(0xFFE11D48)
private val THUMB_BG = Color(0xFFE8F0FA)

private val SEVERITY_COLOR: Map<String, Color> = mapOf(
    "Rusak Berat" to Color(0xFFE11D48),
    "Rusak Sedang" to Color(0xFFF97316),
    "Rusak Ringan" to Color(0xFFF59E0B),
    "Baik" to Color(0xFF10B981),
)

@Composable
fun SupervisorReportCard(
    report: ReportItemDto,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    showDeadline: Boolean = true,
    actions: List<CardAction> = emptyList(),
) {
    val severityLabel = report.effectiveSeverity
    val severityColor = SEVERITY_COLOR[severityLabel ?: ""] ?: Color(0xFF64748B)
    val deadline = remember(report.id) {
        cardDeadline(report.status, report.deadlineResolusi, report.deadlineReview, showDeadline)
    }
    val isTerlambat = showDeadline && (
        report.statusDeadline == "terlambat" || report.terlambatReview || report.terlambatResolusi
        )
    val isDuplicate = report.isDuplicate

    val shape = RoundedCornerShape(12.dp)
    val borderWidth = if (isTerlambat) 2.dp else 1.dp
    val borderColor = when {
        isTerlambat -> RED
        isDuplicate -> Color(0xFFF59E0B)
        else -> BORDER
    }

    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(shape)
            .background(Color.White)
            .border(borderWidth, borderColor, shape)
            .clickable(onClick = onClick),
    ) {
        // ── Thumbnail 4:3 ──
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(4f / 3f)
                .background(THUMB_BG),
        ) {
            val url = ImageUrl.resolve(report.displayImageUrl)
            if (url != null) {
                AsyncImage(
                    model = url,
                    contentDescription = report.roadName,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxWidth().aspectRatio(4f / 3f),
                )
            } else {
                Box(Modifier.fillMaxWidth().aspectRatio(4f / 3f), contentAlignment = Alignment.Center) {
                    Icon(AppIcon.Gallery, contentDescription = null, tint = Color(0xFFC4D4E6), modifier = Modifier.size(40.dp))
                }
            }
        }

        Column(modifier = Modifier.padding(16.dp)) {
            // ── Header: jalan + badge ──
            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
                Text(
                    text = report.roadName ?: "Nama jalan belum diisi",
                    color = TextDark,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                    if (isTerlambat) CardLateBadge("Terlambat", Color(0xFFFEF2F2), RED, Color(0xFFFECACA))
                    if (isDuplicate) CardLateBadge("Duplikat", Color(0xFFFFFBEB), AMBER, Color(0xFFFDE68A))
                    if (report.source == "warga") CardLateBadge("Warga", Color(0xFFFAF5FF), PURPLE, Color(0xFFE9D5FF))
                }
            }
            Spacer(Modifier.height(8.dp))

            // ── Kode • waktu ──
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = report.reportCode ?: "-",
                    color = BRAND_BLUE,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace,
                )
                Text("  •  ", color = Color(0xFFCBD5E1), fontSize = 10.sp)
                Text(
                    text = report.createdAt?.let { formatDateRelative(it) } ?: "-",
                    color = SLATE_400,
                    fontSize = 10.sp,
                )
            }
            Spacer(Modifier.height(6.dp))

            // ── Dot status ──
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(8.dp)
                        .clip(RoundedCornerShape(999.dp))
                        .background(statusDotColor(report.status)),
                )
                Spacer(Modifier.width(6.dp))
                Text(displayStatus(report.status), color = SLATE_600, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
            }

            // ── Khusus Ditolak ──
            if (report.status == "Ditolak") {
                Spacer(Modifier.height(2.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(AppIcon.Info, contentDescription = null, tint = SLATE_400, modifier = Modifier.size(11.dp))
                    Spacer(Modifier.width(4.dp))
                    Text("Dihapus otomatis 3 hari setelah ditolak", color = SLATE_400, fontSize = 10.sp)
                }
            }
            Spacer(Modifier.height(6.dp))

            // ── Lokasi ──
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(AppIcon.Map, contentDescription = null, tint = SLATE_400, modifier = Modifier.size(12.dp))
                Spacer(Modifier.width(4.dp))
                Text(report.district ?: "-", color = SLATE_500, fontSize = 10.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }

            // ── Mini progress bar ──
            val est = report.estimasiHari
            if (report.status == "Sedang Diperbaiki" && est != null && est > 0) {
                Spacer(Modifier.height(8.dp))
                val day = minOf(report.progressUpdatesCount + 1, est)
                Text("Hari $day/$est", color = Color(0xFF1A4F8A), fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(4.dp))
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(6.dp)
                        .clip(RoundedCornerShape(999.dp))
                        .background(BORDER),
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth((report.progressUpdatesCount.toFloat() / est).coerceIn(0f, 1f))
                            .height(6.dp)
                            .clip(RoundedCornerShape(999.dp))
                            .background(Color(0xFF1A4F8A)),
                    )
                }
            }

            Spacer(Modifier.height(12.dp))
            Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(DIVIDER))
            Spacer(Modifier.height(10.dp))

            // ── Grid 2 kolom ──
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    GridCell("Tingkat", Modifier.weight(1f)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(AppIcon.Warning, contentDescription = null, tint = severityColor, modifier = Modifier.size(12.dp))
                            Spacer(Modifier.width(4.dp))
                            Text(severityLabel ?: "-", color = TextDark, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                    }
                    GridCell("Dimensi", Modifier.weight(1f)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            val dim = if (report.kerusakanPanjang != null || report.kerusakanLebar != null) {
                                "P: ${fmt(report.kerusakanPanjang)}m • L: ${fmt(report.kerusakanLebar)}m"
                            } else "-"
                            Text(dim, color = TextDark, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    if (showDeadline && deadline != null) {
                        GridCell("Deadline", Modifier.weight(1f)) { CardDeadlineRow(deadline) }
                    }
                    GridCell("Pelapor", Modifier.weight(1f)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(AppIcon.Person, contentDescription = null, tint = SLATE_500, modifier = Modifier.size(12.dp))
                            Spacer(Modifier.width(4.dp))
                            Text(report.reporterName ?: "Anonim", color = TextDark, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                    }
                }
            }

            // ── PCI ──
            if (report.pciScore != null) {
                Spacer(Modifier.height(10.dp))
                CardPciRow(report.pciScore)
            }

            // ── Actions ──
            if (actions.isNotEmpty()) {
                Spacer(Modifier.height(12.dp))
                Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(DIVIDER))
                Spacer(Modifier.height(10.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.End),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    actions.forEach { CardActionButton(it) }
                }
            }
        }
    }
}

@Composable
private fun GridCell(label: String, modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    Column(modifier = modifier) {
        Text(
            text = label.uppercase(),
            color = SLATE_400,
            fontSize = 9.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 1.sp,
        )
        Spacer(Modifier.height(2.dp))
        content()
    }
}

@Composable
private fun CardActionButton(action: CardAction) {
    val (bg, fg, borderColor) = when (action.variant) {
        CardActionVariant.PRIMARY -> Triple(BRAND_BLUE, Color.White, BRAND_BLUE)
        CardActionVariant.SECONDARY -> Triple(Color.White, BRAND_BLUE, BRAND_BLUE)
        CardActionVariant.DESTRUCTIVE -> Triple(Color(0xFFFEF2F2), RED, Color(0xFFFECACA))
    }
    val shape = RoundedCornerShape(8.dp)
    Row(
        modifier = Modifier
            .clip(shape)
            .background(if (action.disabled) bg.copy(alpha = 0.4f) else bg)
            .border(1.dp, borderColor, shape)
            .clickable(enabled = !action.disabled, onClick = action.onClick)
            .padding(horizontal = if (action.iconOnly) 8.dp else 12.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        action.icon?.let {
            Icon(it, contentDescription = action.label, tint = fg, modifier = Modifier.size(13.dp))
            if (!action.iconOnly) Spacer(Modifier.width(4.dp))
        }
        if (!action.iconOnly) {
            Text(action.label, color = fg, fontSize = 11.sp, fontWeight = FontWeight.Bold)
        }
    }
}

private fun fmt(v: Double?): String =
    if (v == null) "-" else String.format(java.util.Locale.US, "%.1f", v)
