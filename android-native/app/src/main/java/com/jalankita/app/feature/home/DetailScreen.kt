package com.jalankita.app.feature.home

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.jalankita.app.core.network.PetugasAfterPhotoDto
import com.jalankita.app.core.network.ProgressItemDto
import com.jalankita.app.core.network.ReportItemDto
import com.jalankita.app.core.network.UserDto
import com.jalankita.app.core.util.ImageUrl
import com.jalankita.app.feature.home.components.formatDateShort
import com.jalankita.app.ui.rememberGalleryPickerLauncher
import com.jalankita.app.ui.components.AppIcon
import com.jalankita.app.ui.components.BeforeAfterSlider
import com.jalankita.app.ui.components.BrandPrimaryButton
import com.jalankita.app.ui.components.BrandSecondaryButton
import com.jalankita.app.ui.components.BrandTextField
import com.jalankita.app.ui.components.ErrorBox
import com.jalankita.app.ui.components.FieldLabel
import com.jalankita.app.ui.components.SuccessBox
import com.jalankita.app.ui.theme.BrandBlue
import com.jalankita.app.ui.theme.TextDark
import com.jalankita.app.ui.theme.TextMuted
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.delay

/**
 * Detail laporan petugas — replikasi ringkas detail-report.tsx.
 *
 * Tombol eksekusi mengikuti gate backend (ReportController):
 * - "Ditugaskan" → Mulai Pengerjaan (POST mulai; gate tim server).
 * - "Sedang Diperbaiki" → Update Progress + Selesaikan (POST progress/complete).
 * Hak tim disembunyikan bila jelas beda tim ([ReportItemDto.assignedTeamId]
 * vs [UserDto.teamId]); 403/422 server tetap ditampilkan sebagai pesan.
 */
@Composable
fun DetailScreen(
    reportId: String,
    vm: DashboardViewModel,
    user: UserDto,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    LaunchedEffect(reportId) {
        vm.consumeActionError()
        vm.consumeActionSuccess()
        vm.clearProgress()
        vm.loadDetail(reportId)
    }
    // Sukses otomatis hilang setelah tampil (error dipertahankan sampai aksi berikutnya).
    val success = vm.actionSuccess
    LaunchedEffect(success) {
        if (success != null) {
            delay(4000)
            vm.consumeActionSuccess()
        }
    }
    Column(modifier = modifier.fillMaxSize()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp)
                .background(Color.White)
                .padding(horizontal = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = {
                vm.clearDetail()
                vm.clearProgress()
                onBack()
            }) {
                Icon(AppIcon.ArrowBack, contentDescription = "Kembali", tint = TextDark)
            }
            Text("Detail Laporan", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = TextDark)
        }
        if (vm.detailLoading && vm.detail == null) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = BrandBlue)
            }
        } else {
            val report = vm.detail
            if (report == null) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text("Gagal memuat detail.", color = TextMuted)
                }
            } else {
                DetailBody(report = report, user = user, vm = vm, onBack = onBack)
            }
        }
    }
}

