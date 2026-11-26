package com.jalankita.app.feature.home

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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
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
import com.jalankita.app.core.network.InspectionAssignmentDto
import com.jalankita.app.core.network.UserDto
import com.jalankita.app.ui.components.AppIcon
import com.jalankita.app.ui.components.BadgeRow
import com.jalankita.app.ui.components.BrandPrimaryButton
import com.jalankita.app.ui.components.safeContentPadding
import com.jalankita.app.ui.components.LokasiCard
import com.jalankita.app.ui.components.ReportThumbnail
import com.jalankita.app.ui.components.PhotoViewerDialog
import com.jalankita.app.ui.theme.BrandBlue
import com.jalankita.app.ui.theme.ErrorRed
import com.jalankita.app.ui.theme.SuccessGreen
import com.jalankita.app.ui.theme.TextDark
import com.jalankita.app.ui.theme.TextMuted
import com.jalankita.app.ui.theme.WarningAmber

@Composable
fun InspectionTaskListScreen(
    user: UserDto,
    vm: InspectionViewModel,
    onOpenAssignment: (String) -> Unit,
    showTitle: Boolean = true,
    modifier: Modifier = Modifier,
) {
    LaunchedEffect(user.id) { vm.load() }
    Column(modifier = modifier.fillMaxSize().padding(if (showTitle) 16.dp else 0.dp)) {
        if (showTitle) {
            Text("Inspeksi Laporan", color = TextDark, fontSize = 16.sp, fontWeight = FontWeight.Bold)
            Text("Tugas verifikasi tim", color = TextMuted, fontSize = 13.sp, modifier = Modifier.padding(top = 2.dp, bottom = 10.dp))
        }
        when {
            vm.loading && vm.page == null -> Box(Modifier.fillMaxWidth().height(120.dp), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = BrandBlue, modifier = Modifier.size(28.dp))
            }
            vm.error != null -> Column(
                modifier = Modifier.fillMaxWidth().padding(vertical = 12.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(vm.error.orEmpty(), color = ErrorRed, fontSize = 13.sp)
                OutlinedButton(onClick = { vm.load(force = true) }) { Text("Coba lagi", fontSize = 12.sp) }
            }
            vm.page?.data.orEmpty().isEmpty() -> Box(
                modifier = Modifier.fillMaxWidth().height(80.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text("Tidak ada tugas inspeksi aktif.", color = TextMuted, fontSize = 13.sp)
            }
            else -> LazyColumn(
                contentPadding = PaddingValues(bottom = 12.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                items(vm.page?.data.orEmpty(), key = { it.id }) { assignment ->
                    InspectionAssignmentCard(assignment, onOpenAssignment)
                }
            }
        }
    }
}

@Composable
internal fun InspectionAssignmentCard(
    assignment: InspectionAssignmentDto,
    onOpenAssignment: (String) -> Unit,
) {
    val report = assignment.report
    val statusLabel = when (assignment.status) {
        "assigned" -> "Siap Diinspeksi"
        "started" -> "Sedang Berjalan"
        "submitted" -> "Menunggu Review"
        else -> assignment.status ?: "-"
    }
    val statusColor = when (assignment.status) {
        "assigned" -> WarningAmber
        "started" -> BrandBlue
        "submitted" -> SuccessGreen
        else -> TextMuted
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(Color.White)
            .border(1.dp, Color(0xFFE2E8F0), RoundedCornerShape(10.dp))
            .clickable { onOpenAssignment(assignment.id) }
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // Thumbnail bukti laporan awal dari warga
        val img = report?.imageOriginalUrl ?: report?.imageOriginalPath
        Box(
            modifier = Modifier.size(54.dp).clip(RoundedCornerShape(8.dp)).background(Color(0xFFEEF3FA)),
            contentAlignment = Alignment.Center,
        ) {
            ReportThumbnail(
                url = img,
                contentDescription = null,
                modifier = Modifier.size(54.dp),
            )
        }
        Spacer(Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                report?.roadName ?: "Laporan tanpa nama jalan",
                color = TextDark,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
            )
            report?.district?.let {
                Text("Kec. $it", color = TextMuted, fontSize = 11.sp)
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(modifier = Modifier.size(6.dp).clip(RoundedCornerShape(999.dp)).background(statusColor))
                Spacer(Modifier.width(4.dp))
                Text(statusLabel, color = statusColor, fontSize = 11.sp, fontWeight = FontWeight.Medium)
                report?.overallSeverity?.let {
                    Text(" • $it", color = TextMuted, fontSize = 11.sp)
                }
            }
        }
        Icon(AppIcon.ChevronRight, contentDescription = null, tint = TextMuted, modifier = Modifier.size(18.dp))
    }
}

@Composable
fun InspectionAssignmentDetailScreen(
    vm: InspectionViewModel,
    assignmentId: String,
    onBack: () -> Unit,
    onStartInspection: () -> Unit = {},
    onOpenDiscovered: (String) -> Unit = {},
    modifier: Modifier = Modifier,
) {
    LaunchedEffect(assignmentId) { vm.loadDetail(assignmentId) }
    LaunchedEffect(vm.startSucceeded) {
        if (vm.startSucceeded) {
            vm.consumeStartSuccess()
            onStartInspection()
        }
    }

    // Full-screen di luar Scaffold → wajib inset sistem agar tombol Kembali tidak
    // tertimpa status bar dan konten paling bawah tidak tertutup gesture bar.
    Column(
        modifier = modifier
            .fillMaxSize()
            .background(Color(0xFFF8FAFC))
            .safeContentPadding()
            .padding(16.dp),
    ) {
        // Top bar
        Row(
            modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            OutlinedButton(onClick = onBack) {
                Icon(AppIcon.ArrowBack, contentDescription = "Kembali", modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(6.dp))
                Text("Kembali")
            }
            Spacer(Modifier.width(12.dp))
            Text("Detail Tugas Inspeksi", color = TextDark, fontSize = 16.sp, fontWeight = FontWeight.Bold)
        }

        when {
            vm.loading && vm.detail?.id != assignmentId -> Box(
                Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center,
            ) {
                CircularProgressIndicator(color = BrandBlue)
            }
            vm.error != null -> Box(
                Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center,
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(vm.error.orEmpty(), color = ErrorRed, fontSize = 14.sp)
                    Button(onClick = { vm.loadDetail(assignmentId) }) { Text("Coba Lagi") }
                }
            }
            vm.detail != null -> {
                val item = vm.detail!!
                val report = item.report
                // Indeks foto yang dibuka layar penuh (null = tertutup).
                var fotoDibuka by remember(item.id) { mutableStateOf<Int?>(null) }
                val semuaFotoWarga = remember(report) {
                    buildList {
                        report?.photos?.mapNotNullTo(this) { it.imageOriginalUrl }
                        val utama = report?.imageOriginalUrl ?: report?.imageOriginalPath
                        if (!utama.isNullOrBlank() && utama !in this) add(utama)
                    }
                }
                fotoDibuka?.let { idx ->
                    PhotoViewerDialog(
                        urls = semuaFotoWarga,
                        initialIndex = idx,
                        onDismiss = { fotoDibuka = null },
                    )
                }
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    // Kartu Info Utama
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(Color.White)
                            .border(1.dp, Color(0xFFE2E8F0), RoundedCornerShape(12.dp))
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                report?.reportCode ?: "TUGAS INSPEKSI",
                                color = BrandBlue,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                            )
                            val statusBadge = when (item.status) {
                                "assigned" -> "Siap Diinspeksi"
                                "started" -> "Sedang Diperiksa"
                                else -> item.status.orEmpty()
                            }
                            Text(
                                statusBadge,
                                color = if (item.status == "started") BrandBlue else WarningAmber,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.SemiBold,
                            )
                        }
                        Text(
                            report?.roadName ?: "Laporan tanpa nama jalan",
                            color = TextDark,
                            fontSize = 17.sp,
                            fontWeight = FontWeight.Bold,
                        )
                        report?.district?.let {
                            Text("Kecamatan: $it", color = TextMuted, fontSize = 13.sp)
                        }
                        report?.overallSeverity?.let {
                            Text("Tingkat Kerusakan Awal: $it", color = TextDark, fontSize = 13.sp, fontWeight = FontWeight.Medium)
                        }
                    }

                    // Baris badge (severity + status + sumber) — komponen bersama yang
                    // juga dipakai layar supervisor, supaya kedua layar seragam.
                    BadgeRow(
                        severity = report?.overallSeverity ?: report?.aiSeverity,
                        status = report?.status,
                        source = report?.source,
                    )

                    // Bukti Laporan Warga
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(Color.White)
                            .border(1.dp, Color(0xFFE2E8F0), RoundedCornerShape(12.dp))
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Text("Bukti Laporan Awal Warga", color = TextDark, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                        Text(
                            "Foto dan deskripsi yang dikirim warga saat pelaporan:",
                            color = TextMuted,
                            fontSize = 12.sp,
                        )

                        // Semua bukti foto warga, bukan hanya foto utama. Petugas
                        // perlu melihat seluruh sudut kerusakan; ketuk untuk
                        // memperbesar (retak halus tidak terbaca di thumbnail).
                        val urlFotoWarga = semuaFotoWarga
                        if (urlFotoWarga.isNotEmpty()) {
                            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                itemsIndexed(urlFotoWarga) { idx, url ->
                                    Box {
                                        ReportThumbnail(
                                            url = url,
                                            contentDescription = "Foto kerusakan jalan dari warga ${idx + 1}",
                                            modifier = Modifier
                                                .size(120.dp)
                                                .clip(RoundedCornerShape(8.dp))
                                                .clickable { fotoDibuka = idx },
                                        )
                                        if (urlFotoWarga.size > 1) {
                                            Text(
                                                "${idx + 1}/${urlFotoWarga.size}",
                                                color = Color.White,
                                                fontSize = 10.sp,
                                                fontWeight = FontWeight.Bold,
                                                modifier = Modifier
                                                    .align(Alignment.BottomEnd)
                                                    .padding(4.dp)
                                                    .clip(RoundedCornerShape(4.dp))
                                                    .background(Color.Black.copy(alpha = 0.55f))
                                                    .padding(horizontal = 5.dp, vertical = 2.dp),
                                            )
                                        }
                                    }
                                }
                            }
                            if (urlFotoWarga.size > 1) {
                                Text(
                                    "Ketuk foto untuk memperbesar (${urlFotoWarga.size} foto).",
                                    color = TextMuted,
                                    fontSize = 11.sp,
                                )
                            }
                        } else {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(100.dp)
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(Color(0xFFEEF3FA)),
                                contentAlignment = Alignment.Center,
                            ) {
                                Text("Foto laporan warga tidak tersedia", color = TextMuted, fontSize = 12.sp)
                            }
                        }

                        report?.description?.takeIf { it.isNotBlank() }?.let {
                            Text("Deskripsi warga: \"$it\"", color = TextDark, fontSize = 13.sp)
                        }
                    }

                    // Catatan Keputusan Supervisor jika ada revisi/reinspeksi
                    val reviewNotes = item.result?.reviewNotes ?: item.previousReviewNotes
                    if (!reviewNotes.isNullOrBlank()) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .background(Color(0xFFFFFBEB))
                                .border(1.dp, Color(0xFFFDE68A), RoundedCornerShape(12.dp))
                                .padding(14.dp),
                            verticalArrangement = Arrangement.spacedBy(4.dp),
                        ) {
                            Text("Catatan dari Supervisor:", color = Color(0xFF92400E), fontSize = 13.sp, fontWeight = FontWeight.Bold)
                            Text(reviewNotes, color = Color(0xFF78350F), fontSize = 13.sp)
                            if (item.result?.result == "returned") {
                                Text("Data/bukti dikembalikan. Silakan lengkapi lalu kirim ulang.", color = Color(0xFF92400E), fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                            } else if (item.session?.scheduleType == "reinspection" || item.result?.result == "reinspection_requested") {
                                Text("Supervisor meminta verifikasi ulang di lokasi.", color = Color(0xFF92400E), fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                            }
                        }
                    }

                    Spacer(Modifier.height(8.dp))

                    // ── Lokasi: titik yang bisa diklik → buka aplikasi peta ──
                    // Petugas harus menemukan kerusakan fisik di lapangan; nama jalan +
                    // kecamatan saja tidak cukup untuk jalan panjang dengan banyak titik.
                    // Kartu ini memberi koordinat presisi, peta mini ber-pin, dan tombol
                    // navigasi langsung (geo: → aplikasi peta pilihan pengguna).
                    LokasiCard(
                        latitude = report?.latitude,
                        longitude = report?.longitude,
                        roadName = report?.roadName,
                        district = report?.district,
                        mapLabel = "Titik inspeksi",
                    )

                    // Tombol Aksi Petugas
                    when (item.status) {
                        "assigned" -> BrandPrimaryButton(
                            "Mulai Inspeksi Lapangan",
                            onClick = { vm.start(assignmentId) },
                            enabled = !vm.loading,
                            modifier = Modifier.fillMaxWidth(),
                        )
                        "started" -> {
                            BrandPrimaryButton(
                                "Lanjutkan Form Inspeksi",
                                onClick = onStartInspection,
                                enabled = !vm.loading,
                                modifier = Modifier.fillMaxWidth(),
                            )
                            val sessionId = item.session?.id
                            if (!sessionId.isNullOrBlank()) {
                                OutlinedButton(
                                    onClick = { onOpenDiscovered(sessionId) },
                                    enabled = !vm.loading,
                                    modifier = Modifier.fillMaxWidth(),
                                ) {
                                    Text("Buat Laporan Temuan Lapangan")
                                }
                            }
                        }
                        else -> Box(
                            Modifier.fillMaxWidth().padding(12.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text("Assignment ini sudah selesai diproses.", color = TextMuted, fontSize = 13.sp)
                        }
                    }
                }
            }
        }
    }
}
