package com.jalankita.app.feature.supervisor

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.jalankita.app.core.network.MapReportDto
import com.jalankita.app.core.network.MarkerKind
import com.jalankita.app.ui.map.ReportMapScreen
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue

/**
 * Tab Peta supervisor — port /map untuk supervisor (S2c).
 * Memakai [ReportMapScreen] generik dengan sourceId berbeda; data map-data (auth) identik
 * dengan peta warga.
 */
@Composable
fun SupervisorPetaScreen(
    vm: SupervisorViewModel,
    onOpenDetail: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    var reports by remember { mutableStateOf<List<MapReportDto>>(emptyList()) }
    var total by remember { mutableStateOf(0) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var reload by remember { mutableStateOf(0) }

    LaunchedEffect(reload) {
        loading = true
        error = null
        when (val r = vm.mapData()) {
            is com.jalankita.app.core.data.DashboardResult.Success -> {
                reports = r.data.first
                total = r.data.second
            }
            is com.jalankita.app.core.data.DashboardResult.Error -> error = r.message
        }
        loading = false
    }

    ReportMapScreen(
        reports = reports,
        loading = loading,
        error = error,
        totalLabel = "$total laporan di Kab. Sidoarjo",
        sourceId = "supervisor-reports",
        onRetry = { reload++ },
        onOpenDetail = onOpenDetail,
        modifier = modifier,
    )
}
