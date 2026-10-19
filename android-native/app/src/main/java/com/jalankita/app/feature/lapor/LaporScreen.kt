package com.jalankita.app.feature.lapor

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.jalankita.app.core.network.MAX_PETUGAS_PHOTOS
import com.jalankita.app.core.network.SurveyTask
import com.jalankita.app.feature.home.components.EmptyState
import com.jalankita.app.feature.home.components.formatDateShort
import com.jalankita.app.feature.lapor.components.FraudModal
import com.jalankita.app.ui.components.AppIcon
import com.jalankita.app.ui.components.BrandPrimaryButton
import com.jalankita.app.ui.components.BrandSecondaryButton
import com.jalankita.app.ui.components.ErrorBox
import com.jalankita.app.ui.components.PatrolContextBanner
import com.jalankita.app.ui.rememberGalleryPickerLauncher
import com.jalankita.app.ui.theme.BrandBlue
import com.jalankita.app.ui.theme.DeltaJalanTypography
import com.jalankita.app.ui.theme.TextDark
import com.jalankita.app.ui.theme.TextMuted

/**
 * Layar Lapor petugas — pilih BEBERAPA foto (maks [MAX_PETUGAS_PHOTOS]) →
 * validasi EXIF → analisis batch. Setelah analisis, `onAnalyzed` dipanggil ke [AiResultScreen].
 */
@Composable
fun LaporScreen(
    vm: LaporViewModel,
    teamId: String?,
    onAnalyzed: () -> Unit,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current

    // Jadwal hari ini dimuat tiap buka layar (cermin refetchOnMount web).
    LaunchedEffect(Unit) { vm.loadTodayTasks(teamId, force = true) }

    // DEFAULT: SAF multiple (ACTION_OPEN_DOCUMENT) — URI media.documents mendukung
    // setRequireOriginal + MediaStore (rantai EXIF GPS tidak ter-redact), sama alur warga.
    val safLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.OpenMultipleDocuments(),
    ) { uris: List<Uri> -> if (uris.isNotEmpty()) vm.addPhotos(context, uris, checkDate = true) }

    // Fallback: Photo Picker multi.
    val galleryLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.PickMultipleVisualMedia(MAX_PETUGAS_PHOTOS),
    ) { uris: List<Uri> -> if (uris.isNotEmpty()) vm.addPhotos(context, uris, checkDate = true) }

    val pickFromGallery = rememberGalleryPickerLauncher {
        try {
            safLauncher.launch(arrayOf("image/jpeg"))
        } catch (_: Exception) {
            galleryLauncher.launch(
                PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly),
            )
        }
    }

    // Navigasi setelah analisis sukses.
    LaunchedEffect(vm.stage, vm.batchId) {
        if (vm.stage == LaporStage.RESULT && vm.batchId != null) onAnalyzed()
    }

    Column(modifier.fillMaxSize().padding(16.dp)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier
                    .size(40.dp)
                    .clip(RoundedCornerShape(50))
                    .background(Color.White.copy(alpha = .9f))
                    .clickable { onBack() },
                contentAlignment = Alignment.Center,
            ) { Icon(AppIcon.ArrowBack, "Kembali", tint = BrandBlue, modifier = Modifier.size(22.dp)) }
            Spacer(Modifier.size(12.dp))
            Text(
                "Lapor Kerusakan",
                style = DeltaJalanTypography.headlineLarge.copy(fontSize = 20.sp),
                color = Color.White,
            )
        }

        Spacer(Modifier.height(16.dp))
        // Tanpa tugas terikat → mode daftar jadwal (port list-mode upload.tsx).
        // Tanpa memilih tugas, picker tidak terjangkau (paritas gate taskId web).
        if (vm.surveyTaskId == null && vm.stage == LaporStage.SELECT) {
            ScheduleSelect(
                vm = vm,
                onRefresh = { vm.loadTodayTasks(teamId, force = true) },
                modifier = Modifier.fillMaxWidth().weight(1f),
            )
        } else {
        Column(
            Modifier.fillMaxWidth().weight(1f).verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            // Banner sesi cek rutin (bila laporan dari sesi patroli).
            if (vm.surveyTaskId != null) {
                PatrolContextBanner(roadName = vm.surveyRoadName, kecamatan = vm.surveyKecamatan)
            }

            vm.error?.let { ErrorBox(it) }

            // Counter + grid foto
            Text(
                "Foto Kerusakan (${vm.photos.size}/$MAX_PETUGAS_PHOTOS)",
                color = TextDark, fontSize = 14.sp, fontWeight = FontWeight.SemiBold,
            )
            if (vm.photos.isEmpty()) {
                PhotoPlaceholder()
            } else {
                vm.photos.forEachIndexed { i, p ->
                    Row(
                        Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp))
                            .background(Color.White.copy(alpha = 0.95f))
                            .border(1.dp, Color(0xFFE2E8F0), RoundedCornerShape(12.dp))
                            .padding(10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        AsyncImage(
                            model = p.uri, contentDescription = "Foto ${i + 1}",
                            contentScale = ContentScale.Crop,
                            modifier = Modifier.size(64.dp).clip(RoundedCornerShape(8.dp)),
                        )
                        Spacer(Modifier.size(12.dp))
                        Column(Modifier.weight(1f)) {
                            Text("Foto ${i + 1}", color = TextDark, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                            Text(
                                "GPS: %.5f, %.5f".format(p.latitude, p.longitude),
                                color = TextMuted, fontSize = 11.sp,
                            )
                        }
                        Icon(
                            AppIcon.Delete, contentDescription = "Hapus",
                            tint = Color(0xFFEF4444), modifier = Modifier.size(20.dp).clickable { vm.removePhoto(i) },
                        )
                    }
                }
            }

            if (vm.canAddMore) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    PickButton("Galeri", AppIcon.Gallery, Modifier.weight(1f)) { pickFromGallery() }
                    PickButton("Kamera", AppIcon.Camera, Modifier.weight(1f)) { pickFromGallery() }
                }
            } else {
                Text(
                    "Maksimal $MAX_PETUGAS_PHOTOS foto tercapai.",
                    color = TextMuted, fontSize = 12.sp,
                )
            }

            if (vm.photos.isNotEmpty()) {
                BrandPrimaryButton(
                    text = "Analisis ${vm.photos.size} Foto",
                    loading = vm.busy && vm.stage == LaporStage.ANALYZING,
                    loadingText = "Menganalisis…",
                    onClick = vm::analyze,
                )
            }
        }
        }
    }

    FraudModal(vm.fraudAlert) { vm.dismissFraudAlert() }
}

