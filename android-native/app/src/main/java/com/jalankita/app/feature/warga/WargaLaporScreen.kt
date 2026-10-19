package com.jalankita.app.feature.warga

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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.jalankita.app.core.network.UserDto
import com.jalankita.app.feature.lapor.components.FraudModal
import com.jalankita.app.feature.lapor.components.KecamatanDropdown
import com.jalankita.app.ui.components.AppIcon
import com.jalankita.app.ui.components.BrandPrimaryButton
import com.jalankita.app.ui.components.BrandSecondaryButton
import com.jalankita.app.ui.components.BrandTextField
import com.jalankita.app.ui.components.DuplicateWarningCard
import com.jalankita.app.ui.components.ErrorBox
import com.jalankita.app.ui.components.FieldLabel
import com.jalankita.app.ui.components.InfoBox
import com.jalankita.app.ui.components.RoadAutocompleteField
import com.jalankita.app.ui.components.SuccessBox
import com.jalankita.app.ui.components.WarningBox
import com.jalankita.app.ui.rememberGalleryPickerLauncher
import com.jalankita.app.ui.theme.BorderInput
import com.jalankita.app.ui.theme.BrandBlue
import com.jalankita.app.ui.theme.BrandBlueLight
import com.jalankita.app.ui.theme.ErrorRed
import com.jalankita.app.ui.theme.ScreenBg
import com.jalankita.app.ui.theme.SuccessBg
import com.jalankita.app.ui.theme.SuccessGreen
import com.jalankita.app.ui.theme.TextDark
import com.jalankita.app.ui.theme.TextMuted
import com.jalankita.app.ui.theme.ThumbBg
import com.jalankita.app.ui.theme.WarningAmber

/**
 * Lapor warga — replikasi warga/lapor.tsx (mode Android disederhanakan):
 * maks 3 foto (galeri multi-pick) → validasi EXIF 7 hari + GPS Sidoarjo →
 * form → POST /warga/reports. TANPA langkah analisis AI (server auto-AI).
 */
