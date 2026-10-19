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
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.jalankita.app.core.network.MonthlyTrendDto
import com.jalankita.app.core.network.PciDistrictDto
import com.jalankita.app.core.network.ReportItemDto
import com.jalankita.app.core.network.TeamStatsDto
import com.jalankita.app.feature.home.components.SectionHeader
import com.jalankita.app.feature.home.components.StatCard
import com.jalankita.app.feature.supervisor.components.CardAction
import com.jalankita.app.feature.supervisor.components.CardActionVariant
import com.jalankita.app.feature.supervisor.components.SupervisorReportCard
import com.jalankita.app.ui.components.AppIcon
import com.jalankita.app.ui.components.BrandPrimaryButton
import com.jalankita.app.ui.components.BrandSecondaryButton
import com.jalankita.app.ui.components.ErrorBox
import com.jalankita.app.ui.components.SuccessBox
import com.jalankita.app.ui.components.WarningBox
import com.jalankita.app.ui.components.InfoBox
import com.jalankita.app.feature.home.components.EmptyState
import com.jalankita.app.feature.home.components.SkeletonCard
import com.jalankita.app.ui.theme.BrandBlue
import com.jalankita.app.ui.theme.DividerLine
import com.jalankita.app.ui.theme.ErrorRed
import com.jalankita.app.ui.theme.SuccessGreen
import com.jalankita.app.ui.theme.TextDark
import com.jalankita.app.ui.theme.TextMuted
import com.jalankita.app.ui.theme.WarningAmber
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.TextButton
import java.util.Locale

/**
 * Dashboard triase supervisor — port supervisor/index.tsx (S2a).
 * Header wilayah + kartu statistik + ringkasan PCI + collapsible UPTD/tim + list antrean.
 */
