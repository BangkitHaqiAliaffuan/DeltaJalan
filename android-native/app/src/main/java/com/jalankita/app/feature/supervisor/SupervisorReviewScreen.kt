package com.jalankita.app.feature.supervisor

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Checkbox
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
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
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.jalankita.app.core.network.ReportItemDto
import com.jalankita.app.core.network.TeamDto
import com.jalankita.app.feature.supervisor.components.TeamPickerSheet
import com.jalankita.app.feature.supervisor.components.TolakFormDialog
import com.jalankita.app.feature.supervisor.components.queueDeadlineText
import com.jalankita.app.feature.home.components.EmptyState
import com.jalankita.app.feature.home.components.SkeletonCard
import com.jalankita.app.ui.components.AppIcon
import com.jalankita.app.ui.components.BrandPrimaryButton
import com.jalankita.app.ui.components.BrandSecondaryButton
import com.jalankita.app.ui.components.ErrorBox
import com.jalankita.app.ui.components.WarningBox
import com.jalankita.app.ui.theme.BrandBlue
import com.jalankita.app.ui.theme.TextDark
import com.jalankita.app.ui.theme.TextMuted
import com.jalankita.app.ui.util.pciBgColor
import com.jalankita.app.ui.util.pciText
import java.util.Locale

/**
 * Antrean + panel aksi review — port supervisor/review.tsx (list row kompak) +
 * ReviewDrawer.tsx (panel aksi: Setujui & Assign Tim / Tolak / Detail).
 *
 * CATATAN PENTING: web review.tsx TIDAK memakai ReportCard besar — ia list row
 * kompak (thumb 40dp, dot overdue/urgent/ok, PCI chip, badge sumber, deadline).
 * Native mengikuti bentuk itu.
 *
 * Guard: routing approve per `source` ditangani repo; picker tim muncul bila
 * server balas 422 `needs_team` (approve-and-assign).
 */
