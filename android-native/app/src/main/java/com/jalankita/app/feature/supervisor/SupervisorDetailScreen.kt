package com.jalankita.app.feature.supervisor

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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
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
import com.jalankita.app.core.network.StatusHistoryDto
import com.jalankita.app.core.network.SupervisorPhotoDto
import com.jalankita.app.core.network.SupervisorReportDetail
import com.jalankita.app.core.util.ImageUrl
import com.jalankita.app.feature.supervisor.components.PciCard
import com.jalankita.app.feature.supervisor.components.TeamPickerSheet
import com.jalankita.app.feature.supervisor.components.TolakFormDialog
import com.jalankita.app.feature.supervisor.components.extractRejectReason
import com.jalankita.app.feature.home.components.displayStatus
import com.jalankita.app.feature.home.components.formatDateShort
import com.jalankita.app.feature.home.components.formatDistance
import com.jalankita.app.feature.home.components.haversineDistance
import com.jalankita.app.ui.components.AppIcon
import com.jalankita.app.ui.components.BeforeAfterSlider
import com.jalankita.app.ui.components.BrandPrimaryButton
import com.jalankita.app.ui.components.BrandSecondaryButton
import com.jalankita.app.ui.components.ErrorBox
import com.jalankita.app.ui.components.InfoBox
import com.jalankita.app.ui.components.WarningBox
import com.jalankita.app.feature.home.components.SkeletonCard
import com.jalankita.app.ui.theme.BrandBlue
import com.jalankita.app.ui.theme.DividerLine
import com.jalankita.app.ui.theme.ErrorRed
import com.jalankita.app.ui.theme.SuccessGreen
import com.jalankita.app.ui.theme.TextDark
import com.jalankita.app.ui.theme.TextMuted
import com.jalankita.app.ui.theme.WarningAmber
import java.util.Locale

/**
 * Detail laporan supervisor — port detail-report.tsx (footer role-aware) (P5+P6).
 * Urutan section mengikuti web: foto per-foto (+toggle AI) → progress → after-photos →
 * penilaian warga → badges(severity/status/sumber/deadline) → PciCard → alasan ditolak →
 * info jalan (grid) → timeline → lokasi(+map) → duplikasi.
 *
 * Guard: TIDAK menampilkan/memanggil aksi eksekusi (mulai/progress/complete/reopen) —
 * server mengizinkan supervisor, tapi itu milik petugas (PLAN-supervisor §2.3-B).
 */
