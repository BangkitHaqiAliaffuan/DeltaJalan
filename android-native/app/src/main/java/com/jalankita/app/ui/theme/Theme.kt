package com.jalankita.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

/**
 * Tema DeltaJalan — color scheme terang dengan warna brand.
 * Layar login/daftar memakai warna brand langsung (bukan lewat Material role),
 * tema ini menyediakan default yang konsisten untuk sisa aplikasi.
 */
private val DeltaJalanColors = lightColorScheme(
    primary = BrandBlue,
    onPrimary = White,
    secondary = BrandBlueLight,
    onSecondary = White,
    background = White,
    onBackground = TextDark,
    surface = White,
    onSurface = TextDark,
    error = ErrorRed,
    onError = White,
)

@Composable
fun DeltaJalanTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = DeltaJalanColors,
        typography = DeltaJalanTypography,
        content = content,
    )
}
