package com.jalankita.app.ui.components

import java.io.File
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Kontrak penampil foto layar penuh ([PhotoViewerDialog]).
 *
 * Sebelumnya hanya "Foto Setelah Perbaikan" yang punya lightbox — itu pun tanpa
 * zoom dan tinggi gambarnya dipaku 320 dp, sehingga retak halus tidak terbaca.
 * Komponen ini menjadi satu-satunya penampil penuh di aplikasi.
 */
class PhotoViewerKontrakTest {

    private val akar: File = listOf(
        File("src/main/java/com/jalankita/app"),
        File("app/src/main/java/com/jalankita/app"),
    ).first { it.exists() }

    private val kode: String get() = File(akar, "ui/components/PhotoViewer.kt").readText()

    @Test
    fun `layar penuh memakai lebar penuh dialog`() {
        assertTrue(
            "dialog tidak boleh memakai lebar default platform (kotak kecil)",
            kode.contains("usePlatformDefaultWidth = false"),
        )
        assertTrue(
            "dialog harus mengurus inset sendiri, kalau tidak konten tertutup status bar",
            kode.contains("decorFitsSystemWindows = false"),
        )
    }

    @Test
    fun `bisa geser antar foto dengan penghitung`() {
        assertTrue(kode.contains("HorizontalPager("))
        assertTrue(
            "penghitung '2/3' hanya muncul bila foto lebih dari satu",
            kode.contains("if (bersih.size > 1)") && kode.contains("currentPage + 1"),
        )
        assertTrue(
            "indeks awal mengikuti foto yang diketuk",
            kode.contains("initialPage = initialIndex.coerceIn(0, bersih.lastIndex)"),
        )
    }

    @Test
    fun `bisa cubit zoom dan digeser`() {
        assertTrue(kode.contains("detectTransformGestures"))
        assertTrue("batas zoom 1x-5x", kode.contains("coerceIn(1f, 5f)"))
        assertTrue(
            "zoom kembali ke 1x saat digeser keluar, agar foto tidak hilang dari layar",
            kode.contains("if (baru <= 1.01f)"),
        )
        assertTrue(
            "state di-key per URL supaya zoom tidak mewarisi foto sebelumnya",
            kode.contains("remember(url)"),
        )
    }

    @Test
    fun `selalu ada jalan keluar`() {
        assertTrue("tombol Tutup", kode.contains("\"Tutup\""))
        assertTrue("ketuk Tutup menutup dialog", kode.contains("clickable(onClick = onDismiss)"))
        assertTrue("back menutup dialog", kode.contains("onDismissRequest = onDismiss"))
    }

    @Test
    fun `daftar kosong tidak membuka dialog kosong`() {
        assertTrue(
            "jangan merender dialog bila tidak ada foto",
            kode.contains("val bersih = urls.filter { it.isNotBlank() }") &&
                kode.contains("if (bersih.isEmpty()) return"),
        )
    }
}
