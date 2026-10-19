package com.jalankita.app.feature.warga

import android.content.Intent
import android.net.Uri
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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import kotlinx.coroutines.launch
import com.jalankita.app.core.network.TimelineDto
import com.jalankita.app.core.network.WargaDetailReport
import com.jalankita.app.core.util.ImageUrl
import com.jalankita.app.feature.home.components.SectionHeader
import com.jalankita.app.feature.home.components.SkeletonCard
import com.jalankita.app.feature.home.components.StatusBadge
import com.jalankita.app.feature.home.components.formatDateShort
import com.jalankita.app.feature.home.components.monospace
import com.jalankita.app.feature.home.components.statusLabel
import com.jalankita.app.ui.components.AppIcon
import com.jalankita.app.ui.components.BeforeAfterSlider
import com.jalankita.app.ui.components.BrandPrimaryButton
import com.jalankita.app.ui.components.BrandTextField
import com.jalankita.app.ui.components.ErrorBox
import com.jalankita.app.ui.theme.BrandBlue
import com.jalankita.app.ui.theme.DividerLine
import com.jalankita.app.ui.theme.PillShape
import com.jalankita.app.ui.theme.StarAmber
import com.jalankita.app.ui.theme.StarIdle
import com.jalankita.app.ui.theme.TextDark
import com.jalankita.app.ui.theme.TextMuted
import com.jalankita.app.ui.theme.ThumbBg

/**
 * Detail laporan warga read-only + timeline + rating.
 * Replikasi warga/laporan/$id (rating hanya bila Selesai & belum dinilai).
 */
@Composable
fun WargaDetailScreen(
    reportId: String,
    vm: WargaViewModel,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    LaunchedEffect(reportId) { vm.loadDetail(reportId) }
    val context = LocalContext.current
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
                onBack()
            }) {
                Icon(AppIcon.ArrowBack, contentDescription = "Kembali", tint = TextDark)
            }
            Text("Detail Laporan", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = TextDark)
            Spacer(Modifier.weight(1f))
            // Bagikan — 2-tier cermin $id.tsx: ACTION_SEND berisi URL
            // https://delta-jalan.vercel.app/laporan/{kode} (tier-1/2 web),
            // fallback salin ke clipboard + toast (tier-3 web).
            vm.detail?.report?.let { r ->
                IconButton(onClick = {
                    val url = "https://delta-jalan.vercel.app/laporan/${r.reportCode ?: ""}"
                    val text = buildString {
                        append("Laporan ${r.reportCode ?: ""}")
                        r.roadName?.let { append(": $it") }
                        r.district?.let { append(" (Kec. $it)") }
                        r.status?.let { append(" — Status: $it") }
                        append("\n$url")
                    }
                    try {
                        context.startActivity(
                            Intent.createChooser(
                                Intent(Intent.ACTION_SEND).apply {
                                    type = "text/plain"
                                    putExtra(Intent.EXTRA_TEXT, text)
                                },
                                "Bagikan laporan",
                            ),
                        )
                    } catch (_: Exception) {
                        val cm = context.getSystemService(android.content.ClipboardManager::class.java)
                        cm?.setPrimaryClip(android.content.ClipData.newPlainText("laporan", url))
                        android.widget.Toast.makeText(context, "Link laporan disalin!", android.widget.Toast.LENGTH_SHORT).show()
                    }
                }) {
                    Icon(AppIcon.Share, contentDescription = "Bagikan", tint = TextDark)
                }
            }
        }
        if (vm.detailLoading && vm.detail == null) {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                items(4) { SkeletonCard() }
            }
        } else {
            val data = vm.detail
            if (data?.report == null) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(16.dp),
                    verticalArrangement = Arrangement.Center,
                ) {
                    ErrorBox("Gagal memuat detail laporan.")
                    Spacer(Modifier.height(12.dp))
                    BrandPrimaryButton(
                        text = "Coba Lagi",
                        onClick = { vm.loadDetail(reportId) },
                    )
                }
            } else {
                WargaDetailBody(
                    report = data.report,
                    timeline = data.timeline.orEmpty(),
                    ratingBusy = vm.ratingBusy,
                    onRate = { stars, comment -> vm.submitRating(reportId, stars, comment) },
                )
            }
        }
    }
}

