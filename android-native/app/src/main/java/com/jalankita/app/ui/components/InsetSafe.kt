package com.jalankita.app.ui.components

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.calculateEndPadding
import androidx.compose.foundation.layout.calculateStartPadding
import androidx.compose.foundation.layout.displayCutout
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.union
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * Inset layar yang harus dihindari konten agar tidak tertimpa.
 *
 * Aplikasi memakai `enableEdgeToEdge()` di [com.jalankita.app.MainActivity], artinya
 * konten digambar sampai ke bawah status bar dan navigation bar. Setiap layar yang
 * dirender DI LUAR `Scaffold` (yang tidak menerima `innerPadding`) wajib memakai
 * helper ini, kalau tidak tombol paling bawah akan tertimpa gesture bar Android.
 *
 * Dua kelompok dipisah karena perlakuan keyboard berbeda:
 * - [systemBars] — status bar atas + navigation/gesture bar bawah (+ notch layar).
 * - [ime] — keyboard. Hanya dipakai layar berisi input teks yang di-scroll, supaya
 *   field yang sedang diketik tidak tertutup keyboard.
 */
object InsetSafe {

    /** Status bar atas + navigation bar bawah + layar berponi. Tanpa keyboard. */
    val systemBars: WindowInsets
        @Composable get() = WindowInsets.statusBars
            .union(WindowInsets.navigationBars)
            .union(WindowInsets.displayCutout)

    /** Seperti [systemBars] ditambah tinggi keyboard saat muncul. */
    val systemBarsWithIme: WindowInsets
        @Composable get() = systemBars.union(WindowInsets.ime)
}

/**
 * Terapkan inset aman ke sebuah layar full-screen.
 *
 * @param withIme `true` untuk layar yang punya kolom input teks dan bisa ter-scroll.
 */
@Composable
fun Modifier.safeContentPadding(withIme: Boolean = false): Modifier {
    val insets = if (withIme) InsetSafe.systemBarsWithIme else InsetSafe.systemBars
    return this.windowInsetsPadding(insets)
}

/**
 * Varian [safeContentPadding] untuk `LazyColumn`/`LazyRow`, yang hanya punya
 * `contentPadding` dan tidak bisa memakai `Modifier.padding` (padding pada modifier
 * akan ikut menggeser area scroll sehingga item terakhir tidak bisa dijangkau).
 */
@Composable
fun safeContentPaddingValues(
    horizontal: Dp = 16.dp,
    vertical: Dp = 16.dp,
    withIme: Boolean = false,
): PaddingValues {
    val bars = InsetSafe.systemBars.asPaddingValues()
    val layoutDirection = LocalLayoutDirection.current
    val imeBottom = if (withIme) {
        WindowInsets.ime.asPaddingValues().calculateBottomPadding()
    } else {
        0.dp
    }
    return PaddingValues(
        start = horizontal + bars.calculateStartPadding(layoutDirection),
        top = vertical + bars.calculateTopPadding(),
        end = horizontal + bars.calculateEndPadding(layoutDirection),
        bottom = vertical + bars.calculateBottomPadding() + imeBottom,
    )
}
