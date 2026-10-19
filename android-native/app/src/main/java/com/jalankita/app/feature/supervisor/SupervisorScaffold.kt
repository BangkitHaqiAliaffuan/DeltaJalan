package com.jalankita.app.feature.supervisor

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.jalankita.app.BuildConfig
import com.jalankita.app.core.network.UserDto
import com.jalankita.app.feature.auth.AuthViewModel
import com.jalankita.app.feature.home.DashboardViewModel
import com.jalankita.app.feature.home.PatrolSessionScreen
import com.jalankita.app.feature.home.ProfilScreen
import com.jalankita.app.feature.home.components.DeltaTopBar
import com.jalankita.app.feature.notif.NotifScreen
import com.jalankita.app.feature.notif.NotifViewModel
import com.jalankita.app.ui.components.AppIcon
import com.jalankita.app.ui.theme.BrandBlue
import com.jalankita.app.ui.theme.TextMuted

/** Layar supervisor — 5 tab (Beranda/Review/Peta/Jadwal/Statistik) + state DETAIL, PATROL_DETAIL, & PATROL_SESSION. */
enum class SupervisorScreen { BERANDA, REVIEW, PETA, PROFIL, DETAIL, PATROL, PATROL_DETAIL, PATROL_SESSION, NOTIFIKASI, STATISTIK }

enum class SupervisorTab(val label: String, val icon: ImageVector, val screen: SupervisorScreen) {
    BERANDA("Beranda", AppIcon.Home, SupervisorScreen.BERANDA),
    REVIEW("Review", AppIcon.PendingActions, SupervisorScreen.REVIEW),
    PETA("Peta", AppIcon.Map, SupervisorScreen.PETA),
    PATROL("Jadwal", AppIcon.CalendarMonth, SupervisorScreen.PATROL),
    STATISTIK("Statistik", AppIcon.BarChart, SupervisorScreen.STATISTIK),
}

/**
 * Kerangka supervisor — hanya menyentuh endpoint supervisor (isolasi role).
 * Profil reuse milik petugas/warga (generik).
 */