/**
 * Mode daftar jadwal — port list-mode upload.tsx: jadwal hari ini (tugas
 * teratas hasil rotasi) + CTA "Tambahkan Laporan" → mode capture terikat.
 * Tanpa memilih tugas, alur foto tak terjangkau (paritas gate taskId web).
 */
@Composable
private fun ScheduleSelect(
    vm: LaporViewModel,
    onRefresh: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier.verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        vm.todayError?.let { ErrorBox(it) }
        if (vm.todayLoading && vm.todayTasks.isEmpty()) {
            Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = BrandBlue, modifier = Modifier.size(32.dp))
            }
            Text("Memuat jadwal patroli...", color = Color.White, fontSize = 13.sp,
                modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center)
        } else if (vm.todayTasks.isEmpty()) {
            Column(
                Modifier.fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(Color.White.copy(alpha = 0.95f))
                    .padding(16.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                EmptyState(
                    icon = AppIcon.CalendarMonth,
                    title = "Tidak ada jadwal patroli untuk hari ini",
                    subtitle = "Cek Tugas Saya untuk melihat jadwal Anda",
                )
                BrandSecondaryButton(text = "Muat Ulang Jadwal", onClick = onRefresh)
            }
        } else {
            val task = vm.todayTasks.first()
            TodayTaskCard(task = task, onPick = { vm.pilihTugas(task) })
            Text(
                "${vm.todayTasks.size} kecamatan ditugaskan untuk hari ini",
                color = Color.White.copy(alpha = 0.85f), fontSize = 12.sp,
                modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center,
            )
        }
    }
}