@Composable
private fun WargaDetailBody(
    report: WargaDetailReport,
    timeline: List<TimelineDto>,
    ratingBusy: Boolean,
    onRate: (Int, String) -> Unit,
) {
    var stars by remember(report.id) { mutableStateOf(report.rating ?: 0) }
    var comment by remember(report.id) { mutableStateOf(report.ratingComment.orEmpty()) }
    var showAi by remember(report.id) { mutableStateOf(false) }
    val rated = report.ratedAt != null
    val context = LocalContext.current

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        val hasAiPhoto = report.imageResultUrl != null
        val urls = buildList {
            if (showAi && hasAiPhoto) {
                ImageUrl.resolve(report.imageResultUrl)?.let { add(it) }
            } else {
                report.photos?.mapNotNullTo(this) { ImageUrl.resolve(it.displayUrl) }
                ImageUrl.resolve(
                    report.imageOriginalUrl ?: report.firstPhotoUrl,
                )?.let { if (it !in this) add(it) }
            }
        }
        if (hasAiPhoto) {
            item(key = "photo-toggle") {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    PhotoModeChip("Asli", !showAi) { showAi = false }
                    PhotoModeChip("Hasil AI", showAi) { showAi = true }
                }
            }
        }
        if (urls.isNotEmpty()) {
            item(key = "gallery") {
                PhotoCarousel(urls = urls, contentDescription = report.roadName)
            }
        }
        item(key = "head") {
            DetailCard {
                report.reportCode?.let {
                    Text(it, color = TextMuted, fontSize = 12.sp, fontFamily = monospace())
                }
                Text(
                    text = report.roadName ?: "Nama jalan belum diisi",
                    fontSize = 20.sp, fontWeight = FontWeight.Bold, color = TextDark,
                )
                Spacer(Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    StatusBadge(raw = report.effectiveSeverity)
                    StatusBadge(raw = report.status, labelOverride = statusLabel(report.status))
                }
            }
        }
        item(key = "meta") {
            DetailCard {
                report.district?.let { DetailRow("Kecamatan", "Kec. $it") }
                report.fullAddress?.takeIf { it.isNotBlank() }?.let {
                    DetailRow("Alamat", it)
                }
                report.createdAt?.let { DetailRow("Dilaporkan", formatDateShort(it)) }
                report.assignedTeamName?.let { DetailRow("Tim", it) }
                val dims = listOfNotNull(
                    report.kerusakanPanjang?.let { "P $it m" },
                    report.kerusakanLebar?.let { "L $it m" },
                ).joinToString(" × ")
                if (dims.isNotEmpty()) DetailRow("Dimensi", dims)
                val lat = report.latitude
                val lng = report.longitude
                if (lat != null && lng != null) {
                    DetailRow("Koordinat", "$lat, $lng")
                    Text(
                        text = "Buka di Google Maps →",
                        fontSize = 13.sp, fontWeight = FontWeight.SemiBold,
                        color = Color(0xFF1E40AF),
                        modifier = Modifier.clickable {
                            context.startActivity(
                                Intent(
                                    Intent.ACTION_VIEW,
                                    Uri.parse(
                                        "https://www.google.com/maps/search/?api=1&query=$lat,$lng",
                                    ),
                                ),
                            )
                        },
                    )
                }
            }
        }
        report.pciScore?.let { score ->
            item(key = "pci") {
                DetailCard {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = "PCI ${score.toInt()}",
                            fontSize = 16.sp, fontWeight = FontWeight.Bold,
                            color = pciColor(score), modifier = Modifier.weight(1f),
                        )
                        Text(
                            text = pciLabel(score),
                            fontSize = 13.sp, fontWeight = FontWeight.SemiBold,
                            color = pciColor(score),
                        )
                    }
                    Spacer(Modifier.height(4.dp))
                    Text(
                        "Indeks kondisi jalan (0–100, makin tinggi makin baik).",
                        fontSize = 12.sp, color = TextMuted,
                    )
                }
            }
        }
        report.description?.takeIf { it.isNotBlank() }?.let { desc ->
            item(key = "desc") {
                DetailCard {
                    Text("Catatan", fontSize = 13.sp, fontWeight = FontWeight.SemiBold,
                        color = TextDark)
                    Spacer(Modifier.height(4.dp))
                    Text(desc, fontSize = 14.sp, color = TextDark)
                }
            }
        }
        val afterUrls = report.afterPhotos?.mapNotNull { ImageUrl.resolve(it.displayUrl) }
            .orEmpty()
        val beforeUrl = report.photos?.firstOrNull()?.displayUrl ?: report.imageOriginalUrl ?: report.firstPhotoUrl
        if (afterUrls.isNotEmpty()) {
            item(key = "after-h") {
                SectionHeader(icon = AppIcon.Gallery, title = "Foto Sesudah Perbaikan")
            }
            if (beforeUrl != null) {
                item(key = "before-after-slider") {
                    Column(Modifier.fillMaxWidth().padding(bottom = 8.dp)) {
                        Text(
                            "Perbandingan Sebelum & Sesudah (Geser garis pembagi)",
                            fontSize = 12.sp, color = TextMuted, modifier = Modifier.padding(bottom = 6.dp)
                        )
                        BeforeAfterSlider(
                            beforeUrl = beforeUrl,
                            afterUrl = afterUrls.first(),
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }
                }
            }
            items(afterUrls, key = { "after-$it" }) { url ->
                AsyncImage(
                    model = url,
                    contentDescription = "Foto sesudah perbaikan",
                    contentScale = ContentScale.Crop,
                    modifier = Modifier
                        .fillMaxWidth()
                        .aspectRatio(4f / 3f)
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color(0xFFE8F0FA)),
                )
            }
        }
        val updates = report.progressUpdates.orEmpty()
        if (updates.isNotEmpty()) {
            item(key = "prog-h") {
                SectionHeader(icon = AppIcon.Construction, title = "Perkembangan Perbaikan")
            }
            items(updates, key = { "prog-${it.id ?: it.createdAt}" }) { u ->
                DetailCard {
                    Row {
                        Text(
                            text = "Hari ke-${u.dayNumber}",
                            fontSize = 13.sp, fontWeight = FontWeight.SemiBold,
                            color = TextDark, modifier = Modifier.weight(1f),
                        )
                        u.createdAt?.let {
                            Text(formatDateShort(it), color = TextMuted, fontSize = 12.sp)
                        }
                    }
                    u.userName?.takeIf { it.isNotBlank() }?.let {
                        Text(it, color = TextMuted, fontSize = 12.sp)
                    }
                    u.catatan?.takeIf { it.isNotBlank() }?.let {
                        Spacer(Modifier.height(4.dp))
                        Text(it, fontSize = 13.sp, color = TextDark)
                    }
                    ImageUrl.resolve(u.fotoUrl)?.let { url ->
                        Spacer(Modifier.height(8.dp))
                        AsyncImage(
                            model = url,
                            contentDescription = "Foto progres hari ke-${u.dayNumber}",
                            contentScale = ContentScale.Crop,
                            modifier = Modifier
                                .fillMaxWidth()
                                .aspectRatio(4f / 3f)
                                .clip(RoundedCornerShape(12.dp))
                                .background(Color(0xFFE8F0FA)),
                        )
                    }
                }
            }
        }
        if (timeline.isNotEmpty()) {
            item(key = "tl-h") {
                SectionHeader(icon = AppIcon.PendingActions, title = "Riwayat Status")
            }
            items(timeline.size, key = { "tl-${timeline[it].createdAt}-${timeline[it].newStatus}" }) { idx ->
                val t = timeline[idx]
                val isLast = idx == timeline.lastIndex
                Row {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Box(
                            modifier = Modifier
                                .padding(top = 6.dp)
                                .size(8.dp)
                                .clip(CircleShape)
                                .background(if (isLast) BrandBlue else DividerLine),
                        )
                        // Garis penghubung antar-titik (tinggi tetap agar aman di LazyColumn).
                        if (!isLast) {
                            Spacer(Modifier.height(8.dp))
                            Box(
                                modifier = Modifier
                                    .width(1.dp)
                                    .height(56.dp)
                                    .background(DividerLine),
                            )
                        }
                    }
                    Spacer(Modifier.width(12.dp))
                    DetailCard {
                        Text(
                            text = statusLabel(t.newStatus),
                            fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = TextDark,
                        )
                        Row {
                            Text(
                                text = listOfNotNull(t.actorName, t.actorRole)
                                    .joinToString(" • "),
                                color = TextMuted, fontSize = 12.sp,
                                modifier = Modifier.weight(1f),
                            )
                            t.createdAt?.let {
                                Text(formatDateShort(it), color = TextMuted, fontSize = 12.sp)
                            }
                        }
                        t.notes?.takeIf { it.isNotBlank() }?.let {
                            Spacer(Modifier.height(4.dp))
                            Text(it, fontSize = 13.sp, color = TextDark)
                        }
                    }
                }
            }
        }
        if (report.canRate || rated) {
            item(key = "rating") {
                DetailCard {
                    Text(
                        text = if (rated) "Penilaian Anda" else "Beri Penilaian",
                        fontSize = 14.sp, fontWeight = FontWeight.Bold, color = TextDark,
                    )
                    Spacer(Modifier.height(8.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        for (i in 1..5) {
                            val active = i <= stars
                            Icon(
                                imageVector = if (active) AppIcon.Star else AppIcon.StarOutline,
                                contentDescription = "Beri $i bintang",
                                tint = if (active) StarAmber else StarIdle,
                                modifier = Modifier
                                    .clip(RoundedCornerShape(8.dp))
                                    .clickable(
                                        enabled = !rated && !ratingBusy,
                                        role = Role.Button,
                                    ) { stars = i }
                                    .padding(4.dp)
                                    .size(26.dp),
                            )
                        }
                    }
                    if (!rated) {
                        Spacer(Modifier.height(8.dp))
                        BrandTextField(
                            value = comment,
                            onValueChange = { if (it.length <= 500) comment = it },
                            placeholder = "Komentar (opsional, maks 500)",
                            singleLine = false,
                        )
                        Spacer(Modifier.height(8.dp))
                        BrandPrimaryButton(
                            text = "Kirim Penilaian",
                            onClick = { onRate(stars, comment) },
                            loading = ratingBusy,
                            loadingText = "Menyimpan…",
                            enabled = stars in 1..5,
                        )
                    } else if (report.ratingComment?.isNotBlank() == true) {
                        Spacer(Modifier.height(4.dp))
                        Text(report.ratingComment, fontSize = 13.sp, color = TextMuted)
                    }
                }
            }
        }
    }
}

