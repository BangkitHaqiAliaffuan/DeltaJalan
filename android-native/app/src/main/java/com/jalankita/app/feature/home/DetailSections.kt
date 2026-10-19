package com.jalankita.app.feature.home

import android.content.Intent
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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import coil.compose.AsyncImage
import com.jalankita.app.core.network.PetugasAfterPhotoDto
import com.jalankita.app.core.network.PetugasDuplicateOfDto
import com.jalankita.app.core.network.PetugasPhotoDto
import com.jalankita.app.core.network.PetugasStatusHistoryDto
import com.jalankita.app.core.network.ReportItemDto
import com.jalankita.app.core.util.ImageUrl
import com.jalankita.app.feature.home.components.displayStatus
import com.jalankita.app.feature.home.components.formatDateShort
import com.jalankita.app.feature.home.components.formatDistance
import com.jalankita.app.feature.home.components.haversineDistance
import com.jalankita.app.feature.home.components.statusDotColor
import com.jalankita.app.feature.supervisor.components.CardDeadlineRow
import com.jalankita.app.feature.supervisor.components.PciCard
import com.jalankita.app.feature.supervisor.components.cardDeadline
import com.jalankita.app.feature.supervisor.components.extractRejectReason
import com.jalankita.app.ui.components.AppIcon
import com.jalankita.app.ui.theme.BrandBlue
import com.jalankita.app.ui.theme.ErrorRed
import com.jalankita.app.ui.theme.SuccessGreen
import com.jalankita.app.ui.theme.TextDark
import com.jalankita.app.ui.theme.TextMuted
import com.jalankita.app.ui.theme.WarningAmber
import java.util.Locale

private fun fmt1(v: Double): String = String.format(Locale.US, "%.1f", v)

/** Kartu putih standar seksi detail. */
@Composable
fun DetailSectionCard(content: @Composable () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(Color.White)
            .border(1.dp, Color(0xFFE2E8F0), RoundedCornerShape(12.dp))
            .padding(16.dp),
    ) {
        content()
    }
}

// ── Foto per-foto + toggle Asli/Deteksi AI + meta ──────────────────────────
// Port detail-report.tsx:691-822 (adaptasi PhotoCard supervisor).

/** Bungkus foto utama bila `photos` kosong (port SinglePhotoAdapter). */
fun singlePetugasPhoto(report: ReportItemDto): PetugasPhotoDto = PetugasPhotoDto(
    id = "report",
    imageOriginalUrl = report.imageOriginalUrl,
    imageResultUrl = report.imageResultUrl,
    aiSeverity = report.aiSeverity,
    totalDetections = report.totalDetections,
    kerusakanPanjang = report.kerusakanPanjang,
    kerusakanLebar = report.kerusakanLebar,
)

