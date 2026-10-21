package com.jalankita.app

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.core.net.toUri
import androidx.lifecycle.viewmodel.compose.viewModel
import com.jalankita.app.core.data.UserRole
import com.jalankita.app.core.network.UserDto
import com.jalankita.app.feature.auth.AuthViewModel
import com.jalankita.app.feature.auth.LoginScreen
import com.jalankita.app.feature.auth.OnboardingScreen
import com.jalankita.app.feature.auth.PhoneRequiredScreen
import com.jalankita.app.feature.auth.RegisterScreen
import com.jalankita.app.feature.auth.SessionState
import com.jalankita.app.feature.home.DashboardScreen
import com.jalankita.app.feature.home.DashboardViewModel
import com.jalankita.app.feature.home.DetailScreen
import com.jalankita.app.feature.home.PatrolSessionScreen
import com.jalankita.app.feature.home.PetugasPetaScreen
import com.jalankita.app.feature.home.ProfilScreen
import com.jalankita.app.feature.home.RiwayatScreen
import com.jalankita.app.feature.home.TugasScreen
import com.jalankita.app.feature.home.components.DeltaTopBar
import com.jalankita.app.feature.home.components.PetugasBottomNav
import com.jalankita.app.feature.home.components.PetugasTab
import com.jalankita.app.ui.components.AppIcon
import com.jalankita.app.ui.theme.BrandBlue
import com.jalankita.app.feature.warga.WargaScaffold
import com.jalankita.app.feature.warga.WargaScreen
import com.jalankita.app.feature.supervisor.SupervisorScaffold
import com.jalankita.app.feature.supervisor.SupervisorScreen
import com.jalankita.app.feature.lapor.AiResultScreen
import com.jalankita.app.feature.lapor.LaporScreen
import com.jalankita.app.feature.lapor.LaporViewModel
import com.jalankita.app.feature.notif.NotifScreen
import com.jalankita.app.feature.notif.NotifViewModel
import com.jalankita.app.core.worker.LocationTracking
import com.jalankita.app.feature.update.AppUpdateGate
import com.jalankita.app.feature.update.AppUpdateState
import com.jalankita.app.feature.update.AppUpdateViewModel
import com.jalankita.app.ui.theme.DeltaJalanTheme
import dagger.hilt.android.AndroidEntryPoint

/**
 * Scaffold Fase 1 — login/daftar + home + channel notifikasi.
 * Navigasi berbasis state (tanpa navigation-compose, menyusul bila layar bertambah).
 * 401 dari server → [SessionState.Unauthenticated].
 */
@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        createNotificationChannel()
        enableEdgeToEdge()
        setContent {
            DeltaJalanTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    Root()
                }
            }
        }
    }

    /**
     * Tap notifikasi FCM (singleTask) masuk via onNewIntent — bukan onCreate.
     * `report_id` dibaca sekali oleh Root() lalu extra dihapus.
     */
    var deepLinkNonce by mutableStateOf(0)
        private set

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        deepLinkNonce++
    }

    /** Ambil + hapus extra report_id agar tidak diproses ulang saat recompose. */
    fun takeReportIdExtra(): String? {
        val id = intent?.getStringExtra("report_id")?.takeIf { it.isNotBlank() }
        if (id != null) intent?.removeExtra("report_id")
        return id
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val channel = NotificationChannel(
            "delta_jalan_general",
            "Notifikasi Umum",
            NotificationManager.IMPORTANCE_HIGH,
        ).apply {
            description = "Notifikasi laporan, tugas, dan pengumuman umum"
        }
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }
}

/** Layar auth yang bisa ditampilkan (login atau daftar). */
private enum class AuthScreen { LOGIN, REGISTER }

/** Layar setelah login (dashboard + tab + alur lapor). */
private enum class MainScreen {
    BERANDA, TUGAS, PETA, LAPORAN, PROFIL, DETAIL, LAPOR, AI_RESULT, PATROL_SESSION,
    NOTIFIKASI,
}