/** Kartu tugas teratas — port task card upload.tsx (kecamatan, ruas, jam, tim, counter). */
@Composable
private fun TodayTaskCard(task: SurveyTask, onPick: () -> Unit) {
    Column(
        Modifier.fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(Color.White)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        task.tanggalPatroli?.let {
            Text(formatDateShort(it), color = TextMuted, fontSize = 12.sp)
        }
        Text(
            task.kecamatan?.let { "Kec. $it" } ?: "Jadwal Patroli",
            color = TextDark, fontSize = 17.sp, fontWeight = FontWeight.Bold,
        )
        task.roadName?.let {
            Text(it, color = TextDark, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
        }
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            task.priority?.takeIf { it.isNotBlank() }?.let {
                PriorityChip(it)
            }
            StatusChip(task.status ?: "")
        }
        val jam = listOfNotNull(task.jamMulai, task.jamSelesai).joinToString(" – ")
        if (jam.isNotBlank()) Text(jam, color = TextMuted, fontSize = 13.sp)
        task.team?.name?.let { Text("Tim: $it", color = TextMuted, fontSize = 13.sp) }
        task.alasanTugas?.takeIf { it.isNotBlank() }?.let {
            Text(it, color = TextMuted, fontSize = 13.sp)
        }
        Text("${task.reportsCount} laporan", color = TextDark, fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold)
        BrandPrimaryButton(text = "Tambahkan Laporan", onClick = onPick)
    }
}

@Composable
private fun PriorityChip(priority: String) {
    val bg = when (priority.lowercase()) {
        "tinggi" -> Color(0xFFFEE2E2)
        "sedang" -> Color(0xFFFFF7ED)
        else -> Color(0xFFF1F5F9)
    }
    val fg = when (priority.lowercase()) {
        "tinggi" -> Color(0xFFDC2626)
        "sedang" -> Color(0xFFEA580C)
        else -> Color(0xFF475569)
    }
    Text(priority, color = fg, fontSize = 12.sp, fontWeight = FontWeight.Bold,
        modifier = Modifier.clip(RoundedCornerShape(6.dp)).background(bg)
            .padding(horizontal = 8.dp, vertical = 4.dp))
}

@Composable
private fun StatusChip(status: String) {
    val aktif = status.equals("aktif", ignoreCase = true)
    Text(if (aktif) "Aktif" else status.ifBlank { "-" },
        color = if (aktif) Color(0xFF15803D) else TextMuted,
        fontSize = 12.sp, fontWeight = FontWeight.Bold,
        modifier = Modifier.clip(RoundedCornerShape(6.dp))
            .background(if (aktif) Color(0xFFDCFCE7) else Color(0xFFF1F5F9))
            .padding(horizontal = 8.dp, vertical = 4.dp))
}

@Composable
private fun PhotoPlaceholder() {
    Box(
        Modifier
            .fillMaxWidth()
            .aspectRatio(4f / 3f)
            .clip(RoundedCornerShape(16.dp))
            .background(Color.White.copy(alpha = 0.95f))
            .border(2.dp, BrandBlue, RoundedCornerShape(16.dp)),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(AppIcon.AddPhoto, null, tint = BrandBlue, modifier = Modifier.size(48.dp))
            Spacer(Modifier.height(8.dp))
            Text("Pilih foto kerusakan jalan", color = TextDark, style = DeltaJalanTypography.labelMedium)
            Text(
                "Foto asli dari kamera, maks 2 hari • maks $MAX_PETUGAS_PHOTOS foto",
                color = TextMuted, fontSize = 12.sp, textAlign = TextAlign.Center,
            )
        }
    }
}

@Composable
private fun PickButton(
    text: String,
    icon: ImageVector,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    Row(
        modifier
            .height(44.dp)
            .clip(RoundedCornerShape(8.dp))
            .background(BrandBlue)
            .clickable { onClick() },
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, null, tint = Color.White, modifier = Modifier.size(20.dp))
        Spacer(Modifier.size(8.dp))
        Text(text, color = Color.White, style = DeltaJalanTypography.labelMedium)
    }
}
