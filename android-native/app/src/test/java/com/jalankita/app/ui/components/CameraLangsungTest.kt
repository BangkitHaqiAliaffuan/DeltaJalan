package com.jalankita.app.ui.components

import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Penjaga jalur kamera bersama.
 *
 * ── Regresi yang dijaga ──────────────────────────────────────────────────
 * Tombol berlabel "Kamera" pernah hanya membuka galeri di **dua** form (lapor
 * warga dan lapor petugas). Tidak ada yang rusak secara teknis — keduanya
 * memang belum diimplementasikan — tetapi hasilnya menyesatkan: pengguna
 * menekan Kamera dan mendapati pemilih foto.
 *
 * Sekarang semua form wajib memakai [rememberCameraCapture] supaya izin
 * kamera, stempel GPS EXIF, dan pembersihan berkas sementara tidak berbeda
 * antar layar.
 */
class CameraLangsungTest {

    private val akar: File = listOf(
        File("src/main/java/com/jalankita/app"),
        File("app/src/main/java/com/jalankita/app"),
    ).first { it.exists() }

    private fun baca(relatif: String): String = File(akar, relatif).readText()

    @Test
    fun `form lapor warga memakai kamera sungguhan`() {
        val layar = baca("feature/warga/WargaLaporScreen.kt")

        assertTrue(
            "tombol Kamera harus lewat jalur bersama",
            layar.contains("rememberCameraCapture("),
        )
        assertTrue(
            "placeholder memanggil kamera, bukan pemilih galeri",
            layar.contains("onCamera = { ambilKamera() }"),
        )
        assertFalse(
            "stub lama (kamera = galeri) tidak boleh kembali",
            layar.contains("TODO Fase 5"),
        )
    }

    @Test
    fun `form lapor petugas memakai kamera sungguhan`() {
        val layar = baca("feature/lapor/LaporScreen.kt")

        assertTrue(layar.contains("rememberCameraCapture("))
        assertTrue(
            "tombol Kamera tidak boleh lagi memanggil pemilih galeri",
            layar.contains("PickButton(\"Kamera\", AppIcon.Camera, Modifier.weight(1f)) { ambilKamera() }"),
        )
        assertFalse(
            "galeri tetap untuk tombol Galeri saja",
            layar.contains("PickButton(\"Kamera\", AppIcon.Camera, Modifier.weight(1f)) { pickFromGallery() }"),
        )
    }

    @Test
    fun `tambah foto berikutnya juga menawarkan kamera`() {
        val layar = baca("feature/warga/WargaLaporScreen.kt")

        assertTrue(
            "AddMoreButton harus punya dua sumber foto",
            layar.contains("private fun AddMoreButton(left: Int, onGallery: () -> Unit, onCamera: () -> Unit)"),
        )
    }

    @Test
    fun `jalur kamera bersama menangani izin, stempel GPS, dan pembersihan`() {
        val helper = baca("ui/components/CameraCapture.kt")

        assertTrue("butuh intent kamera", helper.contains("ActivityResultContracts.TakePicture()"))
        assertTrue(
            "izin kamera diminta runtime",
            helper.contains("Manifest.permission.CAMERA"),
        )
        assertTrue(
            "izin lokasi diminta sekalian untuk stempel",
            helper.contains("Manifest.permission.ACCESS_FINE_LOCATION"),
        )
        assertTrue(
            "EXIF kamera yang sudah ber-GPS tidak ditimpa",
            helper.contains("PhotoCapture.hasGps(t.file)"),
        )
        assertTrue(
            "koordinat perangkat ditambal ke berkas",
            helper.contains("PhotoCapture.stampLocation(t.file, fix.first, fix.second)"),
        )
        assertTrue(
            "baca/tulis EXIF dipindah ke Dispatchers.IO",
            helper.contains("withContext(Dispatchers.IO)"),
        )
        assertTrue(
            "berkas sementara dibuang saat pengambilan dibatalkan",
            helper.contains("PhotoCapture.discard(t)"),
        )
    }

    @Test
    fun `hanya ada satu implementasi jalur kamera`() {
        // Empat formulir memakai kamera; kalau salah satunya menulis ulang
        // intent + izin + stempel sendiri, perilakunya akan menyimpang lagi.
        val pemilik = File(akar, "ui/components/CameraCapture.kt")
        val pelanggar = File(akar, "").walkTopDown()
            .filter { it.isFile && it.extension == "kt" }
            .filter { it.readText().contains("ActivityResultContracts.TakePicture()") }
            .map { it.relativeTo(akar).invariantSeparatorsPath }
            .toList()

        assertEquals(
            "hanya jalur bersama yang boleh membuka intent kamera, ditemukan: $pelanggar",
            listOf("ui/components/CameraCapture.kt"),
            pelanggar,
        )
        assertTrue(pemilik.exists())
    }

    @Test
    fun `form inspeksi dan temuan memakai jalur bersama`() {
        val layar = baca("feature/home/InspectionResultScreen.kt")

        assertEquals(
            "dua form (INS + TMW) harus memakai jalur kamera bersama",
            2,
            layar.split("rememberCameraCapture(").size - 1,
        )
        assertTrue("form inspeksi memakai prefix INS", layar.contains("prefix = \"INS\""))
        assertTrue("form temuan memakai prefix TMW", layar.contains("prefix = \"TMW\""))
        assertTrue(
            "kegagalan kamera tampil dekat komponen foto",
            layar.contains("onError = { pesan -> vm.reportPhotoProblem(pesan) }"),
        )
    }

    @Test
    fun `pesan gagal kamera spesifik, bukan generik`() {
        val helper = baca("ui/components/CameraCapture.kt")

        assertTrue(
            "izin lokasi ditolak punya pesan sendiri",
            helper.contains("const val IZIN_LOKASI"),
        )
        assertTrue(
            "GPS belum terkunci punya pesan sendiri",
            helper.contains("const val LOKASI_GAGAL"),
        )
        assertTrue(
            "izin kamera ditolak punya pesan sendiri",
            helper.contains("const val IZIN_KAMERA"),
        )
        assertTrue(
            "setiap pesan menyebutkan jalan keluar (Galeri)",
            helper.contains("atau pilih foto dari Galeri"),
        )
    }
}