/** Tab bottom-nav untuk setiap layar utama (null = tanpa sorotan). */
private fun MainScreen.toTab(): PetugasTab? = when (this) {
    MainScreen.BERANDA -> PetugasTab.BERANDA
    MainScreen.TUGAS -> PetugasTab.TUGAS
    MainScreen.PETA -> PetugasTab.PETA
    MainScreen.LAPORAN -> PetugasTab.LAPORAN
    else -> null
}

private fun PetugasTab.toScreen(): MainScreen = when (this) {
    PetugasTab.BERANDA -> MainScreen.BERANDA
    PetugasTab.TUGAS -> MainScreen.TUGAS
    PetugasTab.PETA -> MainScreen.PETA
    PetugasTab.LAPORAN -> MainScreen.LAPORAN
}

@Composable
// viewModel() memakai Hilt-generated factory via @AndroidEntryPoint.
private fun Root(vm: AuthViewModel = viewModel()) {
    RequestNotificationPermission()
    val context = LocalContext.current
    val activity = context as? MainActivity

    // G3: cek versi wajib saat startup (Fase 4). Best-effort — gagal = Ok.
    val updateVm: AppUpdateViewModel = viewModel()
    LaunchedEffect(Unit) { updateVm.check() }
    // State notifikasi milik user lama wajib dibersihkan saat sesi berganti
    // (instance NotifViewModel activity-scoped dipakai 3 role).
    val sessionNotifVm: NotifViewModel = viewModel()
    val updateState = updateVm.state
    if (updateState is AppUpdateState.ForceUpdate) {
        // Tanpa BackHandler — back sistem tidak bisa melewati layar blokir.
        AppUpdateGate(
            state = updateState,
            onRecheck = updateVm::retry,
            onDismissSoft = updateVm::dismissSoft,
            onDownload = { url ->
                context.startActivity(Intent(Intent.ACTION_VIEW, url.toUri()))
            },
        )
        return
    }

    // G4: tap notif FCM (cold start via onCreate intent / warm via onNewIntent).
    var pendingReportId by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(activity?.deepLinkNonce) {
        activity?.takeReportIdExtra()?.let { pendingReportId = it }
    }
    fun consumeDeepLink() {
        pendingReportId = null
    }

    var authScreen by remember { mutableStateOf(AuthScreen.LOGIN) }
    var mainScreen by remember { mutableStateOf(MainScreen.BERANDA) }
    val laporVm: LaporViewModel = viewModel()

    when (val s = vm.session) {
        SessionState.Loading -> Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center,
        ) {
            CircularProgressIndicator()
        }

        SessionState.Unauthenticated -> {
            // Keluar sesi → hentikan tracking GPS + buang notifikasi user lama.
            LaunchedEffect(Unit) {
                LocationTracking.stop(context)
                sessionNotifVm.clear()
            }
            // Back sistem di layar Daftar → kembali ke Login (bukan keluar app).
            androidx.activity.compose.BackHandler(
                enabled = authScreen == AuthScreen.REGISTER,
            ) {
                authScreen = AuthScreen.LOGIN
            }
            when (authScreen) {
                AuthScreen.LOGIN -> LoginScreen(
                    vm = vm,
                    onNavigateRegister = { authScreen = AuthScreen.REGISTER },
                )
                AuthScreen.REGISTER -> RegisterScreen(
                    onNavigateLogin = { authScreen = AuthScreen.LOGIN },
                )
            }
        }

        // Login Google berhasil, tetapi phone/password belum lengkap. Belum ada
        // Sanctum token di sini; jangan buka scaffold warga sebelum onboarding.
        is SessionState.NeedsOnboarding -> {
            LaunchedEffect(Unit) {
                LocationTracking.stop(context)
                sessionNotifVm.clear()
            }
            androidx.activity.compose.BackHandler {
                vm.cancelOnboarding()
            }
            OnboardingScreen(
                vm = vm,
                state = s,
                onCancel = vm::cancelOnboarding,
            )
        }

        // ATURAN KERAS isolasi role (crosscheck §3.1): sesi warga TIDAK BOLEH
        // menyentuh endpoint petugas (/reports/stats, /reports?team_tasks, dsb.)
        // karena backend tidak memfilter role warga di sana (data global bocor).
        // Warga → WargaScaffold (/warga/* saja); supervisor → SupervisorScaffold
        // (endpoint triase supervisor); sisanya → MainScaffold petugas.
        is SessionState.Authenticated -> {
            if (s.user.role == UserRole.WARGA && s.user.needsPhone) {
                // Sesi warga lama tanpa phone: backend memblokir endpoint warga
                // (PHONE_REQUIRED), jadi tampilkan form phone sebelum scaffold.
                LaunchedEffect(s.user.id) {
                    LocationTracking.stop(context)
                    sessionNotifVm.clear()
                }
                androidx.activity.compose.BackHandler {
                    vm.logout()
                }
                PhoneRequiredScreen(
                    vm = vm,
                    user = s.user,
                    onCancel = vm::logout,
                )
            } else {
                // Ganti user (termasuk login pertama) → buang state milik user lama.
                LaunchedEffect(s.user.id) {
                    sessionNotifVm.clear()
                }
                when (s.user.role) {
                    UserRole.WARGA -> {
                        var wargaScreen by remember(s.user.id) {
                            mutableStateOf(WargaScreen.BERANDA)
                        }
                        WargaScaffold(
                            user = s.user,
                            authVm = vm,
                            wargaScreen = wargaScreen,
                            onNavigate = { wargaScreen = it },
                            deepLinkReportId = pendingReportId,
                            onDeepLinkConsumed = ::consumeDeepLink,
                        )
                    }

                    UserRole.SUPERVISOR -> {
                        var supervisorScreen by remember(s.user.id) {
                            mutableStateOf(SupervisorScreen.BERANDA)
                        }
                        SupervisorScaffold(
                            user = s.user,
                            authVm = vm,
                            screen = supervisorScreen,
                            onNavigate = { supervisorScreen = it },
                            deepLinkReportId = pendingReportId,
                            onDeepLinkConsumed = ::consumeDeepLink,
                        )
                    }

                    else -> {
                        MainScaffold(
                            user = s.user,
                            authVm = vm,
                            laporVm = laporVm,
                            mainScreen = mainScreen,
                            onNavigate = { mainScreen = it },
                            deepLinkReportId = pendingReportId,
                            onDeepLinkConsumed = ::consumeDeepLink,
                        )
                    }
                }
            }
        }
    }
    // Soft update: dialog di atas konten apapun.
    AppUpdateGate(
        state = updateState,
        onRecheck = updateVm::retry,
        onDismissSoft = updateVm::dismissSoft,
        onDownload = { url ->
            context.startActivity(Intent(Intent.ACTION_VIEW, url.toUri()))
        },
    )
}