@Composable
fun SupervisorDashboardScreen(
    vm: SupervisorViewModel,
    onOpenReview: () -> Unit,
    onOpenDetail: (String) -> Unit,
    onOpenPatrol: () -> Unit,
    modifier: Modifier = Modifier,
) {
    LaunchedEffect(Unit) { vm.loadDashboard() }
    LaunchedEffect(Unit) { if (vm.reports.isEmpty()) vm.loadReports(reset = true) }
    var expandedUptd by remember { mutableStateOf<String?>(null) }
    var deleteTarget by remember { mutableStateOf<String?>(null) }
    var showExportDialog by remember { mutableStateOf(false) }

    LazyColumn(
        modifier = modifier.fillMaxWidth().padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(vertical = 16.dp),
    ) {
        // Header wilayah
        item {
            Column {
                Text(
                    text = vm.regions?.label?.takeIf { it.isNotBlank() } ?: "Supervisor",
                    color = TextDark,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    text = buildString {
                        append("Wilayah yang disupervisi")
                        val n = vm.regions?.districts?.size ?: 0
                        if (n > 0) append(" • $n kecamatan")
                    },
                    color = TextMuted,
                    fontSize = 13.sp,
                )
                Spacer(Modifier.height(12.dp))
                // Pintu masuk Jadwal Patroli Rutin (pola supervisor/patrol-schedule web).
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color.White)
                        .border(1.dp, Color(0xFFE2E8F0), RoundedCornerShape(12.dp))
                        .clickable(onClick = onOpenPatrol)
                        .padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(
                        modifier = Modifier.size(36.dp).clip(RoundedCornerShape(8.dp)).background(Color(0xFFEEF3FA)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(AppIcon.CalendarMonth, contentDescription = null, tint = BrandBlue, modifier = Modifier.size(18.dp))
                    }
                    Spacer(Modifier.width(12.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text("Jadwal Patroli Rutin", color = TextDark, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                        Text("Atur pola patroli tim satgas", color = TextMuted, fontSize = 12.sp)
                    }
                    Icon(AppIcon.ChevronRight, contentDescription = null, tint = TextMuted, modifier = Modifier.size(20.dp))
                }
                Spacer(Modifier.height(8.dp))
                // Tombol Export Rekap Laporan Bulanan (PDF / Excel).
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color.White)
                        .border(1.dp, Color(0xFFE2E8F0), RoundedCornerShape(12.dp))
                        .clickable { showExportDialog = true }
                        .padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(
                        modifier = Modifier.size(36.dp).clip(RoundedCornerShape(8.dp)).background(Color(0xFFEEF3FA)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(AppIcon.Description, contentDescription = null, tint = BrandBlue, modifier = Modifier.size(18.dp))
                    }
                    Spacer(Modifier.width(12.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text("Export Rekap Laporan", color = TextDark, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                        Text("Unduh dokumen PDF / Excel bulanan", color = TextMuted, fontSize = 12.sp)
                    }
                    Icon(AppIcon.ChevronRight, contentDescription = null, tint = TextMuted, modifier = Modifier.size(20.dp))
                }
            }
        }

        if (vm.dashboardLoading && vm.stats == null) {
            items(4) { SkeletonCard(modifier = Modifier.height(90.dp)) }
        }

        // 4 kartu statistik
        vm.stats?.let { s ->
            item {
                SectionHeader(icon = AppIcon.BarChart, title = "Ringkasan Triase")
                Spacer(Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    StatCard(AppIcon.Description, "Total", s.total, BrandBlue, Modifier.weight(1f))
                    StatCard(AppIcon.PendingActions, "Perlu Review", s.menungguReview, WarningAmber, Modifier.weight(1f))
                }
                Spacer(Modifier.height(12.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    StatCard(AppIcon.Assignment, "Ditugaskan", s.ditugaskan, BrandBlue, Modifier.weight(1f))
                    StatCard(AppIcon.Construction, "Diperbaiki", s.sedangDiperbaiki, SuccessGreen, Modifier.weight(1f))
                }
            }
        }

        // Ringkasan PCI
        vm.pci?.kabupaten?.let { kab ->
            item {
                SectionHeader(icon = AppIcon.BarChart, title = "Ringkasan PCI")
                Spacer(Modifier.height(8.dp))
                PciSummaryCard(
                    avgPci = kab.avgPci,
                    totalLaporan = kab.totalLaporan,
                    kritis = kab.kritis,
                    districts = vm.pci?.districts.orEmpty(),
                )
            }
        }

        // Collapsible per-UPTD
        if (vm.pci?.districts.isNullOrEmpty().not() || vm.teams.isNotEmpty()) {
            item {
                SectionHeader(icon = AppIcon.Assignment, title = "Statistik per Tim / UPTD")
                Spacer(Modifier.height(8.dp))
                TeamStatsGroups(
                    teams = vm.teams,
                    teamStats = vm.teamStats,
                    expandedUptd = expandedUptd,
                    onToggle = { expandedUptd = if (expandedUptd == it) null else it },
                )
            }
        }

        // Tren bulanan (list sederhana — chart penuh milik S3)
        vm.stats?.monthlyTrend?.takeIf { it.isNotEmpty() }?.let { trend ->
            item {
                SectionHeader(icon = AppIcon.BarChart, title = "Tren 6 Bulan")
                Spacer(Modifier.height(8.dp))
                MonthlyTrendList(trend)
            }
        }

        // ── Tab status (chips) — port supervisor/index.tsx:664-696 ──
        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                val s = vm.stats
                StatusTab("Perlu Review", s?.menungguReview, vm.tabKey == "menunggu") {
                    vm.selectTab("menunggu")
                }
                StatusTab("Disetujui", s?.disetujui, vm.tabKey == "disetujui") { vm.selectTab("disetujui") }
                StatusTab("Ditugaskan", s?.ditugaskan, vm.tabKey == "ditugaskan") { vm.selectTab("ditugaskan") }
                StatusTab("Diperbaiki", s?.sedangDiperbaiki, vm.tabKey == "sedang_diperbaiki") {
                    vm.selectTab("sedang_diperbaiki")
                }
                StatusTab("Ditolak", s?.ditolak, vm.tabKey == "ditolak") { vm.selectTab("ditolak") }
                StatusTab("Semua", null, vm.tabKey == "semua") { vm.selectTab("semua") }
            }
            Spacer(Modifier.height(4.dp))
        }

        when {
            vm.listLoading && vm.reports.isEmpty() -> items(3) { SkeletonCard() }
            vm.reports.isEmpty() -> item {
                EmptyState(
                    icon = AppIcon.Inbox,
                    title = "Belum ada laporan",
                    subtitle = "Antrean triase akan muncul di sini.",
                )
            }
            else -> items(vm.reports, key = { it.id }) { r ->
                val actions = buildList {
                    // Hapus hanya bila Ditolak (web: index.tsx:734) — native juga
                    // boleh 4 status per backend, tapi UX mengikuti web = Ditolak.
                    if (r.status == "Ditolak") {
                        add(
                            CardAction("Hapus", AppIcon.Delete, variant = CardActionVariant.DESTRUCTIVE) {
                                deleteTarget = r.id
                            },
                        )
                    }
                    add(
                        CardAction(
                            label = "Lihat Detail",
                            icon = AppIcon.ChevronRight,
                            iconOnly = true,
                            variant = CardActionVariant.SECONDARY,
                        ) { onOpenDetail(r.id) },
                    )
                }
                SupervisorReportCard(
                    report = r,
                    onClick = { onOpenDetail(r.id) },
                    showDeadline = true,
                    actions = actions,
                )
                Spacer(Modifier.height(4.dp))
            }
        }

        // ── Paginasi prev/next (port index.tsx:761-781) ──
        if (vm.listLastPage > 1) {
            item {
                Spacer(Modifier.height(8.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    BrandSecondaryButton("← Sebelumnya", onClick = { vm.goToPage(vm.listPage - 1) }, enabled = vm.listPage > 1)
                    Spacer(Modifier.width(12.dp))
                    Text(
                        "Halaman ${vm.listPage} dari ${vm.listLastPage}",
                        color = TextMuted,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium,
                    )
                    Spacer(Modifier.width(12.dp))
                    BrandSecondaryButton("Selanjutnya →", onClick = { vm.goToPage(vm.listPage + 1) }, enabled = vm.listPage < vm.listLastPage)
                }
            }
        }
    }

    // ── Dialog konfirmasi hapus (port ConfirmDialog index.tsx:788-797) ──
    deleteTarget?.let { id ->
        AlertDialog(
            onDismissRequest = { if (!vm.actionBusy) deleteTarget = null },
            title = { Text("Hapus Laporan?", fontWeight = FontWeight.Bold) },
            text = {
                Text(
                    "Laporan yang dihapus tidak bisa dikembalikan. Semua foto dan data terkait akan dihapus permanen.",
                    fontSize = 13.sp,
                )
            },
            confirmButton = {
                BrandPrimaryButton(
                    "Ya, Hapus",
                    onClick = {
                        vm.deleteReport(id) { deleteTarget = null }
                    },
                    loading = vm.actionBusy,
                )
            },
            dismissButton = {
                TextButton(onClick = { deleteTarget = null }) { Text("Batal", color = TextMuted) }
            },
        )
    }

    if (showExportDialog) {
        ExportMonthlyDialog(
            busy = vm.exportLoading,
            onDismiss = { showExportDialog = false },
            onExport = { format, month, year ->
                vm.exportReport(format, month, year) { file ->
                    if (file != null) {
                        showExportDialog = false
                    }
                }
            },
        )
    }
}

/** Chip tab status — port supervisor/index.tsx tab pills. */
@Composable
private fun StatusTab(label: String, count: Int?, active: Boolean, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(if (active) BrandBlue else Color(0xFFEEF3FA))
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 6.dp),
    ) {
        Text(
            text = if (count != null) "$label ($count)" else label,
            color = if (active) Color.White else Color(0xFF476788),
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
        )
    }
}