@Composable
fun SupervisorScaffold(
    user: UserDto,
    authVm: AuthViewModel,
    screen: SupervisorScreen,
    onNavigate: (SupervisorScreen) -> Unit,
    deepLinkReportId: String? = null,
    onDeepLinkConsumed: () -> Unit = {},
) {
    val vm: SupervisorViewModel = viewModel()
    val patrolVm: PatrolViewModel = viewModel()
    val dashboardVm: DashboardViewModel = viewModel()
    var detailId by remember { mutableStateOf<String?>(null) }
    var patrolId by remember { mutableStateOf<String?>(null) }
    var patrolSessionId by remember { mutableStateOf<String?>(null) }
    var returnTab by remember { mutableStateOf(SupervisorScreen.BERANDA) }
    // Layar Notifikasi dipakai bersama (endpoint per-user, tanpa sekat role).
    val notifVm: NotifViewModel = viewModel()
    var notifReturn by remember { mutableStateOf(SupervisorScreen.BERANDA) }
    val snackbar = remember { SnackbarHostState() }

    fun openDetail(id: String) {
        // Rekam tab asal saja — deep-link beruntun tidak boleh menimpa.
        if (screen != SupervisorScreen.DETAIL && screen != SupervisorScreen.NOTIFIKASI) {
            returnTab = screen
        }
        detailId = id
        onNavigate(SupervisorScreen.DETAIL)
    }

    fun openNotif() {
        if (screen != SupervisorScreen.DETAIL && screen != SupervisorScreen.NOTIFIKASI) {
            notifReturn = screen
        }
        onNavigate(SupervisorScreen.NOTIFIKASI)
    }

    // G4: tap notifikasi FCM → buka detail laporan (deep-link Fase 4).
    LaunchedEffect(deepLinkReportId) {
        if (deepLinkReportId != null) {
            openDetail(deepLinkReportId)
            onDeepLinkConsumed()
        }
    }

    fun openPatrolDetail(id: String) {
        patrolId = id
        onNavigate(SupervisorScreen.PATROL_DETAIL)
    }

    fun goTab(tab: SupervisorTab) {
        detailId = null
        patrolId = null
        onNavigate(tab.screen)
    }

    LaunchedEffect(vm.sessionExpired) {
        if (vm.sessionExpired) authVm.refreshSession()
    }
    // 401 dari endpoint notifikasi → sesi mati → kembali ke login.
    LaunchedEffect(notifVm.sessionExpired) {
        if (notifVm.sessionExpired) authVm.refreshSession()
    }
    LaunchedEffect(vm.errorMessage) {
        vm.errorMessage?.let {
            snackbar.showSnackbar(it)
            vm.consumeError()
        }
    }
    LaunchedEffect(vm.actionMessage) {
        vm.actionMessage?.let {
            snackbar.showSnackbar(it)
            vm.consumeMessage()
        }
    }
    LaunchedEffect(notifVm.errorMessage) {
        notifVm.errorMessage?.let {
            snackbar.showSnackbar(it)
            notifVm.consumeError()
        }
    }
    // Badge bell TopBar — muat saat scaffold dibuka (best-effort, 0 bila gagal).
    LaunchedEffect(Unit) {
        notifVm.loadUnread()
    }
    // Snackbar khusus alur patroli (ViewModel terpisah).
    LaunchedEffect(patrolVm.errorMessage) {
        patrolVm.errorMessage?.let {
            snackbar.showSnackbar(it)
            patrolVm.consumeError()
        }
    }
    LaunchedEffect(patrolVm.message) {
        patrolVm.message?.let {
            snackbar.showSnackbar(it)
            patrolVm.consumeMessage()
        }
    }
    LaunchedEffect(patrolVm.sessionExpired) {
        if (patrolVm.sessionExpired) authVm.refreshSession()
    }

    // Auto-refresh antrean hanya saat tab Review aktif; hentikan saat pindah.
    LaunchedEffect(screen) {
        if (screen == SupervisorScreen.REVIEW) vm.startAutoRefresh() else vm.stopAutoRefresh()
    }

    androidx.activity.compose.BackHandler(
        enabled = screen == SupervisorScreen.PETA ||
            screen == SupervisorScreen.REVIEW ||
            screen == SupervisorScreen.PATROL ||
            screen == SupervisorScreen.STATISTIK ||
            screen == SupervisorScreen.PROFIL,
    ) {
        onNavigate(SupervisorScreen.BERANDA)
    }
    androidx.activity.compose.BackHandler(enabled = screen == SupervisorScreen.DETAIL) {
        detailId = null
        onNavigate(returnTab)
    }
    androidx.activity.compose.BackHandler(enabled = screen == SupervisorScreen.PATROL_DETAIL) {
        patrolId = null
        onNavigate(SupervisorScreen.PATROL)
    }
    androidx.activity.compose.BackHandler(enabled = screen == SupervisorScreen.NOTIFIKASI) {
        onNavigate(notifReturn)
    }

    when (screen) {
        // DETAIL dirender di luar Scaffold tab, jadi perlu SnackbarHost sendiri —
        // jika tidak, actionMessage/errorMessage di-consume LaunchedEffect di atas
        // tanpa pernah tampil (pesan sukses approve hilang sunyi).
        SupervisorScreen.DETAIL -> {
            Box(Modifier.fillMaxSize()) {
                SupervisorDetailScreen(
                    reportId = detailId.orEmpty(),
                    vm = vm,
                    onBack = {
                        detailId = null
                        onNavigate(returnTab)
                    },
                )
                SnackbarHost(
                    hostState = snackbar,
                    modifier = Modifier.align(Alignment.BottomCenter)
                        .navigationBarsPadding()
                        .padding(16.dp),
                )
            }
        }
        SupervisorScreen.PATROL_DETAIL -> Box(Modifier.fillMaxSize()) {
            PatrolDetailScreen(
                scheduleId = patrolId.orEmpty(),
                vm = patrolVm,
                onBack = {
                    patrolId = null
                    onNavigate(SupervisorScreen.PATROL)
                },
                onOpenTask = { taskId ->
                    patrolSessionId = taskId
                    onNavigate(SupervisorScreen.PATROL_SESSION)
                },
            )
            SnackbarHost(
                hostState = snackbar,
                modifier = Modifier.align(Alignment.BottomCenter)
                    .navigationBarsPadding()
                    .padding(16.dp),
            )
        }
        SupervisorScreen.PATROL_SESSION -> Box(Modifier.fillMaxSize()) {
            PatrolSessionScreen(
                taskId = patrolSessionId.orEmpty(),
                user = user,
                vm = dashboardVm,
                onBack = { onNavigate(SupervisorScreen.PATROL_DETAIL) },
                onTambahLaporan = { _, _, _ -> },
                onOpenReport = { reportId -> openDetail(reportId) },
            )
            SnackbarHost(
                hostState = snackbar,
                modifier = Modifier.align(Alignment.BottomCenter)
                    .navigationBarsPadding()
                    .padding(16.dp),
            )
        }
        // NOTIFIKASI di luar Scaffold tab → SnackbarHost sendiri.
        SupervisorScreen.NOTIFIKASI -> Box(Modifier.fillMaxSize()) {
            NotifScreen(
                vm = notifVm,
                onBack = { onNavigate(notifReturn) },
            )
            SnackbarHost(
                hostState = snackbar,
                modifier = Modifier.align(Alignment.BottomCenter)
                    .navigationBarsPadding()
                    .padding(16.dp),
            )
        }
        else -> {
            Scaffold(
                snackbarHost = { SnackbarHost(snackbar) },
                topBar = {
                    DeltaTopBar(
                        user = user,
                        onAvatarClick = { onNavigate(SupervisorScreen.PROFIL) },
                        unreadCount = notifVm.unread,
                        onNotifClick = ::openNotif,
                    )
                    HorizontalDivider(color = Color(0xFFD0DAE8), thickness = 1.dp)
                },
                bottomBar = {
                    HorizontalDivider(color = Color(0xFFD0DAE8), thickness = 1.dp)
                    SupervisorBottomNav(
                        selected = when (screen) {
                            SupervisorScreen.REVIEW -> SupervisorTab.REVIEW
                            SupervisorScreen.PETA -> SupervisorTab.PETA
                            SupervisorScreen.PATROL -> SupervisorTab.PATROL
                            SupervisorScreen.STATISTIK -> SupervisorTab.STATISTIK
                            else -> SupervisorTab.BERANDA
                        },
                        onSelect = ::goTab,
                    )
                },
                containerColor = Color(0xFFF5F7FA),
            ) { inner ->
                when (screen) {
                    SupervisorScreen.BERANDA -> SupervisorDashboardScreen(
                        vm = vm,
                        onOpenReview = { goTab(SupervisorTab.REVIEW) },
                        onOpenDetail = ::openDetail,
                        onOpenPatrol = { onNavigate(SupervisorScreen.PATROL) },
                        modifier = Modifier.padding(inner),
                    )
                    SupervisorScreen.REVIEW -> SupervisorReviewScreen(
                        vm = vm,
                        onOpenDetail = ::openDetail,
                        modifier = Modifier.padding(inner),
                    )
                    SupervisorScreen.PETA -> SupervisorPetaScreen(
                        vm = vm,
                        onOpenDetail = ::openDetail,
                        modifier = Modifier.padding(inner),
                    )
                    // Tab Statistik — replikasi routes/stats.tsx.
                    SupervisorScreen.STATISTIK -> SupervisorStatsScreen(
                        vm = vm,
                        modifier = Modifier.padding(inner),
                    )
                    // Tab Jadwal Patroli — dengan top-bar + bottom-nav (konsisten tab lain).
                    SupervisorScreen.PATROL -> PatrolListScreen(
                        vm = patrolVm,
                        onOpenDetail = ::openPatrolDetail,
                        modifier = Modifier.padding(inner),
                    )
                    SupervisorScreen.PROFIL -> ProfilScreen(
                        user = user,
                        versionName = BuildConfig.VERSION_NAME,
                        logoutBusy = authVm.logoutBusy,
                        onLogout = authVm::logout,
                        modifier = Modifier.padding(inner),
                    )
                    else -> Unit
                }
            }
        }
    }
}