@Composable
fun SupervisorReviewScreen(
    vm: SupervisorViewModel,
    onOpenDetail: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    var selectedIndex by remember { mutableStateOf(0) }
    var showActionPanel by remember { mutableStateOf(false) }
    var showTolak by remember { mutableStateOf(false) }
    var showTeamPicker by remember { mutableStateOf(false) }
    var showBulkTolak by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        if (vm.tabKey != "menunggu") vm.selectTab("menunggu")
        if (vm.reports.isEmpty()) vm.loadReports(reset = true)
    }
    LaunchedEffect(vm.reports.size) {
        if (selectedIndex >= vm.reports.size) selectedIndex = (vm.reports.size - 1).coerceAtLeast(0)
    }
    LaunchedEffect(vm.needsTeam) { if (vm.needsTeam) showTeamPicker = true }

    val selected = vm.reports.getOrNull(selectedIndex)

    Column(modifier = modifier.fillMaxWidth()) {
        LazyColumn(
            modifier = Modifier.fillMaxWidth().weight(1f),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(vertical = 12.dp),
        ) {
            item {
                Column(modifier = Modifier.padding(horizontal = 16.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text("Review Cepat", color = TextDark, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                            Text("Antrean menunggu review • urut deadline review", color = TextMuted, fontSize = 13.sp)
                        }
                        TextButton(onClick = { vm.toggleSelectionMode() }) {
                            Text(
                                if (vm.selectionMode) "Batal" else "Mode Pilih",
                                color = BrandBlue,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.SemiBold,
                            )
                        }
                    }
                    Spacer(Modifier.height(10.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.horizontalScroll(rememberScrollState())) {
                        FilterChip("Semua", vm.filterSource == null) { vm.applySourceFilter(null) }
                        FilterChip("Petugas", vm.filterSource == "petugas") { vm.applySourceFilter("petugas") }
                        FilterChip("Warga", vm.filterSource == "warga") { vm.applySourceFilter("warga") }
                        FilterChip("Telegram", vm.filterSource == "telegram") { vm.applySourceFilter("telegram") }
                    }
                    Spacer(Modifier.height(10.dp))
                }
            }

            when {
                vm.listLoading && vm.reports.isEmpty() -> items(3) {
                    SkeletonCard(modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp))
                }
                vm.reports.isEmpty() -> item {
                    Column(modifier = Modifier.padding(horizontal = 16.dp)) {
                        EmptyState(
                            icon = AppIcon.CheckCircle,
                            title = "Semua Sudah Direview",
                            subtitle = "Tidak ada laporan yang perlu direview saat ini.",
                        )
                    }
                }
                else -> items(vm.reports.size) { idx ->
                    val r = vm.reports[idx]
                    ReviewQueueRow(
                        report = r,
                        selected = !vm.selectionMode && idx == selectedIndex,
                        selectionMode = vm.selectionMode,
                        checked = vm.selectedIds.contains(r.id),
                        onClick = {
                            if (vm.selectionMode) {
                                vm.toggleSelected(r.id)
                            } else {
                                selectedIndex = idx
                                showActionPanel = true
                            }
                        },
                    )
                }
            }

            if (vm.reports.isNotEmpty() && !vm.selectionMode) {
                item {
                    Spacer(Modifier.height(8.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        BrandSecondaryButton("← Sebelumnya", onClick = {
                            selectedIndex = (selectedIndex - 1).coerceAtLeast(0)
                        }, enabled = selectedIndex > 0)
                        Spacer(Modifier.width(12.dp))
                        Text("${selectedIndex + 1} / ${vm.reports.size}", color = TextMuted, fontSize = 13.sp)
                        Spacer(Modifier.width(12.dp))
                        BrandSecondaryButton("Selanjutnya →", onClick = {
                            selectedIndex = (selectedIndex + 1).coerceAtMost(vm.reports.size - 1)
                        }, enabled = selectedIndex < vm.reports.size - 1)
                    }
                }
            }
        }

        if (vm.selectionMode) {
            BulkActionBar(
                count = vm.selectedIds.size,
                busy = vm.bulkBusy,
                onApprove = { vm.bulkApproveSelected() },
                onTolak = { showBulkTolak = true },
            )
        }
    }

    // ── Panel aksi (pengganti ReviewDrawer web) ──
    if (showActionPanel && selected != null) {
        ReviewActionSheet(
            report = selected,
            actionMsg = vm.actionMessage,
            busy = vm.actionBusy,
            currentIndex = selectedIndex,
            total = vm.reports.size,
            onPrev = { selectedIndex = (selectedIndex - 1).coerceAtLeast(0) },
            onNext = { selectedIndex = (selectedIndex + 1).coerceAtMost(vm.reports.size - 1) },
            onDismiss = { showActionPanel = false; vm.clearNeedsTeam() },
            onApprove = { vm.approve(selected.id, selected.source, null, null) { status -> if (status != null) showActionPanel = false } },
            onTolak = { showTolak = true },
            onDetail = { showActionPanel = false; onOpenDetail(selected.id) },
        )
    }

    if (showTolak && selected != null) {
        TolakFormDialog(
            busy = vm.actionBusy,
            onDismiss = { showTolak = false },
            onConfirm = { alasan, catatan ->
                vm.tolak(selected.id, alasan, catatan) { _ -> showTolak = false; showActionPanel = false }
            },
        )
    }

    if (showTeamPicker && selected != null) {
        TeamPickerSheet(
            teams = vm.teams,
            busy = vm.actionBusy,
            onDismiss = { showTeamPicker = false; vm.clearNeedsTeam() },
            onPick = { teamId ->
                vm.approve(selected.id, selected.source, null, teamId) { status ->
                    if (status != null) { showTeamPicker = false; showActionPanel = false }
                }
            },
        )
    }

    if (showBulkTolak) {
        BulkTolakDialog(
            count = vm.selectedIds.size,
            busy = vm.bulkBusy,
            onDismiss = { showBulkTolak = false },
            onConfirm = { alasan ->
                showBulkTolak = false
                vm.bulkTolakSelected(alasan)
            },
        )
    }
}

/**
 * Baris antrean kompak — port review.tsx:278-373.
 * Thumb 40dp + dot overdue/urgent/ok + jalan + kode·PCI·badge sumber + deadline + dot AI.
 */
