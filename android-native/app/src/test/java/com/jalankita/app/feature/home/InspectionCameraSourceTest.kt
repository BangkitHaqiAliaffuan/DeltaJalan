package com.jalankita.app.feature.home

import java.io.File
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Penjaga sumber foto hasil inspeksi: kamera langsung + galeri.
 *
 * Latar: server menolak foto yang jauh dari titik laporan dan memeriksa sebaran
 * antar foto. Foto galeri bisa diambil berhari-hari lalu di tempat lain, jadi
 * form menawarkan TAMBAHAN jalur kamera yang merekam EXIF GPS saat pengambilan.
 *
 * Sejak jalur kamera disatukan, implementasi intent + berkas tujuan tinggal di
 * `ui/components/CameraCapture.kt`; test ini memastikan kontrak itu tetap utuh
 * (berkas dibuat sebelum kamera dibuka, pembatalan membuang cache, URI dibagikan
 * lewat FileProvider) dan kedua form hasil inspeksi benar-benar memakainya.
 */
class InspectionCameraSourceTest {

    private fun readSource(relatif: String): String {
        val kandidat = listOf(
            File("src/main/java/com/jalankita/app/$relatif"),
            File("app/src/main/java/com/jalankita/app/$relatif"),
            File("src/main/res/$relatif"),
            File("app/src/main/res/$relatif"),
            File("src/main/$relatif"),
            File("app/src/main/$relatif"),
        )
        val file = kandidat.firstOrNull { it.exists() }
        assertTrue("Berkas sumber tidak ditemukan: $relatif", file != null)
        return file!!.readText()
    }

    @Test
    fun `form inspeksi memakai jalur kamera bersama`() {
        val form = readSource("feature/home/InspectionResultScreen.kt")
        assertTrue(
            "Form harus membuka kamera lewat jalur bersama, bukan intent sendiri",
            form.contains("rememberCameraCapture("),
        )
    }

    @Test
    fun `form temuan juga memakai jalur kamera bersama`() {
        val form = readSource("feature/home/InspectionResultScreen.kt")
        val jumlah = form.split("rememberCameraCapture(").size - 1
        assertTrue(
            "Harus ada jalur kamera di form inspeksi DAN form temuan (ditemukan $jumlah).",
            jumlah == 2,
        )
        assertTrue("Form temuan memakai prefix TMW", form.contains("prefix = \"TMW\""))
    }

    @Test
    fun `berkas tujuan dibuat sebelum kamera dibuka`() {
        val helper = readSource("ui/components/CameraCapture.kt")
        val buat = helper.indexOf("PhotoCapture.newTarget(context, prefix)")
        val buka = helper.indexOf("kamera.launch(t.uri)")
        assertTrue("Berkas tujuan harus dibuat dulu (PhotoCapture.newTarget).", buat >= 0)
        assertTrue("Kamera harus diluncurkan lewat TakePicture.", buka >= 0)
        assertTrue(
            "newTarget harus dipanggil SEBELUM launch, kalau tidak kamera menulis ke berkas yang salah.",
            buat < buka,
        )
    }

    @Test
    fun `pembatalan kamera membuang berkas cache`() {
        val helper = readSource("ui/components/CameraCapture.kt")
        assertTrue(
            "Discard harus dipanggil saat pengambilan gagal/dibatalkan",
            helper.contains("if (!tersimpan || t == null)") &&
                helper.contains("PhotoCapture.discard(t)"),
        )
    }

    @Test
    fun `uri dibagikan lewat fileprovider dengan cache-path`() {
        val helper = readSource("ui/components/CameraCapture.kt")
        assertTrue(
            "URI kamera wajib FileProvider (file:// dilarang sejak Android 7)",
            helper.contains("PhotoCapture.newTarget("),
        )
        val paths = readSource("xml/file_paths.xml")
        assertTrue(
            "file_paths.xml harus mencakup cache-path, kalau tidak FileProvider melempar",
            paths.contains("<cache-path"),
        )
    }
}
