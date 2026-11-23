package com.jalankita.app.feature.queue

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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.jalankita.app.core.data.outbox.QueuePolicy
import com.jalankita.app.core.data.outbox.QueuedSubmission
import com.jalankita.app.ui.components.AppIcon
import com.jalankita.app.ui.components.InsetSafe
import com.jalankita.app.ui.components.JkDialog
import com.jalankita.app.ui.components.safeContentPadding
import com.jalankita.app.ui.theme.BorderInput
import com.jalankita.app.ui.theme.BrandBlue
import com.jalankita.app.ui.theme.DividerLine
import com.jalankita.app.ui.theme.ErrorBg
import com.jalankita.app.ui.theme.ErrorBorder
import com.jalankita.app.ui.theme.ErrorRed
import com.jalankita.app.ui.theme.InfoBg
import com.jalankita.app.ui.theme.InfoBlue
import com.jalankita.app.ui.theme.SuccessGreen
import com.jalankita.app.ui.theme.TextDark
import com.jalankita.app.ui.theme.TextHint
import com.jalankita.app.ui.theme.TextMuted
import com.jalankita.app.ui.theme.WarningAmber
import com.jalankita.app.ui.theme.WarningBg
import com.jalankita.app.ui.theme.WarningBorder
import java.io.File

/**
 * Layar Antrean Kirim. Satu layar untuk semua role — warga (laporan) dan
 * petugas (hasil inspeksi/temuan). Item menampilkan alasan gagal dari server,
 * jumlah percobaan, dan sisa waktu sebelum foto kedaluwarsa, lalu pengguna
 * bisa kirim sekarang / kirim ulang / batalkan.
 */
