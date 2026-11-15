package com.jalankita.app.ui.components

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.platform.LocalContext
import coil.imageLoader
import coil.request.ImageRequest
import com.jalankita.app.core.util.ImageUrl

/** Ukuran yang sama dengan [ReportThumbnail] supaya hasil prefetch kena memori/disk cache. */
private const val PREFETCH_WIDTH = 720
private const val PREFETCH_HEIGHT = 540

/**
 * Unduh [count] thumbnail pertama di latar belakang.
 *
 * `LazyColumn` hanya meng-compose item yang terlihat, jadi kartu yang baru masuk
 * viewport saat scroll baru mulai mengunduh saat itu juga. Memanaskan sebagian
 * kecil daftar di awal membuat thumbnail sudah tersedia sebelum item terlihat.
 */
fun prefetchThumbnails(context: Context, urls: List<String?>, count: Int = 5) {
    val loader = context.imageLoader
    urls.asSequence()
        .mapNotNull { ImageUrl.resolve(it) }
        .distinct()
        .take(count)
        .forEach { url ->
            loader.enqueue(
                ImageRequest.Builder(context)
                    .data(url)
                    .size(PREFETCH_WIDTH, PREFETCH_HEIGHT)
                    .build(),
            )
        }
}

/** Versi composable — dipanggil sekali per perubahan daftar. */
@Composable
fun PrefetchThumbnails(urls: List<String?>, count: Int = 5) {
    val context = LocalContext.current
    LaunchedEffect(urls) {
        prefetchThumbnails(context, urls, count)
    }
}
