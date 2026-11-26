package com.jalankita.app.feature.home

import java.io.File
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Penjaga izin kamera pada jalur kamera bersama.
 *
 * Regresi yang pernah terjadi di perangkat: aplikasi MENDECLARASIKAN
 * `android.permission.CAMERA`, dan Android menolak membuka aplikasi kamera dari
 * aplikasi yang mendeklarasikannya tanpa memegang izinnya — aplikasi crash saat
 * tombol Kamera ditekan. Karena itu izin harus diminta runtime lebih dulu, dan
 * penolakan harus berakhir dengan pesan, bukan crash.
 */
class InspectionCameraPermissionTest {

    private fun readSource(relatif: String): String {
        val kandidat = listOf(
            File("src/main/java/com/jalankita/app/$relatif"),
            File("app/src/main/java/com/jalankita/app/$relatif"),
        )
        val file = kandidat.firstOrNull { it.exists() }
        assertTrue("Berkas sumber tidak ditemukan: $relatif", file != null)
        return file!!.readText()
    }

    private val helper: String get() = readSource("ui/components/CameraCapture.kt")

    @Test
    fun `izin kamera diminta sebelum kamera dibuka`() {
        assertTrue(
            "Harus ada permintaan izin CAMERA runtime.",
            helper.contains("Manifest.permission.CAMERA"),
        )
        assertTrue(
            "Permintaan izin lewat launcher (RequestMultiplePermissions) agar lokasi ikut diminta.",
            helper.contains("ActivityResultContracts.RequestMultiplePermissions()"),
        )
        assertTrue(
            "Izin yang sudah ada diperiksa lebih dulu sebelum meminta ulang.",
            helper.contains("ContextCompat.checkSelfPermission("),
        )
    }

    @Test
    fun `izin lokasi diminta untuk stempel koordinat`() {
        assertTrue(
            "Stempel EXIF butuh ACCESS_FINE_LOCATION.",
            helper.contains("Manifest.permission.ACCESS_FINE_LOCATION"),
        )
    }

    @Test
    fun `penolakan izin berakhir dengan pesan, bukan crash`() {
        assertTrue(
            "Penolakan izin kamera harus memanggil onError dengan pesan jelas.",
            helper.contains("onError(CameraMessages.IZIN_KAMERA)"),
        )
        assertTrue(
            "Penolakan izin lokasi punya pesan sendiri.",
            helper.contains("CameraMessages.IZIN_LOKASI"),
        )
    }

    @Test
    fun `kamera yang tidak tersedia ditangani`() {
        assertTrue(
            "Peluncuran kamera harus dibungkus try/catch.",
            helper.contains("try {") && helper.contains("catch (_: Exception)"),
        )
        assertTrue(
            "Perangkat tanpa aplikasi kamera diberi pesan, berkas dibuang.",
            helper.contains("onError(CameraMessages.KAMERA_TIDAK_ADA)") &&
                helper.contains("PhotoCapture.discard(t)"),
        )
    }

    @Test
    fun `berkas tujuan ditugaskan sebelum kamera diluncurkan`() {
        val tugaskan = helper.indexOf("target = t")
        val buka = helper.indexOf("kamera.launch(t.uri)")
        assertTrue("target harus ditugaskan", tugaskan >= 0)
        assertTrue("kamera harus diluncurkan", buka >= 0)
        assertTrue(
            "Hasil kamera bisa kembali sangat cepat; target wajib diset sebelum launch.",
            tugaskan < buka,
        )
        assertTrue(
            "Target harus direset setelah dipakai, agar pengambilan berikutnya tidak salah berkas.",
            helper.contains("target = null"),
        )
    }
}
