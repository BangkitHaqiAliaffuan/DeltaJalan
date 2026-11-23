package com.jalankita.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

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
    // ── Warna turunan yang dipakai komponen Material ────────────────────
    // Tanpa ini Material MENURUNKAN sendiri warna container dialog/judul
    // dari `primary`, sehingga muncul kotak abu-keunguan yang tidak cocok
    // dengan putih/biru brand (keluhan "pop up dari Android warnanya jelek").
    surfaceContainer = Color(0xFFFFFFFF),
    surfaceContainerHigh = Color(0xFFFFFFFF),
    surfaceContainerHighest = Color(0xFFFFFFFF),
    surfaceContainerLow = Color(0xFFF8FAFC),
    surfaceContainerLowest = Color(0xFFFFFFFF),
    onSurfaceVariant = TextMuted,
    outline = BorderInput,
    outlineVariant = DividerLine,
    primaryContainer = BrandBlueLight,
    onPrimaryContainer = BrandBlueDark,
    surfaceVariant = Color(0xFFF1F5F9),
)

@Composable
fun DeltaJalanTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = DeltaJalanColors,
        typography = DeltaJalanTypography,
        content = content,
    )
}
