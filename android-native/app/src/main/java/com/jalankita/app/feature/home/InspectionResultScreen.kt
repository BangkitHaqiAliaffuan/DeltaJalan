package com.jalankita.app.feature.home

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
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.jalankita.app.ui.components.AppIcon
import com.jalankita.app.ui.components.BrandPrimaryButton
import com.jalankita.app.ui.components.safeContentPadding
import com.jalankita.app.ui.rememberGalleryPickerLauncher
import com.jalankita.app.ui.theme.BorderInput
import com.jalankita.app.ui.theme.BrandBlue
import com.jalankita.app.ui.theme.ErrorRed
import com.jalankita.app.ui.theme.TextDark
import com.jalankita.app.ui.theme.TextMuted

@Composable
fun InspectionResultScreen(
    vm: InspectionResultViewModel,
    assignmentId: String,
    sessionId: String? = null,
    onBack: () -> Unit,
    onSubmitted: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    // SAF (OpenMultipleDocuments) menjaga EXIF GPS utuh di Android 13+, sama seperti alur LaporScreen
    val safLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.OpenMultipleDocuments(),
    ) { uris: List<Uri> -> if (uris.isNotEmpty()) vm.addPhotos(context, uris) }

    val galleryLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.PickMultipleVisualMedia(5),
    ) { uris: List<Uri> -> if (uris.isNotEmpty()) vm.addPhotos(context, uris) }

    val openPicker = rememberGalleryPickerLauncher {
        try {
            safLauncher.launch(arrayOf("image/jpeg", "image/png"))
        } catch (_: Exception) {
            galleryLauncher.launch(
                PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly),
            )
        }
    }

    LaunchedEffect(assignmentId) { vm.prepare(assignmentId) }
    LaunchedEffect(vm.submitted) { if (vm.submitted != null) onSubmitted() }

    // Tata letak: konten form DIGULIR, tombol Kirim MENEMPEL di bawah.
    //
    // Memakai Box + tombol `align(BottomCenter)`, BUKAN Column bersarang
    // `weight(1f)`. Column bersarang terbukti meluap: pada perangkat 720x1448
    // isi kolom butuh 1486px, sehingga tombol 44dp terpotong menjadi 39px dan
    // labelnya terbelah di tepi bawah layar (diukur dengan uiautomator dump).
    // Dengan Box, tombol diukur memakai constraint longgar sehingga selalu
    // mendapat 44dp penuh, dan area gulir menyisihkan ruangnya lewat
    // `padding(bottom = 56.dp)` (44dp tombol + 12dp jarak).
    //
    // Inset sistem dipasang di root (layar ini di luar Scaffold), plus imePadding
    // agar tombol tidak tertutup keyboard saat petugas mengetik catatan.
    Box(
        modifier = modifier
            .fillMaxSize()
            .background(Color(0xFFF8FAFC))
            .safeContentPadding(withIme = true)
            .padding(16.dp),
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(bottom = 56.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("Form Hasil Inspeksi", color = TextDark, fontSize = 18.sp, fontWeight = FontWeight.Bold)
            OutlinedButton(onClick = onBack) { Text("Kembali") }
        }

        Text(
            "Bukti foto inspeksi disimpan terpisah dari bukti laporan warga untuk menjaga integritas data.",
            color = TextMuted,
            fontSize = 13.sp,
        )

        // Foto bukti inspeksi
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .background(Color.White)
                .border(1.dp, Color(0xFFE2E8F0), RoundedCornerShape(12.dp))
                .padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Foto Bukti Lapangan *", color = TextDark, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.width(8.dp))
                Text("(${vm.evidence.size}/5)", color = TextMuted, fontSize = 12.sp)
            }

            if (vm.evidence.isNotEmpty()) {
                LazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    itemsIndexed(vm.evidence) { index, item ->
                        Box(
                            modifier = Modifier
                                .size(110.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .border(1.dp, Color(0xFFCBD5E1), RoundedCornerShape(8.dp)),
                        ) {
                            AsyncImage(
                                model = item.uri,
                                contentDescription = "Bukti inspeksi ${index + 1}",
                                contentScale = ContentScale.Crop,
                                modifier = Modifier.fillMaxSize(),
                            )
                            Box(
                                modifier = Modifier
                                    .align(Alignment.TopEnd)
                                    .padding(4.dp)
                                    .size(24.dp)
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(Color.Black.copy(alpha = 0.65f))
                                    .clickable { vm.removePhoto(index) },
                                contentAlignment = Alignment.Center,
                            ) {
                                Icon(AppIcon.Close, contentDescription = "Hapus", tint = Color.White, modifier = Modifier.size(16.dp))
                            }
                        }
                    }
                }
            }

            if (vm.canAddMore) {
                OutlinedButton(
                    onClick = openPicker,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Icon(AppIcon.Camera, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text(if (vm.evidence.isEmpty()) "Pilih Foto Lapangan (Wajib GPS & EXIF)" else "Tambah Foto Lain")
                }
            }

            // Petunjuk syarat minimal. Tanpa ini, form dengan catatan terisi
            // tapi tanpa foto menampilkan tombol mati tanpa alasan yang terlihat.
            if (vm.evidence.isEmpty()) {
                Text(
                    "Minimal 1 foto wajib agar tombol kirim aktif.",
                    color = ErrorRed,
                    fontSize = 11.sp,
                )
            }

            // ── Galat validasi foto ──────────────────────────────────────
            // Ditempatkan DI DALAM kartu foto, bukan di dasar layar. Alasan
            // penolakan (mis. foto kedaluwarsa / GPS hilang) hanya masuk akal
            // bila terbaca tepat di tempat petugas memilih foto.
            vm.photoError?.let { pesan ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .background(Color(0xFFFEF2F2))
                        .border(1.dp, Color(0xFFFCA5A5), RoundedCornerShape(8.dp))
                        .padding(10.dp),
                    verticalAlignment = Alignment.Top,
                ) {
                    Icon(
                        AppIcon.Warning,
                        contentDescription = null,
                        tint = ErrorRed,
                        modifier = Modifier.size(16.dp),
                    )
                    Spacer(Modifier.width(8.dp))
                    Column {
                        Text(pesan, color = ErrorRed, fontSize = 12.sp)
                        Spacer(Modifier.height(4.dp))
                        Text(
                            "Pilih foto lain yang diambil maksimal 2 hari terakhir.",
                            color = TextMuted,
                            fontSize = 11.sp,
                        )
                    }
                }
            }
        }

        // ── Catatan pemeriksaan (WAJIB) ──────────────────────────────────
        // Ditaruh TEPAT SETELAH foto, bukan di dasar form. Sebelumnya field
        // wajib ini berada paling bawah setelah 6 field opsional, sehingga
        // petugas mengisi semua yang terlihat di layar, tombol Kirim tetap
        // mati, dan tidak ada petunjuk apa yang kurang. Terbukti dari dump UI
        // perangkat: field ini tidak pernah muncul di layar tanpa scroll.
        OutlinedTextField(
            value = vm.notes,
            onValueChange = { vm.notes = it },
            label = { Text("Catatan Hasil Pemeriksaan *") },
            placeholder = { Text("Uraikan hasil pengecekan di lokasi...") },
            modifier = Modifier.fillMaxWidth(),
            minLines = 3,
            supportingText = if (vm.notes.isBlank()) {
                { Text("Wajib diisi agar tombol kirim aktif.", color = ErrorRed, fontSize = 11.sp) }
            } else {
                null
            },
        )

        // Field kondisi teknis
        OutlinedTextField(
            value = vm.condition,
            onValueChange = { vm.condition = it },
            label = { Text("Kondisi Teknis (opsional)") },
            placeholder = { Text("Contoh: Rusak Ringan, Rusak Sedang, Lubang 50cm") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
        )

        // ── Dimensi hasil ukur (meter) ─────────────────────────────────────
        // Opsional dengan sengaja: petugas yang tidak membawa meteran lebih
        // baik mengosongkan daripada mengarang angka. Nilai kosong ditampilkan
        // sebagai "tidak diukur" di layar review supervisor.
        Text(
            "Dimensi Kerusakan (meter, opsional)",
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            color = TextDark,
        )
        // Panjang & Lebar sebaris; Kedalaman DI BARIS SENDIRI.
        // Sebelumnya ketiganya dibagi rata dalam satu baris, sehingga label
        // "Kedalaman" (9 huruf) terpotong atau terlipat di layar sempit —
        // sementara "Panjang"/"Lebar" muat. Satuan "m" ditaruh sebagai suffix
        // supaya tidak perlu diulang di placeholder.
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(
                value = vm.kerusakanPanjang,
                onValueChange = { vm.kerusakanPanjang = it },
                label = { Text("Panjang") },
                suffix = { Text("m") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                modifier = Modifier.weight(1f),
                singleLine = true,
            )
            OutlinedTextField(
                value = vm.kerusakanLebar,
                onValueChange = { vm.kerusakanLebar = it },
                label = { Text("Lebar") },
                suffix = { Text("m") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                modifier = Modifier.weight(1f),
                singleLine = true,
            )
        }
        OutlinedTextField(
            value = vm.kerusakanKedalaman,
            onValueChange = { vm.kerusakanKedalaman = it },
            label = { Text("Kedalaman") },
            suffix = { Text("m") },
            supportingText = { Text("Kosongkan bila kedalaman tidak diukur.") },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
        )

        // ── Karakteristik lokasi ──────────────────────────────────────────
        // Dua pilihan tetap, bukan teks bebas, karena nilainya dipakai mesin:
        // jenis perkerasan menentukan material perbaikan, kepadatan lalu
        // lintas menentukan prioritas penanganan (lihat KEPADATAN_KE_PRIORITAS
        // di backend). Keduanya opsional — petugas yang ragu boleh melewati.
        PilihanLokasi(
            judul = "Jenis Perkerasan",
            keterangan = "Menentukan material perbaikan.",
            nilai = listOf(
                "aspal" to "Aspal",
                "beton" to "Beton",
                "paving" to "Paving Block",
                "kerikil_tanah" to "Kerikil / Tanah",
            ),
            terpilih = vm.jenisPerkerasan,
            onPilih = { vm.jenisPerkerasan = if (vm.jenisPerkerasan == it) null else it },
        )
        PilihanLokasi(
            judul = "Kepadatan Lalu Lintas",
            keterangan = "Menentukan prioritas penanganan.",
            nilai = listOf(
                "sepi" to "Sepi",
                "sedang" to "Sedang",
                "padat" to "Padat",
            ),
            terpilih = vm.kepadatanLaluLintas,
            onPilih = { vm.kepadatanLaluLintas = if (vm.kepadatanLaluLintas == it) null else it },
        )

            vm.error?.let {
                Text(it, color = ErrorRed, fontSize = 13.sp)
            }
        }

        BrandPrimaryButton(
            "Kirim Hasil Inspeksi",
            onClick = { vm.submit(assignmentId, sessionId) },
            enabled = vm.isValid && !vm.loading,
            loading = vm.loading,
            loadingText = "Mengirim hasil...",
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth(),
        )
    }
}