@Composable
private fun DetailBody(
    report: ReportItemDto,
    user: UserDto,
    vm: DashboardViewModel,
    onBack: () -> Unit,
) {
    var showMulai by remember(report.id) { mutableStateOf(false) }
    var showProgress by remember(report.id) { mutableStateOf(false) }
    var showSelesai by remember(report.id) { mutableStateOf(false) }
    var showEditForm by remember(report.id) { mutableStateOf(false) }
    var showDeleteConfirm by remember(report.id) { mutableStateOf(false) }
    /** true bila sesi edit dikunci dari layar ini (batal → batal-edit). */
    var editLockedByMe by remember(report.id) { mutableStateOf(false) }

    // Tim lain yang jelas → sembunyikan tombol eksekusi (server tetap gate 403).
    val wrongTeam = user.teamId != null &&
        report.assignedTeamId != null &&
        report.assignedTeamId != user.teamId
    val canMulai = report.status == "Ditugaskan" && !wrongTeam
    val canWork = report.status == "Sedang Diperbaiki" && !wrongTeam
    // Kelola draft sendiri (kontrak destroy:update — gate reporter_name + status).
    val isOwner = report.reporterName == user.name
    val canEdit = isOwner && (report.status == "Menunggu Review" || report.status == "Diedit")
    val canDelete = isOwner && report.status in
        listOf("Menunggu Review", "Ditinjau", "Diedit", "Ditolak")

    // Muat timeline progres untuk status berjalan/selesai.
    LaunchedEffect(report.id, report.status) {
        if (report.status == "Sedang Diperbaiki" ||
            report.status == "Selesai" ||
            report.progressUpdatesCount > 0
        ) {
            vm.muatProgress(report.id)
        }
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        // ── Galeri foto per-foto + toggle Asli/AI (port detail-report.tsx:691-878) ──
        val galleryPhotos = report.photos.orEmpty()
        if (galleryPhotos.isNotEmpty()) {
            galleryPhotos.forEachIndexed { idx, p ->
                item(key = "photo-${p.id ?: idx}") { PetugasPhotoCard(p) }
            }
        } else if (report.displayImageUrl != null) {
            item(key = "photo-single") { PetugasPhotoCard(singlePetugasPhoto(report)) }
        }
        // ── Progress bar estimasi (port detail-report.tsx:881-907) ──
        val est = report.estimasiHari
        if (est != null && est > 0) {
            item(key = "estimasi-bar") {
                val isSelesai = report.status == "Selesai"
                val doneDays = if (isSelesai) est else (vm.progressList.mapNotNull { it.dayNumber }.distinct().size.takeIf { it > 0 } ?: minOf(report.progressUpdatesCount, est))
                PetugasProgressBar(doneDays = doneDays, estimasi = est, isSelesai = isSelesai)
            }
        }
        // ── Timeline progres pengerjaan ──
        if (vm.progressList.isNotEmpty() || vm.progressLoading) {
            item(key = "progress-head") {
                Text("Progres Pengerjaan (${vm.progressList.size})",
                    fontSize = 15.sp, fontWeight = FontWeight.Bold, color = TextDark)
            }
            if (vm.progressLoading && vm.progressList.isEmpty()) {
                item(key = "progress-loading") {
                    Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = BrandBlue, modifier = Modifier.size(28.dp))
                    }
                }
            }
            vm.progressList.forEach { p ->
                item(key = "progress-${p.id ?: p.createdAt}") { ProgressRow(p) }
            }
        }
        // ── Galeri after (port AfterPhotoGallery) ──
        val afterList = report.afterPhotos.orEmpty().filter { it.url != null }
        val beforePhotoUrl = report.photos?.firstOrNull()?.displayUrl ?: report.displayImageUrl
        val primaryAfterUrl = afterList.firstOrNull()?.url ?: report.afterPhotoUrl
        if (primaryAfterUrl != null && beforePhotoUrl != null) {
            item(key = "before-after-slider") {
                Column(Modifier.fillMaxWidth().padding(bottom = 8.dp)) {
                    Text(
                        "Perbandingan Sebelum & Sesudah (Geser garis pembagi)",
                        fontSize = 12.sp, color = TextMuted, modifier = Modifier.padding(bottom = 6.dp)
                    )
                    BeforeAfterSlider(
                        beforeUrl = beforePhotoUrl,
                        afterUrl = primaryAfterUrl,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            }
        }
        if (afterList.isNotEmpty()) {
            item(key = "after") {
                PetugasAfterGallery(photos = afterList, notes = report.afterPhotoNotes)
            }
        } else if (report.afterPhotoUrl != null) {
            item(key = "after-single") {
                PetugasAfterGallery(
                    photos = listOf(PetugasAfterPhotoDto(id = "legacy", url = report.afterPhotoUrl)),
                    notes = report.afterPhotoNotes,
                )
            }
        }
        // ── Penilaian warga (port detail-report.tsx:918-935) ──
        if ((report.source == "warga" || report.source == "telegram") && report.rating != null) {
            item(key = "rating") {
                PetugasRatingCard(rating = report.rating, comment = report.ratingComment)
            }
        }
        // ── Baris badges + PCI + alasan ditolak ──
        item(key = "badges") { PetugasBadgeRow(report) }
        report.pciScore?.let {
            item(key = "pci") { PetugasPciSection(score = it) }
        }
        if (report.status == "Ditolak" && report.systemNotes != null) {
            item(key = "reject") { PetugasRejectCard(systemNotes = report.systemNotes) }
        }
        // ── Info jalan grid ──
        item(key = "info") { PetugasInfoGrid(report) }
        // ── Timeline status ──
        report.statusHistory?.takeIf { it.isNotEmpty() }?.let { history ->
            item(key = "timeline") { PetugasStatusTimeline(history) }
        }
        // ── Lokasi ──
        if (report.latitude != null && report.longitude != null) {
            item(key = "lokasi") {
                PetugasLokasiCard(
                    lat = report.latitude,
                    lng = report.longitude,
                    fullAddress = report.fullAddress,
                )
            }
        }
        // ── Duplikat (gate duplicateOf — is_duplicate tidak dikirim show()) ──
        report.duplicateOf?.let { dup ->
            item(key = "duplicate") {
                PetugasDuplicateCard(
                    ownLat = report.latitude,
                    ownLng = report.longitude,
                    dup = dup,
                )
            }
        }
        vm.actionError?.let { err ->
            item(key = "action-error") { ErrorBox(err) }
        }
        vm.actionSuccess?.let { msg ->
            item(key = "action-success") { SuccessBox(msg) }
        }
        if (canMulai || canWork) {
            item(key = "actions") {
                DetailCard {
                    Text("Aksi Lapangan", fontSize = 13.sp, fontWeight = FontWeight.SemiBold,
                        color = TextDark)
                    Spacer(Modifier.height(8.dp))
                    if (canMulai) {
                        BrandPrimaryButton(
                            text = "Mulai Pengerjaan",
                            icon = AppIcon.PlayArrow,
                            loading = vm.actionLoading,
                            loadingText = "Memproses...",
                            onClick = { showMulai = true },
                        )
                    }
                    if (canWork) {
                        if (canMulai) Spacer(Modifier.height(8.dp))
                        BrandPrimaryButton(
                            text = "Update Progress",
                            icon = AppIcon.UploadPhoto,
                            loading = vm.actionLoading,
                            loadingText = "Mengunggah...",
                            onClick = { showProgress = true },
                        )
                        Spacer(Modifier.height(8.dp))
                        // Web menonaktifkan Selesaikan bila belum ada progres.
                        val hasProgress = report.progressUpdatesCount > 0 ||
                            vm.progressList.isNotEmpty()
                        BrandSecondaryButton(
                            text = "Selesaikan Laporan",
                            icon = AppIcon.CheckCircle,
                            enabled = !vm.actionLoading && hasProgress,
                            onClick = { showSelesai = true },
                        )
                        if (!hasProgress) {
                            Spacer(Modifier.height(6.dp))
                            Text("Unggah minimal 1 progres sebelum menyelesaikan.",
                                color = TextMuted, fontSize = 12.sp)
                        }
                    }
                }
            }
        }
        if (canEdit || canDelete) {
            item(key = "manage") {
                DetailCard {
                    Text("Kelola Laporan", fontSize = 13.sp, fontWeight = FontWeight.SemiBold,
                        color = TextDark)
                    Spacer(Modifier.height(8.dp))
                    if (canEdit) {
                        BrandSecondaryButton(
                            text = "Edit Laporan",
                            icon = AppIcon.Edit,
                            enabled = !vm.actionLoading,
                            onClick = {
                                if (report.status == "Diedit") {
                                    editLockedByMe = false
                                    showEditForm = true
                                } else {
                                    vm.mulaiEdit(report.id) {
                                        editLockedByMe = true
                                        showEditForm = true
                                    }
                                }
                            },
                        )
                    }
                    if (canDelete) {
                        if (canEdit) Spacer(Modifier.height(8.dp))
                        TextButton(onClick = { showDeleteConfirm = true }) {
                            Icon(AppIcon.Delete, contentDescription = null,
                                tint = Color(0xFFDC2626), modifier = Modifier.size(18.dp))
                            Spacer(Modifier.width(6.dp))
                            Text("Hapus laporan ini", color = Color(0xFFDC2626), fontSize = 14.sp)
                        }
                    }
                }
            }
        }
    }

    if (showMulai && report.id == vm.detail?.id) {
        MulaiDialog(
            loading = vm.actionLoading,
            onDismiss = { showMulai = false },
            onConfirm = { estimasi, catatan ->
                vm.mulai(report.id, estimasi, catatan)
                showMulai = false
            },
        )
    }
    if (showProgress && report.id == vm.detail?.id) {
        ProgressDialog(
            vm = vm,
            onDismiss = { showProgress = false },
            onConfirm = { foto, catatan ->
                vm.kirimProgress(report.id, foto, catatan)
                showProgress = false
            },
        )
    }
    if (showSelesai && report.id == vm.detail?.id) {
        SelesaiDialog(
            vm = vm,
            onDismiss = { showSelesai = false },
            onConfirm = { foto, catatan ->
                vm.selesaikan(report.id, foto, catatan)
                showSelesai = false
            },
        )
    }
    if (showEditForm && report.id == vm.detail?.id) {
        EditFormDialog(
            report = report,
            loading = vm.actionLoading,
            onDismiss = {
                showEditForm = false
                if (editLockedByMe) {
                    editLockedByMe = false
                    vm.batalEdit(report.id)
                }
            },
            onSave = { body ->
                vm.simpanEdit(report.id, body)
                showEditForm = false
                editLockedByMe = false
            },
        )
    }
    if (showDeleteConfirm && report.id == vm.detail?.id) {
        AlertDialog(
            onDismissRequest = { showDeleteConfirm = false },
            title = { Text("Hapus Laporan?", fontWeight = FontWeight.Bold, color = TextDark) },
            text = {
                Text("Laporan ${report.reportCode ?: ""} dihapus permanen beserta fotonya. Tindakan ini tidak dapat dibatalkan.",
                    fontSize = 14.sp, color = TextDark)
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        showDeleteConfirm = false
                        vm.hapus(report.id) { onBack() }
                    },
                    enabled = !vm.actionLoading,
                ) { Text("Hapus", color = Color(0xFFDC2626), fontWeight = FontWeight.Bold) }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteConfirm = false }) {
                    Text("Batal", color = TextMuted)
                }
            },
        )
    }
}

