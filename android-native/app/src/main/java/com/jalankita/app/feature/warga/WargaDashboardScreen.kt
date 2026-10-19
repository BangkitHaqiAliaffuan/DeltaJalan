package com.jalankita.app.feature.warga

import androidx.compose.foundation.background
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.jalankita.app.core.network.UserDto
import com.jalankita.app.feature.home.components.EmptyState
import com.jalankita.app.feature.home.components.GreetingHero
import com.jalankita.app.feature.home.components.SectionHeader
import com.jalankita.app.feature.home.components.SkeletonCard
import com.jalankita.app.feature.home.components.StatCard
import com.jalankita.app.ui.components.AppIcon
import com.jalankita.app.ui.components.BrandPrimaryButton
import com.jalankita.app.ui.theme.BrandBlue
import com.jalankita.app.ui.theme.ErrorRed
import com.jalankita.app.ui.theme.SuccessGreen
import com.jalankita.app.ui.theme.WarningAmber

/**
 * Beranda warga — port src/routes/warga/index.tsx (mode mobile).
 * Hero "Selamat datang" + 4 tile (Total/Diproses/Selesai/Ditolak) +
 * CTA lapor + laporan terbaru. Tanpa FAB (hideFab di web).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WargaDashboardScreen(
    user: UserDto,
    vm: WargaViewModel,
    onLapor: () -> Unit,
    onOpenLaporan: () -> Unit,
    onOpenDetail: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    LaunchedEffect(user.id) { vm.refreshDashboard(user) }
    LaunchedEffect(user.id) {
        while (true) {
            kotlinx.coroutines.delay(120_000)
            vm.refreshDashboard(user)
        }
    }

    val ptr = rememberPullToRefreshState()
    PullToRefreshBox(
        isRefreshing = vm.refreshing,
        state = ptr,
        onRefresh = { vm.refreshDashboard(user, force = true) },
        modifier = modifier.fillMaxSize(),
    ) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = 24.dp),
        ) {
            item(key = "hero") {
                GreetingHero(
                    greeting = "Selamat datang",
                    name = user.name,
                    teamName = null,
                    badgeLabel = "WARGA",
                    subtitle = "Laporkan kerusakan jalan di Kab. Sidoarjo",
                )
            }

            item(key = "tiles-title") {
                SectionHeader(
                    icon = AppIcon.BarChart,
                    title = "Laporan Saya",
                    modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 24.dp),
                )
                Spacer(Modifier.height(12.dp))
            }
            if (vm.loading && vm.recent.isEmpty()) {
                items(4) { SkeletonCard(Modifier.padding(horizontal = 16.dp)) }
            } else {
                item(key = "tiles-r1") {
                    Row(
                        modifier = Modifier.padding(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        StatCard(
                            icon = AppIcon.Description,
                            label = "Total",
                            value = vm.stats.total,
                            color = BrandBlue,
                            modifier = Modifier.weight(1f),
                        )
                        StatCard(
                            icon = AppIcon.PendingActions,
                            label = "Diproses",
                            value = vm.stats.diproses,
                            color = WarningAmber,
                            modifier = Modifier.weight(1f),
                        )
                    }
                    Spacer(Modifier.height(12.dp))
                }
                item(key = "tiles-r2") {
                    Row(
                        modifier = Modifier.padding(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        StatCard(
                            icon = AppIcon.CheckCircle,
                            label = "Selesai",
                            value = vm.stats.selesai,
                            color = SuccessGreen,
                            modifier = Modifier.weight(1f),
                        )
                        StatCard(
                            icon = AppIcon.Error,
                            label = "Ditolak",
                            value = vm.stats.ditolak,
                            color = ErrorRed,
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
            }

            item(key = "cta") {
                BrandPrimaryButton(
                    text = "Laporkan Kerusakan Jalan",
                    onClick = onLapor,
                    icon = AppIcon.UploadPhoto,
                    modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 24.dp),
                )
            }

            item(key = "recent-title") {
                SectionHeader(
                    icon = AppIcon.PendingActions,
                    title = "Laporan Terbaru",
                    actionLabel = "Lihat Semua",
                    onAction = onOpenLaporan,
                    modifier = Modifier.padding(start = 16.dp, end = 8.dp, top = 24.dp),
                )
                Spacer(Modifier.height(12.dp))
            }
            if (vm.loading && vm.recent.isEmpty()) {
                items(3) { SkeletonCard(Modifier.padding(horizontal = 16.dp)) }
            } else if (vm.recent.isEmpty()) {
                item(key = "recent-empty") {
                    EmptyState(
                        title = "Belum ada laporan",
                        subtitle = "Buat laporan pertama Anda.",
                        modifier = Modifier.padding(horizontal = 16.dp),
                        action = {
                            BrandPrimaryButton(
                                text = "Buat Laporan Baru",
                                onClick = onLapor,
                            )
                        },
                    )
                }
            } else {
                items(vm.recent, key = { "wrecent-${it.id}" }) { report ->
                    WargaReportCard(
                        report = report,
                        onClick = { onOpenDetail(report.id) },
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp),
                    )
                }
            }
        }
    }
}