@Composable
fun DiscoveredReportScreen(
    vm: InspectionResultViewModel,
    sessionId: String,
    onBack: () -> Unit,
    onSubmitted: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val safSingleLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.OpenDocument(),
    ) { uri -> if (uri != null) vm.addPhotos(context, listOf(uri), discovered = true) }

    val gallerySingleLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.PickVisualMedia(),
    ) { uri -> if (uri != null) vm.addPhotos(context, listOf(uri), discovered = true) }

    val openPicker = rememberGalleryPickerLauncher {
        try {
            safSingleLauncher.launch(arrayOf("image/jpeg", "image/png"))
        } catch (_: Exception) {
            gallerySingleLauncher.launch(
                PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly),
            )
        }
    }

    LaunchedEffect(sessionId) { vm.prepareDiscovered(sessionId) }
    LaunchedEffect(vm.submitted) { if (vm.submitted != null) onSubmitted() }

    // Sama seperti form inspeksi: Box + tombol overlay, supaya tombol Kirim
    // tidak pernah terpotong bila isi form lebih tinggi dari layar.
    Box(
        modifier = modifier
            .fillMaxSize()
            .background(Color(0xFFF8FAFC))
            .safeContentPadding(withIme = true)
            .padding(16.dp),
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(bottom = 56.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("Temuan Lapangan Baru", color = TextDark, fontSize = 18.sp, fontWeight = FontWeight.Bold)
            OutlinedButton(onClick = onBack) { Text("Kembali") }
        }

        Text(
            "Laporan dibuat langsung dari sesi patroli aktif. Sumber otomatis tercatat sebagai petugas.",
            color = TextMuted,
            fontSize = 13.sp,
        )

        OutlinedTextField(
            value = vm.roadName,
            onValueChange = { vm.roadName = it },
            label = { Text("Nama Jalan *") },
            placeholder = { Text("Masukkan nama jalan temuan") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
        )

        OutlinedTextField(
            value = vm.district,
            onValueChange = { vm.district = it },
            label = { Text("Kecamatan *") },
            placeholder = { Text("Contoh: Sidoarjo, Waru, Candi") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
        )

        // Foto temuan
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .background(Color.White)
                .border(1.dp, Color(0xFFE2E8F0), RoundedCornerShape(12.dp))
                .padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text("Foto Temuan Kerusakan *", color = TextDark, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
            if (vm.evidence.isNotEmpty()) {
                val item = vm.evidence.first()
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(180.dp)
                        .clip(RoundedCornerShape(8.dp)),
                ) {
                    AsyncImage(
                        model = item.uri,
                        contentDescription = "Foto temuan",
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize(),
                    )
                }
            }
            OutlinedButton(onClick = openPicker, modifier = Modifier.fillMaxWidth()) {
                Icon(AppIcon.Camera, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text(if (vm.evidence.isEmpty()) "Pilih Foto Temuan (Wajib GPS)" else "Ganti Foto Temuan")
            }

            // Sama seperti form inspeksi: alasan penolakan foto tampil di sini,
            // bukan di dasar layar yang tidak terbaca.
            vm.photoError?.let { pesan ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .background(Color(0xFFFEF2F2))
                        .border(1.dp, Color(0xFFFCA5A5), RoundedCornerShape(8.dp))
                        .padding(10.dp),
                    verticalAlignment = Alignment.Top,
                ) {
                    Icon(
                        AppIcon.Warning,
                        contentDescription = null,
                        tint = ErrorRed,
                        modifier = Modifier.size(16.dp),
                    )
                    Spacer(Modifier.width(8.dp))
                    Text(pesan, color = ErrorRed, fontSize = 12.sp)
                }
            }
        }

        OutlinedTextField(
            value = vm.notes,
            onValueChange = { vm.notes = it },
            label = { Text("Deskripsi Kerusakan *") },
            placeholder = { Text("Deskripsikan kondisi kerusakan jalan yang ditemukan...") },
            modifier = Modifier.fillMaxWidth(),
            minLines = 3,
        )

        vm.error?.let {
            Text(it, color = ErrorRed, fontSize = 13.sp)
        }

        Spacer(Modifier.height(4.dp))
        }

        BrandPrimaryButton(
            "Kirim Temuan Lapangan",
            onClick = { vm.submitDiscovered(sessionId) },
            enabled = vm.discoveredValid && !vm.loading,
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth(),
        )
    }
}

