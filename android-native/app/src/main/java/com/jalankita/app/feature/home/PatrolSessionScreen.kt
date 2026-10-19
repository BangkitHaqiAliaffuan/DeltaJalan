package com.jalankita.app.feature.home

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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.jalankita.app.core.network.SurveyReport
import com.jalankita.app.core.network.SurveyTask
import com.jalankita.app.core.network.UserDto
import com.jalankita.app.core.data.UserRole
import com.jalankita.app.core.util.ImageUrl
import com.jalankita.app.feature.home.components.EmptyState
import com.jalankita.app.feature.home.components.SkeletonCard
import com.jalankita.app.feature.home.components.displayStatus
import com.jalankita.app.feature.home.components.formatDateShort
import com.jalankita.app.feature.home.components.statusDotColor
import com.jalankita.app.ui.components.AppIcon
import com.jalankita.app.ui.components.BrandPrimaryButton
import com.jalankita.app.ui.components.ErrorBox
import com.jalankita.app.ui.theme.BrandBlue
import com.jalankita.app.ui.theme.SuccessGreen
import com.jalankita.app.ui.theme.TextDark
import com.jalankita.app.ui.theme.TextMuted

/**
 * Detail sesi patroli petugas — port Frontend-stable/src/routes/detail-patroli.tsx.
 * Info sesi + ringkasan laporan + daftar laporan + tombol "Tambah Laporan Patroli"
 * (hanya petugas & status sesi aktif). Setelah lapor, sesi di-refresh.
 */