@Composable
fun SupervisorDetailScreen(
    reportId: String,
    vm: SupervisorViewModel,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var showApprove by remember { mutableStateOf(false) }
    var showTolak by remember { mutableStateOf(false) }
    var showTeamPicker by remember { mutableStateOf(false) }

    LaunchedEffect(reportId) { if (reportId.isNotBlank()) vm.loadDetail(reportId) }
    LaunchedEffect(vm.needsTeam) { if (vm.needsTeam) showTeamPicker = true }

    Column(modifier = modifier.fillMaxWidth()) {
        // ── Header bar: back + "Detail Laporan" + kode di kanan ──
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color.White)
                .padding(horizontal = 12.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                AppIcon.ArrowBack,
                contentDescription = "Kembali",
                tint = BrandBlue,
                modifier = Modifier.size(24.dp).clickable(onClick = onBack),
            )
            Spacer(Modifier.width(12.dp))
            Text("Detail Laporan", color = TextDark, fontSize = 16.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
            vm.detail?.reportCode?.let {
                Text(it, color = TextMuted, fontSize = 12.sp, fontFamily = FontFamily.Monospace)
            }
        }
        HorizontalDivider(color = DividerLine, thickness = 1.dp)

        when {
            vm.detailLoading && vm.detail == null -> LazyColumn(
                modifier = Modifier.fillMaxWidth().padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) { items(4) { SkeletonCard() } }

            vm.detail == null -> LazyColumn(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
                item { ErrorBox("Laporan tidak dapat dimuat.", modifier = Modifier.fillMaxWidth()) }
                item {
                    Spacer(Modifier.height(12.dp))
                    BrandSecondaryButton("Kembali", onClick = onBack, modifier = Modifier.fillMaxWidth())
                }
            }

            else -> SupervisorDetailBody(
                d = vm.detail!!,
                onApprove = { showApprove = true },
                onTolak = { showTolak = true },
                onConfirmAi = { vm.confirmAi(vm.detail!!.id) { onBack() } },
                onBack = onBack,
            )
        }
    }

    if (showApprove) {
        vm.detail?.let { d ->
            ApprovalDialog(
                detail = d,
                busy = vm.actionBusy,
                onDismiss = { showApprove = false; vm.clearNeedsTeam() },
                onConfirm = { priority ->
                    // Sukses → tutup dialog + kembali ke tab asal (snackbar sukses
                    // tampil di sana via host Scaffold; antrean sudah di-refresh VM).
                    vm.approve(d.id, d.source, priority, null) { status ->
                        if (status != null) { showApprove = false; onBack() }
                    }
                },
            )
        }
    }
    if (showTolak) {
        vm.detail?.let { d ->
            TolakFormDialog(
                busy = vm.actionBusy,
                onDismiss = { showTolak = false },
                onConfirm = { alasan, catatan ->
                    vm.tolak(d.id, alasan, catatan) { showTolak = false; onBack() }
                },
            )
        }
    }
    if (showTeamPicker) {
        vm.detail?.let { d ->
            TeamPickerSheet(
                teams = vm.teams,
                busy = vm.actionBusy,
                onDismiss = { showTeamPicker = false; vm.clearNeedsTeam() },
                onPick = { teamId ->
                    vm.approve(d.id, d.source, d.priority, teamId) { status ->
                        if (status != null) { showTeamPicker = false; showApprove = false; onBack() }
                    }
                },
            )
        }
    }
}