@Composable
fun QueueScreen(
    vm: QueueViewModel,
    onBack: () -> Unit,
) {
    val items by vm.semua.collectAsState()
    val menunggu = items.filter { !it.isFailed }
    val gagal = items.filter { it.isFailed }
    var akanDihapus by remember { mutableStateOf<QueuedSubmission?>(null) }

    Column(
        Modifier
            .fillMaxSize()
            .background(Color(0xFFF5F7FA))
            .safeContentPadding(),
    ) {
        // ── Top bar ──────────────────────────────────────────────────────
        Row(
            Modifier
                .fillMaxWidth()
                .background(Color.White)
                .padding(horizontal = 12.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                Modifier
                    .size(40.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .clickable(onClick = onBack),
                contentAlignment = Alignment.Center,
            ) {
                Icon(AppIcon.ArrowBack, contentDescription = "Kembali", tint = TextDark)
            }
            Spacer(Modifier.width(4.dp))
            Text(
                "Antrean Kirim",
                fontSize = 18.sp,
                fontWeight = FontWeight.SemiBold,
                color = TextDark,
            )
        }
        HorizontalDivider(color = DividerLine)

        if (items.isEmpty()) {
            KosongState()
            return@Column
        }

        LazyColumn(
            Modifier.fillMaxSize(),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item {
                Ringkasan(
                    menunggu = menunggu.size,
                    gagal = gagal.size,
                    onKirimSemua = { vm.kirimUlang(null) },
                )
            }

            if (menunggu.isNotEmpty()) {
                item { JudulSeksi("Menunggu dikirim", menunggu.size) }
                items(menunggu, key = { "m-${it.id}" }) { item ->
                    KartuAntrean(
                        item = item,
                        onKirim = { vm.kirimUlang(item.id) },
                        onBatalkan = { akanDihapus = item },
                    )
                }
            }

            if (gagal.isNotEmpty()) {
                item { JudulSeksi("Gagal terkirim", gagal.size) }
                items(gagal, key = { "g-${it.id}" }) { item ->
                    KartuAntrean(
                        item = item,
                        onKirim = { vm.kirimUlang(item.id) },
                        onBatalkan = { akanDihapus = item },
                    )
                }
            }

            item {
                Text(
                    "Kiriman dikirim otomatis saat internet tersedia. " +
                        "Foto laporan warga berlaku 7 hari, bukti inspeksi 2 hari sejak foto diambil.",
                    fontSize = 12.sp,
                    color = TextHint,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
        }
    }

    akanDihapus?.let { target ->
        JkDialog(
            title = "Batalkan kiriman?",
            onDismissRequest = { akanDihapus = null },
            primaryLabel = "Batalkan Kiriman",
            onPrimary = {
                vm.batalkan(target.id)
                akanDihapus = null
            },
            subtitle = "Data dan fotonya akan dihapus dari perangkat dan tidak akan dikirim. " +
                "Tindakan ini tidak bisa dibatalkan.",
            secondaryLabel = "Tidak",
            primaryColor = ErrorRed,
        )
    }
}

/** Banner ringkas untuk Beranda — hanya tampil bila ada item menunggu. */
@Composable
fun QueueBanner(
    jumlah: Int,
    gagal: Int,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    if (jumlah <= 0 && gagal <= 0) return
    Row(
        modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(if (gagal > 0) WarningBg else InfoBg)
            .border(
                1.dp,
                if (gagal > 0) WarningBorder else BorderInput.copy(alpha = 0.4f),
                RoundedCornerShape(12.dp),
            )
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            if (gagal > 0) AppIcon.Warning else AppIcon.PendingActions,
            contentDescription = null,
            tint = if (gagal > 0) WarningAmber else InfoBlue,
            modifier = Modifier.size(18.dp),
        )
        Spacer(Modifier.width(8.dp))
        Text(
            text = buildString {
                append("$jumlah kiriman menunggu dikirim")
                if (gagal > 0) append(" · $gagal gagal")
            },
            fontSize = 13.sp,
            fontWeight = FontWeight.Medium,
            color = if (gagal > 0) WarningAmber else InfoBlue,
            modifier = Modifier.weight(1f),
        )
        Text("Lihat", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = BrandBlue)
        Icon(
            AppIcon.ChevronRight,
            contentDescription = null,
            tint = BrandBlue,
            modifier = Modifier.size(16.dp),
        )
    }
}

// ── Bagian layar ─────────────────────────────────────────────────────────

@Composable
private fun Ringkasan(menunggu: Int, gagal: Int, onKirimSemua: () -> Unit) {
    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(Color.White)
            .padding(14.dp),
    ) {
        Text(
            when {
                menunggu > 0 && gagal > 0 -> "$menunggu menunggu · $gagal gagal"
                menunggu > 0 -> "$menunggu kiriman menunggu dikirim"
                else -> "$gagal kiriman gagal dikirim"
            },
            fontSize = 15.sp,
            fontWeight = FontWeight.SemiBold,
            color = TextDark,
        )
        if (menunggu > 0) {
            Spacer(Modifier.height(10.dp))
            Row(
                Modifier
                    .clip(RoundedCornerShape(10.dp))
                    .background(BrandBlue)
                    .clickable(onClick = onKirimSemua)
                    .padding(horizontal = 14.dp, vertical = 9.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(AppIcon.UploadPhoto, contentDescription = null, tint = Color.White, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(6.dp))
                Text("Kirim semua sekarang", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = Color.White)
            }
        }
    }
}

@Composable
private fun JudulSeksi(judul: String, jumlah: Int) {
    Text(
        "$judul ($jumlah)",
        fontSize = 13.sp,
        fontWeight = FontWeight.SemiBold,
        color = TextMuted,
        modifier = Modifier.padding(top = 4.dp),
    )
}

@Composable
private fun KartuAntrean(
    item: QueuedSubmission,
    onKirim: () -> Unit,
    onBatalkan: () -> Unit,
) {
    val foto = item.photoPaths.firstOrNull()?.let(::File)?.takeIf { it.exists() }
    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(Color.White)
            .padding(12.dp),
    ) {
        Row(verticalAlignment = Alignment.Top) {
            Box(
                Modifier
                    .size(64.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(Color(0xFFEFF3F8)),
                contentAlignment = Alignment.Center,
            ) {
                if (foto != null) {
                    AsyncImage(
                        model = foto,
                        contentDescription = null,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize(),
                    )
                } else {
                    Icon(AppIcon.Error, contentDescription = null, tint = TextHint, modifier = Modifier.size(20.dp))
                }
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        QueueFormat.jenis(item),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = InfoBlue,
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(InfoBg)
                            .padding(horizontal = 6.dp, vertical = 2.dp),
                    )
                    if (item.isFailed) {
                        Spacer(Modifier.width(6.dp))
                        Text(
                            if (item.status == QueuedSubmission.STATUS_EXPIRED) "Kedaluwarsa" else "Gagal",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = ErrorRed,
                            modifier = Modifier
                                .clip(RoundedCornerShape(6.dp))
                                .background(ErrorBg)
                                .padding(horizontal = 6.dp, vertical = 2.dp),
                        )
                    }
                }
                Spacer(Modifier.height(4.dp))
                Text(
                    item.roadName?.takeIf { it.isNotBlank() } ?: "Lokasi laporan",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = TextDark,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                val lokasi = QueueFormat.lokasiDanUmur(item)
                if (lokasi.isNotBlank()) {
                    Text(lokasi, fontSize = 12.sp, color = TextMuted, maxLines = 1)
                }
                Text(
                    "Percobaan ${item.attempts}/${QueuePolicy.MAX_ATTEMPTS} · foto ${QueuePolicy.remainingLabel(item.remainingMillis())}",
                    fontSize = 12.sp,
                    color = TextHint,
                    maxLines = 1,
                )
            }
        }

        val alasan = item.lastError?.takeIf { it.isNotBlank() }
        if (alasan != null) {
            Spacer(Modifier.height(10.dp))
            Row(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(10.dp))
                    .background(if (item.isFailed) ErrorBg else WarningBg)
                    .border(
                        1.dp,
                        if (item.isFailed) ErrorBorder else WarningBorder,
                        RoundedCornerShape(10.dp),
                    )
                    .padding(10.dp),
                verticalAlignment = Alignment.Top,
            ) {
                Icon(
                    AppIcon.Info,
                    contentDescription = null,
                    tint = if (item.isFailed) ErrorRed else WarningAmber,
                    modifier = Modifier.size(14.dp),
                )
                Spacer(Modifier.width(6.dp))
                Text(
                    alasan,
                    fontSize = 12.sp,
                    color = if (item.isFailed) ErrorRed else WarningAmber,
                )
            }
        }

        Spacer(Modifier.height(10.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            if (item.status != QueuedSubmission.STATUS_EXPIRED) {
                Tombol(
                    teks = if (item.isFailed) "Kirim ulang" else "Kirim sekarang",
                    utama = true,
                    onClick = onKirim,
                )
            }
            Tombol(teks = "Hapus", utama = false, onClick = onBatalkan)
        }

        if (item.status == QueuedSubmission.STATUS_WAITING_QUOTA) {
            Spacer(Modifier.height(8.dp))
            Text(
                "Menunggu kuota harian. Dikirim otomatis setelah tengah malam.",
                fontSize = 12.sp,
                color = SuccessGreen,
            )
        }
    }
}

@Composable
private fun Tombol(teks: String, utama: Boolean, onClick: () -> Unit) {
    val latar = if (utama) BrandBlue else Color.White
    val isi = if (utama) Color.White else TextMuted
    Box(
        Modifier
            .clip(RoundedCornerShape(10.dp))
            .background(latar)
            .border(1.dp, if (utama) BrandBlue else BorderInput, RoundedCornerShape(10.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 8.dp),
    ) {
        Text(teks, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = isi)
    }
}

@Composable
private fun KosongState() {
    Column(
        Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Icon(AppIcon.CheckCircle, contentDescription = null, tint = SuccessGreen, modifier = Modifier.size(48.dp))
        Spacer(Modifier.height(12.dp))
        Text("Semua terkirim", fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = TextDark)
        Spacer(Modifier.height(6.dp))
        Text(
            "Tidak ada kiriman yang tertunda di perangkat ini.",
            fontSize = 13.sp,
            color = TextMuted,
        )
    }
}