@Composable
private fun PhotoCarousel(urls: List<String>, contentDescription: String?) {
    val pagerState = androidx.compose.foundation.pager.rememberPagerState(
        pageCount = { urls.size },
    )
    val scope = androidx.compose.runtime.rememberCoroutineScope()
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .aspectRatio(4f / 3f)
            .clip(RoundedCornerShape(12.dp))
            .background(ThumbBg),
    ) {
        androidx.compose.foundation.pager.HorizontalPager(
            state = pagerState,
            modifier = Modifier.fillMaxSize(),
        ) { page ->
            AsyncImage(
                model = urls[page],
                contentDescription = contentDescription,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize(),
            )
        }
        if (urls.size > 1) {
            // Counter ala web (bg-black/50 rounded-full).
            Text(
                text = "${pagerState.currentPage + 1}/${urls.size}",
                fontSize = 11.sp, color = Color.White,
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(bottom = 8.dp)
                    .clip(PillShape)
                    .background(Color.Black.copy(alpha = 0.5f))
                    .padding(horizontal = 10.dp, vertical = 4.dp),
            )
            // Panah kiri/kanan.
            androidx.compose.material3.IconButton(
                onClick = {
                    scope.launch {
                        pagerState.animateScrollToPage(
                            (pagerState.currentPage - 1 + urls.size) % urls.size,
                        )
                    }
                },
                modifier = Modifier
                    .align(Alignment.CenterStart)
                    .padding(start = 8.dp)
                    .clip(CircleShape)
                    .background(Color.Black.copy(alpha = 0.4f)),
            ) {
                Icon(
                    AppIcon.ChevronRight,
                    contentDescription = "Sebelumnya",
                    tint = Color.White,
                    modifier = Modifier.graphicsLayer(rotationZ = 180f),
                )
            }
            androidx.compose.material3.IconButton(
                onClick = {
                    scope.launch {
                        pagerState.animateScrollToPage(
                            (pagerState.currentPage + 1) % urls.size,
                        )
                    }
                },
                modifier = Modifier
                    .align(Alignment.CenterEnd)
                    .padding(end = 8.dp)
                    .clip(CircleShape)
                    .background(Color.Black.copy(alpha = 0.4f)),
            ) {
                Icon(
                    AppIcon.ChevronRight,
                    contentDescription = "Berikutnya",
                    tint = Color.White,
                )
            }
        }
    }
}