@Composable
private fun SupervisorDetailBody(
    d: SupervisorReportDetail,
    onApprove: () -> Unit,
    onTolak: () -> Unit,
    onConfirmAi: () -> Unit,
    onBack: () -> Unit,
) {
    LazyColumn(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(top = 16.dp, bottom = 120.dp),
    ) {
        // ── Foto & analisis AI per foto (bisa >1) ──
        // key unik per grup (idx) agar state toggle AI tidak tertukar antar foto/after-photo.
        val photos = d.photos.orEmpty()
        if (photos.isNotEmpty()) {
            itemsIndexed(photos, key = { idx, p -> "photo-${p.id ?: idx}" }) { _, p -> PhotoCard(p) }
        } else if (d.displayImageUrl != null) {
            item(key = "photo-single") { PhotoCard(SinglePhotoAdapter(d)) }
        }

        // ── Progress bar ──
        val est = d.estimasiHari
        if (est != null && est > 0) {
            item {
                val isSelesai = d.status == "Selesai"
                val doneDays = if (isSelesai) est else (d.progressUpdates?.mapNotNull { it.dayNumber }?.distinct()?.size?.takeIf { it > 0 } ?: minOf(d.progressUpdatesCount, est))
                ProgressBarCard(doneDays = doneDays, estimasi = est, isSelesai = isSelesai)
            }
        }

        // ── After-photo gallery (bisa >1) ──
        val afterPhotos = d.afterPhotos.orEmpty().filter { it.displayUrl != null }
        val beforePhotoUrl = d.photos?.firstOrNull()?.displayUrl ?: d.imageResultUrl ?: d.firstPhotoUrl
        val primaryAfterUrl = afterPhotos.firstOrNull()?.displayUrl
        if (primaryAfterUrl != null && beforePhotoUrl != null) {
            item(key = "before-after-slider") {
                Column(Modifier.fillMaxWidth().padding(bottom = 8.dp)) {
                    Text(
                        "Perbandingan Sebelum & Sesudah (Geser garis pembagi)",
                        fontSize = 12.sp, color = TextMuted, modifier = Modifier.padding(bottom = 6.dp)
                    )
                    BeforeAfterSlider(
                        beforeUrl = beforePhotoUrl,
                        afterUrl = primaryAfterUrl,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            }
        }
        if (afterPhotos.isNotEmpty()) {
            item(key = "after-title") { SectionTitle("Foto Perbaikan") }
            itemsIndexed(afterPhotos, key = { idx, p -> "after-${p.id ?: idx}" }) { _, p ->
                val u = ImageUrl.resolve(p.displayUrl)
                if (u != null) {
                    AsyncImage(
                        model = u,
                        contentDescription = "Foto perbaikan",
                        contentScale = ContentScale.Crop,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(180.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(Color(0xFFE8F0FA)),
                    )
                }
            }
        }

        // ── Penilaian Warga ──
        if ((d.source == "warga" || d.source == "telegram") && d.rating != null) {
            item { RatingCard(rating = d.rating, comment = d.ratingComment) }
        }

        // ── Baris badges ──
        item { BadgeRow(d) }

        // ── PCI ──
        if (d.pciScore != null) {
            item { PciCard(d.pciScore, modifier = Modifier.fillMaxWidth()) }
        }

        // ── Alasan Ditolak ──
        if (d.status == "Ditolak" && d.systemNotes != null) {
            item {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color.White)
                        .border(1.dp, Color(0xFFFECACA), RoundedCornerShape(12.dp))
                        .padding(16.dp),
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(AppIcon.Error, contentDescription = null, tint = ErrorRed, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(8.dp))
                        Text("Laporan Ditolak", color = ErrorRed, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                    }
                    Spacer(Modifier.height(8.dp))
                    Text(
                        extractRejectReason(d.systemNotes) ?: "Tidak ada alasan",
                        color = Color(0xFF991B1B),
                        fontSize = 13.sp,
                    )
                }
            }
        }

        // ── Info Jalan ──
        item { InfoJalanCard(d) }

        // ── Timeline ──
        d.statusHistory?.takeIf { it.isNotEmpty() }?.let { history ->
            item { TimelineCardSupervisor(history) }
        }

        // ── Lokasi (koord + alamat + tombol Google Maps) ──
        if (d.latitude != null && d.longitude != null) {
            item { LokasiCard(d) }
        }

        // ── Duplikasi ──
        d.duplicateOf?.let { dup ->
            item { DuplicateCard(d = d, dupCode = dup.reportCode, dupRoad = dup.roadName, dupDistrict = dup.district, dupLat = dup.latitude, dupLng = dup.longitude) }
        }

        // ── Catatan petugas ──
        d.catatanPetugas?.takeIf { it.isNotBlank() }?.let { note ->
            item {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(10.dp))
                        .background(Color(0xFFFFFBEB))
                        .border(1.dp, Color(0xFFFDE68A), RoundedCornerShape(10.dp))
                        .padding(12.dp),
                ) {
                    Text("Catatan Petugas", color = Color(0xFF92400E), fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                    Spacer(Modifier.height(2.dp))
                    Text(note, color = Color(0xFF475569), fontSize = 12.sp)
                }
            }
        }

        // ── Footer aksi (role-aware) ──
        item { DetailFooter(d, onApprove = onApprove, onTolak = onTolak, onConfirmAi = onConfirmAi, onBack = onBack) }
    }
}

// ── Section composables ───────────────────────────────────────────────────

/** Foto tunggal (fallback bila `photos` kosong) — bungkus report agar bisa reuse PhotoCard. */
private fun SinglePhotoAdapter(d: SupervisorReportDetail): SupervisorPhotoDto = SupervisorPhotoDto(
    id = "report",
    imageOriginalUrl = d.imageOriginalUrl,
    imageResultUrl = d.imageResultUrl,
    aiSeverity = d.aiSeverity,
    totalDetections = d.totalDetections,
    kerusakanPanjang = d.kerusakanPanjang,
    kerusakanLebar = d.kerusakanLebar,
)

