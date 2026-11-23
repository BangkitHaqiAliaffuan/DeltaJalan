package com.jalankita.app.ui.components

import java.io.File
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Penjaga tampilan dialog: memakai kartu putih milik aplikasi, bukan
 * `AlertDialog` bawaan Material 3.
 *
 * Keluhan petugas: pop-up "Estimasi Penyelesaian" tampil dengan warna kurang
 * bagus. Sebabnya `AlertDialog` mengambil `colorScheme.surfaceContainerHigh`,
 * yang TIDAK didefinisikan di `DeltaJalanColors` — Material menurunkannya
 * sendiri (abu-keunguan), dan lebarnya mengikuti `usePlatformDefaultWidth`
 * sehingga sempit di layar 720px.
 */
class JkDialogStyleTest {

    private fun readSource(relatif: String): String {
        val kandidat = listOf(
            File("src/main/java/com/jalankita/app/$relatif"),
            File("app/src/main/java/com/jalankita/app/$relatif"),
        )
        val file = kandidat.firstOrNull { it.exists() }
        assertTrue("Sumber tidak ditemukan untuk $relatif", file != null)
        return file!!.readText()
    }

    @Test
    fun `JkDialog memakai Dialog polos dengan lebar sendiri`() {
        val sumber = readSource("ui/components/JkDialog.kt")
        assertTrue("Harus memakai androidx Dialog.", sumber.contains("Dialog("))
        assertTrue(
            "usePlatformDefaultWidth harus false agar lebar bisa diatur (tidak sempit).",
            sumber.contains("usePlatformDefaultWidth = false"),
        )
        assertTrue("Latar harus putih, bukan surface Material.", sumber.contains("background(Color.White)"))
    }

    @Test
    fun `dialog estimasi dan hapus tidak lagi memakai AlertDialog`() {
        val aksi = readSource("feature/home/CardActions.kt")
        val kartu = readSource("feature/home/components/Cards.kt")
        assertTrue("Dialog estimasi harus memakai JkDialog.", aksi.contains("JkDialog("))
        assertTrue("Dialog hapus harus memakai JkDialog.", kartu.contains("JkDialog("))
        assertFalse(
            "CardActions tidak boleh lagi memakai AlertDialog (warna surface tidak didefinisikan tema).",
            aksi.contains("AlertDialog("),
        )
    }

    /**
     * Penjaga menyeluruh: TIDAK boleh ada lagi `AlertDialog(` Material di
     * seluruh kode aplikasi. Dialog M3 memakai warna turunan yang tidak
     * didefinisikan tema, dan lebarnya mengikuti platform (sempit di 720px).
     */
    @Test
    fun `seluruh aplikasi bebas AlertDialog Material`() {
        val akar = listOf(File("src/main/java/com/jalankita/app"), File("app/src/main/java/com/jalankita/app"))
            .firstOrNull { it.exists() }
        assertTrue("Folder sumber tidak ditemukan", akar != null)

        val pelanggar = akar!!.walkTopDown()
            .filter { it.isFile && it.extension == "kt" && it.name != "JkDialog.kt" }
            .filter { it.readText().contains("AlertDialog(") }
            .map { it.name }
            .toList()

        assertTrue("Masih memakai AlertDialog Material: \${pelanggar.joinToString()}", pelanggar.isEmpty())
    }

    @Test
    fun `aksi merusak memakai warna merah`() {
        val kartu = readSource("feature/home/components/Cards.kt")
        assertTrue(
            "Hapus laporan harus memakai primaryColor merah.",
            kartu.contains("primaryColor = Color(0xFFDC2626)"),
        )
    }

    @Test
    fun `dialog menyediakan jalan batal`() {
        val sumber = readSource("ui/components/JkDialog.kt")
        // Tombol batal default memanggil onDismissRequest; tanpa ini dialog
        // hanya bisa ditutup dengan tombol Back.
        assertTrue(sumber.contains("onSecondary ?: onDismissRequest"))
        assertTrue(sumber.contains("secondaryLabel: String = \"Batal\""))
    }
}
