package com.jalankita.app.feature.supervisor

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.jalankita.app.core.network.InspectionQueueCandidateDto
import com.jalankita.app.ui.components.BrandPrimaryButton
import com.jalankita.app.ui.theme.BrandBlue
import com.jalankita.app.ui.theme.ErrorRed
import com.jalankita.app.ui.theme.TextDark
import com.jalankita.app.ui.theme.TextMuted
import com.jalankita.app.ui.theme.WarningAmber

/** Batas jumlah laporan per antrean — backend membatasi `report_ids` tanpa angka pasti, jaga tetap kecil. */
private const val MAX_QUEUE_SIZE = 20

/**
 * Dialog antrean inspeksi untuk satu `surveyTask`.
 *
 * Alur: supervisor memilih laporan berstatus "Menunggu Review" (bisa dari luar
 * task ini — laporan warga belum tentu punya task), lalu `POST
 * /api/inspection-queues` membuat sesi `report_inspection` + assignment yang
 * langsung muncul di daftar tugas petugas. Pilihan maksimal [MAX_QUEUE_SIZE]
 * supaya satu sesi tetap bisa diselesaikan dalam satu patroli.
 */
@Composable
fun InspectionQueueSheet(
    taskId: String,
    vm: InspectionQueueViewModel,
    onDismiss: () -> Unit,
) {
    LaunchedEffect(taskId) { vm.open() }
    var selected by remember(taskId) { mutableStateOf<Set<String>>(emptySet()) }

    Dialog(
        onDismissRequest = { if (!vm.submitting) onDismiss() },
        properties = DialogProperties(usePlatformDefaultWidth = false),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp)
                .clip(RoundedCornerShape(16.dp))
                .background(Color.White)
                .padding(16.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    "Antrekan laporan untuk inspeksi",
                    color = TextDark, fontSize = 16.sp, fontWeight = FontWeight.Bold,
                    modifier = Modifier.weight(1f),
                )
                if (!vm.loading && vm.candidates.isNotEmpty()) {
                    TextButton(onClick = { vm.retry() }) {
                        Text("Muat ulang", color = BrandBlue, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                    }
                }
            }
            Spacer(Modifier.height(4.dp))
            Text(
                "Pilih laporan yang perlu diverifikasi petugas di lapangan (maks $MAX_QUEUE_SIZE).",
                color = TextMuted, fontSize = 12.sp,
            )

            when {
                vm.loading && vm.candidates.isEmpty() -> Box(
                    modifier = Modifier.fillMaxWidth().height(160.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    CircularProgressIndicator(color = BrandBlue, modifier = Modifier.size(28.dp))
                }

                vm.candidates.isEmpty() && vm.error != null -> Column {
                    Spacer(Modifier.height(12.dp))
                    Text(vm.error.orEmpty(), color = ErrorRed, fontSize = 12.sp)
                    TextButton(onClick = { vm.retry() }) {
                        Text("Coba lagi", color = BrandBlue, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                    }
                }

                vm.candidates.isEmpty() -> Column {
                    Spacer(Modifier.height(12.dp))
                    Text(
                        "Tidak ada laporan yang menunggu antrean inspeksi saat ini.",
                        color = TextMuted, fontSize = 12.sp,
                    )
                }

                else -> Column {
                    Spacer(Modifier.height(8.dp))
                    LazyColumn(
                        modifier = Modifier.fillMaxWidth().heightIn(max = 320.dp),
                        verticalArrangement = Arrangement.spacedBy(2.dp),
                    ) {
                        items(vm.candidates, key = { it.id }) { report ->
                            val checked = report.id in selected
                            val limitReached = !checked && selected.size >= MAX_QUEUE_SIZE
                            CandidateRow(
                                report = report,
                                checked = checked,
                                enabled = !limitReached,
                                onToggle = {
                                    selected = if (checked) selected - report.id else selected + report.id
                                },
                            )
                        }
                    }
                    if (vm.error != null) {
                        Spacer(Modifier.height(8.dp))
                        Text(vm.error.orEmpty(), color = ErrorRed, fontSize = 12.sp)
                    }
                    if (selected.size >= MAX_QUEUE_SIZE) {
                        Spacer(Modifier.height(8.dp))
                        Text(
                            "Maksimal $MAX_QUEUE_SIZE laporan per antrean.",
                            color = WarningAmber, fontSize = 11.sp,
                        )
                    }
                }
            }

            Spacer(Modifier.height(12.dp))
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                TextButton(
                    onClick = onDismiss,
                    enabled = !vm.submitting,
                    modifier = Modifier.weight(1f),
                ) { Text("Batal", color = TextMuted) }
                BrandPrimaryButton(
                    text = "Antrekan (${selected.size})",
                    onClick = { vm.queue(taskId, selected.toList(), onQueued = onDismiss) },
                    modifier = Modifier.weight(2f),
                    enabled = selected.isNotEmpty(),
                    loading = vm.submitting,
                    loadingText = "Mengantrekan...",
                )
            }
        }
    }
}

@Composable
private fun CandidateRow(
    report: InspectionQueueCandidateDto,
    checked: Boolean,
    enabled: Boolean,
    onToggle: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .clickable(enabled = enabled || checked, onClick = onToggle)
            .padding(vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Checkbox(checked = checked, onCheckedChange = null, enabled = enabled || checked)
        Spacer(Modifier.width(4.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                report.reportCode ?: "Laporan",
                color = TextDark, fontSize = 13.sp, fontWeight = FontWeight.Medium,
                maxLines = 1, overflow = TextOverflow.Ellipsis,
            )
            Text(
                listOfNotNull(report.roadName, report.district).joinToString(" · ")
                    .ifBlank { "Tanpa lokasi" },
                color = TextMuted, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

/** Label role yang boleh memakai antrean ini — menjaga pemanggilan tidak salah tempat. */
