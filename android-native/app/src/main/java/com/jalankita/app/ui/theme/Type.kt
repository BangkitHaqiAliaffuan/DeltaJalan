package com.jalankita.app.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import com.jalankita.app.R

/**
 * Tipografi DeltaJalan — memetakan token frontend (styles.css @theme):
 *   headline-lg = 32px / Manrope
 *   body-sm     = 14px / Inter
 *   label-md    = 14px / Inter
 *   label-sm    = 12px / Inter
 */

val Manrope = FontFamily(
    Font(R.font.manrope_bold, FontWeight.Bold),
    Font(R.font.manrope_extrabold, FontWeight.ExtraBold),
)

val Inter = FontFamily(
    Font(R.font.inter_regular, FontWeight.Normal),
    Font(R.font.inter_medium, FontWeight.Medium),
    Font(R.font.inter_semibold, FontWeight.SemiBold),
)

// Token ukuran (px frontend ≈ sp Compose, karena 1x density design baseline)
object TextTokens {
    val HeadlineLg = TextStyle(
        fontFamily = Manrope,
        fontWeight = FontWeight.ExtraBold,
        fontSize = 32.sp,
        letterSpacing = (-0.5).sp, // tracking-tight
    )
    val BodySm = TextStyle(
        fontFamily = Inter,
        fontWeight = FontWeight.Normal,
        fontSize = 14.sp,
        lineHeight = (14 * 1.625).sp, // leading-relaxed
    )
    val LabelMd = TextStyle(
        fontFamily = Inter,
        fontWeight = FontWeight.SemiBold,
        fontSize = 14.sp,
    )
    val LabelSm = TextStyle(
        fontFamily = Inter,
        fontWeight = FontWeight.SemiBold,
        fontSize = 12.sp,
    )
}

val DeltaJalanTypography = Typography(
    headlineLarge = TextTokens.HeadlineLg,
    bodySmall = TextTokens.BodySm,
    labelMedium = TextTokens.LabelMd,
    labelSmall = TextTokens.LabelSm,
)
