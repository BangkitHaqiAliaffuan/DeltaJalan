package com.jalankita.app.feature.home

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.jalankita.app.core.network.ReportItemDto
import com.jalankita.app.core.network.UserDto
import com.jalankita.app.feature.home.components.CardActionButton
import com.jalankita.app.feature.home.components.CardActionStyle
import com.jalankita.app.feature.home.components.DeleteConfirmDialog
import com.jalankita.app.ui.components.AppIcon
import com.jalankita.app.ui.components.BrandTextField
import com.jalankita.app.ui.components.FieldLabel
import com.jalankita.app.ui.theme.BrandBlue
import com.jalankita.app.ui.theme.TextDark
import com.jalankita.app.ui.theme.TextMuted

/**
 * Tombol aksi kontekstual kartu laporan — port aksi ReportCard
 * home.tsx / tugas-saya.tsx / my-reports.tsx.
 *
 * - Ditugaskan (tim sama) → dialog estimasi (same-day vs N-hari) lalu mulai.
 * - Sedang Diperbaiki → Progress / Selesai (buka detail: dialog + form ada di sana).
 * - Draft sendiri → Edit (buka detail) / Hapus (konfirmasi inline).
 * - Selalu: Detail.
 */
@Composable
fun ReportCardActions(
    report: ReportItemDto,
    user: UserDto,
    vm: DashboardViewModel,
    onOpenDetail: (String) -> Unit,
) {
    var confirmDelete by remember(report.id) { mutableStateOf(false) }
    var showEstimasi by remember(report.id) { mutableStateOf(false) }
    val sameTeam = user.teamId == null ||
        report.assignedTeamId == null ||
        report.assignedTeamId == user.teamId
    val isOwner = report.reporterName == user.name

    if (report.status == "Ditugaskan" && sameTeam) {
        CardActionButton(
            text = "Mulai",
            onClick = { showEstimasi = true },
            style = CardActionStyle.PRIMARY,
            icon = AppIcon.PlayArrow,
            enabled = !vm.actionLoading,
        )
    }
    if (report.status == "Sedang Diperbaiki" && sameTeam) {
        CardActionButton(
            text = "Progress",
            onClick = { onOpenDetail(report.id) },
            style = CardActionStyle.SECONDARY,
            icon = AppIcon.UploadPhoto,
        )
        if (report.progressUpdatesCount > 0) {
            CardActionButton(
                text = "Selesaikan",
                onClick = { onOpenDetail(report.id) },
                style = CardActionStyle.PRIMARY,
                icon = AppIcon.CheckCircle,
            )
        }
    }
    if (isOwner && report.status in listOf("Menunggu Review", "Ditinjau", "Diedit")) {
        CardActionButton(
            text = "Edit",
            onClick = { onOpenDetail(report.id) },
            style = CardActionStyle.SECONDARY,
            icon = AppIcon.Edit,
            enabled = !vm.actionLoading,
        )
    }
    if (isOwner && report.status in listOf("Menunggu Review", "Ditinjau", "Diedit", "Ditolak")) {
        CardActionButton(
            text = "Hapus",
            onClick = { confirmDelete = true },
            style = CardActionStyle.DESTRUCTIVE,
            icon = AppIcon.Delete,
            enabled = !vm.actionLoading,
        )
    }
    CardActionButton(
        text = "Detail",
        onClick = { onOpenDetail(report.id) },
        style = CardActionStyle.SECONDARY,
        icon = AppIcon.ChevronRight,
    )
    if (confirmDelete) {
        DeleteConfirmDialog(
            reportCode = report.reportCode,
            loading = vm.actionLoading,
            onDismiss = { confirmDelete = false },
            onConfirm = {
                confirmDelete = false
                vm.hapus(report.id) {}
            },
        )
    }
    if (showEstimasi) {
        CardEstimasiDialog(
            isRingan = report.effectiveSeverity?.contains("Ringan", ignoreCase = true) == true,
            loading = vm.actionLoading,
            onDismiss = { showEstimasi = false },
            onConfirm = { estimasi ->
                showEstimasi = false
                vm.mulai(report.id, estimasi, null)
            },
        )
    }
}

/**
 * Dialog estimasi kartu — port EstimasiModal.tsx: same-day (kirim null)
 * vs multi-day (1-90). Default: Ringan → same-day, selainnya → 7 hari.
 */
@Composable
private fun CardEstimasiDialog(
    isRingan: Boolean,
    loading: Boolean,
    onDismiss: () -> Unit,
    onConfirm: (estimasiHari: Int?) -> Unit,
) {
    var sameDay by remember { mutableStateOf(isRingan) }
    var estimasi by remember { mutableStateOf(if (isRingan) "" else "7") }
    val estimasiInt = estimasi.toIntOrNull()
    val valid = sameDay || (estimasiInt != null && estimasiInt in 1..90)
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Estimasi Penyelesaian", fontWeight = FontWeight.Bold, color = TextDark) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("Kapan perbaikan diperkirakan selesai?", fontSize = 14.sp, color = TextDark)
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    FilterChip(
                        selected = sameDay,
                        onClick = { sameDay = true },
                        label = { Text("Hari ini juga") },
                    )
                    FilterChip(
                        selected = !sameDay,
                        onClick = { sameDay = false },
                        label = { Text("Beberapa hari") },
                    )
                }
                if (!sameDay) {
                    FieldLabel("Estimasi (hari, 1–90)")
                    BrandTextField(
                        value = estimasi,
                        onValueChange = { if (it.length <= 2 && it.all(Char::isDigit)) estimasi = it },
                        placeholder = "7",
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        isError = !valid,
                    )
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = { onConfirm(if (sameDay) null else estimasiInt) },
                enabled = valid && !loading,
            ) { Text("Mulai", color = BrandBlue, fontWeight = FontWeight.Bold) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Batal", color = TextMuted) } },
    )
}