/** Dialog Mulai Pengerjaan — estimasi opsional 1-90 hari + catatan opsional ≤500. */
@Composable
private fun MulaiDialog(
    loading: Boolean,
    onDismiss: () -> Unit,
    onConfirm: (estimasiHari: Int?, catatan: String?) -> Unit,
) {
    var estimasi by remember { mutableStateOf("") }
    var catatan by remember { mutableStateOf("") }
    val estimasiInt = estimasi.toIntOrNull()
    val estimasiValid = estimasi.isBlank() || (estimasiInt != null && estimasiInt in 1..90)
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Mulai Pengerjaan", fontWeight = FontWeight.Bold, color = TextDark) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("Status laporan berubah menjadi “Sedang Diperbaiki”.",
                    fontSize = 14.sp, color = TextDark)
                FieldLabel("Estimasi selesai (hari, opsional)")
                BrandTextField(
                    value = estimasi,
                    onValueChange = { if (it.length <= 2 && it.all(Char::isDigit)) estimasi = it },
                    placeholder = " Mis. 3 (kosong = akhir hari)",
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    isError = !estimasiValid,
                )
                if (!estimasiValid) {
                    Text("Isi 1–90 atau kosongkan.", color = Color(0xFFDC2626), fontSize = 12.sp)
                }
                FieldLabel("Catatan (opsional, maks 500)")
                BrandTextField(
                    value = catatan,
                    onValueChange = { if (it.length <= 500) catatan = it },
                    placeholder = "Catatan awal pengerjaan",
                    singleLine = false,
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    onConfirm(
                        estimasiInt?.takeIf { it in 1..90 },
                        catatan.takeIf { it.isNotBlank() },
                    )
                },
                enabled = estimasiValid && !loading,
            ) { Text("Mulai", color = BrandBlue, fontWeight = FontWeight.Bold) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Batal", color = TextMuted) } },
    )
}

