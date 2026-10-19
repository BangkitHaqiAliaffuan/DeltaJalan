package com.jalankita.app.feature.warga

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.jalankita.app.feature.home.components.EmptyState
import com.jalankita.app.feature.home.components.SkeletonCard
import com.jalankita.app.ui.components.AppIcon
import com.jalankita.app.ui.components.BrandPrimaryButton
import com.jalankita.app.ui.components.BrandTextField
import com.jalankita.app.ui.theme.BrandBlue
import com.jalankita.app.ui.theme.ContainerLow
import com.jalankita.app.ui.theme.PillShape
import com.jalankita.app.ui.theme.TextDark
import com.jalankita.app.ui.theme.TextMuted

/** Filter tab Laporan warga — nilai dikirim apa adanya ke ?status=. */
private val WARGA_FILTERS: List<Pair<String, String?>> = listOf(
    "Semua" to null,
    "Diproses" to "Diproses",
    "Selesai" to "Selesai",
    "Ditolak" to "Ditolak",
)

/** Tab Laporan — riwayat + cari + filter (replikasi warga/laporan). */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WargaRiwayatScreen(
    vm: WargaViewModel,
    onOpenDetail: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    LaunchedEffect(Unit) {
        if (vm.history.isEmpty() && !vm.historyLoading) vm.loadHistory(reset = true)
    }
    val ptr = rememberPullToRefreshState()
    var confirmDeleteId by remember { mutableStateOf<String?>(null) }
    var confirmDeleteCode by remember { mutableStateOf<String?>(null) }
    Column(modifier = modifier.fillMaxSize()) {
        BrandTextField(
            value = vm.historyQuery,
            onValueChange = vm::updateHistoryQuery,
            placeholder = "Cari kode / jalan / kecamatan…",
            leadingIcon = AppIcon.Search,
            trailingContent = {
                Text(
                    text = "Cari",
                    color = BrandBlue,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 14.sp,
                    modifier = Modifier
                        .clip(PillShape)
                        .clickable(onClick = vm::submitHistoryQuery)
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                )
            },
            containerColor = ContainerLow,
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
            keyboardActions = KeyboardActions(onSearch = { vm.submitHistoryQuery() }),
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp),
        )
        LazyRow(
            contentPadding = PaddingValues(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            items(WARGA_FILTERS) { (label, value) ->
                val selected = vm.historyFilter == value
                Box(
                    modifier = Modifier
                        .clip(PillShape)
                        .background(if (selected) BrandBlue else ContainerLow)
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
        androidx.compose.foundation.layout.Spacer(
            Modifier.padding(vertical = 4.dp),
        )
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
                if (!vm.historyLoading && vm.history.isEmpty() && vm.historyTotal == 0) {
                    item(key = "empty") {
                        EmptyState(
                            title = "Belum ada laporan",
                            subtitle = "Laporkan kerusakan jalan pertama Anda.",
                        )
                    }
                } else {
                    if (vm.historyLoading && vm.history.isEmpty()) {
                        items(3) { SkeletonCard(Modifier.padding(horizontal = 0.dp)) }
                    }
                    items(vm.history, key = { "whist-${it.id}" }) { report ->
                        WargaReportCard(
                            report = report,
                            onClick = { onOpenDetail(report.id) },
                            // Hapus draft sendiri (cermin web: Menunggu Review/Ditinjau).
                            onDelete = if (report.status == "Menunggu Review" || report.status == "Ditinjau") {
                                {
                                    confirmDeleteId = report.id
                                    confirmDeleteCode = report.reportCode
                                }
                            } else null,
                        )
                    }
                    if (vm.historyPage < vm.historyLastPage) {
                        item(key = "more") {
                            BrandPrimaryButton(
                                text = "Muat lebih banyak",
                                onClick = { vm.loadHistory() },
                                loading = vm.historyLoading,
                                loadingText = "Memuat…",
                            )
                        }
                    }
                }
            }
        }
    }
    if (confirmDeleteId != null) {
        com.jalankita.app.feature.home.components.DeleteConfirmDialog(
            reportCode = confirmDeleteCode,
            loading = vm.deleteBusy,
            onDismiss = { confirmDeleteId = null },
            onConfirm = {
                val id = confirmDeleteId
                confirmDeleteId = null
                if (id != null) vm.hapus(id)
            },
        )
    }
}