@Composable
fun PetugasPhotoCard(p: PetugasPhotoDto) {
    val stateKey = p.id ?: p.imageOriginalUrl ?: p.imageResultUrl ?: "photo"
    var showAi by remember(stateKey) { mutableStateOf(true) }
    val original = ImageUrl.resolve(p.imageOriginalUrl)
    val result = ImageUrl.resolve(p.imageResultUrl)
    val hasToggle = result != null && original != null && result != original
    val shown = if (hasToggle && showAi) result else original

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(Color.White)
            .border(1.dp, Color(0xFFE2E8F0), RoundedCornerShape(12.dp)),
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(260.dp)
                .background(Color(0xFF0F172A)),
            contentAlignment = Alignment.Center,
        ) {
            if (shown != null) {
                AsyncImage(
                    model = shown,
                    contentDescription = "Foto laporan",
                    contentScale = ContentScale.Fit,
                    modifier = Modifier.fillMaxWidth().height(260.dp),
                )
            } else {
                Icon(AppIcon.Camera, contentDescription = null, tint = Color(0xFF94A3B8),
                    modifier = Modifier.size(40.dp))
            }
            if (hasToggle) {
                Row(
                    modifier = Modifier.align(Alignment.TopStart).padding(12.dp),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    PetugasToggleChip("Deteksi AI", showAi) { showAi = true }
                    PetugasToggleChip("Asli", !showAi) { showAi = false }
                }
            }
        }
        // Meta AI: jenis • severity • confidence • jumlah deteksi.
        if (!p.aiSeverity.isNullOrBlank() || p.aiConfidence != null || p.totalDetections != null) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(AppIcon.CheckCircle, contentDescription = null, tint = SuccessGreen,
                    modifier = Modifier.size(13.dp))
                Spacer(Modifier.width(6.dp))
                val parts = buildList {
                    p.aiJenisKerusakan?.let { add(it) }
                    p.aiSeverity?.let { add(it) }
                    p.aiConfidence?.let { add("${(it * 100).toInt()}%") }
                    p.totalDetections?.let { add("$it deteksi") }
                }
                Text(parts.joinToString(" • "), color = TextMuted, fontSize = 11.sp)
            }
        }
        // Dimensi per foto.
        p.kerusakanPanjang?.let { panjang ->
            val lebar = p.kerusakanLebar
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(AppIcon.Description, contentDescription = null, tint = TextMuted,
                    modifier = Modifier.size(13.dp))
                Spacer(Modifier.width(6.dp))
                val dim = if (lebar != null) {
                    "P: ${fmt1(panjang)}m × L: ${fmt1(lebar)}m (${fmt1(panjang * lebar)} m²)"
                } else "P: ${fmt1(panjang)}m"
                Text(dim, color = TextMuted, fontSize = 11.sp)
            }
        }
        // Tanggal pengambilan.
        p.photoTakenAt?.let {
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(AppIcon.CalendarMonth, contentDescription = null, tint = TextMuted,
                    modifier = Modifier.size(13.dp))
                Spacer(Modifier.width(6.dp))
                Text(formatDateShort(it), color = TextMuted, fontSize = 11.sp)
            }
        }
        // MobileCLIP.
        if (p.mobileclipScore != null || !p.mobileclipLabel.isNullOrBlank()) {
            val ok = (p.mobileclipScore ?: 0.0) >= 0.15
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(
                    if (ok) AppIcon.CheckCircle else AppIcon.Warning,
                    contentDescription = null,
                    tint = if (ok) Color(0xFF16A34A) else Color(0xFFF59E0B),
                    modifier = Modifier.size(13.dp),
                )
                Spacer(Modifier.width(6.dp))
                val label = p.mobileclipLabel ?: "—"
                val pct = p.mobileclipScore?.let { "${(it * 100).toInt()}%" } ?: ""
                Text("AI: $label ($pct)", color = TextMuted, fontSize = 11.sp)
            }
        }
        // Kualitas foto (hanya bila bermasalah).
        val q = p.qualityScores
        if (q != null && q.status != null && q.status != "good") {
            val qLabel = when (q.status) {
                "blurry" -> "Kabur"
                "too_dark" -> "Terlalu Gelap"
                "too_bright" -> "Terlalu Terang"
                "low_contrast" -> "Kontras Rendah"
                else -> "Gagal Analisis"
            }
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(AppIcon.Warning, contentDescription = null, tint = Color(0xFFF59E0B),
                    modifier = Modifier.size(13.dp))
                Spacer(Modifier.width(6.dp))
                val extra = listOfNotNull(
                    q.blurScore?.let { "ketajaman ${it.toInt()}" },
                    q.meanBrightness?.let { "kecerahan ${it.toInt()}" },
                ).joinToString(", ")
                Text("$qLabel${if (extra.isNotBlank()) " ($extra)" else ""}",
                    color = TextMuted, fontSize = 11.sp)
            }
        }
    }
}

@Composable
fun PetugasToggleChip(label: String, active: Boolean, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(6.dp))
            .background(if (active) BrandBlue else Color.Black.copy(alpha = 0.5f))
            .clickable(onClick = onClick)
            .padding(horizontal = 10.dp, vertical = 4.dp),
    ) {
        Text(label, color = if (active) Color.White else Color.White.copy(alpha = 0.6f),
            fontSize = 10.sp, fontWeight = FontWeight.Bold)
    }
}

// ── Progress bar estimasi ───────────────────────────────────────────────────