/** Foto per-foto + toggle Asli/Deteksi AI + meta AI — port detail-report.tsx:691-822. */
@Composable
private fun PhotoCard(p: SupervisorPhotoDto) {
    // key remember: pakai originalUrl sebagai fallback bila id null, agar tiap
    // kartu punya state toggle sendiri (tidak bentrok saat id kosong).
    val stateKey = p.id ?: p.originalUrl ?: p.displayUrl ?: "photo"
    var showAi by remember(stateKey) { mutableStateOf(true) }
    val original = ImageUrl.resolve(p.originalUrl)
    val result = ImageUrl.resolve(p.resultUrl)
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
                Icon(AppIcon.Camera, contentDescription = null, tint = Color(0xFF94A3B8), modifier = Modifier.size(40.dp))
            }
            if (hasToggle) {
                Row(
                    modifier = Modifier.align(Alignment.TopStart).padding(12.dp),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    ToggleChip("Deteksi AI", showAi) { showAi = true }
                    ToggleChip("Asli", !showAi) { showAi = false }
                }
            }
        }
        // Baris meta AI
        if (!p.aiSeverity.isNullOrBlank() || p.aiConfidence != null || p.totalDetections != null) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(AppIcon.CheckCircle, contentDescription = null, tint = SuccessGreen, modifier = Modifier.size(13.dp))
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
        p.kerusakanPanjang?.let { panjang ->
            val lebar = p.kerusakanLebar
            Row(modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(AppIcon.Description, contentDescription = null, tint = TextMuted, modifier = Modifier.size(13.dp))
                Spacer(Modifier.width(6.dp))
                val dim = if (lebar != null) {
                    "P: ${fmt1(panjang)}m × L: ${fmt1(lebar)}m (${fmt1(panjang * lebar)} m²)"
                } else "P: ${fmt1(panjang)}m"
                Text(dim, color = TextMuted, fontSize = 11.sp)
            }
        }
    }
}

@Composable
private fun ToggleChip(label: String, active: Boolean, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(6.dp))
            .background(if (active) BrandBlue else Color.Black.copy(alpha = 0.5f))
            .clickable(onClick = onClick)
            .padding(horizontal = 10.dp, vertical = 4.dp),
    ) {
        Text(label, color = if (active) Color.White else Color.White.copy(alpha = 0.6f), fontSize = 10.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun ProgressBarCard(doneDays: Int, estimasi: Int, isSelesai: Boolean = false) {
    val pct = if (isSelesai) 1f else (doneDays.toFloat() / estimasi).coerceIn(0f, 1f)
    val barColor = if (isSelesai) SuccessGreen else Color(0xFF1A4F8A)
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(Color.White)
            .border(1.dp, Color(0xFFE2E8F0), RoundedCornerShape(12.dp))
            .padding(16.dp),
    ) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(if (isSelesai) AppIcon.CheckCircle else AppIcon.Construction, contentDescription = null, tint = barColor, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(6.dp))
                Text("Progress Perbaikan", color = TextDark, fontSize = 13.sp, fontWeight = FontWeight.Bold)
            }
            Text(
                if (isSelesai) "Selesai (100%)" else "Hari ${minOf(doneDays, estimasi)} dari $estimasi",
                color = barColor,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
            )
        }
        Spacer(Modifier.height(8.dp))
        Box(modifier = Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(999.dp)).background(Color(0xFFE2E8F0))) {
            Box(modifier = Modifier.fillMaxWidth(pct).height(8.dp).clip(RoundedCornerShape(999.dp)).background(barColor))
        }
        if (isSelesai || doneDays >= estimasi) {
            Spacer(Modifier.height(6.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(AppIcon.CheckCircle, contentDescription = null, tint = SuccessGreen, modifier = Modifier.size(14.dp))
                Spacer(Modifier.width(4.dp))
                Text(if (isSelesai) "Perbaikan telah selesai" else "Estimasi terpenuhi", color = SuccessGreen, fontSize = 11.sp)
            }
        }
    }
}

