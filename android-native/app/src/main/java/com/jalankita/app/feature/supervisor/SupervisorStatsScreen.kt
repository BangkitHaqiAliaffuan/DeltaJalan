package com.jalankita.app.feature.supervisor

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.jalankita.app.core.network.TeamStatsDto
import com.jalankita.app.feature.home.components.SectionHeader
import com.jalankita.app.feature.home.components.SkeletonCard
import com.jalankita.app.feature.home.components.StatCard
import com.jalankita.app.feature.supervisor.components.PciCard
import com.jalankita.app.ui.components.AppIcon
import com.jalankita.app.ui.theme.TextDark
import com.jalankita.app.ui.theme.TextMuted

/**
 * Layar Statistik supervisor — replikasi routes/stats.tsx (khusus supervisor).
 * Web memakai recharts (pie + bar); native menggambar via Canvas agar tanpa
 * dependensi chart baru (offline-safe, APK tetap ramping).
 * Data reuse [SupervisorViewModel] (stats + teamStats + pci sudah dimuat
 * loadDashboard — endpoint supervisorStats/stats-by-team/pciOverview).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SupervisorStatsScreen(
    vm: SupervisorViewModel,
    modifier: Modifier = Modifier,
) {
    LaunchedEffect(Unit) {
        // Guard benar: panggil bila data belum ada (dashboardLoading init
        // true sehingga tidak bisa dipakai sebagai syarat di sini).
        if (vm.stats == null) vm.loadDashboard()
    }
    val ptr = rememberPullToRefreshState()
    PullToRefreshBox(
        isRefreshing = vm.refreshing,
        state = ptr,
        onRefresh = { vm.loadDashboard(force = true) },
        modifier = modifier.fillMaxSize(),
    ) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            val s = vm.stats
            if (vm.dashboardLoading && s == null) {
                items(4) { SkeletonCard() }
                return@LazyColumn
            }
            if (s == null) {
                item(key = "empty") {
                    Text(
                        "Statistik belum tersedia. Tarik untuk memuat ulang.",
                        color = TextMuted, fontSize = 13.sp,
                        modifier = Modifier.padding(vertical = 32.dp),
                    )
                }
                return@LazyColumn
            }
            // ── Kartu ringkas (cermin stats.tsx: kartu total/menunggu/…) ──
            item(key = "cards") {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        StatCard(AppIcon.Description, "Total", s.total, Color(0xFF1E40AF), Modifier.weight(1f))
                        StatCard(AppIcon.PendingActions, "Menunggu", s.menungguReview, Color(0xFFD97706), Modifier.weight(1f))
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        StatCard(AppIcon.CheckCircle, "Disetujui", s.disetujui, Color(0xFF1E40AF), Modifier.weight(1f))
                        StatCard(AppIcon.Construction, "Diperbaiki", s.sedangDiperbaiki, Color(0xFFD97706), Modifier.weight(1f))
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        StatCard(AppIcon.CheckCircle, "Selesai", s.selesai, Color(0xFF059669), Modifier.weight(1f))
                        StatCard(AppIcon.Warning, "Ditolak", s.ditolak, Color(0xFFDC2626), Modifier.weight(1f))
                    }
                }
            }
            // ── Komposisi severity (cermin DistrictPieChart) ──
            item(key = "pie") {
                CardBox(title = "Komposisi Tingkat Kerusakan") {
                    SeverityPie(
                        berat = s.rusakBerat,
                        sedang = s.rusakSedang,
                        ringan = s.rusakRingan,
                        total = s.total,
                    )
                }
            }
            // ── Tren bulanan (cermin MonthlyTrendChart) ──
            val trend = s.monthlyTrend.orEmpty()
            if (trend.isNotEmpty()) {
                item(key = "trend") {
                    CardBox(title = "Tren Bulanan") {
                        TrendBars(
                            labels = trend.map { it.bulan?.take(3) ?: "-" },
                            values = trend.map { it.total },
                        )
                    }
                }
            }
            // ── PCI kabupaten (cermin ringkasan PCI stats.tsx) ──
            // PciCard memaksa fillMaxWidth internal — susun vertikal agar
            // teks hitungan tidak terdorong keluar layar.
            val pci = vm.pci?.kabupaten
            if (pci != null) {
                item(key = "pci") {
                    CardBox(title = "Indeks Kondisi Jalan (PCI)") {
                        PciCard(score = pci.avgPci)
                        Spacer(Modifier.height(8.dp))
                        Text("${pci.totalLaporan} laporan dinilai • ${pci.kritis} kritis (PCI < 40)", color = TextMuted, fontSize = 12.sp)
                    }
                }
            }
            // ── Tabel per tim (cermin tabel UPTD/Tim stats.tsx) ──
            if (vm.teamStats.isNotEmpty()) {
                item(key = "teams-head") {
                    SectionHeader(title = "Per Tim Satgas", icon = AppIcon.Assignment)
                }
                vm.teamStats.forEach { t ->
                    item(key = "team-${t.teamId ?: t.teamName}") { TeamRow(t) }
                }
            }
        }
    }
}

/** Kartu putih pembungkus section — pola card §10 DESIGN.md. */
@Composable
private fun CardBox(title: String, content: @Composable () -> Unit) {
    val shape = RoundedCornerShape(12.dp)
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(Color.White)
            .padding(16.dp),
    ) {
        Text(title, color = TextDark, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.height(12.dp))
        content()
    }
}

