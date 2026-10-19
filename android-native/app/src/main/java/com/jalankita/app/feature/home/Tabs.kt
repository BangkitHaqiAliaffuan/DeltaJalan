package com.jalankita.app.feature.home

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.jalankita.app.core.network.SurveyTask
import com.jalankita.app.core.network.UserDto
import com.jalankita.app.ui.components.AppIcon
import com.jalankita.app.feature.home.components.EmptyState
import com.jalankita.app.feature.home.components.PatrolCompactCard
import com.jalankita.app.feature.home.components.ReportCard
import com.jalankita.app.feature.home.components.SectionHeader
import com.jalankita.app.feature.home.components.SkeletonCard
import com.jalankita.app.feature.home.components.formatDateShort
import com.jalankita.app.ui.theme.BrandBlue
import com.jalankita.app.ui.theme.SuccessGreen
import com.jalankita.app.ui.theme.TextDark
import com.jalankita.app.ui.theme.TextMuted

/** Tab Tugas — jadwal patroli tim + seluruh tugas perbaikan (read-only fase ini). */
@Composable
fun TugasScreen(
    user: UserDto,
    vm: DashboardViewModel,
    onOpenDetail: (String) -> Unit,
    onOpenSession: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    LaunchedEffect(user.id) {
        vm.refresh(user)
        vm.loadAllTeamTasks()
        vm.loadSurveys()
    }
    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item(key = "patrol-h") {
            SectionHeader(icon = AppIcon.CalendarMonth, title = "Jadwal Patroli Tim")
        }
        when {
            vm.surveysLoading && vm.surveys.isEmpty() -> item(key = "patrol-skel") { SkeletonCard() }
            vm.surveys.isEmpty() -> item(key = "patrol-empty") {
                EmptyState(
                    icon = AppIcon.CalendarMonth,
                    title = "Belum ada sesi patroli",
                    subtitle = "Jadwal dari supervisor akan muncul di sini",
                )
            }
            else -> items(vm.surveys, key = { "survey-${it.id}" }) { task ->
                PatrolSessionRow(task = task, onClick = { onOpenSession(task.id) })
            }
        }
        item(key = "tasks-h") {
            SectionHeader(icon = AppIcon.Construction, title = "Perbaikan Aktif")
        }
        if (vm.allTeamTasksLoading && vm.allTeamTasks.isEmpty()) {
            item(key = "tasks-skel") { SkeletonCard() }
        } else {
            val active = vm.allTeamTasks.filter {
                it.status == "Ditugaskan" || it.status == "Sedang Diperbaiki"
            }
            if (active.isEmpty()) {
                item(key = "tasks-empty") {
                    EmptyState(
                        icon = AppIcon.CheckCircle,
                        title = "Tidak ada tugas perbaikan aktif",
                        subtitle = "Laporan yang ditugaskan ke timmu akan muncul di sini",
                    )
                }
            } else {
                items(active, key = { "alltask-${it.id}" }) { report ->
                    ReportCard(
                        report = report,
                        onClick = { onOpenDetail(report.id) },
                        actions = {
                            ReportCardActions(
                                report = report,
                                user = user,
                                vm = vm,
                                onOpenDetail = onOpenDetail,
                            )
                        },
                    )
                }
            }
        }
    }
}

/** Filter status untuk tab Laporan — nilai dikirim apa adanya ke ?status= (server case-insensitive). */
private val HISTORY_FILTERS: List<Pair<String, String?>> = listOf(
    "Semua" to null,
    "Menunggu Review" to "menunggu_review",
    "Disetujui" to "disetujui",
    "Ditugaskan" to "ditugaskan",
    "Diperbaiki" to "sedang_diperbaiki",
    "Selesai" to "selesai",
    "Ditolak" to "ditolak",
)