@Composable
private fun RatingCard(rating: Int, comment: String?) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(Color(0xFFF0FDF4))
            .border(1.dp, Color(0xFFBBF7D0), RoundedCornerShape(10.dp))
            .padding(16.dp),
    ) {
        Text("Penilaian Warga", color = Color(0xFF15803D), fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
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

/** Baris badges: severity pill + status pill + sumber + deadline. Port detail-report.tsx:937-967. */
@Composable
private fun BadgeRow(d: SupervisorReportDetail) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        d.effectiveSeverity?.let { sev ->
            SeverityPill(sev)
        }
        StatusPill(d.status)
        d.source?.takeIf { it != "petugas" }?.let { src ->
            SourcePill(src)
        }
    }
}

@Composable
private fun SeverityPill(severity: String) {
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
        Text(severity.uppercase(Locale.US), color = fg, fontSize = 10.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun StatusPill(status: String?) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(Color.White)
            .border(1.dp, Color(0xFFE2E8F0), RoundedCornerShape(999.dp))
            .padding(horizontal = 12.dp, vertical = 4.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier
                    .size(8.dp)
                    .clip(RoundedCornerShape(999.dp))
                    .background(com.jalankita.app.feature.home.components.statusDotColor(status)),
            )
            Spacer(Modifier.width(6.dp))
            Text(displayStatus(status), color = Color(0xFF475569), fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
private fun SourcePill(source: String) {
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
        Text(source.replaceFirstChar { it.uppercase() }, color = fg, fontSize = 10.sp, fontWeight = FontWeight.Bold)
    }
}

/** Info jalan grid 2 kolom — port detail-report.tsx:983-1021. */
@Composable
private fun InfoJalanCard(d: SupervisorReportDetail) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(Color.White)
            .border(1.dp, Color(0xFFE2E8F0), RoundedCornerShape(12.dp))
            .padding(16.dp),
    ) {
        Text(d.roadName ?: "—", color = TextDark, fontSize = 17.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(12.dp))
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                InfoItem(AppIcon.Map, "Kec. ${d.district ?: "-"}", Modifier.weight(1f))
                d.assignedTeamName?.let { InfoItem(AppIcon.Assignment, "Tim: $it", Modifier.weight(1f)) }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                d.kerusakanPanjang?.let { p ->
                    val lebar = d.kerusakanLebar
                    val v = if (lebar != null) {
                        "${fmt1(p)}m × ${fmt1(lebar)}m (${fmt1(p * lebar)} m²)"
                    } else "${fmt1(p)}m"
                    InfoItem(AppIcon.Description, v, Modifier.weight(1f))
                }
                InfoItem(AppIcon.CalendarMonth, d.createdAt?.let { formatDateShort(it) } ?: "-", Modifier.weight(1f))
            }
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                InfoItem(AppIcon.Person, d.reporterName ?: "-", Modifier.weight(1f))
                d.reportCode?.let { InfoItem(AppIcon.Description, it, Modifier.weight(1f)) }
            }
        }
        d.description?.takeIf { it.isNotBlank() }?.let { desc ->
            Spacer(Modifier.height(12.dp))
            HorizontalDivider(color = Color(0xFFE2E8F0))
            Spacer(Modifier.height(12.dp))
            Text("Deskripsi Laporan", color = Color(0xFF475569), fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(4.dp))
            Text(desc, color = TextDark, fontSize = 13.sp)
        }
    }
}