/** Donat severity: Berat merah / Sedang oranye / Ringan amber / sisanya abu. */
@Composable
private fun SeverityPie(berat: Int, sedang: Int, ringan: Int, total: Int) {
    val other = (total - berat - sedang - ringan).coerceAtLeast(0)
    val parts = listOf(
        Triple("Berat", berat, Color(0xFFE11D48)),
        Triple("Sedang", sedang, Color(0xFFF97316)),
        Triple("Ringan", ringan, Color(0xFFF59E0B)),
        Triple("Lainnya", other, Color(0xFFE2E8F0)),
    )
    Row(verticalAlignment = Alignment.CenterVertically) {
        Canvas(modifier = Modifier.size(120.dp)) {
            var start = -90f
            val sum = parts.sumOf { it.second }.toFloat().takeIf { it > 0 } ?: 1f
            parts.forEach { (_, v, c) ->
                val sweep = v / sum * 360f
                if (sweep > 0) {
                    drawArc(
                        color = c,
                        startAngle = start,
                        sweepAngle = sweep,
                        useCenter = false,
                        style = Stroke(width = 36f),
                        size = Size(size.width - 40f, size.height - 40f),
                        topLeft = Offset(20f, 20f),
                    )
                }
                start += sweep
            }
        }
        Spacer(Modifier.width(16.dp))
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            parts.forEach { (label, v, c) ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(10.dp).clip(RoundedCornerShape(3.dp)).background(c))
                    Spacer(Modifier.width(8.dp))
                    Text("$label: $v", color = TextMuted, fontSize = 12.sp)
                }
            }
        }
    }
}

/** Bar chart tren — nilai total per bulan (label 3 huruf). */
@Composable
private fun TrendBars(labels: List<String>, values: List<Int>) {
    val max = (values.maxOrNull() ?: 0).coerceAtLeast(1).toFloat()
    Column {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(140.dp),
            horizontalArrangement = Arrangement.SpaceEvenly,
            verticalAlignment = Alignment.Bottom,
        ) {
            values.forEach { v ->
                val h = (v / max * 100f).coerceAtLeast(if (v > 0) 6f else 2f)
                Box(
                    modifier = Modifier
                        .width(28.dp)
                        .height(h.dp)
                        .clip(RoundedCornerShape(topStart = 6.dp, topEnd = 6.dp))
                        .background(Color(0xFF1E40AF)),
                )
            }
        }
        Spacer(Modifier.height(8.dp))
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceEvenly,
        ) {
            labels.forEach {
                Text(
                    text = it,
                    color = TextMuted,
                    fontSize = 10.sp,
                    modifier = Modifier.width(28.dp),
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                )
            }
        }
    }
}

/** Satu baris tabel tim: nama + total/diproses/selesai + progress + luas. */
@Composable
private fun TeamRow(t: TeamStatsDto) {
    val shape = RoundedCornerShape(12.dp)
    val diproses = t.ditugaskan + t.sedangDiperbaiki
    val progress = if (t.total > 0) t.selesai.toFloat() / t.total else 0f
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(Color.White)
            .padding(16.dp),
    ) {
        Text(t.teamName ?: "Tim", color = TextDark, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.height(8.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            MiniStat("Total", "${t.total}")
            MiniStat("Diproses", "$diproses")
            MiniStat("Selesai", "${t.selesai}")
            MiniStat("Luas", "${t.totalLuasM2.toInt()} m²")
        }
        Spacer(Modifier.height(8.dp))
        LinearProgressIndicator(
            progress = { progress },
            modifier = Modifier
                .fillMaxWidth()
                .height(6.dp)
                .clip(RoundedCornerShape(3.dp)),
            color = Color(0xFF10B981),
            trackColor = Color(0xFFE2E8F0),
        )
    }
}

@Composable
private fun MiniStat(label: String, value: String) {
    Column {
        Text(value, color = TextDark, fontSize = 15.sp, fontWeight = FontWeight.Bold)
        Text(label, color = TextMuted, fontSize = 11.sp)
    }
}
