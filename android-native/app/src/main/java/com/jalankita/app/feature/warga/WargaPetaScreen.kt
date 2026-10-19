package com.jalankita.app.feature.warga

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Modifier
import com.jalankita.app.feature.warga.WargaViewModel
import com.jalankita.app.ui.map.ReportMapScreen

/**
 * Tab Peta warga — sebaran laporan dari GET /reports/map-data.
 * Replikasi routes/warga/peta.tsx (marker per severity, ketuk → detail).
 *
 * Logika peta diekstraksi ke [ReportMapScreen] (PLAN-supervisor §5.4) agar
 * supervisor dapat memakai komponen yang sama tanpa duplikasi MapView/lifecycle.
 */
@Composable
fun WargaPetaScreen(
    vm: WargaViewModel,
    onOpenDetail: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    LaunchedEffect(Unit) { vm.loadMap() }

    ReportMapScreen(
        reports = vm.mapReports,
        loading = vm.mapLoading,
        error = vm.mapError,
        totalLabel = "${vm.mapStatsTotal} laporan di Kab. Sidoarjo",
        sourceId = "warga-reports",
        onRetry = { vm.loadMap(force = true) },
        onOpenDetail = onOpenDetail,
        modifier = modifier,
    )
}