@Composable
private fun InfoItem(icon: androidx.compose.ui.graphics.vector.ImageVector, value: String, modifier: Modifier = Modifier) {
    Row(modifier = modifier, verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, contentDescription = null, tint = TextMuted, modifier = Modifier.size(16.dp))
        Spacer(Modifier.width(8.dp))
        Text(value, color = TextDark, fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

/** Timeline status — port TimelineCard. */
@Composable
private fun TimelineCardSupervisor(history: List<StatusHistoryDto>) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(Color.White)
            .border(1.dp, Color(0xFFE2E8F0), RoundedCornerShape(12.dp))
            .padding(16.dp),
    ) {
        Text("Riwayat Perbaikan", color = TextDark, fontSize = 13.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(10.dp))
        history.forEachIndexed { i, h ->
            Row(verticalAlignment = Alignment.Top) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(modifier = Modifier.size(10.dp).clip(RoundedCornerShape(999.dp)).background(BrandBlue))
                    if (i < history.size - 1) {
                        Box(modifier = Modifier.width(2.dp).height(28.dp).background(Color(0xFFE2E8F0)))
                    }
                }
                Spacer(Modifier.width(10.dp))
                Column(modifier = Modifier.weight(1f).padding(bottom = 6.dp)) {
                    Text(h.label ?: displayStatus(h.status), color = TextDark, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                    val sub = listOfNotNull(
                        h.actorName,
                        h.timestamp?.replace("T", " ")?.take(16),
                    ).joinToString(" • ")
                    if (sub.isNotBlank()) Text(sub, color = TextMuted, fontSize = 11.sp)
                    h.notes?.takeIf { it.isNotBlank() }?.let { Text(it, color = Color(0xFF475569), fontSize = 11.sp) }
                }
            }
        }
    }
}

/** Lokasi + koordinat + tombol Google Maps — port detail-report.tsx:1026-1064 (tanpa mini-map). */
@Composable
private fun LokasiCard(d: SupervisorReportDetail) {
    val lat = d.latitude ?: return
    val lng = d.longitude ?: return
    val context = androidx.compose.ui.platform.LocalContext.current
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
                fontFamily = FontFamily.Monospace,
            )
            d.fullAddress?.let {
                Spacer(Modifier.height(6.dp))
                Row(verticalAlignment = Alignment.Top) {
                    Icon(AppIcon.Map, contentDescription = null, tint = TextMuted, modifier = Modifier.size(14.dp))
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
                        context.startActivity(
                            android.content.Intent(
                                android.content.Intent.ACTION_VIEW,
                                android.net.Uri.parse(url),
                            ),
                        )
                    }
                }
                .padding(12.dp),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(AppIcon.Map, contentDescription = null, tint = BrandBlue, modifier = Modifier.size(14.dp))
            Spacer(Modifier.width(6.dp))
            Text("Buka di Google Maps", color = BrandBlue, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

/** Kartu duplikasi — port detail-report.tsx:1066-1122. */
@Composable
private fun DuplicateCard(
    d: SupervisorReportDetail,
    dupCode: String?,
    dupRoad: String?,
    dupDistrict: String?,
    dupLat: Double?,
    dupLng: Double?,
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
                modifier = Modifier.size(36.dp).clip(RoundedCornerShape(8.dp)).background(Color(0xFFFFFBEB)).border(1.dp, Color(0xFFFDE68A), RoundedCornerShape(8.dp)),
                contentAlignment = Alignment.Center,
            ) { Icon(AppIcon.Warning, contentDescription = null, tint = WarningAmber, modifier = Modifier.size(18.dp)) }
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text("Terindikasi Duplikat", color = Color(0xFF92400E), fontSize = 13.sp, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(4.dp))
                Text(
                    "Laporan ini memiliki kemiripan dengan laporan ${dupCode ?: "-"} (${dupRoad ?: "-"}, ${dupDistrict ?: "-"}).",
                    color = Color(0xFF92400E),
                    fontSize = 12.sp,
                )
                if (d.latitude != null && d.longitude != null && dupLat != null && dupLng != null) {
                    Spacer(Modifier.height(4.dp))
                    Text(
                        "Jarak: ${formatDistance(haversineDistance(d.latitude, d.longitude, dupLat, dupLng))} dari laporan tersebut",
                        color = Color(0xFF92400E),
                        fontSize = 12.sp,
                    )
                }
            }
        }
    }
}

