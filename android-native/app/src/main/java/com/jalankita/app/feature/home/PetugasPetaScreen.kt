package com.jalankita.app.feature.home

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Modifier
import com.jalankita.app.ui.map.ReportMapScreen

/**
 * Tab Peta petugas — sebaran laporan dari GET /reports/map-data.
 * Memakai [ReportMapScreen] generik dengan sourceId berbeda (pola
 * WargaPetaScreen / SupervisorPetaScreen); data dimuat via
 * [DashboardViewModel.loadMap].
 */
@Composable
fun PetugasPetaScreen(
    vm: DashboardViewModel,
    onOpenDetail: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    LaunchedEffect(Unit) { vm.loadMap() }

    ReportMapScreen(
        reports = vm.mapReports,
        loading = vm.mapLoading,
        error = vm.mapError,
        totalLabel = "${vm.mapStatsTotal} laporan di Kab. Sidoarjo",
        sourceId = "petugas-reports",
        onRetry = { vm.loadMap(force = true) },
        onOpenDetail = onOpenDetail,
        modifier = modifier,
    )
}