@Composable
private fun ReviewQueueRow(
    report: ReportItemDto,
    selected: Boolean,
    selectionMode: Boolean,
    checked: Boolean,
    onClick: () -> Unit,
) {
    val isOverdue = report.terlambatReview || report.statusDeadline == "terlambat"
    val hoursLeft = remember(report.id) { hoursLeftValue(report.deadlineReview) }
    val isUrgent = hoursLeft != null && hoursLeft in 0 until 4
    val dotColor = when {
        isOverdue -> Color(0xFFE11D48)
        isUrgent -> Color(0xFFF59E0B)
        else -> Color(0xFF10B981)
    }
    val deadlineText = queueDeadlineText(report.deadlineReview)

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(if (selected || checked) Color(0xFFDBE4FF) else Color.White)
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // Bar kiri penanda terpilih
        Box(
            modifier = Modifier
                .size(width = 2.dp, height = 40.dp)
                .background(if (selected || checked) BrandBlue else Color.Transparent),
        )
        Spacer(Modifier.width(8.dp))

        if (selectionMode) {
            Checkbox(checked = checked, onCheckedChange = { onClick() })
            Spacer(Modifier.width(4.dp))
        }

        // Thumbnail 40dp
        Box(
            modifier = Modifier
                .size(40.dp)
                .clip(RoundedCornerShape(8.dp))
                .background(Color(0xFFE8F0FA)),
            contentAlignment = Alignment.Center,
        ) {
            val url = com.jalankita.app.core.util.ImageUrl.resolve(report.displayImageUrl)
            if (url != null) {
                coil.compose.AsyncImage(
                    model = url,
                    contentDescription = null,
                    contentScale = androidx.compose.ui.layout.ContentScale.Crop,
                    modifier = Modifier.size(40.dp).clip(RoundedCornerShape(8.dp)),
                )
            } else {
                Icon(AppIcon.Gallery, contentDescription = null, tint = Color(0xFFC4D4E6), modifier = Modifier.size(18.dp))
            }
        }
        Spacer(Modifier.width(12.dp))

        // Info
        Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(modifier = Modifier.size(6.dp).clip(RoundedCornerShape(999.dp)).background(dotColor))
                Spacer(Modifier.width(6.dp))
                Text(
                    report.roadName ?: "-",
                    color = TextDark,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            Spacer(Modifier.height(2.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    report.reportCode ?: "-",
                    color = Color(0xFF476788),
                    fontSize = 10.sp,
                    fontFamily = FontFamily.Monospace,
                )
                if (report.pciScore != null) {
                    Text(" · ", color = Color(0xFF476788), fontSize = 10.sp)
                    val badge = pciBgColor(report.pciScore)
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(4.dp))
                            .background(badge.bg)
                            .padding(horizontal = 4.dp, vertical = 1.dp),
                    ) {
                        Text("PCI ${pciText(report.pciScore, 0)}", color = badge.fg, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                    }
                }
                if (report.source != null && report.source != "petugas") {
                    Text(" · ", color = Color(0xFF476788), fontSize = 10.sp)
                    val (bg, fg, border) = if (report.source == "warga") {
                        Triple(Color(0xFFFAF5FF), Color(0xFF7C3AED), Color(0xFFE9D5FF))
                    } else {
                        Triple(Color(0xFFF0F9FF), Color(0xFF0284C7), Color(0xFFBAE6FD))
                    }
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(4.dp))
                            .background(bg)
                            .border(1.dp, border, RoundedCornerShape(4.dp))
                            .padding(horizontal = 4.dp, vertical = 1.dp),
                    ) {
                        Text(if (report.source == "warga") "W" else "T", color = fg, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
            Spacer(Modifier.height(2.dp))
            when {
                isOverdue -> Text("Terlambat!", color = Color(0xFFE11D48), fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
                isUrgent -> Text("Mendesak", color = Color(0xFFF59E0B), fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
                deadlineText != null -> Text(deadlineText, color = Color(0xFF476788), fontSize = 10.sp)
            }
        }

        // Dot AI (hijau bila ai_severity terisi)
        Box(
            modifier = Modifier
                .size(8.dp)
                .clip(RoundedCornerShape(999.dp))
                .background(if (report.aiSeverity.isNullOrBlank()) Color(0xFF94A3B8) else Color(0xFF10B981)),
        )
    }
    Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(Color(0xFFE2E8F0)))
}

/** Panel aksi review — pengganti ReviewDrawer (header prev/next + tombol aksi). */
@Composable
private fun ReviewActionSheet(
    report: ReportItemDto,
    actionMsg: String?,
    busy: Boolean,
    currentIndex: Int,
    total: Int,
    onPrev: () -> Unit,
    onNext: () -> Unit,
    onDismiss: () -> Unit,
    onApprove: () -> Unit,
    onTolak: () -> Unit,
    onDetail: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = { if (!busy) onDismiss() },
        title = {
            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    report.roadName ?: "Laporan",
                    color = Color(0xFF476788),
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                Icon(
                    AppIcon.ChevronLeft, contentDescription = "Sebelumnya",
                    tint = BrandBlue, modifier = Modifier.size(20.dp).clickable(enabled = currentIndex > 0, onClick = onPrev),
                )
                Text(" ${currentIndex + 1} / $total ", color = Color(0xFF476788), fontSize = 12.sp)
                Icon(
                    AppIcon.ChevronRight, contentDescription = "Selanjutnya",
                    tint = BrandBlue, modifier = Modifier.size(20.dp).clickable(enabled = currentIndex < total - 1, onClick = onNext),
                )
            }
        },
        text = {
            Column {
                if (actionMsg != null) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(8.dp))
                            .background(Color(0xFFF8FAFC))
                            .border(1.dp, Color(0xFFE2E8F0), RoundedCornerShape(8.dp))
                            .padding(8.dp),
                    ) { Text(actionMsg, color = TextDark, fontSize = 12.sp) }
                    Spacer(Modifier.height(8.dp))
                }
                Text(report.reportCode ?: "-", color = TextMuted, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                Spacer(Modifier.height(4.dp))
                Text("Kec. ${report.district ?: "-"} • Sumber: ${sourceLabel(report.source)}", color = TextMuted, fontSize = 12.sp)
                if (report.source != null && report.source != "petugas") {
                    Spacer(Modifier.height(8.dp))
                    WarningBox(
                        "Laporan warga/telegram → akan ditugaskan ke tim (approve-and-assign).",
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            }
        },
        confirmButton = { BrandPrimaryButton("Setujui & Assign Tim", onClick = onApprove, loading = busy) },
        dismissButton = {
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                TextButton(onClick = { if (!busy) onTolak() }) { Text("Tolak", color = Color(0xFFDC2626)) }
                TextButton(onClick = { if (!busy) onDetail() }) { Text("Detail", color = BrandBlue) }
            }
        },
    )
}