/** Tab Laporan — riwayat laporan sendiri + cari + filter status (replikasi my-reports). */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RiwayatScreen(
    user: UserDto,
    vm: DashboardViewModel,
    onOpenDetail: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    LaunchedEffect(user.id) {
        if (vm.history.isEmpty() && !vm.historyLoading) vm.loadHistory(reset = true)
    }
    val ptr = rememberPullToRefreshState()
    Column(modifier = modifier.fillMaxSize()) {
        OutlinedTextField(
            value = vm.historyQuery,
            onValueChange = vm::updateHistoryQuery,
            placeholder = { Text("Cari kode / jalan / pelapor…") },
            singleLine = true,
            trailingIcon = {
                Text(
                    text = "Cari",
                    color = BrandBlue,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .clickable(onClick = vm::submitHistoryQuery)
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                )
            },
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp),
        )
        LazyRow(
            contentPadding = PaddingValues(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            items(HISTORY_FILTERS) { (label, value) ->
                val selected = vm.historyFilter == value
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(999.dp))
                        .background(if (selected) BrandBlue else Color(0xFFF1F5F9))
                        .clickable(onClick = { vm.applyHistoryFilter(value) })
                        .padding(horizontal = 14.dp, vertical = 8.dp),
                ) {
                    Text(
                        text = label,
                        color = if (selected) Color.White else TextDark,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium,
                    )
                }
            }
        }
        Spacer(Modifier.height(8.dp))
        PullToRefreshBox(
            isRefreshing = vm.historyLoading && vm.history.isEmpty(),
            state = ptr,
            onRefresh = { vm.loadHistory(reset = true) },
            modifier = Modifier.fillMaxSize(),
        ) {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 24.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                if (vm.historyTotal > 0) {
                    item(key = "count") {
                        Text(
                            text = "Menampilkan ${vm.history.size} dari ${vm.historyTotal} laporan",
                            color = TextMuted, fontSize = 12.sp, fontWeight = FontWeight.Medium,
                        )
                    }
                }
                if (!vm.historyLoading && vm.history.isEmpty()) {
                    item(key = "empty") {
                        EmptyState(
                            title = "Belum ada laporan",
                            subtitle = "Upload laporan pertama Anda untuk mulai.",
                        )
                    }
                } else {
                    items(vm.history, key = { "hist-${it.id}" }) { report ->
                        ReportCard(
                            report = report,
                            onClick = { onOpenDetail(report.id) },
                            actions = {
                                ReportCardActions(
                                    report = report,
                                    user = user,
                                    vm = vm,
                                    onOpenDetail = onOpenDetail,
                                )
                            },
                        )
                    }
                    if (vm.historyPage < vm.historyLastPage) {
                        item(key = "more") {
                            OutlinedButton(
                                onClick = { vm.loadHistory() },
                                enabled = !vm.historyLoading,
                                modifier = Modifier.fillMaxWidth(),
                            ) {
                                if (vm.historyLoading) {
                                    CircularProgressIndicator(Modifier.padding(end = 8.dp))
                                }
                                Text(if (vm.historyLoading) "Memuat…" else "Muat lebih banyak")
                            }
                        }
                    }
                }
            }
        }
    }
}

/** Tab Profil — kartu peran (pindahan HomeScreen lama) + versi + keluar. */
@Composable
fun ProfilScreen(
    user: UserDto,
    versionName: String,
    logoutBusy: Boolean,
    onLogout: () -> Unit,
    modifier: Modifier = Modifier,
) {
    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item(key = "card") {
            val shape = RoundedCornerShape(12.dp)
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(shape)
                    .background(Color.White)
                    .padding(16.dp),
            ) {
                val initial = user.name.firstOrNull()?.uppercase() ?: "?"
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .clip(CircleShape)
                            .background(BrandBlue)
                            .padding(14.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(initial, color = Color.White, fontSize = 20.sp,
                            fontWeight = FontWeight.Bold)
                    }
                    Spacer(Modifier.padding(horizontal = 6.dp))
                    Column(Modifier.weight(1f)) {
                        Text(user.name, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                        Text(
                            user.roleLabel ?: user.role,
                            color = TextMuted, fontSize = 13.sp,
                        )
                    }
                }
                Spacer(Modifier.height(12.dp))
                user.teamName?.let { Text("Tim: $it", color = TextDark, fontSize = 14.sp) }
                user.email?.let { Text(it, color = TextDark, fontSize = 14.sp) }
                user.phone?.let { Text(it, color = TextDark, fontSize = 14.sp) }
            }
        }
        item(key = "version") {
            Text(
                text = "DeltaJalan v$versionName",
                color = TextMuted, fontSize = 12.sp,
                modifier = Modifier.padding(horizontal = 4.dp),
            )
        }
        item(key = "logout") {
            Button(
                onClick = onLogout,
                enabled = !logoutBusy,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(if (logoutBusy) "Keluar…" else "Keluar")
            }
        }
    }
}

/**
 * Baris sesi patroli di tab Tugas — port task card tugas-saya.tsx PatroliSection.
 * Ketuk → detail sesi (tempat tombol tambah laporan).
 */
@Composable
private fun PatrolSessionRow(task: SurveyTask, onClick: () -> Unit) {
    val aktif = task.status == "aktif"
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(Color.White)
            .border(1.dp, Color(0xFFE2E8F0), RoundedCornerShape(12.dp))
            .clickable(onClick = onClick)
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
            Text(
                task.roadName ?: task.kecamatan?.let { "Patroli Kec. $it" } ?: "Sesi Patroli",
                color = TextDark, fontSize = 14.sp, fontWeight = FontWeight.Bold,
                maxLines = 1, overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = listOfNotNull(
                    task.kecamatan?.let { "Kec. $it" },
                    task.tanggalPatroli?.let { formatDateShort(it) },
                    task.alasanTugas?.replace("_", " "),
                ).joinToString(" • "),
                color = TextMuted, fontSize = 11.sp,
                maxLines = 1, overflow = TextOverflow.Ellipsis,
            )
            if (task.reportsCount > 0) {
                Text("${task.reportsCount} laporan", color = TextMuted, fontSize = 11.sp)
            }
        }
        Box(
            modifier = Modifier
                .clip(RoundedCornerShape(6.dp))
                .background(if (aktif) Color(0xFFF0FDF4) else Color(0xFFF8FAFC))
                .padding(horizontal = 8.dp, vertical = 3.dp),
        ) {
            Text(
                if (aktif) "Aktif" else "Selesai",
                color = if (aktif) SuccessGreen else Color(0xFF94A3B8),
                fontSize = 10.sp, fontWeight = FontWeight.SemiBold,
            )
        }
        Spacer(Modifier.width(6.dp))
        Icon(AppIcon.ChevronRight, contentDescription = null, tint = TextMuted, modifier = Modifier.size(18.dp))
    }
}