@Composable
private fun PciSummaryCard(
    avgPci: Double?,
    totalLaporan: Int,
    kritis: Int,
    districts: List<PciDistrictDto>,
) {
    val shape = RoundedCornerShape(12.dp)
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(androidx.compose.ui.graphics.Color.White)
            .padding(16.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = avgPci?.let { String.format(Locale.US, "%.1f", it) } ?: "—",
                color = BrandBlue,
                fontSize = 32.sp,
                fontWeight = FontWeight.Bold,
            )
            Spacer(Modifier.width(12.dp))
            Column {
                Text("Skor rata-rata kabupaten", color = TextMuted, fontSize = 12.sp)
                Text("$totalLaporan laporan ber-PCI", color = TextMuted, fontSize = 12.sp)
            }
            Spacer(Modifier.weight(1f))
            if (kritis > 0) {
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(999.dp))
                        .background(com.jalankita.app.ui.theme.ErrorBg)
                        .padding(horizontal = 10.dp, vertical = 4.dp),
                ) {
                    Text("$kritis kritis", color = com.jalankita.app.ui.theme.ErrorRed, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                }
            }
        }
        if (districts.isNotEmpty()) {
            Spacer(Modifier.height(12.dp))
            districts.take(5).forEach { d ->
                Row(
                    modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(d.district ?: "—", color = TextDark, fontSize = 13.sp, modifier = Modifier.weight(1f))
                    Text("${d.total} laporan", color = TextMuted, fontSize = 12.sp)
                    Spacer(Modifier.width(8.dp))
                    Text(
                        text = d.avgPci?.let { String.format(Locale.US, "%.1f", it) } ?: "—",
                        color = if ((d.avgPci ?: 100.0) <= 40) com.jalankita.app.ui.theme.ErrorRed else BrandBlue,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
            }
        }
    }
}