@Composable
private fun PhotoModeChip(label: String, active: Boolean, onClick: () -> Unit) {
    Text(
        text = label,
        fontSize = 13.sp, fontWeight = FontWeight.SemiBold,
        color = if (active) Color.White else TextDark,
        modifier = Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(if (active) Color(0xFF1E40AF) else Color(0xFFF1F5F9))
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 8.dp),
    )
}

/** Label kondisi PCI — port CONDITION_MAP Frontend-stable/src/lib/pci.ts. */
private fun pciLabel(score: Double): String = when {
    score >= 86 -> "Baik"
    score >= 71 -> "Rusak Ringan"
    score >= 56 -> "Rusak Sedang"
    score >= 41 -> "Rusak Berat"
    else -> "Kritis"
}

private fun pciColor(score: Double): Color = when {
    score >= 86 -> Color(0xFF16A34A)
    score >= 71 -> Color(0xFF15803D)
    score >= 56 -> Color(0xFFCA8A04)
    score >= 41 -> Color(0xFFEA580C)
    else -> Color(0xFFDC2626)
}
@Composable
private fun DetailCard(content: @Composable () -> Unit) {
    val shape = RoundedCornerShape(12.dp)
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .shadow(2.dp, shape)
            .clip(shape)
            .background(Color.White)
            .border(1.dp, DividerLine, shape)
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