/**
 * Pemilih satu-dari-beberapa untuk karakteristik lokasi inspeksi.
 *
 * Mengetuk pilihan yang sedang aktif akan membatalkannya (null), sehingga
 * petugas bisa mengembalikan ke "belum dicatat" tanpa tombol tambahan.
 */
@Composable
private fun PilihanLokasi(
    judul: String,
    keterangan: String,
    nilai: List<Pair<String, String>>,
    terpilih: String?,
    onPilih: (String) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(judul, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = TextDark)
        Text(keterangan, fontSize = 11.sp, color = TextMuted)
        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.horizontalScroll(rememberScrollState()),
        ) {
            nilai.forEach { (kunci, label) ->
                PilihanChip(label, terpilih == kunci) { onPilih(kunci) }
            }
        }
    }
}

/** Chip pilihan; tampilan mengikuti FilterChip pada layar supervisor. */
@Composable
private fun PilihanChip(label: String, aktif: Boolean, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(if (aktif) BrandBlue else Color.White)
            .border(
                width = 1.dp,
                color = if (aktif) BrandBlue else BorderInput,
                shape = RoundedCornerShape(999.dp),
            )
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 8.dp),
    ) {
        Text(
            label,
            color = if (aktif) Color.White else TextMuted,
            fontSize = 12.sp,
            fontWeight = if (aktif) FontWeight.SemiBold else FontWeight.Normal,
        )
    }
}