/** Footer aksi per-status — port renderFooter detail-report.tsx:458-673. */
@Composable
private fun DetailFooter(
    d: SupervisorReportDetail,
    onApprove: () -> Unit,
    onTolak: () -> Unit,
    onConfirmAi: () -> Unit,
    onBack: () -> Unit,
) {
    val status = d.status
    Column(modifier = Modifier.fillMaxWidth()) {
        when {
            status == "Menunggu Review" || status == "Ditinjau" -> {
                BrandPrimaryButton("Setujui & Tugaskan Tim", onClick = onApprove, modifier = Modifier.fillMaxWidth())
                Spacer(Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    BrandSecondaryButton("Tolak", onClick = onTolak, modifier = Modifier.weight(1f))
                    BrandSecondaryButton("Kembali", onClick = onBack, modifier = Modifier.weight(1f))
                }
            }
            status == "Hasil AI" -> {
                BrandPrimaryButton("Konfirmasi & Tugaskan Tim", onClick = onConfirmAi, modifier = Modifier.fillMaxWidth())
                Spacer(Modifier.height(6.dp))
                WarningBox(
                    "Bila tim tak terpetakan, arahkan ke penugasan manual (tak ada retry di endpoint ini).",
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(6.dp))
                BrandSecondaryButton("Kembali", onClick = onBack, modifier = Modifier.fillMaxWidth())
            }
            status == "Disetujui" -> {
                InfoBox(
                    "Tim pelapor telah ditugaskan. Menunggu tim memulai pengerjaan.",
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(6.dp))
                BrandSecondaryButton("Kembali", onClick = onBack, modifier = Modifier.fillMaxWidth())
            }
            status == "Ditugaskan" -> {
                InfoBox("Menunggu tim satgas memulai pengerjaan.", modifier = Modifier.fillMaxWidth())
                Spacer(Modifier.height(6.dp))
                BrandSecondaryButton("Kembali", onClick = onBack, modifier = Modifier.fillMaxWidth())
            }
            else -> {
                InfoBox("Laporan dalam status \"$status\" — hanya pemantauan.", modifier = Modifier.fillMaxWidth())
                Spacer(Modifier.height(6.dp))
                BrandSecondaryButton("Kembali", onClick = onBack, modifier = Modifier.fillMaxWidth())
            }
        }
    }
}

/** Dialog persetujuan + prioritas — port approval modal detail-report.tsx:1219-. */
@Composable
private fun ApprovalDialog(
    detail: SupervisorReportDetail,
    busy: Boolean,
    onDismiss: () -> Unit,
    onConfirm: (priority: String?) -> Unit,
) {
    var priority by remember { mutableStateOf(detail.priority ?: "Sedang") }
    AlertDialog(
        onDismissRequest = { if (!busy) onDismiss() },
        title = { Text("Setujui & Tugaskan Tim", fontWeight = FontWeight.Bold) },
        text = {
            Column {
                Text(
                    if (detail.source == "petugas") {
                        "Laporan akan disetujui dan ditugaskan ke tim pelapor."
                    } else {
                        "Laporan akan disetujui, dianalisis AI, dan otomatis ditugaskan ke tim satgas yang sesuai."
                    },
                    color = Color(0xFF475569),
                    fontSize = 13.sp,
                )
                Spacer(Modifier.height(14.dp))
                Text("Prioritas", color = TextDark, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(6.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("Rendah", "Sedang", "Tinggi").forEach { p ->
                        PriorityChip(p, priority == p) { priority = p }
                    }
                }
            }
        },
        confirmButton = { BrandPrimaryButton("Setujui & Tugaskan", onClick = { onConfirm(priority) }, loading = busy) },
        dismissButton = {
            TextButton(onClick = { if (!busy) onDismiss() }) { Text("Batal", color = TextMuted) }
        },
    )
}

@Composable
private fun PriorityChip(label: String, active: Boolean, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(if (active) BrandBlue else Color(0xFFF1F5F9))
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 6.dp),
    ) {
        Text(label, color = if (active) Color.White else TextMuted, fontSize = 12.sp, fontWeight = if (active) FontWeight.SemiBold else FontWeight.Normal)
    }
}

@Composable
private fun SectionTitle(text: String) {
    Text(text, color = TextDark, fontSize = 13.sp, fontWeight = FontWeight.Bold)
}

private fun fmt1(v: Double): String = String.format(Locale.US, "%.1f", v)
