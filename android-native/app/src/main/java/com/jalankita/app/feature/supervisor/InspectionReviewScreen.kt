package com.jalankita.app.feature.supervisor

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.jalankita.app.core.network.InspectionResultDto
import com.jalankita.app.core.network.InspectionReviewAction
import com.jalankita.app.ui.components.AppIcon
import com.jalankita.app.ui.components.ReportThumbnail
import com.jalankita.app.ui.theme.BrandBlue
import com.jalankita.app.ui.theme.ErrorRed
import com.jalankita.app.ui.theme.SuccessGreen
import com.jalankita.app.ui.theme.TextDark
import com.jalankita.app.ui.theme.TextMuted
import com.jalankita.app.ui.theme.WarningAmber

/** Panjang minimum alasan review — sinkron dengan validasi backend (`min:5`). */
private const val MIN_REVIEW_NOTES = 5

@Composable
fun NativeInspectionReviewScreen(
    vm: InspectionReviewViewModel,
    modifier: Modifier = Modifier,
) {
    var selectedId by remember { mutableStateOf<String?>(null) }
    var notes by remember { mutableStateOf("") }
    var showActions by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) { vm.load() }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(Color(0xFFF8FAFC))
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Column {
                Text("Review Hasil Inspeksi", color = TextDark, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                Text("Verifikasi hasil pengecekan lapangan petugas", color = TextMuted, fontSize = 13.sp)
            }
            OutlinedButton(onClick = vm::load, enabled = !vm.loading) {
                Icon(AppIcon.Refresh, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(6.dp))
                Text("Muat ulang", fontSize = 12.sp)
            }
        }

        vm.error?.let {
            Text(it, color = ErrorRed, fontSize = 13.sp)
        }

        when {
            vm.loading && vm.results.isEmpty() -> Box(
                Modifier.fillMaxWidth().height(160.dp),
                contentAlignment = Alignment.Center,
            ) {
                CircularProgressIndicator(color = BrandBlue)
            }
            vm.results.isEmpty() -> Box(
                Modifier.fillMaxWidth().height(160.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text("Tidak ada hasil inspeksi yang menunggu review saat ini.", color = TextMuted, fontSize = 14.sp)
            }
            else -> LazyColumn(
                contentPadding = PaddingValues(bottom = 16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                items(vm.results, key = { it.id }) { result ->
                    InspectionReviewCard(
                        result = result,
                        onClick = {
                            selectedId = result.id
                            notes = ""
                            showActions = true
                        },
                    )
                }
            }
        }
    }

    if (showActions && selectedId != null) {
        val selected = vm.results.firstOrNull { it.id == selectedId }
        val reasonMissing = notes.trim().length < MIN_REVIEW_NOTES
        val busy = vm.loading

        AlertDialog(
            onDismissRequest = { if (!busy) showActions = false },
            title = {
                Text("Keputusan Review Inspeksi", color = TextDark, fontSize = 16.sp, fontWeight = FontWeight.Bold)
            },
            text = {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(max = 420.dp)
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    Text(
                        selected?.report?.roadName ?: "Laporan inspeksi",
                        color = TextDark,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold,
                    )
                    selected?.report?.district?.let {
                        Text("Kecamatan: $it", color = TextMuted, fontSize = 12.sp)
                    }

                    // Galeri Foto Bukti Inspeksi Petugas
                    val photos = selected?.photos.orEmpty()
                    if (photos.isNotEmpty()) {
                        Text("Foto Bukti Petugas (${photos.size}):", color = TextDark, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            items(photos, key = { it.id }) { photo ->
                                ReportThumbnail(
                                    url = photo.displayUrl,
                                    contentDescription = "Bukti inspeksi",
                                    modifier = Modifier
                                        .size(100.dp)
                                        .clip(RoundedCornerShape(8.dp))
                                        .border(1.dp, Color(0xFFCBD5E1), RoundedCornerShape(8.dp)),
                                )
                            }
                        }
                    }

                    Text("Kondisi teknis: ${selected?.condition ?: "-"}", color = TextDark, fontSize = 13.sp)
                    // Dimensi hasil ukur petugas. Sengaja menampilkan "tidak diukur"
                    // alih-alih 0 — angka nol akan disalahartikan sebagai hasil ukur.
                    Text(
                        "Dimensi: ${dimensionText(selected)}",
                        color = TextDark,
                        fontSize = 13.sp,
                    )
                    Text("Catatan petugas: ${selected?.notes ?: "-"}", color = TextDark, fontSize = 13.sp)

                    Spacer(Modifier.height(4.dp))

                    OutlinedTextField(
                        value = notes,
                        onValueChange = { notes = it },
                        label = { Text("Catatan Reviewer") },
                        placeholder = { Text("Wajib diisi jika dikembalikan, reinspeksi, atau ditolak") },
                        isError = reasonMissing,
                        supportingText = if (reasonMissing) {
                            { Text("Wajib min. $MIN_REVIEW_NOTES karakter untuk kembalikan / reinspeksi / tolak.", color = ErrorRed, fontSize = 11.sp) }
                        } else null,
                        modifier = Modifier.fillMaxWidth(),
                        minLines = 2,
                    )

                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Button(
                            onClick = {
                                vm.review(selectedId!!, InspectionReviewAction.ACCEPT, notes.ifBlank { null })
                                showActions = false
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = SuccessGreen),
                            enabled = !busy,
                            modifier = Modifier.fillMaxWidth(),
                        ) { Text("Terima Hasil Inspeksi") }

                        Button(
                            onClick = {
                                vm.review(selectedId!!, InspectionReviewAction.RETURN, notes)
                                showActions = false
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = WarningAmber),
                            enabled = !busy && !reasonMissing,
                            modifier = Modifier.fillMaxWidth(),
                        ) { Text("Kembalikan ke Petugas") }

                        Button(
                            onClick = {
                                vm.review(selectedId!!, InspectionReviewAction.REINSPECT, notes)
                                showActions = false
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = BrandBlue),
                            enabled = !busy && !reasonMissing,
                            modifier = Modifier.fillMaxWidth(),
                        ) { Text("Minta Inspeksi Ulang") }

                        Button(
                            onClick = {
                                vm.review(selectedId!!, InspectionReviewAction.REJECT, notes)
                                showActions = false
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = ErrorRed),
                            enabled = !busy && !reasonMissing,
                            modifier = Modifier.fillMaxWidth(),
                        ) { Text("Tolak Laporan") }
                    }
                }
            },
            confirmButton = {},
            dismissButton = {
                TextButton(onClick = { showActions = false }, enabled = !busy) {
                    Text("Tutup")
                }
            },
        )
    }
}