@Composable
fun WargaLaporScreen(
    user: UserDto,
    vm: WargaViewModel,
    laporVm: WargaLaporViewModel,
    onBack: () -> Unit,
    onSuccess: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    // Sukses submit → layar hijau (sekali per submit).
    val saved = laporVm.savedReport
    LaunchedEffect(saved) {
        if (saved != null) onSuccess()
    }
    val singleLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.PickVisualMedia(),
    ) { uri: Uri? ->
        if (uri != null) laporVm.addPhotos(context, listOf(uri))
    }

    /**
     * DEFAULT: pemilih dokumen sistem (SAF, ACTION_OPEN_DOCUMENT). URI
     * media.documents mendukung setRequireOriginal + query kolom MediaStore
     * (rantai D/A/B ExifValidator) — tidak seperti Picker URI yang menolak
     * requireOriginal dan menyajikan stream ter-redact (logcat 10-01).
     * Dibatasi JPEG (satu-satunya format galeri ber-EXIF GPS). Gate izin
     * dipertahankan karena attempt A mensyaratkan ACCESS_MEDIA_LOCATION.
     */
    val safLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.OpenMultipleDocuments(),
    ) { uris: List<Uri> ->
        if (uris.isNotEmpty()) laporVm.addPhotos(context, uris)
    }
    val pickSaf = rememberGalleryPickerLauncher {
        safLauncher.launch(arrayOf("image/jpeg"))
    }

    // Minta izin ACCESS_MEDIA_LOCATION dulu agar GPS EXIF tidak di-redact.
    val pickSingle = rememberGalleryPickerLauncher {
        singleLauncher.launch(
            PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly),
        )
    }

    Column(modifier = modifier.fillMaxSize()) {
        // Header biru + kembali (gaya LaporScreen petugas).
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(Brush.horizontalGradient(listOf(BrandBlue, BrandBlueLight)))
                .padding(horizontal = 4.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack) {
                Icon(AppIcon.ArrowBack, contentDescription = "Kembali", tint = Color.White)
            }
            Text("Lapor Kerusakan", color = Color.White, fontSize = 18.sp,
                fontWeight = FontWeight.Bold)
            Spacer(Modifier.weight(1f))
            // Pil kuota live (port lapor.tsx:897-902 "Sisa X/5").
            vm.remaining?.let {
                Text("Sisa ${it.remaining}/${it.limit}",
                    color = Color.White.copy(alpha = 0.85f), fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(end = 12.dp))
            }
        }

        // Gate kuota — meniru blocked screen web (lapor.tsx:873-891).
        if (vm.remaining?.reached == true) {
            QuotaBlocked(
                remaining = vm.remaining?.remaining ?: 0,
                limit = vm.remaining?.limit ?: 5,
            )
            return@Column
        }

        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .background(ScreenBg),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item(key = "photos") {
                Text("Foto Kerusakan (${laporVm.photos.size}/$WARGA_MAX_PHOTOS)",
                    fontSize = 15.sp, fontWeight = FontWeight.Bold, color = TextDark)
                Spacer(Modifier.height(8.dp))
                if (laporVm.photos.isEmpty()) {
                    PhotoPlaceholder(
                        onGallery = { pickSaf() },
                        onCamera = {
                            // TODO Fase 5: CameraX (EXIF GPS asli). Sementara galeri.
                            pickSingle()
                        },
                    )
                } else {
                    laporVm.photos.forEachIndexed { i, photo ->
                        Box(modifier = Modifier.padding(bottom = 8.dp)) {
                            AsyncImage(
                                model = photo.uri,
                                contentDescription = "Foto ${i + 1}",
                                contentScale = ContentScale.Crop,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .aspectRatio(4f / 3f)
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(ThumbBg),
                            )
                            // Badge "Utama" foto pertama (port lapor.tsx grid preview).
                            if (i == 0) {
                                Text(
                                    text = "Utama",
                                    color = Color.White,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier
                                        .align(Alignment.TopStart)
                                        .padding(8.dp)
                                        .clip(RoundedCornerShape(6.dp))
                                        .background(BrandBlue)
                                        .padding(horizontal = 8.dp, vertical = 4.dp),
                                )
                            }
                            IconButton(
                                onClick = { laporVm.removePhoto(i) },
                                modifier = Modifier
                                    .align(Alignment.TopEnd)
                                    .padding(8.dp)
                                    .background(Color.Black.copy(alpha = 0.5f), CircleShape)
                                    .size(32.dp),
                            ) {
                                Icon(AppIcon.Delete, contentDescription = "Hapus",
                                    tint = Color.White, modifier = Modifier.size(18.dp))
                            }
                        }
                        Text(
                            text = "Foto ${i + 1} — GPS: %.5f, %.5f".format(photo.lat, photo.lng),
                            color = TextMuted, fontSize = 12.sp,
                            modifier = Modifier.padding(bottom = 8.dp),
                        )
                    }
                    if (laporVm.canAddMore) {
                        AddMoreButton(
                            left = WARGA_MAX_PHOTOS - laporVm.photos.size,
                            onClick = { pickSaf() },
                        )
                    }
                }
                if (laporVm.skippedCount > 0) {
                    Spacer(Modifier.height(4.dp))
                    WarningBox(
                        text = "${laporVm.skippedCount} foto dilewati " +
                            "(gagal validasi / di luar Sidoarjo).",
                    )
                }
            }

            laporVm.duplicateWarning?.let { w ->
                item(key = "dup-warning") {
                    DuplicateWarningCard(
                        warning = w,
                        onDismiss = { laporVm.dismissDuplicateWarning() },
                    )
                }
            }

            item(key = "form") {
                FieldLabel("Nama Pelapor")
                BrandTextField(
                    value = user.name, onValueChange = {}, placeholder = "",
                    enabled = false,
                )
                Spacer(Modifier.height(12.dp))
                FieldLabel("Nama Jalan *")
                RoadAutocompleteField(
                    value = laporVm.roadName,
                    onValueChange = { laporVm.onRoadQueryChange(it) },
                    suggestions = if (laporVm.roadNameLocked) emptyList() else laporVm.roadSuggestions,
                    loading = laporVm.roadSearchLoading,
                    enabled = !laporVm.roadNameLocked,
                    onPick = { laporVm.pickRoadSuggestion(it) },
                    placeholder = "cth. Jl. Raya Porong",
                )
                if (laporVm.geocoding) {
                    Spacer(Modifier.height(4.dp))
                    InfoBox(text = "Mengidentifikasi nama jalan dari lokasi foto…")
                } else if (laporVm.roadNameLocked) {
                    Spacer(Modifier.height(4.dp))
                    SuccessBox(
                        text = "Terisi otomatis dari GPS foto. Ubah hanya bila tidak sesuai.",
                    )
                }
                Spacer(Modifier.height(12.dp))
                FieldLabel("Kecamatan *")
                KecamatanDropdown(
                    selected = laporVm.district,
                    onSelect = { laporVm.district = it },
                )
                Spacer(Modifier.height(12.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Column(Modifier.weight(1f)) {
                        FieldLabel("Panjang (m) (opsional)")
                        BrandTextField(
                            value = laporVm.panjang,
                            onValueChange = { laporVm.panjang = it },
                            placeholder = "cth. 2.5",
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        )
                    }
                    Column(Modifier.weight(1f)) {
                        FieldLabel("Lebar (m) (opsional)")
                        BrandTextField(
                            value = laporVm.lebar,
                            onValueChange = { laporVm.lebar = it },
                            placeholder = "cth. 1.2",
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        )
                    }
                }
                Spacer(Modifier.height(12.dp))
                FieldLabel("Catatan (opsional)")
                BrandTextField(
                    value = laporVm.catatan, onValueChange = { laporVm.catatan = it },
                    placeholder = "Deskripsi tambahan…",
                    singleLine = false,
                )
                Spacer(Modifier.height(12.dp))
                FieldLabel("Alamat lengkap (opsional)")
                BrandTextField(
                    value = laporVm.fullAddress, onValueChange = { laporVm.fullAddress = it },
                    placeholder = "Patokan / alamat detail…",
                )
            }

            laporVm.error?.let { err ->
                item(key = "error") { ErrorBox(text = err) }
            }

            item(key = "submit") {
                BrandPrimaryButton(
                    text = "Kirim Laporan",
                    loading = laporVm.busy,
                    loadingText = "Mengirim…",
                    onClick = {
                        laporVm.clearError()
                        laporVm.submit(user.name)
                    },
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    text = "Maksimal ${vm.remaining?.limit ?: 5} laporan per hari.",
                    color = TextMuted, fontSize = 12.sp,
                )
            }
        }
    }

    FraudModal(alert = laporVm.fraudAlert, onDismiss = laporVm::dismissFraudAlert)

    if (laporVm.queuedOffline) {
        AlertDialog(
            onDismissRequest = {
                laporVm.reset()
                onBack()
            },
            title = {
                Text("Laporan Disimpan Offline", fontWeight = FontWeight.Bold, color = TextDark)
            },
            text = {
                Text(
                    "Koneksi internet tidak tersedia atau terputus. Laporan Anda telah tersimpan dengan aman di perangkat dan akan otomatis dikirim ke dinas saat koneksi internet kembali pulih.",
                    fontSize = 13.sp,
                    color = TextDark,
                )
            },
            confirmButton = {
                BrandPrimaryButton(
                    text = "Selesai",
                    onClick = {
                        laporVm.reset()
                        onBack()
                    },
                )
            },
        )
    }
}