@Composable
fun PetugasProgressBar(doneDays: Int, estimasi: Int, isSelesai: Boolean = false) {
    val pct = if (isSelesai) 1f else (doneDays.toFloat() / estimasi).coerceIn(0f, 1f)
    val barColor = if (isSelesai) SuccessGreen else Color(0xFF1A4F8A)
    DetailSectionCard {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(if (isSelesai) AppIcon.CheckCircle else AppIcon.Construction, contentDescription = null,
                    tint = barColor, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(6.dp))
                Text("Progress Perbaikan", color = TextDark, fontSize = 13.sp,
                    fontWeight = FontWeight.Bold)
            }
            Text(if (isSelesai) "Selesai (100%)" else "Hari ${minOf(doneDays, estimasi)} dari $estimasi",
                color = barColor, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
        }
        Spacer(Modifier.height(8.dp))
        Box(
            modifier = Modifier.fillMaxWidth().height(8.dp)
                .clip(RoundedCornerShape(999.dp)).background(Color(0xFFE2E8F0)),
        ) {
            Box(
                modifier = Modifier.fillMaxWidth(pct).height(8.dp)
                    .clip(RoundedCornerShape(999.dp)).background(barColor),
            )
        }
        if (isSelesai || doneDays >= estimasi) {
            Spacer(Modifier.height(6.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(AppIcon.CheckCircle, contentDescription = null, tint = SuccessGreen,
                    modifier = Modifier.size(14.dp))
                Spacer(Modifier.width(4.dp))
                Text(if (isSelesai) "Perbaikan telah selesai" else "Estimasi terpenuhi, silakan selesaikan laporan",
                    color = SuccessGreen, fontSize = 11.sp)
            }
        }
    }
}

// ── Galeri after + lightbox ─────────────────────────────────────────────────
// Port AfterPhotoGallery detail-report.tsx:1852-1962.

@Composable
fun PetugasAfterGallery(
    photos: List<PetugasAfterPhotoDto>,
    notes: String?,
) {
    var lightbox by remember { mutableStateOf<Int?>(null) }
    DetailSectionCard {
        Text("Foto Setelah Perbaikan", color = TextDark, fontSize = 13.sp,
            fontWeight = FontWeight.Bold)
        notes?.takeIf { it.isNotBlank() }?.let {
            Spacer(Modifier.height(4.dp))
            Text(it, color = Color(0xFF475569), fontSize = 12.sp)
        }
        Spacer(Modifier.height(10.dp))
        LazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            itemsIndexed(photos, key = { idx, p -> p.id ?: "after-$idx" }) { idx, p ->
                val u = ImageUrl.resolve(p.url)
                if (u != null) {
                    AsyncImage(
                        model = u,
                        contentDescription = "Foto sesudah perbaikan ${idx + 1}",
                        contentScale = ContentScale.Crop,
                        modifier = Modifier
                            .size(72.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(Color(0xFFE8F0FA))
                            .clickable { lightbox = idx },
                    )
                }
            }
        }
    }
    lightbox?.let { idx ->
        val u = ImageUrl.resolve(photos.getOrNull(idx)?.url)
        if (u != null) {
            Dialog(
                onDismissRequest = { lightbox = null },
                properties = DialogProperties(usePlatformDefaultWidth = false),
            ) {
                Box(
                    modifier = Modifier.fillMaxWidth()
                        .background(Color.Black.copy(alpha = 0.9f))
                        .padding(16.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        AsyncImage(
                            model = u,
                            contentDescription = "Foto sesudah perbaikan",
                            contentScale = ContentScale.Fit,
                            modifier = Modifier.fillMaxWidth().height(320.dp),
                        )
                        Spacer(Modifier.height(12.dp))
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(24.dp),
                        ) {
                            Text("‹", color = Color.White, fontSize = 28.sp,
                                modifier = Modifier.clickable(
                                    enabled = idx > 0,
                                ) { if (idx > 0) lightbox = idx - 1 })
                            Text("${idx + 1} / ${photos.size}", color = Color.White, fontSize = 14.sp)
                            Text("›", color = Color.White, fontSize = 28.sp,
                                modifier = Modifier.clickable(
                                    enabled = idx < photos.size - 1,
                                ) { if (idx < photos.size - 1) lightbox = idx + 1 })
                        }
                        Spacer(Modifier.height(8.dp))
                        Text("Tutup", color = Color.White, fontSize = 14.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.clickable { lightbox = null })
                    }
                }
            }
        }
    }
}

