package com.jalankita.app.ui.components.report

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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.jalankita.app.core.network.ReportItemDto
import com.jalankita.app.feature.home.components.displayStatus
import com.jalankita.app.feature.home.components.formatDateRelative
import com.jalankita.app.feature.home.components.monospace
import com.jalankita.app.feature.home.components.statusDotColor
import com.jalankita.app.ui.components.AppIcon
import com.jalankita.app.ui.components.ReportThumbnail
import com.jalankita.app.ui.theme.TextDark

/**
 * SATU kartu laporan untuk semua peran (petugas, supervisor, warga).
 *
 * Pengganti tiga duplikat lama: `feature/home/components/Cards.kt::ReportCard`,
 * `feature/supervisor/components/SupervisorReportCard.kt`, dan
 * `feature/warga/WargaComponents.kt::WargaReportCard`
 * (PR-4 PLAN-kartu-thumbnail-detail-tinggi.md).
 *
 * Struktur (port penuh Frontend-stable/src/components/jk/ReportCard.tsx):
 *  thumbnail 4:3 → [jalan + badge Terlambat/Duplikat/Warga] → kode·waktu →
 *  dot status → (Ditolak: catatan) → lokasi → (progress bila Sedang Diperbaiki) →
 *  divider → grid 2 kolom (Tingkat/Dimensi/Deadline/Pelapor) → PCI → slot aksi.
 *
 * Perbedaan per-peran disesuaikan lewat parameter, bukan lewat komponen terpisah:
 * - `compact = true` — beranda warga: tanpa divider/grid/PCI/aksi (±260 dp).
 * - `showSourceBadge = false` — layar warga (semua laporannya ber-source "warga").
 * - `rejectedNote` — catatan di bawah dot status saat Ditolak (null untuk sembunyikan).
 *
 * Border: terlambat 2px merah > duplikat 1px amber > normal 1px abu.
 */
private val BRAND_BLUE = Color(0xFF1E40AF)
private val SLATE_400 = Color(0xFF94A3B8)
private val SLATE_500 = Color(0xFF64748B)
private val SLATE_600 = Color(0xFF475569)
private val AMBER = Color(0xFFD97706)
private val PURPLE = Color(0xFF7C3AED)
private val RED = Color(0xFFE11D48)
private val AMBER_BORDER = Color(0xFFF59E0B)
private val BORDER = Color(0xFFE2E8F0)

private val SEVERITY_COLOR: Map<String, Color> = mapOf(
    "Rusak Berat" to Color(0xFFE11D48),
    "Rusak Sedang" to Color(0xFFF97316),
    "Rusak Ringan" to Color(0xFFF59E0B),
    "Baik" to Color(0xFF10B981),
)

@Composable
fun ReportCard(
    report: ReportItemDto,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    compact: Boolean = false,
    showDeadline: Boolean = true,
    showReporter: Boolean = true,
    showSourceBadge: Boolean = true,
    rejectedNote: String? = "Dihapus otomatis 3 hari setelah ditolak",
    actions: (@Composable () -> Unit)? = null,
) {
    val severityLabel = report.effectiveSeverity
    val severityColor = SEVERITY_COLOR[severityLabel ?: ""] ?: SLATE_500
    val deadline = remember(report.id, showDeadline) {
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
        isDuplicate -> AMBER_BORDER
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
        ReportThumbnail(
            url = report.displayImageUrl,
            contentDescription = report.roadName,
            modifier = Modifier.fillMaxWidth().aspectRatio(4f / 3f),
        )

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
                Row(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    if (isTerlambat) CardLateBadge("Terlambat", Color(0xFFFEF2F2), RED, Color(0xFFFECACA))
                    if (isDuplicate) CardLateBadge("Duplikat", Color(0xFFFFFBEB), AMBER, Color(0xFFFDE68A))
                    if (report.source == "warga" && showSourceBadge) {
                        CardLateBadge("Warga", Color(0xFFFAF5FF), PURPLE, Color(0xFFE9D5FF))
                    }
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
                    fontFamily = monospace(),
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
                Text(
                    displayStatus(report.status),
                    color = SLATE_600,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                )
            }

            // ── Khusus Ditolak (tidak di mode ringkas) ──
            if (!compact && report.status == "Ditolak" && rejectedNote != null) {
                Spacer(Modifier.height(2.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(AppIcon.Info, contentDescription = null, tint = SLATE_400, modifier = Modifier.size(11.dp))
                    Spacer(Modifier.width(4.dp))
                    Text(rejectedNote, color = SLATE_400, fontSize = 10.sp)
                }
            }
            Spacer(Modifier.height(6.dp))

            // ── Lokasi ──
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(AppIcon.Map, contentDescription = null, tint = SLATE_400, modifier = Modifier.size(12.dp))
                Spacer(Modifier.width(4.dp))
                Text(
                    report.district ?: "-",
                    color = SLATE_500,
                    fontSize = 10.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }

            // ── Mini progress bar ──
            val est = report.estimasiHari
            if (report.status == "Sedang Diperbaiki" && est != null && est > 0) {
                Spacer(Modifier.height(8.dp))
                val day = minOf(report.progressUpdatesCount + 1, est)
                Text("Hari $day/$est", color = BRAND_BLUE, fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
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
                            .background(BRAND_BLUE),
                    )
                }
            }

            if (!compact) {
                Spacer(Modifier.height(12.dp))
                CardDivider()
                Spacer(Modifier.height(10.dp))

                // ── Grid 2 kolom: Tingkat/Dimensi/Deadline/Pelapor ──
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        GridCell("Tingkat", Modifier.weight(1f)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(AppIcon.Warning, contentDescription = null, tint = severityColor, modifier = Modifier.size(12.dp))
                                Spacer(Modifier.width(4.dp))
                                Text(
                                    severityLabel ?: "-",
                                    color = TextDark,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                )
                            }
                        }
                        GridCell("Dimensi", Modifier.weight(1f)) {
                            val dim = if (report.kerusakanPanjang != null || report.kerusakanLebar != null) {
                                "P: ${fmt(report.kerusakanPanjang)}m • L: ${fmt(report.kerusakanLebar)}m"
                            } else "-"
                            Text(
                                dim,
                                color = TextDark,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.SemiBold,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                        }
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        if (showDeadline && deadline != null) {
                            GridCell("Deadline", Modifier.weight(1f)) { CardDeadlineRow(deadline) }
                        }
                        if (showReporter) {
                            GridCell("Pelapor", Modifier.weight(1f)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(AppIcon.Person, contentDescription = null, tint = SLATE_500, modifier = Modifier.size(12.dp))
                                    Spacer(Modifier.width(4.dp))
                                    Text(
                                        report.reporterName ?: "Anonim",
                                        color = TextDark,
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis,
                                    )
                                }
                            }
                        }
                    }
                }

                // ── PCI ──
                if (report.pciScore != null) {
                    Spacer(Modifier.height(10.dp))
                    CardPciRow(report.pciScore)
                }

                // ── Aksi (slot) ──
                actions?.let {
                    Spacer(Modifier.height(12.dp))
                    CardDivider()
                    Spacer(Modifier.height(10.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.End),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        it()
                    }
                }
            }
        }
    }
}

private fun fmt(v: Double?): String =
    if (v == null) "-" else String.format(java.util.Locale.US, "%.1f", v)