@Composable
private fun PhotoPlaceholder(onGallery: () -> Unit, onCamera: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .aspectRatio(4f / 3f)
            .clip(RoundedCornerShape(12.dp))
            .background(Color.White)
            .dashedBorder(BorderInput)
            .clickable(onClick = onGallery)
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Icon(AppIcon.UploadPhoto, contentDescription = null, tint = BrandBlue,
            modifier = Modifier.size(48.dp))
        Spacer(Modifier.height(8.dp))
        Text("Ketuk untuk pilih foto (maks $WARGA_MAX_PHOTOS)", color = TextDark,
            fontSize = 14.sp, fontWeight = FontWeight.Medium)
        Text("Foto maksimal 7 hari terakhir & berlokasi Sidoarjo",
            color = TextMuted, fontSize = 12.sp)
        Spacer(Modifier.height(12.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            PickMiniButton("Galeri", AppIcon.Gallery, onGallery)
            PickMiniButton("Kamera", AppIcon.Camera, onCamera)
        }
    }
}

@Composable
private fun PickMiniButton(label: String, icon: androidx.compose.ui.graphics.vector.ImageVector, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(8.dp))
            .background(BrandBlue)
            .clickable(onClick = onClick)
            .padding(horizontal = 20.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, contentDescription = null, tint = Color.White, modifier = Modifier.size(18.dp))
        Spacer(Modifier.width(6.dp))
        Text(label, color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun AddMoreButton(left: Int, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(Color.White)
            .clickable(onClick = onClick)
            .padding(12.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(AppIcon.UploadPhoto, contentDescription = null, tint = BrandBlue,
            modifier = Modifier.size(20.dp))
        Spacer(Modifier.width(8.dp))
        Text("Tambah foto (sisa $left)", color = BrandBlue, fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold)
    }
}

/** Border putus-putus ala dropzone web (`border-2 border-dashed`). */
private fun Modifier.dashedBorder(
    color: Color,
    strokeWidth: Dp = 2.dp,
    cornerRadius: Dp = 12.dp,
): Modifier = this.drawBehind {
    val stroke = Stroke(
        width = strokeWidth.toPx(),
        pathEffect = PathEffect.dashPathEffect(floatArrayOf(14f, 10f)),
    )
    drawRoundRect(
        color = color,
        style = stroke,
        cornerRadius = CornerRadius(cornerRadius.toPx()),
    )
}

/** Layar blokir kuota — port lapor.tsx:873-891 (ikon hourglass amber web). */
@Composable
private fun QuotaBlocked(remaining: Int, limit: Int) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(ScreenBg)
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Box(
            modifier = Modifier
                .size(64.dp)
                .background(WarningAmber.copy(alpha = 0.15f), CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Icon(AppIcon.PendingActions, contentDescription = null, tint = WarningAmber,
                modifier = Modifier.size(32.dp))
        }
        Spacer(Modifier.height(16.dp))
        Text("Batas Harian Tercapai", fontSize = 18.sp, fontWeight = FontWeight.Bold,
            color = TextDark)
        Spacer(Modifier.height(8.dp))
        Text(
            text = "Maksimal $limit laporan per hari. Silakan coba lagi besok.\nSisa: $remaining / $limit laporan",
            color = TextMuted, fontSize = 14.sp,
        )
    }
}