// ── Penilaian warga ─────────────────────────────────────────────────────────

@Composable
fun PetugasRatingCard(rating: Int, comment: String?) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(Color(0xFFF0FDF4))
            .border(1.dp, Color(0xFFBBF7D0), RoundedCornerShape(10.dp))
            .padding(16.dp),
    ) {
        Text("Penilaian Warga", color = Color(0xFF15803D), fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.height(4.dp))
        Row {
            (1..5).forEach { star ->
                Icon(
                    if (star <= rating) AppIcon.Star else AppIcon.StarOutline,
                    contentDescription = null,
                    tint = if (star <= rating) Color(0xFFF59E0B) else Color(0xFFD0DAE8),
                    modifier = Modifier.size(18.dp),
                )
            }
        }
        comment?.takeIf { it.isNotBlank() }?.let {
            Spacer(Modifier.height(6.dp))
            Text("\"$it\"", color = Color(0xFF166534), fontSize = 13.sp)
        }
    }
}

// ── Baris badges (severity + status + sumber + deadline) ────────────────────

@Composable
fun PetugasBadgeRow(report: ReportItemDto) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        report.effectiveSeverity?.let { PetugasSeverityPill(it) }
        PetugasStatusPill(report.status)
        report.source?.takeIf { it != "petugas" }?.let { PetugasSourcePill(it) }
        cardDeadline(
            status = report.status,
            deadlineResolusi = report.deadlineResolusi,
            deadlineReview = report.deadlineReview,
            show = true,
        )?.let { CardDeadlineRow(it) }
    }
}

@Composable
fun PetugasSeverityPill(severity: String) {
    val (bg, fg) = when {
        severity.contains("Berat", true) -> ErrorRed to Color.White
        severity.contains("Sedang", true) -> Color(0xFFFFF7ED) to Color(0xFFF97316)
        severity.contains("Ringan", true) -> Color(0xFFFFFBEB) to Color(0xFFF59E0B)
        severity.contains("Baik", true) -> Color(0xFFE8F5E9) to Color(0xFF2E7D32)
        else -> Color(0xFFF8FAFC) to Color(0xFF64748B)
    }
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(bg)
            .padding(horizontal = 12.dp, vertical = 4.dp),
    ) {
        Text(severity.uppercase(Locale.US), color = fg, fontSize = 10.sp,
            fontWeight = FontWeight.Bold)
    }
}

@Composable
fun PetugasStatusPill(status: String?) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(Color.White)
            .border(1.dp, Color(0xFFE2E8F0), RoundedCornerShape(999.dp))
            .padding(horizontal = 12.dp, vertical = 4.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier.size(8.dp)
                    .clip(RoundedCornerShape(999.dp))
                    .background(statusDotColor(status)),
            )
            Spacer(Modifier.width(6.dp))
            Text(displayStatus(status), color = Color(0xFF475569), fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
fun PetugasSourcePill(source: String) {
    val (bg, fg, border) = when (source) {
        "warga" -> Triple(Color(0xFFFAF5FF), Color(0xFF7C3AED), Color(0xFFE9D5FF))
        "telegram" -> Triple(Color(0xFFF0F9FF), Color(0xFF0284C7), Color(0xFFBAE6FD))
        else -> Triple(Color(0xFFEFF6FF), Color(0xFF2563EB), Color(0xFFBFDBFE))
    }
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(bg)
            .border(1.dp, border, RoundedCornerShape(999.dp))
            .padding(horizontal = 10.dp, vertical = 4.dp),
    ) {
        Text(source.replaceFirstChar { it.uppercase() }, color = fg, fontSize = 10.sp,
            fontWeight = FontWeight.Bold)
    }
}

// ── Kartu PCI (reuse komponen supervisor) ────────────────────────────────────

@Composable
fun PetugasPciSection(score: Double?) {
    if (score == null) return
    PciCard(score, modifier = Modifier.fillMaxWidth())
}