/** Dialog Update Progress — 1 foto galeri (validasi tanggal EXIF) + catatan. */
@Composable
private fun ProgressDialog(
    vm: DashboardViewModel,
    onDismiss: () -> Unit,
    onConfirm: (foto: java.io.File, catatan: String?) -> Unit,
) {
    val context = LocalContext.current
    var picked by remember { mutableStateOf<Uri?>(null) }
    var catatan by remember { mutableStateOf("") }
    var preparing by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val singleLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.PickVisualMedia(),
    ) { uri: Uri? -> if (uri != null) picked = uri }
    val pickSingle = rememberGalleryPickerLauncher {
        singleLauncher.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
    }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Update Progress", fontWeight = FontWeight.Bold, color = TextDark) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                if (picked == null) {
                    BrandSecondaryButton(
                        text = "Pilih Foto Progres",
                        icon = AppIcon.Gallery,
                        onClick = pickSingle,
                    )
                    Text("Foto maksimal 2 hari terakhir (aturan EXIF server).",
                        fontSize = 12.sp, color = TextMuted)
                } else {
                    AsyncImage(
                        model = picked,
                        contentDescription = "Foto progres",
                        contentScale = ContentScale.Crop,
                        modifier = Modifier
                            .fillMaxWidth()
                            .aspectRatio(4f / 3f)
                            .clip(RoundedCornerShape(8.dp))
                            .background(Color(0xFFE8F0FA)),
                    )
                    TextButton(onClick = pickSingle) { Text("Ganti foto", color = BrandBlue) }
                }
                FieldLabel("Catatan (opsional, maks 1000)")
                BrandTextField(
                    value = catatan,
                    onValueChange = { if (it.length <= 1000) catatan = it },
                    placeholder = "Kondisi pengerjaan hari ini",
                    singleLine = false,
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    val uri = picked ?: return@TextButton
                    preparing = true
                    // Validasi EXIF + kompres di IO (pola LaporViewModel).
                    scope.launch(Dispatchers.IO) {
                        val file = vm.siapkanFoto(context, uri, checkDate = true)
                        withContext(Dispatchers.Main) {
                            preparing = false
                            if (file != null) onConfirm(file, catatan.takeIf { it.isNotBlank() })
                        }
                    }
                },
                enabled = picked != null && !preparing && !vm.actionLoading,
            ) { Text(if (preparing) "Memproses..." else "Kirim", color = BrandBlue, fontWeight = FontWeight.Bold) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Batal", color = TextMuted) } },
    )
}