/** Bottom nav supervisor — pola identik WargaBottomNav. */
@Composable
private fun SupervisorBottomNav(
    selected: SupervisorTab,
    onSelect: (SupervisorTab) -> Unit,
    modifier: Modifier = Modifier,
) {
    val bottomInset = WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding()
    Row(
        modifier = modifier
            .fillMaxWidth()
            .background(Color.White)
            .padding(bottom = bottomInset),
    ) {
        SupervisorTab.values().forEach { tab ->
            val active = tab == selected
            Column(
                modifier = Modifier
                    .weight(1f)
                    .height(64.dp)
                    .clickable(onClick = { onSelect(tab) })
                    .padding(top = 2.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                Box(
                    modifier = Modifier
                        .size(width = 24.dp, height = 2.dp)
                        .background(if (active) BrandBlue else Color.Transparent),
                )
                Icon(
                    imageVector = tab.icon,
                    contentDescription = tab.label,
                    tint = if (active) BrandBlue else TextMuted,
                    modifier = Modifier.size(22.dp),
                )
                Text(
                    text = tab.label,
                    color = if (active) BrandBlue else TextMuted,
                    fontSize = 12.sp,
                    fontWeight = if (active) FontWeight.SemiBold else FontWeight.Normal,
                )
            }
        }
    }
}