@Composable
private fun FilterChip(label: String, active: Boolean, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(if (active) BrandBlue else Color.White)
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 6.dp),
    ) {
        Text(
            label,
            color = if (active) Color.White else TextMuted,
            fontSize = 12.sp,
            fontWeight = if (active) FontWeight.SemiBold else FontWeight.Normal,
        )
    }
}

private fun sourceLabel(source: String?): String = when (source) {
    "warga" -> "Warga"
    "telegram" -> "Telegram"
    else -> "Petugas"
}

private fun hoursLeftValue(iso: String?): Long? {
    if (iso.isNullOrBlank()) return null
    return try {
        val deadline = java.time.OffsetDateTime.parse(iso).toInstant()
        val diff = java.time.Duration.between(java.time.Instant.now(), deadline)
        if (diff.isNegative) -1L else diff.toHours()
    } catch (_: Exception) {
        null
    }
}

/** Bar aksi massal (pinned di bawah daftar) — muncul hanya saat Mode Pilih aktif. */
@Composable
private fun BulkActionBar(
    count: Int,
    busy: Boolean,
    onApprove: () -> Unit,
    onTolak: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color.White)
            .padding(horizontal = 16.dp, vertical = 10.dp),
    ) {
        Box(Modifier.fillMaxWidth().height(1.dp).background(Color(0xFFE2E8F0)))
        Spacer(Modifier.height(10.dp))
        Text("$count laporan dipilih", color = TextDark, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.height(8.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            BrandPrimaryButton(
                text = "Setujui Terpilih ($count)",
                onClick = onApprove,
                modifier = Modifier.weight(1f),
                loading = busy,
                enabled = count > 0,
            )
            BrandSecondaryButton(
                text = "Tolak Terpilih ($count)",
                onClick = onTolak,
                modifier = Modifier.weight(1f),
                enabled = count > 0 && !busy,
            )
        }
    }
}

/** Dialog alasan penolakan massal — alasan wajib, maks 500 karakter. */
@Composable
private fun BulkTolakDialog(
    count: Int,
    busy: Boolean,
    onDismiss: () -> Unit,
    onConfirm: (String) -> Unit,
) {
    var alasan by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = { if (!busy) onDismiss() },
        title = { Text("Tolak $count Laporan") },
        text = {
            Column {
                Text("Alasan penolakan (wajib, maks 500 karakter):", color = TextMuted, fontSize = 12.sp)
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(
                    value = alasan,
                    onValueChange = { if (it.length <= 500) alasan = it },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 3,
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    "${alasan.length}/500",
                    color = TextMuted,
                    fontSize = 10.sp,
                    modifier = Modifier.align(Alignment.End),
                )
            }
        },
        confirmButton = {
            BrandPrimaryButton(
                text = "Tolak",
                onClick = { onConfirm(alasan.trim()) },
                loading = busy,
                enabled = alasan.isNotBlank(),
            )
        },
        dismissButton = {
            TextButton(onClick = { if (!busy) onDismiss() }) { Text("Batal") }
        },
    )
}
