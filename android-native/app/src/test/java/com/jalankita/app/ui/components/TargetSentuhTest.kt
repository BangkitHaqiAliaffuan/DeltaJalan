package com.jalankita.app.ui.components

import java.io.File
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Penjaga ukuran target sentuh.
 *
 * Standar Material 3: area yang bisa diketuk minimal 48 dp, dan di aplikasi ini
 * dipakai 44 dp sebagai batas praktis (sudah dipakai tombol bintang rating dan
 * `PasswordToggle`). Tiga tempat sempat di bawah batas itu dan sulit ditekan
 * dengan jempol:
 *
 * - chip hapus foto bukti inspeksi: 24 dp
 * - ikon hapus foto di layar lapor petugas: 20 dp
 * - tombol prev/next antrean di panel review supervisor: 28 dp
 *
 * Pola yang diwajibkan: kotak sentuh 44 dp, di dalamnya chip/ikon yang terlihat
 * tetap kecil. Tes ini mengunci pola itu agar tidak menyusut lagi.
 */
class TargetSentuhTest {

    private fun readSource(relatif: String): String {
        val kandidat = listOf(
            File("src/main/java/com/jalankita/app/$relatif"),
            File("app/src/main/java/com/jalankita/app/$relatif"),
        )
        val file = kandidat.firstOrNull { it.exists() }
        assertTrue("Sumber tidak ditemukan untuk $relatif", file != null)
        return file!!.readText()
    }

    /**
     * Potongan sumber sebelum jangkar — tempat modifier chain tombol berada.
     * Jangkar ikut disertakan agar rantai `.size(...).clickable { jangkar }`
     * bisa diperiksa utuh.
     */
    private fun sebelum(sumber: String, jangkar: String, panjang: Int = 400): String {
        val idx = sumber.indexOf(jangkar)
        assertTrue("Jangkar '$jangkar' tidak ditemukan", idx >= 0)
        return sumber.substring(maxOf(0, idx - panjang), idx + jangkar.length)
    }

    @Test
    fun `hapus foto bukti inspeksi memakai target 44 dp`() {
        val sumber = readSource("feature/home/InspectionResultScreen.kt")
        val rantai = sebelum(sumber, "vm.removePhoto(index)")
        assertTrue(
            "Kotak 44 dp harus menjadi area sentuh tombol hapus foto bukti.",
            rantai.contains(".size(44.dp)"),
        )
        assertTrue(
            "Aksi hapus harus menempel pada kotak 44 dp, bukan chip 24 dp.",
            rantai.contains("clickable(role = Role.Button) { vm.removePhoto"),
        )
        assertTrue(
            "Chip 24 dp tetap boleh ada, tapi hanya sebagai tampilan di dalamnya.",
            sumber.contains(".size(24.dp)"),
        )
        assertTrue(
            "Ikon hapus harus punya label suara yang menyebut nomor foto.",
            sumber.contains("contentDescription = \"Hapus foto "),
        )
    }

    @Test
    fun `hapus foto layar lapor petugas memakai target 44 dp`() {
        val sumber = readSource("feature/lapor/LaporScreen.kt")
        val rantai = sebelum(sumber, "vm.removePhoto(i)")
        assertTrue(
            "Ikon hapus 20 dp harus dibungkus kotak sentuh 44 dp.",
            rantai.contains(".size(44.dp)"),
        )
        assertTrue(
            "Aksi hapus harus menempel pada kotak 44 dp.",
            rantai.contains("clickable(role = Role.Button) { vm.removePhoto"),
        )
        assertFalse(
            "Ikon hapus tidak boleh lagi memakai clickable langsung di ukuran 20 dp.",
            rantai.contains(".size(20.dp).clickable"),
        )
    }

    @Test
    fun `navigasi antrean review memakai komponen 44 dp dan label tidak terdesak`() {
        val sumber = readSource("feature/supervisor/SupervisorReviewScreen.kt")
        assertTrue(
            "Navigasi antrean harus lewat satu komponen bersama.",
            sumber.split("NavigasiAntrean(").size - 1 >= 3,
        )
        val badan = sebelum(sumber, "private fun ReviewActionSheet(", 1400)
        assertTrue("Komponen navigasi harus memakai kotak 44 dp.", badan.contains(".size(44.dp)"))
        assertTrue("Komponen navigasi harus menyatakan peran tombol.", badan.contains("role = Role.Button"))
        assertFalse(
            "Chip 28 dp tidak boleh lagi menjadi area sentuh.",
            Regex("""size\(28\.dp\)[\s\S]{0,120}clickable""").containsMatchIn(sumber),
        )
        assertTrue(
            "Label antrean diberi weight(1f) agar tidak terdorong dua tombol 44 dp.",
            Regex("""antrean",[\s\S]{0,300}weight\(1f\)""").containsMatchIn(sumber),
        )
    }
}