/** Layar sukses hijau — pesan persis server (store():1346). */
@Composable
fun WargaSuksesScreen(
    laporVm: WargaLaporViewModel,
    onBeranda: () -> Unit,
    onRiwayat: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val saved = laporVm.savedReport
    Column(
        modifier = modifier
            .fillMaxSize()
            .background(ScreenBg)
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Box(
            modifier = Modifier
                .size(72.dp)
                .background(SuccessBg, CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Icon(AppIcon.CheckCircle, contentDescription = null, tint = SuccessGreen,
                modifier = Modifier.size(40.dp))
        }
        Spacer(Modifier.height(16.dp))
        Text("Laporan Terkirim", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = TextDark)
        Spacer(Modifier.height(8.dp))
        Text(
            text = "Laporan berhasil dikirim dan sedang menunggu verifikasi petugas.",
            color = TextMuted, fontSize = 14.sp,
        )
        if (saved != null && saved.totalPhotos > 0) {
            Spacer(Modifier.height(4.dp))
            Text("${saved.totalPhotos} foto terkirim.", color = TextMuted, fontSize = 13.sp)
        }
        laporVm.serverWarnings.forEach { w ->
            Spacer(Modifier.height(8.dp))
            WarningBox(text = w)
        }
        Spacer(Modifier.height(24.dp))
        BrandPrimaryButton(text = "Kembali ke Beranda", onClick = onBeranda)
        Spacer(Modifier.height(8.dp))
        BrandSecondaryButton(text = "Lihat Riwayat", onClick = onRiwayat)
    }
}