/** Dialog Selesaikan — ≥1 foto after + catatan (tanpa field material/volume). */
@Composable
private fun SelesaiDialog(
    vm: DashboardViewModel,
    onDismiss: () -> Unit,
    onConfirm: (foto: List<java.io.File>, catatan: String?) -> Unit,
) {
    val context = LocalContext.current
    var picked by remember { mutableStateOf<List<Uri>>(emptyList()) }
    var catatan by remember { mutableStateOf("") }
    var preparing by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val multiLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.PickMultipleVisualMedia(5),
    ) { uris: List<Uri> -> if (uris.isNotEmpty()) picked = (picked + uris).take(5) }
    val pickMulti = rememberGalleryPickerLauncher {
        multiLauncher.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
    }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Selesaikan Laporan", fontWeight = FontWeight.Bold, color = TextDark) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("Unggah foto sesudah perbaikan. Status menjadi “Selesai”.",
                    fontSize = 14.sp, color = TextDark)
                BrandSecondaryButton(
                    text = "Pilih Foto After (${picked.size}/5)",
                    icon = AppIcon.AddPhoto,
                    onClick = pickMulti,
                )
                if (picked.isNotEmpty()) {
                    TextButton(onClick = { picked = emptyList() }) {
                        Text("Hapus semua", color = Color(0xFFDC2626))
                    }
                }
                FieldLabel("Catatan (opsional, maks 1000)")
                BrandTextField(
                    value = catatan,
                    onValueChange = { if (it.length <= 1000) catatan = it },
                    placeholder = "Hasil akhir perbaikan",
                    singleLine = false,
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    if (picked.isEmpty()) return@TextButton
                    preparing = true
                    scope.launch(Dispatchers.IO) {
                        // Foto after: tanpa cek tanggal (server tidak memvalidasi).
                        val files = picked.mapNotNull { vm.siapkanFoto(context, it, checkDate = false) }
                        withContext(Dispatchers.Main) {
                            preparing = false
                            if (files.isNotEmpty()) onConfirm(files, catatan.takeIf { it.isNotBlank() })
                        }
                    }
                },
                enabled = picked.isNotEmpty() && !preparing && !vm.actionLoading,
            ) { Text(if (preparing) "Memproses..." else "Selesaikan", color = BrandBlue, fontWeight = FontWeight.Bold) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Batal", color = TextMuted) } },
    )
}

/**
 * Form edit draft — field sederhana (catatan, jalan, kecamatan, dimensi total).
 * Tanpa ubah dimensi per-foto (kontrak PUT: angka top-level wajib non-null).
 */
