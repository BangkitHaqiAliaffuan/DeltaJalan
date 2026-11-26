package com.jalankita.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import coil.compose.AsyncImage
import com.jalankita.app.core.util.ImageUrl

/**
 * Penampil foto layar penuh dengan geser antar foto dan cubit-zoom.
 *
 * Kenapa ada: semua layar menampilkan foto berukuran kecil (72–260 dp). Pada
 * pekerjaan jalan, detail yang menentukan justru retak halus dan tepi lubang —
 * tidak terbaca di thumbnail. Sebelumnya hanya "Foto Setelah Perbaikan" yang
 * punya lightbox lokal tanpa zoom; sekarang seluruh aplikasi memakai satu
 * komponen ini supaya perilakunya seragam.
 *
 * Sengaja tanpa pustaka pihak ketiga: kebutuhan hanya geser, cubit, dan tutup.
 *
 * @param urls daftar URL (boleh berupa path `/storage/...` — diresolusi di sini).
 * @param initialIndex foto yang dibuka lebih dulu (indeks yang diketuk).
 * @param onDismiss dipanggil saat tombol Tutup atau back ditekan.
 */
@Composable
fun PhotoViewerDialog(
    urls: List<String>,
    initialIndex: Int = 0,
    onDismiss: () -> Unit,
) {
    val bersih = urls.filter { it.isNotBlank() }
    if (bersih.isEmpty()) return

    val pagerState = rememberPagerState(
        initialPage = initialIndex.coerceIn(0, bersih.lastIndex),
        pageCount = { bersih.size },
    )

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(
            usePlatformDefaultWidth = false,
            decorFitsSystemWindows = false,
        ),
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Black),
        ) {
            HorizontalPager(
                state = pagerState,
                modifier = Modifier.fillMaxSize(),
            ) { halaman ->
                ZoomablePhoto(
                    url = bersih[halaman],
                    modifier = Modifier.fillMaxSize(),
                )
            }

            // Penghitung di atas: pengguna harus tahu masih ada foto lain.
            if (bersih.size > 1) {
                Text(
                    "${pagerState.currentPage + 1}/${bersih.size}",
                    color = Color.White,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier
                        .align(Alignment.TopCenter)
                        .statusBarsPadding()
                        .padding(top = 10.dp)
                        .background(Color.Black.copy(alpha = 0.45f), RoundedCornerShape(50))
                        .padding(horizontal = 12.dp, vertical = 5.dp),
                )
            }

            Column(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .navigationBarsPadding()
                    .padding(16.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text(
                    "Cubit untuk memperbesar · geser untuk foto lain",
                    color = Color.White.copy(alpha = 0.75f),
                    fontSize = 11.sp,
                )
                Text(
                    "Tutup",
                    color = Color.White,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier
                        .clickable(onClick = onDismiss)
                        .background(Color.White.copy(alpha = 0.16f), RoundedCornerShape(50))
                        .padding(horizontal = 28.dp, vertical = 10.dp),
                )
            }
        }
    }
}

/**
 * Satu halaman foto: cubit-zoom 1x–5x + geser saat sudah diperbesar.
 *
 * State di-key pada [url] supaya foto berikutnya tidak mewarisi zoom/posisi foto
 * sebelumnya — perilaku yang membingungkan saat membandingkan beberapa foto.
 */
@Composable
private fun ZoomablePhoto(url: String, modifier: Modifier = Modifier) {
    val src = ImageUrl.resolve(url) ?: return
    var skala by remember(url) { mutableFloatStateOf(1f) }
    var geser by remember(url) { mutableStateOf(Offset.Zero) }

    Box(
        modifier = modifier.pointerInput(url) {
            detectTransformGestures { _, pan, zoom, _ ->
                val baru = (skala * zoom).coerceIn(1f, 5f)
                skala = baru
                geser = if (baru <= 1.01f) {
                    Offset.Zero
                } else {
                    // Batasi pergeseran agar foto tidak hilang dari layar.
                    val batasX = size.width * (baru - 1f) / 2f
                    val batasY = size.height * (baru - 1f) / 2f
                    Offset(
                        x = (geser.x + pan.x).coerceIn(-batasX, batasX),
                        y = (geser.y + pan.y).coerceIn(-batasY, batasY),
                    )
                }
            }
        },
        contentAlignment = Alignment.Center,
    ) {
        AsyncImage(
            model = src,
            contentDescription = "Foto laporan layar penuh",
            modifier = Modifier
                .fillMaxSize()
                .graphicsLayer(
                    scaleX = skala,
                    scaleY = skala,
                    translationX = geser.x,
                    translationY = geser.y,
                ),
            contentScale = ContentScale.Fit,
        )
    }
}