// ── Alasan ditolak ──────────────────────────────────────────────────────────

@Composable
fun PetugasRejectCard(systemNotes: String?) {
    if (systemNotes == null) return
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(Color.White)
            .border(1.dp, Color(0xFFFECACA), RoundedCornerShape(12.dp))
            .padding(16.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(AppIcon.Error, contentDescription = null, tint = ErrorRed,
                modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(8.dp))
            Text("Laporan Ditolak", color = ErrorRed, fontSize = 13.sp,
                fontWeight = FontWeight.Bold)
        }
        Spacer(Modifier.height(8.dp))
        Text(
            extractRejectReason(systemNotes) ?: "Tidak ada alasan",
            color = Color(0xFF991B1B),
            fontSize = 13.sp,
        )
    }
}

// ── Info jalan grid 2 kolom ─────────────────────────────────────────────────

@Composable
fun PetugasInfoGrid(report: ReportItemDto) {
    DetailSectionCard {
        Text(report.roadName ?: "Nama jalan belum diisi", color = TextDark, fontSize = 17.sp,
            fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(12.dp))
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                PetugasInfoItem(AppIcon.Map, "Kec. ${report.district ?: "-"}", Modifier.weight(1f))
                report.assignedTeamName?.let {
                    PetugasInfoItem(AppIcon.Assignment, "Tim: $it", Modifier.weight(1f))
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                val p = report.kerusakanPanjang
                val l = report.kerusakanLebar
                if (p != null) {
                    val v = if (l != null) "${fmt1(p)}m × ${fmt1(l)}m (${fmt1(p * l)} m²)"
                    else "${fmt1(p)}m"
                    PetugasInfoItem(AppIcon.Description, v, Modifier.weight(1f))
                }
                PetugasInfoItem(
                    AppIcon.CalendarMonth,
                    report.createdAt?.let { formatDateShort(it) } ?: "-",
                    Modifier.weight(1f),
                )
            }
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                PetugasInfoItem(AppIcon.Person, report.reporterName ?: "-", Modifier.weight(1f))
                report.reportCode?.let {
                    PetugasInfoItem(AppIcon.Description, it, Modifier.weight(1f))
                }
            }
        }
        report.description?.takeIf { it.isNotBlank() }?.let { desc ->
            Spacer(Modifier.height(12.dp))
            HorizontalDivider(color = Color(0xFFE2E8F0))
            Spacer(Modifier.height(12.dp))
            Text("Deskripsi Laporan", color = Color(0xFF475569), fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(4.dp))
            Text(desc, color = TextDark, fontSize = 13.sp)
        }
        report.catatanPetugas?.takeIf { it.isNotBlank() }?.let { note ->
            Spacer(Modifier.height(12.dp))
            HorizontalDivider(color = Color(0xFFE2E8F0))
            Spacer(Modifier.height(12.dp))
            Text("Catatan Petugas", color = Color(0xFF92400E), fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(4.dp))
            Text(note, color = Color(0xFF475569), fontSize = 12.sp)
        }
    }
}

@Composable
private fun PetugasInfoItem(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    value: String,
    modifier: Modifier = Modifier,
) {
    Row(modifier = modifier, verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, contentDescription = null, tint = TextMuted, modifier = Modifier.size(16.dp))
        Spacer(Modifier.width(8.dp))
        Text(value, color = TextDark, fontSize = 13.sp, maxLines = 1,
            overflow = TextOverflow.Ellipsis)
    }
}

// ── Timeline status ─────────────────────────────────────────────────────────