@Composable
private fun EditFormDialog(
    report: ReportItemDto,
    loading: Boolean,
    onDismiss: () -> Unit,
    onSave: (com.jalankita.app.core.network.UpdateReportRequest) -> Unit,
) {
    var catatan by remember(report.id) { mutableStateOf(report.description ?: "") }
    var roadName by remember(report.id) { mutableStateOf(report.roadName ?: "") }
    var district by remember(report.id) { mutableStateOf(report.district ?: "") }
    var panjang by remember(report.id) {
        mutableStateOf(report.kerusakanPanjang?.toString() ?: "")
    }
    var lebar by remember(report.id) {
        mutableStateOf(report.kerusakanLebar?.toString() ?: "")
    }
    val panjangNum = panjang.replace(',', '.').toDoubleOrNull()
    val lebarNum = lebar.replace(',', '.').toDoubleOrNull()
    val angkaValid = panjangNum != null && panjangNum >= 0 &&
        lebarNum != null && lebarNum >= 0
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Edit Laporan", fontWeight = FontWeight.Bold, color = TextDark) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("Perubahan dikirim untuk review ulang supervisor.",
                    fontSize = 14.sp, color = TextDark)
                FieldLabel("Nama jalan")
                BrandTextField(
                    value = roadName,
                    onValueChange = { if (it.length <= 255) roadName = it },
                    placeholder = "Nama jalan",
                )
                FieldLabel("Kecamatan")
                BrandTextField(
                    value = district,
                    onValueChange = { if (it.length <= 100) district = it },
                    placeholder = "Kecamatan",
                )
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Column(Modifier.weight(1f)) {
                        FieldLabel("Panjang (m)")
                        BrandTextField(
                            value = panjang,
                            onValueChange = {
                                if (it.length <= 10 && it.all { c -> c.isDigit() || c == '.' || c == ',' }) panjang = it
                            },
                            placeholder = "0",
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                            isError = panjangNum == null || panjangNum < 0,
                        )
                    }
                    Column(Modifier.weight(1f)) {
                        FieldLabel("Lebar (m)")
                        BrandTextField(
                            value = lebar,
                            onValueChange = {
                                if (it.length <= 10 && it.all { c -> c.isDigit() || c == '.' || c == ',' }) lebar = it
                            },
                            placeholder = "0",
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                            isError = lebarNum == null || lebarNum < 0,
                        )
                    }
                }
                if (!angkaValid) {
                    Text("Panjang dan lebar wajib diisi angka ≥ 0.",
                        color = Color(0xFFDC2626), fontSize = 12.sp)
                }
                FieldLabel("Catatan (maks 1000)")
                BrandTextField(
                    value = catatan,
                    onValueChange = { if (it.length <= 1000) catatan = it },
                    placeholder = "Catatan laporan",
                    singleLine = false,
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    onSave(
                        com.jalankita.app.core.network.UpdateReportRequest(
                            catatan = catatan.takeIf { it.isNotBlank() },
                            roadName = roadName.takeIf { it.isNotBlank() },
                            district = district.takeIf { it.isNotBlank() },
                            kerusakanPanjang = panjangNum ?: return@TextButton,
                            kerusakanLebar = lebarNum ?: return@TextButton,
                        ),
                    )
                },
                enabled = angkaValid && !loading,
            ) { Text("Simpan", color = BrandBlue, fontWeight = FontWeight.Bold) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Batal", color = TextMuted) } },
    )
}

/** Baris timeline progres: foto + badge hari + pengirim + catatan. */
@Composable
private fun ProgressRow(p: ProgressItemDto) {
    DetailCard {
        Row {
            val url = ImageUrl.resolve(p.fotoUrl)
            if (url != null) {
                AsyncImage(
                    model = url,
                    contentDescription = "Foto progres",
                    contentScale = ContentScale.Crop,
                    modifier = Modifier
                        .size(72.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(Color(0xFFE8F0FA)),
                )
                Spacer(Modifier.width(12.dp))
            }
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    p.dayNumber?.let {
                        Text("Hari $it", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = BrandBlue)
                        Spacer(Modifier.width(6.dp))
                    }
                    p.userName?.let { Text(it, fontSize = 12.sp, color = TextMuted) }
                }
                p.createdAt?.let { Text(formatDateShort(it), fontSize = 12.sp, color = TextMuted) }
                p.catatan?.takeIf { it.isNotBlank() }?.let {
                    Spacer(Modifier.height(4.dp))
                    Text(it, fontSize = 14.sp, color = TextDark)
                }
            }
        }
    }
}

@Composable
private fun DetailCard(content: @Composable () -> Unit) {
    val shape = RoundedCornerShape(12.dp)
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(Color.White)
            .padding(16.dp),
    ) {
        content()
    }
}

@Composable
private fun DetailRow(label: String, value: String) {
    Row(modifier = Modifier.fillMaxWidth()) {
        Text(label, color = TextMuted, fontSize = 13.sp, modifier = Modifier.width(110.dp))
        Text(value, color = TextDark, fontSize = 14.sp, modifier = Modifier.weight(1f))
    }
    Spacer(Modifier.height(6.dp))
}