/**
 * Kerangka setelah login: TopBar + konten tab + bottom nav + snackbar.
 * Alur LAPOR / AI_RESULT memakai chrome sendiri (header khusus, tanpa nav).
 */
@Composable
private fun MainScaffold(
    user: UserDto,
    authVm: AuthViewModel,
    laporVm: LaporViewModel,
    mainScreen: MainScreen,
    onNavigate: (MainScreen) -> Unit,
    deepLinkReportId: String? = null,
    onDeepLinkConsumed: () -> Unit = {},
) {
    // Fase 3: izin lokasi + jadwalkan tracking GPS (hanya sesi petugas —
    // scaffold ini tidak dipakai warga/supervisor).
    RequestLocationPermission()
    val trackingContext = LocalContext.current
    LaunchedEffect(Unit) {
        LocationTracking.start(trackingContext)
    }
    val dashboardVm: DashboardViewModel = viewModel()
    var detailId by remember { mutableStateOf<String?>(null) }
    var surveyId by remember { mutableStateOf<String?>(null) }
    var returnTab by remember { mutableStateOf(MainScreen.BERANDA) }
    // Layar Notifikasi dipakai bersama (endpoint per-user, tanpa sekat role).
    val notifVm: NotifViewModel = viewModel()
    var notifReturn by remember { mutableStateOf(MainScreen.BERANDA) }
    val snackbar = remember { SnackbarHostState() }

    fun openDetail(id: String) {
        // Rekam tab asal saja — bila sudah di DETAIL/NOTIFIKASI (mis. deep-link
        // beruntun), jangan timpa agar back tidak muter ke layar kosong.
        if (mainScreen != MainScreen.DETAIL && mainScreen != MainScreen.NOTIFIKASI) {
            returnTab = mainScreen
        }
        detailId = id
        onNavigate(MainScreen.DETAIL)
    }

    fun openNotif() {
        if (mainScreen != MainScreen.DETAIL && mainScreen != MainScreen.NOTIFIKASI) {
            notifReturn = mainScreen
        }
        onNavigate(MainScreen.NOTIFIKASI)
    }

    // G4: tap notifikasi FCM → buka detail laporan (deep-link Fase 4).
    LaunchedEffect(deepLinkReportId) {
        if (deepLinkReportId != null) {
            openDetail(deepLinkReportId)
            onDeepLinkConsumed()
        }
    }

    fun goTab(tab: PetugasTab) {
        detailId = null
        surveyId = null
        onNavigate(tab.toScreen())
    }

    // 401 dari endpoint dashboard → sesi mati → kembali ke login.
    LaunchedEffect(dashboardVm.sessionExpired) {
        if (dashboardVm.sessionExpired) authVm.refreshSession()
    }
    // 401 dari alur Lapor (analyze/submit) → sesi mati → kembali ke login.
    // Tanpa ini, token dicabut saat lapor membuat petugas macet di layar Lapor.
    LaunchedEffect(laporVm.sessionExpired) {
        if (laporVm.sessionExpired) authVm.refreshSession()
    }
    // Error non-401 → snackbar (web menelan error; native menampilkannya).
    LaunchedEffect(dashboardVm.errorMessage) {
        dashboardVm.errorMessage?.let {
            snackbar.showSnackbar(it)
            dashboardVm.consumeError()
        }
    }
    // 401 dari endpoint notifikasi → sesi mati → kembali ke login.
    LaunchedEffect(notifVm.sessionExpired) {
        if (notifVm.sessionExpired) authVm.refreshSession()
    }
    // Badge bell TopBar — muat saat scaffold dibuka (best-effort, 0 bila gagal).
    LaunchedEffect(Unit) {
        notifVm.loadUnread()
    }
    LaunchedEffect(notifVm.errorMessage) {
        notifVm.errorMessage?.let {
            snackbar.showSnackbar(it)
            notifVm.consumeError()
        }
    }
    // Hasil aksi tulis (mulai/progress/selesai/hapus) → snackbar.
    // Tanpa ini actionSuccess/actionError hanya tersimpan di VM tanpa pernah
    // tampil dari kartu (Beranda/Tugas) — klik "Mulai" terlihat tidak bereaksi.
    LaunchedEffect(dashboardVm.actionError) {
        dashboardVm.actionError?.let {
            snackbar.showSnackbar(it)
            dashboardVm.consumeActionError()
        }
    }
    LaunchedEffect(dashboardVm.actionSuccess) {
        dashboardVm.actionSuccess?.let {
            snackbar.showSnackbar(it)
            dashboardVm.consumeActionSuccess()
        }
    }

    // Kembali sistem di tab non-Beranda → Beranda; di Detail → tab asal.
    androidx.activity.compose.BackHandler(
        enabled = mainScreen == MainScreen.TUGAS ||
            mainScreen == MainScreen.PETA ||
            mainScreen == MainScreen.LAPORAN ||
            mainScreen == MainScreen.PROFIL,
    ) {
        onNavigate(MainScreen.BERANDA)
    }
    androidx.activity.compose.BackHandler(enabled = mainScreen == MainScreen.DETAIL) {
        detailId = null
        onNavigate(returnTab)
    }
    androidx.activity.compose.BackHandler(enabled = mainScreen == MainScreen.PATROL_SESSION) {
        surveyId = null
        onNavigate(MainScreen.TUGAS)
    }
    androidx.activity.compose.BackHandler(enabled = mainScreen == MainScreen.NOTIFIKASI) {
        onNavigate(notifReturn)
    }

    when (mainScreen) {
        MainScreen.LAPOR -> {
            // Kembali ke sesi patroli bila lapor dari sesi (surveyId != null),
            // ke Beranda bila lapor mandiri (FAB/dashboard membersihkan surveyId).
            fun backFromLapor() {
                if (surveyId != null) onNavigate(MainScreen.PATROL_SESSION)
                else onNavigate(MainScreen.BERANDA)
            }
            androidx.activity.compose.BackHandler { backFromLapor() }
            LaporScreen(
                vm = laporVm,
                teamId = user.teamId,
                onAnalyzed = { onNavigate(MainScreen.AI_RESULT) },
                onBack = { backFromLapor() },
            )
        }
        MainScreen.AI_RESULT -> {
            androidx.activity.compose.BackHandler { onNavigate(MainScreen.LAPOR) }
            AiResultScreen(
                vm = laporVm,
                reporterName = user.name,
                onDone = {
                    // Bila lapor dari sesi patroli → kembali ke sesi & refresh (padanan
                    // invalidateQueries web agar reports_count bertambah).
                    val sid = surveyId
                    if (sid != null) {
                        dashboardVm.refreshAfterLapor(sid)
                        onNavigate(MainScreen.PATROL_SESSION)
                    } else {
                        onNavigate(MainScreen.BERANDA)
                    }
                },
                onBack = { onNavigate(MainScreen.LAPOR) },
            )
        }
        MainScreen.PATROL_SESSION -> PatrolSessionScreen(
            taskId = surveyId.orEmpty(),
            user = user,
            vm = dashboardVm,
            onBack = {
                surveyId = null
                onNavigate(MainScreen.TUGAS)
            },
            onTambahLaporan = { surveyTaskId, roadName, kecamatan ->
                laporVm.reset()
                laporVm.setSurveyTask(surveyTaskId, roadName, kecamatan)
                onNavigate(MainScreen.LAPOR)
            },
            onOpenReport = ::openDetail,
        )
        // DETAIL di luar Scaffold tab → perlu SnackbarHost sendiri agar
        // actionSuccess/actionError dari layar detail ikut terlihat.
        MainScreen.DETAIL -> {
            Box(Modifier.fillMaxSize()) {
                DetailScreen(
                    reportId = detailId.orEmpty(),
                    vm = dashboardVm,
                    user = user,
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
        // NOTIFIKASI di luar Scaffold tab (seperti DETAIL) → SnackbarHost sendiri.
        MainScreen.NOTIFIKASI -> {
            Box(Modifier.fillMaxSize()) {
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
        }
        else -> {
            Scaffold(
                snackbarHost = { SnackbarHost(snackbar) },
                topBar = {
                    DeltaTopBar(
                        user = user,
                        onAvatarClick = { onNavigate(MainScreen.PROFIL) },
                        unreadCount = notifVm.unread,
                        onNotifClick = ::openNotif,
                    )
                    HorizontalDivider(color = Color(0xFFD0DAE8), thickness = 1.dp)
                },
                // CTA upload mengambang — port Fab.tsx web (lingkaran biru + plus,
                // hanya di tab; otomatis di atas bottom bar).
                floatingActionButton = {
                    Box(
                        Modifier
                            .size(56.dp)
                            .clip(CircleShape)
                            .background(BrandBlue)
                            .clickable {
                                laporVm.reset()
                                onNavigate(MainScreen.LAPOR)
                            },
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(AppIcon.Add, contentDescription = "Upload Laporan",
                            tint = Color.White, modifier = Modifier.size(28.dp))
                    }
                },
                bottomBar = {
                    HorizontalDivider(color = Color(0xFFD0DAE8), thickness = 1.dp)
                    PetugasBottomNav(
                        selected = mainScreen.toTab() ?: PetugasTab.BERANDA,
                        onSelect = ::goTab,
                    )
                },
                containerColor = Color(0xFFF5F7FA),
            ) { inner ->
                when (mainScreen) {
                    MainScreen.BERANDA -> DashboardScreen(
                        user = user,
                        vm = dashboardVm,
                        onLapor = {
                            laporVm.reset()
                            onNavigate(MainScreen.LAPOR)
                        },
                        onOpenLaporanTab = { goTab(PetugasTab.LAPORAN) },
                        onOpenTugasTab = { goTab(PetugasTab.TUGAS) },
                        onOpenDetail = ::openDetail,
                        modifier = Modifier.padding(inner),
                    )
                    MainScreen.TUGAS -> TugasScreen(
                        user = user,
                        vm = dashboardVm,
                        onOpenDetail = ::openDetail,
                        onOpenSession = { sid ->
                            surveyId = sid
                            onNavigate(MainScreen.PATROL_SESSION)
                        },
                        modifier = Modifier.padding(inner),
                    )
                    MainScreen.PETA -> PetugasPetaScreen(
                        vm = dashboardVm,
                        onOpenDetail = ::openDetail,
                        modifier = Modifier.padding(inner),
                    )
                    MainScreen.LAPORAN -> RiwayatScreen(
                        user = user,
                        vm = dashboardVm,
                        onOpenDetail = ::openDetail,
                        modifier = Modifier.padding(inner),
                    )
                    MainScreen.PROFIL -> ProfilScreen(
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

/**
 * Android 13+ wajib izin runtime POST_NOTIFICATIONS agar push tampil.
 * Diminta sekali saat aplikasi dibuka; penolakan tidak blocking.
 */
@Composable
private fun RequestNotificationPermission() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return
    val context = LocalContext.current
    val launcher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { }
    LaunchedEffect(Unit) {
        if (ContextCompat.checkSelfPermission(
                context, Manifest.permission.POST_NOTIFICATIONS,
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            launcher.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }
}

/**
 * Izin lokasi untuk tracking GPS petugas (Fase 3).
 * Foreground dulu, lalu background (wajib berurutan sejak Android 10 —
 * WorkManager periodik jalan saat app background). Aplikasi sideload
 * internal (non-Play) sehingga background location dapat dipakai.
 * Penolakan = worker skip sunyi.
 */
@Composable
private fun RequestLocationPermission() {
    val context = LocalContext.current
    val bgLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { }
    val fgLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) { granted ->
        if ((granted[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
                granted[Manifest.permission.ACCESS_COARSE_LOCATION] == true) &&
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
            ContextCompat.checkSelfPermission(
                context, Manifest.permission.ACCESS_BACKGROUND_LOCATION,
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            bgLauncher.launch(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
        }
    }
    LaunchedEffect(Unit) {
        val fine = ContextCompat.checkSelfPermission(
            context, Manifest.permission.ACCESS_FINE_LOCATION,
        ) == PackageManager.PERMISSION_GRANTED
        val coarse = ContextCompat.checkSelfPermission(
            context, Manifest.permission.ACCESS_COARSE_LOCATION,
        ) == PackageManager.PERMISSION_GRANTED
        if (!fine && !coarse) {
            fgLauncher.launch(
                arrayOf(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION,
                ),
            )
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
            ContextCompat.checkSelfPermission(
                context, Manifest.permission.ACCESS_BACKGROUND_LOCATION,
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            bgLauncher.launch(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
        }
    }
}