@Composable
private fun TeamStatsGroups(
    teams: List<com.jalankita.app.core.network.TeamDto>,
    teamStats: List<TeamStatsDto>,
    expandedUptd: String?,
    onToggle: (String) -> Unit,
) {
    if (teamStats.isEmpty()) {
        InfoBox("Belum ada statistik per tim.", modifier = Modifier.fillMaxWidth())
        return
    }
    val byUptd = teamStats.groupBy { stat ->
        teams.firstOrNull { it.id == stat.teamId }?.uptd?.nama ?: "Tanpa UPTD"
    }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        byUptd.forEach { (uptdName, stats) ->
            val expanded = expandedUptd == uptdName
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(androidx.compose.ui.graphics.Color.White)
                    .padding(12.dp),
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(
                        if (expanded) AppIcon.ChevronDown else AppIcon.ChevronRight,
                        contentDescription = null,
                        tint = BrandBlue,
                        modifier = Modifier.size(20.dp),
                    )
                    Spacer(Modifier.width(8.dp))
                    Text(uptdName, color = TextDark, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                    Text("${stats.sumOf { it.total }} laporan", color = TextMuted, fontSize = 12.sp)
                    Spacer(Modifier.width(8.dp))
                    Text(
                        text = if (expanded) "Tutup" else "Buka",
                        color = BrandBlue,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(4.dp).clickableToggle { onToggle(uptdName) },
                    )
                }
                if (expanded) {
                    stats.forEach { st ->
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(st.teamName ?: "—", color = TextDark, fontSize = 13.sp, modifier = Modifier.weight(1f))
                            Text("Ditugaskan ${st.ditugaskan}", color = TextMuted, fontSize = 11.sp)
                            Spacer(Modifier.width(8.dp))
                            Text("Selesai ${st.selesai}", color = SuccessGreen, fontSize = 11.sp)
                        }
                    }
                }
            }
        }
    }
}

/** Helper clickable sederhana agar tak bentrok import di file ini. */
private fun Modifier.clickableToggle(onClick: () -> Unit): Modifier =
    this.then(Modifier.clickable(onClick = onClick))

@Composable
private fun MonthlyTrendList(trend: List<MonthlyTrendDto>) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(androidx.compose.ui.graphics.Color.White)
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        trend.forEach { t ->
            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(t.bulan ?: "—", color = TextMuted, fontSize = 12.sp, modifier = Modifier.width(96.dp))
                Text("${t.total}", color = TextDark, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.width(40.dp))
                Text("Menunggu ${t.menungguReview}", color = WarningAmber, fontSize = 11.sp)
                Spacer(Modifier.width(8.dp))
                Text("Selesai ${t.selesai}", color = SuccessGreen, fontSize = 11.sp)
            }
        }
    }
}