@Composable
fun PatrolSessionScreen(
    taskId: String,
    user: UserDto,
    vm: DashboardViewModel,
    onBack: () -> Unit,
    onTambahLaporan: (surveyId: String, roadName: String?, kecamatan: String?) -> Unit,
    onOpenReport: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    LaunchedEffect(taskId) { if (taskId.isNotBlank()) vm.loadSurveyDetail(taskId) }

    Column(modifier = modifier.fillMaxWidth()) {
        // Top bar
        Row(
            modifier = Modifier.fillMaxWidth().background(Color.White).padding(horizontal = 12.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(AppIcon.ArrowBack, contentDescription = "Kembali", tint = BrandBlue, modifier = Modifier.size(24.dp).clickable(onClick = onBack))
            Spacer(Modifier.width(12.dp))
            Text("Detail Patroli", color = TextDark, fontSize = 16.sp, fontWeight = FontWeight.Bold)
        }
        HorizontalDivider(color = Color(0xFFD0DAE8), thickness = 1.dp)

        val task = vm.surveyDetail
        when {
            vm.surveyDetailLoading && task == null -> LazyColumn(
                modifier = Modifier.fillMaxWidth().padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) { items(3) { SkeletonCard() } }

            task == null -> LazyColumn(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
                item { ErrorBox("Sesi patroli tidak dapat dimuat.", modifier = Modifier.fillMaxWidth()) }
            }

            else -> PatrolSessionBody(
                task = task,
                user = user,
                onTambahLaporan = { onTambahLaporan(task.id, task.roadName, task.kecamatan) },
                onOpenReport = onOpenReport,
            )
        }
    }
}

@Composable
private fun PatrolSessionBody(
    task: SurveyTask,
    user: UserDto,
    onTambahLaporan: () -> Unit,
    onOpenReport: (String) -> Unit,
) {
    val reports = task.reports.orEmpty()
    val isPetugas = user.role == UserRole.PETUGAS
    val canUpload = isPetugas && task.status == "aktif"

    LazyColumn(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(vertical = 16.dp),
    ) {
        // ── Info sesi ──
        item {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(Color.White)
                    .border(1.dp, Color(0xFFE2E8F0), RoundedCornerShape(12.dp))
                    .padding(16.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        "Patroli ${task.tanggalPatroli?.let { formatDateShort(it) } ?: ""}",
                        color = TextDark, fontSize = 17.sp, fontWeight = FontWeight.Bold,
                        modifier = Modifier.weight(1f),
                    )
                    SessionStatusBadge(task.status)
                }
                Spacer(Modifier.height(12.dp))
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    InfoRow(AppIcon.Map, task.kecamatan?.let { "Kec. $it" } ?: "—")
                    task.roadName?.takeIf { it.isNotBlank() }?.let {
                        InfoRow(AppIcon.Construction, it)
                    }
                    InfoRow(AppIcon.Assignment, task.team?.name?.let { "Tim: $it" } ?: "—")
                    InfoRow(AppIcon.CalendarMonth, "${jam(task.jamMulai)} — ${jam(task.jamSelesai)}")
                    task.tanggalPatroli?.let { InfoRow(AppIcon.CalendarMonth, formatDateShort(it)) }
                    task.alasanTugas?.let { InfoRow(AppIcon.Info, it.replace("_", " ").replaceFirstChar { c -> c.uppercase() }) }
                }
                if (reports.isNotEmpty()) {
                    Spacer(Modifier.height(12.dp))
                    HorizontalDivider(color = Color(0xFFE2E8F0))
                    Spacer(Modifier.height(10.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(14.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text("${reports.size} laporan", color = TextDark, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                        val selesai = reports.count { it.status == "Selesai" }
                        val diperbaiki = reports.count { it.status == "Sedang Diperbaiki" }
                        val menunggu = reports.count { it.status == "Menunggu Review" }
                        if (selesai > 0) DotStat(Color(0xFF10B981), "$selesai selesai")
                        if (diperbaiki > 0) DotStat(Color(0xFFF97316), "$diperbaiki diperbaiki")
                        if (menunggu > 0) DotStat(Color(0xFFF59E0B), "$menunggu menunggu")
                    }
                }
                task.catatan?.takeIf { it.isNotBlank() }?.let {
                    Spacer(Modifier.height(10.dp))
                    Text(
                        "Catatan: $it",
                        color = TextMuted, fontSize = 13.sp,
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(8.dp))
                            .background(Color(0xFFF8FAFC))
                            .border(1.dp, Color(0xFFE2E8F0), RoundedCornerShape(8.dp))
                            .padding(12.dp),
                    )
                }
            }
        }

        // ── Tombol tambah laporan (hanya petugas & sesi aktif) ──
        if (canUpload) {
            item {
                BrandPrimaryButton(
                    "Tambah Laporan Patroli",
                    onClick = onTambahLaporan,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }

        // ── Daftar laporan ──
        if (reports.isNotEmpty()) {
            item {
                Text("Laporan (${reports.size})", color = TextDark, fontSize = 14.sp, fontWeight = FontWeight.Bold)
            }
            items(reports, key = { it.id }) { r ->
                ReportRow(r, onClick = { onOpenReport(r.id) })
            }
        } else {
            item {
                EmptyState(
                    icon = AppIcon.Camera,
                    title = "Belum ada laporan",
                    subtitle = if (canUpload) "Tekan \"Tambah Laporan Patroli\" untuk mulai." else "Belum ada laporan untuk sesi ini.",
                )
            }
        }
    }
}

@Composable
private fun ReportRow(r: SurveyReport, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(Color.White)
            .border(1.dp, Color(0xFFE2E8F0), RoundedCornerShape(10.dp))
            .clickable(onClick = onClick)
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        val img = ImageUrl.resolve(r.displayImageUrl)
        Box(
            modifier = Modifier.size(52.dp).clip(RoundedCornerShape(8.dp)).background(Color(0xFFEEF3FA)),
            contentAlignment = Alignment.Center,
        ) {
            if (img != null) {
                AsyncImage(model = img, contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.size(52.dp).clip(RoundedCornerShape(8.dp)))
            } else {
                Icon(AppIcon.Camera, contentDescription = null, tint = Color(0xFF94A3B8), modifier = Modifier.size(20.dp))
            }
        }
        Spacer(Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(r.reportCode ?: "Laporan", color = TextDark, fontSize = 13.sp, fontWeight = FontWeight.Medium, maxLines = 1, overflow = TextOverflow.Ellipsis)
            r.roadName?.let { Text(it, color = TextMuted, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis) }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(modifier = Modifier.size(6.dp).clip(RoundedCornerShape(999.dp)).background(statusDotColor(r.status)))
                Spacer(Modifier.width(4.dp))
                Text(displayStatus(r.status), color = TextMuted, fontSize = 11.sp)
                r.createdAt?.let {
                    Text(" · ${formatDateShort(it)}", color = TextMuted, fontSize = 11.sp)
                }
            }
        }
        Icon(AppIcon.ChevronRight, contentDescription = null, tint = TextMuted, modifier = Modifier.size(18.dp))
    }
}

@Composable
private fun InfoRow(icon: androidx.compose.ui.graphics.vector.ImageVector, value: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, contentDescription = null, tint = TextMuted, modifier = Modifier.size(16.dp))
        Spacer(Modifier.width(8.dp))
        Text(value, color = TextDark, fontSize = 13.sp)
    }
}

@Composable
private fun DotStat(color: Color, label: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(modifier = Modifier.size(7.dp).clip(RoundedCornerShape(999.dp)).background(color))
        Spacer(Modifier.width(4.dp))
        Text(label, color = TextMuted, fontSize = 11.sp)
    }
}

@Composable
private fun SessionStatusBadge(status: String?) {
    val (bg, fg, label) = when (status) {
        "aktif" -> Triple(Color(0xFFEFF6FF), BrandBlue, "Aktif")
        "selesai" -> Triple(Color(0xFFF0FDF4), SuccessGreen, "Selesai")
        else -> Triple(Color(0xFFF8FAFC), Color(0xFF64748B), "Dibatalkan")
    }
    Box(
        modifier = Modifier.clip(RoundedCornerShape(999.dp)).background(bg).padding(horizontal = 10.dp, vertical = 4.dp),
    ) {
        Text(label, color = fg, fontSize = 11.sp, fontWeight = FontWeight.Bold)
    }
}

/** "07:00:00" → "07:00"; null → "—". */
private fun jam(v: String?): String = v?.take(5) ?: "—"
