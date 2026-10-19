package com.jalankita.app.feature.home

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.jalankita.app.core.network.UserDto
import com.jalankita.app.feature.home.components.EmptyState
import com.jalankita.app.feature.home.components.GreetingHero
import com.jalankita.app.feature.home.components.LatestHeader
import com.jalankita.app.feature.home.components.PatrolCompactCard
import com.jalankita.app.feature.home.components.QuickActions
import com.jalankita.app.feature.home.components.RecentEmptyCard
import com.jalankita.app.feature.home.components.ReportCard
import com.jalankita.app.feature.home.components.SectionHeader
import com.jalankita.app.feature.home.components.SkeletonCard
import com.jalankita.app.feature.home.components.StatCard
import com.jalankita.app.ui.components.AppIcon

/**
 * Beranda petugas — port src/routes/home.tsx (mode mobile).
 * Urutan seksi persis web: hero → overview → patroli → tugas aktif →
 * quick action → laporan terbaru. Read-only; aksi tulis tidak ada fase ini.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(
    user: UserDto,
    vm: DashboardViewModel,
    onLapor: () -> Unit,
    onOpenLaporanTab: () -> Unit,
    onOpenTugasTab: () -> Unit,
    onOpenDetail: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    LaunchedEffect(user.id) { vm.refresh(user) }
    // Auto-refresh tiap 60 dtk saat Beranda tampil (web: stats 30 dtk, recent 120 dtk).
    LaunchedEffect(user.id) {
        while (true) {
            kotlinx.coroutines.delay(60_000)
            vm.refresh(user)
        }
    }

    val ptrState = rememberPullToRefreshState()
    PullToRefreshBox(
        isRefreshing = vm.refreshing,
        state = ptrState,
        onRefresh = { vm.refresh(user, force = true) },
        modifier = modifier.fillMaxSize(),
    ) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = 24.dp),
        ) {
            item(key = "hero") {
                GreetingHero(
                    greeting = greetingForNow(),
                    name = user.name,
                    teamName = user.teamName,
                )
            }
                item(key = "overview-title") {
                SectionHeader(
                    icon = AppIcon.BarChart,
                    title = "Overview Operasional",
                    modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 24.dp),
                )
                Spacer(Modifier.height(12.dp))
            }
            if (vm.loading && vm.stats == null) {
                items(4) { SkeletonCard(Modifier.padding(horizontal = 16.dp)) }
            } else {
                item(key = "overview-row1") {
                    Row(
                        modifier = Modifier.padding(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        StatCard(
                            icon = AppIcon.Warning,
                            label = "Rusak Berat",
                            value = vm.stats?.rusakBerat ?: 0,
                            color = Color(0xFFDC2626),
                            modifier = Modifier.weight(1f),
                        )
                        StatCard(
                            icon = AppIcon.CheckCircle,
                            label = "Selesai Diperbaiki",
                            value = vm.stats?.selesai ?: 0,
                            color = Color(0xFF059669),
                            modifier = Modifier.weight(1f),
                        )
                    }
                    Spacer(Modifier.height(12.dp))
                }
                item(key = "overview-row2") {
                    Row(
                        modifier = Modifier.padding(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        StatCard(
                            icon = AppIcon.PendingActions,
                            label = "Sedang Diproses",
                            value = (vm.stats?.menungguReview ?: 0) +
                                (vm.stats?.sedangDiperbaiki ?: 0),
                            color = Color(0xFFD97706),
                            modifier = Modifier.weight(1f),
                        )
                        StatCard(
                            icon = AppIcon.Assignment,
                            label = "Ditugaskan",
                            value = vm.stats?.ditugaskan ?: 0,
                            color = Color(0xFF1E40AF),
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
            }

            if (vm.schedules.isNotEmpty()) {
                item(key = "patrol-title") {
                    SectionHeader(
                        icon = AppIcon.CalendarMonth,
                        title = "Jadwal Patrolimu",
                        actionLabel = "Lihat Semua",
                        onAction = onOpenTugasTab,
                        modifier = Modifier.padding(start = 16.dp, end = 8.dp, top = 24.dp),
                    )
                    Spacer(Modifier.height(12.dp))
                }
                item(key = "patrol-card") {
                    PatrolCompactCard(
                        schedules = vm.schedules,
                        modifier = Modifier.padding(horizontal = 16.dp),
                    )
                }
            }

            item(key = "tasks-title") {
                SectionHeader(
                    icon = AppIcon.Construction,
                    title = "Tugas Perbaikan Aktif",
                    actionLabel = "Lihat Semua",
                    onAction = onOpenTugasTab,
                    modifier = Modifier.padding(start = 16.dp, end = 8.dp, top = 24.dp),
                )
                Spacer(Modifier.height(12.dp))
            }
            if (vm.loading && vm.teamTasks.isEmpty()) {
                item(key = "tasks-skeleton") {
                    SkeletonCard(Modifier.padding(horizontal = 16.dp))
                }
            } else if (vm.activeTasks.isEmpty()) {
                item(key = "tasks-empty") {
                    EmptyState(
                        icon = AppIcon.CheckCircle,
                        title = "Tidak ada tugas perbaikan aktif",
                        subtitle = "Laporan yang ditugaskan ke timmu akan muncul di sini",
                        modifier = Modifier.padding(horizontal = 16.dp),
                    )
                }
            } else {
                items(vm.activeTasks, key = { "task-${it.id}" }) { report ->
                    ReportCard(
                        report = report,
                        onClick = { onOpenDetail(report.id) },
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp),
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

            item(key = "quick-actions") {
                QuickActions(
                    onUpload = onLapor,
                    onHistory = onOpenLaporanTab,
                    modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 24.dp),
                )
            }

            item(key = "recent-title") {
                LatestHeader(
                    total = vm.stats?.total ?: 0,
                    count = minOf(vm.latestFive.size, 5),
                    onSeeAll = onOpenLaporanTab,
                    modifier = Modifier.padding(start = 16.dp, end = 8.dp, top = 24.dp),
                )
                Spacer(Modifier.height(12.dp))
            }
            if (vm.loading && vm.recent.isEmpty()) {
                items(3) { SkeletonCard(Modifier.padding(horizontal = 16.dp)) }
            } else if (vm.latestFive.isEmpty()) {
                item(key = "recent-empty") {
                    RecentEmptyCard(modifier = Modifier.padding(horizontal = 16.dp))
                }
            } else {
                items(vm.latestFive, key = { "recent-${it.id}" }) { report ->
                    ReportCard(
                        report = report,
                        onClick = { onOpenDetail(report.id) },
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp),
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