@Composable
fun ExportMonthlyDialog(
    busy: Boolean,
    onDismiss: () -> Unit,
    onExport: (format: String, month: Int, year: Int) -> Unit,
) {
    val currentMonth = java.time.LocalDate.now().monthValue
    val currentYear = java.time.LocalDate.now().year
    var selectedMonth by remember { mutableStateOf(currentMonth) }
    var selectedYear by remember { mutableStateOf(currentYear) }
    var selectedFormat by remember { mutableStateOf("pdf") }

    val bulanNames = listOf(
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    )

    AlertDialog(
        onDismissRequest = { if (!busy) onDismiss() },
        title = {
            Text("Export Rekap Bulanan", color = TextDark, fontSize = 16.sp, fontWeight = FontWeight.Bold)
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Pilih format dokumen dan periode rekap:", color = TextMuted, fontSize = 13.sp)

                // Format Selector (PDF / Excel)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("pdf" to "PDF", "excel" to "Excel (.xlsx)").forEach { (fmt, label) ->
                        val active = selectedFormat == fmt
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(8.dp))
                                .background(if (active) BrandBlue else Color(0xFFF1F5F9))
                                .clickable { selectedFormat = fmt }
                                .padding(vertical = 10.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(
                                label,
                                color = if (active) Color.White else TextDark,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.SemiBold,
                            )
                        }
                    }
                }

                // Month Selector
                Column {
                    Text("Bulan", color = TextDark, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                    Spacer(Modifier.height(4.dp))
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(8.dp))
                            .background(Color(0xFFF8FAFC))
                            .border(1.dp, Color(0xFFE2E8F0), RoundedCornerShape(8.dp))
                            .padding(horizontal = 12.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Icon(
                            AppIcon.ChevronLeft,
                            contentDescription = "Bulan sebelumnya",
                            tint = BrandBlue,
                            modifier = Modifier.size(24.dp).clickable {
                                selectedMonth = if (selectedMonth > 1) selectedMonth - 1 else 12
                            },
                        )
                        Text(
                            bulanNames[selectedMonth - 1],
                            color = TextDark,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold,
                        )
                        Icon(
                            AppIcon.ChevronRight,
                            contentDescription = "Bulan berikutnya",
                            tint = BrandBlue,
                            modifier = Modifier.size(24.dp).clickable {
                                selectedMonth = if (selectedMonth < 12) selectedMonth + 1 else 1
                            },
                        )
                    }
                }

                // Year Selector
                Column {
                    Text("Tahun", color = TextDark, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                    Spacer(Modifier.height(4.dp))
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(8.dp))
                            .background(Color(0xFFF8FAFC))
                            .border(1.dp, Color(0xFFE2E8F0), RoundedCornerShape(8.dp))
                            .padding(horizontal = 12.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Icon(
                            AppIcon.ChevronLeft,
                            contentDescription = "Tahun sebelumnya",
                            tint = BrandBlue,
                            modifier = Modifier.size(24.dp).clickable {
                                if (selectedYear > 2020) selectedYear -= 1
                            },
                        )
                        Text(
                            "$selectedYear",
                            color = TextDark,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold,
                        )
                        Icon(
                            AppIcon.ChevronRight,
                            contentDescription = "Tahun berikutnya",
                            tint = BrandBlue,
                            modifier = Modifier.size(24.dp).clickable {
                                if (selectedYear < currentYear + 1) selectedYear += 1
                            },
                        )
                    }
                }
            }
        },
        confirmButton = {
            BrandPrimaryButton(
                text = if (busy) "Mengunduh..." else "Unduh Rekap",
                onClick = { onExport(selectedFormat, selectedMonth, selectedYear) },
                enabled = !busy,
            )
        },
        dismissButton = {
            if (!busy) {
                TextButton(onClick = onDismiss) {
                    Text("Batal", color = TextMuted)
                }
            }
        },
    )
}
