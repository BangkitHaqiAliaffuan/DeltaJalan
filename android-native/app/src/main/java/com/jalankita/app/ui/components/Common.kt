package com.jalankita.app.ui.components

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.jalankita.app.R
import com.jalankita.app.ui.theme.Black30
import com.jalankita.app.ui.theme.BrandBlue
import com.jalankita.app.ui.theme.BrandBlueDark
import com.jalankita.app.ui.theme.BrandBlueLight
import com.jalankita.app.ui.theme.DeltaJalanTypography
import com.jalankita.app.ui.theme.DividerLine
import com.jalankita.app.ui.theme.TextMuted

/** Background bersama: gambar + overlay gradient biru (dipakai login & daftar). */
@Composable
fun BrandBackground(modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    Box(modifier.fillMaxSize()) {
        Image(
            painter = painterResource(R.drawable.background_login),
            contentDescription = null,
            contentScale = ContentScale.Crop,
            modifier = Modifier.fillMaxSize(),
        )
        Box(
            Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        listOf(
                            BrandBlue.copy(alpha = 0.80f),
                            BrandBlueDark.copy(alpha = 0.90f),
                        ),
                    ),
                ),
        )
        content()
    }
}

/** Kartu putih bersama: max 360dp, border biru 2dp, radius 16, shadow dalam. */
@Composable
fun BrandCard(
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit,
) {
    val shape = RoundedCornerShape(16.dp)
    Column(
        modifier = modifier
            .widthIn(max = 360.dp)
            .fillMaxWidth()
            .shadow(
                elevation = 24.dp,
                shape = shape,
                ambientColor = Black30,
                spotColor = Black30,
            )
            .clip(shape)
            .background(Color.White)
            .border(2.dp, BrandBlue, shape),
        content = content,
    )
}

/** Header kartu: logo + judul gradien + subjudul. `showDivider` menambah garis bawah (daftar). */
@Composable
fun CardHeader(
    title: String,
    subtitle: String,
    showDivider: Boolean = false,
) {
    Column(
        Modifier
            .fillMaxWidth()
            .padding(start = 32.dp, end = 32.dp, top = 32.dp, bottom = if (showDivider) 0.dp else 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            Modifier
                .size(64.dp)
                .shadow(4.dp, RoundedCornerShape(12.dp))
                .clip(RoundedCornerShape(12.dp))
                .background(Color.White),
            contentAlignment = Alignment.Center,
        ) {
            Image(
                painter = painterResource(R.drawable.logo_deltajalan),
                contentDescription = "DeltaJalan",
                modifier = Modifier.size(40.dp),
            )
        }
        Spacer(Modifier.height(16.dp))
        Text(
            text = title,
            style = DeltaJalanTypography.headlineLarge.copy(
                brush = Brush.horizontalGradient(listOf(BrandBlue, BrandBlueLight)),
            ),
        )
        Spacer(Modifier.height(8.dp))
        Text(
            text = subtitle,
            style = DeltaJalanTypography.bodySmall,
            color = TextMuted,
            textAlign = TextAlign.Center,
            modifier = Modifier.widthIn(max = 280.dp),
        )
        if (showDivider) {
            Spacer(Modifier.height(16.dp))
            Box(Modifier.fillMaxWidth().height(1.dp).background(DividerLine))
            Spacer(Modifier.height(16.dp))
        } else {
            Spacer(Modifier.height(24.dp))
        }
    }
}

/** Dua baris footer putih transparan di bawah kartu. */
@Composable
fun BrandFooter(modifier: Modifier = Modifier) {
    Column(
        modifier.fillMaxWidth().padding(top = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = "Dinas PU Bina Marga & SDA \u2014 Kab. Sidoarjo",
            color = Color.White.copy(alpha = 0.50f),
            fontWeight = FontWeight.Medium,
            fontSize = 11.sp,
            letterSpacing = 1.sp,
        )
        Spacer(Modifier.height(4.dp))
        Text(
            text = "\u00A9 2024 DeltaJalan Infrastructure Suite. All Rights Reserved.",
            color = Color.White.copy(alpha = 0.30f),
            fontSize = 10.sp,
        )
    }
}
