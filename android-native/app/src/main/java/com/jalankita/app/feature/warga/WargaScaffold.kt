package com.jalankita.app.feature.warga

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
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
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.jalankita.app.BuildConfig
import com.jalankita.app.core.network.UserDto
import com.jalankita.app.feature.auth.AuthViewModel
import com.jalankita.app.feature.home.ProfilScreen
import com.jalankita.app.feature.home.components.DeltaTopBar
import com.jalankita.app.feature.notif.NotifScreen
import com.jalankita.app.feature.notif.NotifViewModel
import com.jalankita.app.ui.components.AppIcon

/** Layar warga — 3 tab meniru WARGA_ITEMS web (Beranda/Peta/Laporan). */
enum class WargaScreen { BERANDA, PETA, LAPORAN, PROFIL, DETAIL, LAPOR, SUKSES, NOTIFIKASI }

enum class WargaTab(val label: String, val icon: ImageVector, val screen: WargaScreen) {
    BERANDA("Beranda", AppIcon.Home, WargaScreen.BERANDA),
    PETA("Peta", AppIcon.Map, WargaScreen.PETA),
    LAPORAN("Laporan", AppIcon.Description, WargaScreen.LAPORAN),
}

/**
 * Kerangka warga — hanya menyentuh endpoint warga (isolasi role).
 * Profil reuse milik petugas (generik).
 */
@Composable
fun WargaScaffold(
    user: UserDto,
    authVm: AuthViewModel,
    wargaScreen: WargaScreen,
    onNavigate: (WargaScreen) -> Unit,
    deepLinkReportId: String? = null,
    onDeepLinkConsumed: () -> Unit = {},
) {
    val vm: WargaViewModel = viewModel()
    val laporVm: WargaLaporViewModel = viewModel()
    var detailId by remember { mutableStateOf<String?>(null) }
    var returnTab by remember { mutableStateOf(WargaScreen.BERANDA) }
    // Layar Notifikasi dipakai bersama (endpoint per-user, tanpa sekat role).
    val notifVm: NotifViewModel = viewModel()
    var notifReturn by remember { mutableStateOf(WargaScreen.BERANDA) }
    val snackbar = remember { SnackbarHostState() }

    fun openDetail(id: String) {
        // Rekam tab asal saja — deep-link beruntun tidak boleh menimpa.
        if (wargaScreen != WargaScreen.DETAIL && wargaScreen != WargaScreen.NOTIFIKASI) {
            returnTab = wargaScreen
        }
        detailId = id
        onNavigate(WargaScreen.DETAIL)
    }

    fun openNotif() {
        if (wargaScreen != WargaScreen.DETAIL && wargaScreen != WargaScreen.NOTIFIKASI) {
            notifReturn = wargaScreen
        }
        onNavigate(WargaScreen.NOTIFIKASI)
    }

    // G4: tap notifikasi FCM → buka detail laporan (deep-link Fase 4).
    LaunchedEffect(deepLinkReportId) {
        if (deepLinkReportId != null) {
            openDetail(deepLinkReportId)
            onDeepLinkConsumed()
        }
    }

    fun goTab(tab: WargaTab) {
        detailId = null
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

    androidx.activity.compose.BackHandler(
        enabled = wargaScreen == WargaScreen.PETA ||
            wargaScreen == WargaScreen.LAPORAN ||
            wargaScreen == WargaScreen.PROFIL,
    ) {
        onNavigate(WargaScreen.BERANDA)
    }
    androidx.activity.compose.BackHandler(enabled = wargaScreen == WargaScreen.DETAIL) {
        detailId = null
        onNavigate(returnTab)
    }
    androidx.activity.compose.BackHandler(enabled = wargaScreen == WargaScreen.LAPOR) {
        onNavigate(WargaScreen.BERANDA)
    }
    androidx.activity.compose.BackHandler(enabled = wargaScreen == WargaScreen.NOTIFIKASI) {
        onNavigate(notifReturn)
    }

    when (wargaScreen) {
        WargaScreen.LAPOR -> {
            WargaLaporScreen(
                user = user,
                vm = vm,
                laporVm = laporVm,
                onBack = { onNavigate(WargaScreen.BERANDA) },
                onSuccess = { onNavigate(WargaScreen.SUKSES) },
            )
        }
        WargaScreen.SUKSES -> {
            androidx.activity.compose.BackHandler { onNavigate(WargaScreen.BERANDA) }
            WargaSuksesScreen(
                laporVm = laporVm,
                onBeranda = {
                    laporVm.reset()
                    onNavigate(WargaScreen.BERANDA)
                },
                onRiwayat = {
                    laporVm.reset()
                    onNavigate(WargaScreen.LAPORAN)
                },
            )
        }
        WargaScreen.DETAIL -> {
            WargaDetailScreen(
                reportId = detailId.orEmpty(),
                vm = vm,
                onBack = {
                    detailId = null
                    onNavigate(returnTab)
                },
            )
        }
        // NOTIFIKASI di luar Scaffold tab → SnackbarHost sendiri.
        WargaScreen.NOTIFIKASI -> {
            Box(Modifier.fillMaxSize()) {
                NotifScreen(
                    vm = notifVm,
                    onBack = { onNavigate(notifReturn) },
                )
                SnackbarHost(
                    hostState = snackbar,
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .navigationBarsPadding()
                        .padding(16.dp),
                )
            }
        }
        else -> {
            Scaffold(
                snackbarHost = { SnackbarHost(snackbar) },
                topBar = {
                    DeltaTopBar(
                        user = user,
                        onAvatarClick = { onNavigate(WargaScreen.PROFIL) },
                        unreadCount = notifVm.unread,
                        onNotifClick = ::openNotif,
                    )
                    HorizontalDivider(color = Color(0xFFD0DAE8), thickness = 1.dp)
                },
                bottomBar = {
                    HorizontalDivider(color = Color(0xFFD0DAE8), thickness = 1.dp)
                    WargaBottomNav(
                        selected = when (wargaScreen) {
                            WargaScreen.PETA -> WargaTab.PETA
                            WargaScreen.LAPORAN -> WargaTab.LAPORAN
                            else -> WargaTab.BERANDA
                        },
                        onSelect = ::goTab,
                    )
                },
                containerColor = Color(0xFFF5F7FA),
            ) { inner ->
                when (wargaScreen) {
                    WargaScreen.BERANDA -> WargaDashboardScreen(
                        user = user,
                        vm = vm,
                        onLapor = {
                            laporVm.reset()
                            vm.loadRemaining()
                            onNavigate(WargaScreen.LAPOR)
                        },
                        onOpenLaporan = { goTab(WargaTab.LAPORAN) },
                        onOpenDetail = ::openDetail,
                        modifier = Modifier.padding(inner),
                    )
                    WargaScreen.PETA -> WargaPetaScreen(
                        vm = vm,
                        onOpenDetail = ::openDetail,
                        modifier = Modifier.padding(inner),
                    )
                    WargaScreen.LAPORAN -> WargaRiwayatScreen(
                        vm = vm,
                        onOpenDetail = ::openDetail,
                        modifier = Modifier.padding(inner),
                    )
                    WargaScreen.PROFIL -> ProfilScreen(
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