@Composable
fun PetugasStatusTimeline(history: List<PetugasStatusHistoryDto>) {
    if (history.isEmpty()) return
    DetailSectionCard {
        Text("Riwayat Perbaikan", color = TextDark, fontSize = 13.sp,
            fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(10.dp))
        history.forEachIndexed { i, h ->
            Row(verticalAlignment = Alignment.Top) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(
                        modifier = Modifier.size(10.dp)
                            .clip(RoundedCornerShape(999.dp)).background(BrandBlue),
                    )
                    if (i < history.size - 1) {
                        Box(
                            modifier = Modifier.width(2.dp).height(28.dp)
                                .background(Color(0xFFE2E8F0)),
                        )
                    }
                }
                Spacer(Modifier.width(10.dp))
                Column(modifier = Modifier.weight(1f).padding(bottom = 6.dp)) {
                    Text(h.label ?: displayStatus(h.status), color = TextDark, fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold)
                    val sub = listOfNotNull(
                        h.actorName,
                        h.timestamp?.replace("T", " ")?.take(16),
                    ).joinToString(" • ")
                    if (sub.isNotBlank()) Text(sub, color = TextMuted, fontSize = 11.sp)
                    h.notes?.takeIf { it.isNotBlank() }?.let {
                        Text(it, color = Color(0xFF475569), fontSize = 11.sp)
                    }
                }
            }
        }
    }
}

// ── Lokasi + Google Maps ────────────────────────────────────────────────────

@Composable
fun PetugasLokasiCard(lat: Double, lng: Double, fullAddress: String?) {
    val context = LocalContext.current
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(Color.White)
            .border(1.dp, Color(0xFFE2E8F0), RoundedCornerShape(12.dp)),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text("Lokasi", color = TextDark, fontSize = 13.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(4.dp))
            Text(
                "${String.format(Locale.US, "%.6f", lat)}, ${String.format(Locale.US, "%.6f", lng)}",
                color = TextMuted,
                fontSize = 11.sp,
                fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace,
            )
            fullAddress?.let {
                Spacer(Modifier.height(6.dp))
                Row(verticalAlignment = Alignment.Top) {
                    Icon(AppIcon.Map, contentDescription = null, tint = TextMuted,
                        modifier = Modifier.size(14.dp))
                    Spacer(Modifier.width(6.dp))
                    Text(it, color = Color(0xFF475569), fontSize = 12.sp)
                }
            }
        }
        HorizontalDivider(color = Color(0xFFE2E8F0))
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable {
                    val url = "https://www.google.com/maps?q=$lat,$lng"
                    runCatching {
                        context.startActivity(Intent(Intent.ACTION_VIEW, android.net.Uri.parse(url)))
                    }
                }
                .padding(12.dp),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(AppIcon.Map, contentDescription = null, tint = BrandBlue,
                modifier = Modifier.size(14.dp))
            Spacer(Modifier.width(6.dp))
            Text("Buka di Google Maps", color = BrandBlue, fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold)
        }
    }
}

// ── Duplikat (gate: duplicateOf != null — is_duplicate tidak dikirim show()) ─

@Composable
fun PetugasDuplicateCard(
    ownLat: Double?,
    ownLng: Double?,
    dup: PetugasDuplicateOfDto,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(Color.White)
            .border(1.dp, Color(0xFFFDE68A), RoundedCornerShape(12.dp))
            .padding(16.dp),
    ) {
        Row(verticalAlignment = Alignment.Top) {
            Box(
                modifier = Modifier.size(36.dp).clip(RoundedCornerShape(8.dp))
                    .background(Color(0xFFFFFBEB))
                    .border(1.dp, Color(0xFFFDE68A), RoundedCornerShape(8.dp)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(AppIcon.Warning, contentDescription = null, tint = WarningAmber,
                    modifier = Modifier.size(18.dp))
            }
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text("Terindikasi Duplikat", color = Color(0xFF92400E), fontSize = 13.sp,
                    fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(4.dp))
                Text(
                    "Laporan ini memiliki kemiripan dengan laporan ${dup.reportCode ?: "-"} " +
                        "(${dup.roadName ?: "-"}, ${dup.district ?: "-"}).",
                    color = Color(0xFF92400E),
                    fontSize = 12.sp,
                )
                if (ownLat != null && ownLng != null && dup.latitude != null && dup.longitude != null) {
                    Spacer(Modifier.height(4.dp))
                    Text(
                        "Jarak: ${formatDistance(haversineDistance(ownLat, ownLng, dup.latitude, dup.longitude))} dari laporan tersebut",
                        color = Color(0xFF92400E),
                        fontSize = 12.sp,
                    )
                }
            }
        }
    }
}
