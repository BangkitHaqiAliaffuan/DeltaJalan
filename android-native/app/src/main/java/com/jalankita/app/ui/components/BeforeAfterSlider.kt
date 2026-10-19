package com.jalankita.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.jalankita.app.core.util.ImageUrl
import com.jalankita.app.ui.theme.BrandBlue
import kotlin.math.roundToInt

/**
 * Slider perbandingan sebelum/sesudah: geser handle untuk menyibak foto "sesudah"
 * di atas foto "sebelum". Hanya render bila kedua URL valid.
 */
@Composable
fun BeforeAfterSlider(
    beforeUrl: String?,
    afterUrl: String?,
    modifier: Modifier = Modifier,
    aspectRatio: Float = 4f / 3f,
) {
    val before = ImageUrl.resolve(beforeUrl)
    val after = ImageUrl.resolve(afterUrl)
    if (before == null || after == null) return

    var splitFraction by remember { mutableFloatStateOf(0.5f) }
    val density = LocalDensity.current
    val handleHalfPx = with(density) { 14.dp.toPx() }

    BoxWithConstraints(
        modifier = modifier
            .fillMaxSize()
            .aspectRatio(aspectRatio)
            .clip(RoundedCornerShape(12.dp))
            .background(Color(0xFFE8F0FA)),
    ) {
        val widthPx = constraints.maxWidth.toFloat()

        AsyncImage(
            model = after,
            contentDescription = "Foto sesudah",
            contentScale = ContentScale.Crop,
            modifier = Modifier.fillMaxSize(),
        )

        AsyncImage(
            model = before,
            contentDescription = "Foto sebelum",
            contentScale = ContentScale.Crop,
            modifier = Modifier
                .fillMaxSize()
                .drawWithContent {
                    clipRect(right = size.width * splitFraction) {
                        this@drawWithContent.drawContent()
                    }
                },
        )

        // Label pojok.
        Text(
            "SEBELUM",
            color = Color.White,
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier
                .align(Alignment.TopStart)
                .offset { IntOffset(8.dp.roundToPx(), 8.dp.roundToPx()) }
                .background(Color.Black.copy(alpha = 0.45f), RoundedCornerShape(4.dp))
                .offset { IntOffset(0, 0) },
        )
        Text(
            "SESUDAH",
            color = Color.White,
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier
                .align(Alignment.TopEnd),
        )

        // Garis pemisah + handle yang bisa digeser.
        Box(
            modifier = Modifier
                .offset { IntOffset((widthPx * splitFraction).toInt() - handleHalfPx.toInt(), 0) }
                .width(28.dp)
                .fillMaxHeight()
                .pointerInput(widthPx) {
                    detectHorizontalDragGestures { _, dragAmount ->
                        if (widthPx > 0f) {
                            splitFraction = (splitFraction + dragAmount / widthPx).coerceIn(0.05f, 0.95f)
                        }
                    }
                },
            contentAlignment = Alignment.Center,
        ) {
            Box(Modifier.width(2.dp).fillMaxHeight().background(Color.White))
            Box(
                modifier = Modifier
                    .size(28.dp)
                    .background(BrandBlue, CircleShape)
                    .border(2.dp, Color.White, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    AppIcon.SwapHoriz,
                    contentDescription = "Geser perbandingan",
                    tint = Color.White,
                    modifier = Modifier.size(16.dp),
                )
            }
        }
    }
}
