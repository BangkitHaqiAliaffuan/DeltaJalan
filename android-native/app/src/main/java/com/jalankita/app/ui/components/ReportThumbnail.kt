package com.jalankita.app.ui.components

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import coil.compose.SubcomposeAsyncImage
import coil.request.ImageRequest
import com.jalankita.app.core.util.ImageUrl
import com.jalankita.app.ui.theme.ThumbBg

/**
 * Thumbnail kartu laporan — satu komponen untuk petugas, supervisor, dan warga.
 *
 * Kenapa ada: `AsyncImage` telanjang hanya menampilkan latar abu-abu selama byte
 * belum datang, sehingga terlihat seperti gambar yang "baru muncul setelah scroll".
 * Di sini:
 * - `SubcomposeAsyncImage` memberi state loading (shimmer) dan error/kosong (ikon kamera);
 * - `size(720, 540)` membatasi byte yang didekode (foto original bisa 2–3 MB);
 * - cache header diabaikan lewat ImageLoader global (`DeltaJalanApplication`:
 *   `respectCacheHeaders(false)`) karena `/storage/` tidak mengirim `Cache-Control`
 *   (`scripts/deltajalan.nginx.conf`). Opsi itu hanya ada di `ImageLoader.Builder`,
 *   jadi tidak diulang per request.
 *
 * Pemanggil memberi ukuran lewat [modifier] (biasanya
 * `Modifier.fillMaxWidth().aspectRatio(4f / 3f)`).
 */
@Composable
fun ReportThumbnail(
    url: String?,
    contentDescription: String?,
    modifier: Modifier = Modifier,
) {
    val resolved = ImageUrl.resolve(url)
    val shape = RoundedCornerShape(8.dp)
    Box(
        modifier = modifier
            .clip(shape)
            .background(ThumbBg),
        contentAlignment = Alignment.Center,
    ) {
        if (resolved == null) {
            ThumbFallback()
        } else {
            SubcomposeAsyncImage(
                model = ImageRequest.Builder(LocalContext.current)
                    .data(resolved)
                    .size(720, 540)
                    .crossfade(180)
                    .build(),
                contentDescription = contentDescription,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize(),
                loading = { ThumbShimmer() },
                error = { ThumbFallback() },
            )
        }
    }
}

/** Ikon kamera saat url kosong atau byte gagal diunduh. */
@Composable
private fun ThumbFallback() {
    Icon(
        imageVector = AppIcon.Camera,
        contentDescription = null,
        tint = Color(0xFFC4D4E6),
        modifier = Modifier.size(40.dp),
    )
}

/** Kilau horizontal saat thumbnail masih diunduh. */
@Composable
private fun ThumbShimmer() {
    val transition = rememberInfiniteTransition(label = "thumb")
    val shift by transition.animateFloat(
        initialValue = 0f,
        targetValue = 1200f,
        animationSpec = infiniteRepeatable(
            animation = tween(1100, easing = LinearEasing),
            repeatMode = RepeatMode.Restart,
        ),
        label = "thumb-shift",
    )
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.linearGradient(
                    colors = listOf(ThumbBg, Color(0xFFF6FAFE), ThumbBg),
                    start = Offset(shift - 600f, 0f),
                    end = Offset(shift, 600f),
                ),
            ),
    )
}