@Composable
private fun InspectionReviewCard(
    result: InspectionResultDto,
    onClick: () -> Unit,
) {
    val report = result.report
    val photos = result.photos.orEmpty()

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(Color.White)
            .border(1.dp, Color(0xFFE2E8F0), RoundedCornerShape(12.dp))
            .clickable(onClick = onClick)
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text(
                report?.reportCode ?: "HASIL INSPEKSI",
                color = BrandBlue,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
            )
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(4.dp))
                    .background(Color(0xFFFEF3C7))
                    .padding(horizontal = 6.dp, vertical = 2.dp),
            ) {
                Text("Menunggu Review", color = Color(0xFF92400E), fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
            }
        }

        Text(
            report?.roadName ?: "Laporan tanpa nama jalan",
            color = TextDark,
            fontSize = 15.sp,
            fontWeight = FontWeight.SemiBold,
        )

        report?.district?.let {
            Text("Kecamatan: $it", color = TextMuted, fontSize = 12.sp)
        }

        // Tampilkan preview foto bukti inspeksi petugas
        if (photos.isNotEmpty()) {
            LazyRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.padding(vertical = 4.dp),
            ) {
                items(photos, key = { it.id }) { photo ->
                    ReportThumbnail(
                        url = photo.displayUrl,
                        contentDescription = "Bukti inspeksi",
                        modifier = Modifier
                            .size(72.dp)
                            .clip(RoundedCornerShape(6.dp))
                            .border(1.dp, Color(0xFFCBD5E1), RoundedCornerShape(6.dp)),
                    )
                }
            }
        }

        Text("Kondisi: ${result.condition ?: "-"}", color = TextDark, fontSize = 12.sp)
        Text("Dimensi: ${dimensionText(result)}", color = TextMuted, fontSize = 12.sp)
        result.notes?.takeIf { it.isNotBlank() }?.let {
            Text("Catatan petugas: \"$it\"", color = TextMuted, fontSize = 12.sp, maxLines = 2)
        }

        Row(
            modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
            horizontalArrangement = Arrangement.End,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("Buka Keputusan", color = BrandBlue, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
            Icon(AppIcon.ChevronRight, contentDescription = null, tint = BrandBlue, modifier = Modifier.size(16.dp))
        }
    }
}

/**
 * Teks dimensi hasil ukur petugas: `1.50 × 0.80 × 0.15 m`.
 *
 * Nilai yang tidak diisi ditampilkan sebagai "tidak diukur", BUKAN "0".
 * Alasannya: 0 berarti "tidak ada kerusakan", sedangkan kosong berarti
 * "petugas tidak membawa meteran" — dua hal berbeda yang tidak boleh
 * dicampur dalam keputusan perbaikan.
 */
private fun dimensionText(result: InspectionResultDto?): String {
    if (result == null) return "tidak diukur"

    val bagian = listOfNotNull(
        result.kerusakanPanjang?.let { "P ${fmtDim(it)}" },
        result.kerusakanLebar?.let { "L ${fmtDim(it)}" },
        result.kerusakanKedalaman?.let { "K ${fmtDim(it)}" },
    )

    return if (bagian.isEmpty()) "tidak diukur" else bagian.joinToString(" × ") + " m"
}

private fun fmtDim(value: Double): String =
    if (value % 1.0 == 0.0) value.toInt().toString() else String.format(java.util.Locale.ROOT, "%.2f", value)
