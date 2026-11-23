package com.jalankita.app.feature.home

import java.io.File
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Regresi crash saat menekan tombol Kamera di form hasil inspeksi.
 *
 * Kejadian di perangkat (SM-A217F, Android 12):
 *
 *   java.lang.SecurityException: Permission Denial: starting Intent
 *   { act=android.media.action.IMAGE_CAPTURE cmp=com.sec.android.app.camera/.Camera }
 *   ... with revoked permission android.permission.CAMERA
 *
 * Sebabnya: aplikasi MENDEKLARASIKAN `android.permission.CAMERA` di manifest.
 * Selama deklarasi itu ada, Android mewajibkan aplikasi memegang izin runtime
 * sebelum membuka aplikasi kamera — kalau tidak, peluncuran Intent ditolak
 * dengan SecurityException dan proses mati.
 *
 * Perbaikan: izin diperiksa/diminta lebih dulu, dan kegagalan apa pun
 * (izin ditolak, tidak ada aplikasi kamera) ditampilkan sebagai pesan di kartu
 * foto — bukan crash.
 */
class InspectionCameraPermissionTest {

    private fun readSource(relatif: String): String {
        val kandidat = listOf(
            File("src/main/java/com/jalankita/app/$relatif"),
            File("app/src/main/java/com/jalankita/app/$relatif"),
            File("src/main/AndroidManifest.xml"),
            File("app/src/main/AndroidManifest.xml"),
        )
        val file = kandidat.firstOrNull { it.exists() }
        assertTrue("Sumber tidak ditemukan untuk $relatif", file != null)
        return file!!.readText()
    }

    private fun hitung(sumber: String, teks: String): Int = sumber.split(teks).size - 1

    private val layar = readSource("feature/home/InspectionResultScreen.kt")

    @Test
    fun `manifest masih mendeklarasikan izin CAMERA`() {
        // Deklarasi inilah yang membuat izin runtime wajib diminta. Kalau suatu
        // saat deklarasi dihapus, permintaan izin di layar menjadi tidak perlu
        // (Android hanya menolak bila aplikasi mendeklarasikannya).
        val manifest = readSource("AndroidManifest.xml")
        assertTrue(
            "Manifest harus tetap memuat android.permission.CAMERA.",
            manifest.contains("android.permission.CAMERA"),
        )
    }

    @Test
    fun `izin diperiksa sebelum kamera dibuka`() {
        assertTrue(
            "Harus ada pemeriksaan ContextCompat.checkSelfPermission untuk CAMERA.",
            layar.contains("Manifest.permission.CAMERA") &&
                layar.contains("ContextCompat.checkSelfPermission"),
        )
        assertTrue(
            "Harus ada launcher RequestPermission sebelum TakePicture.",
            hitung(layar, "ActivityResultContracts.RequestPermission()") >= 2,
        )
    }

    @Test
    fun `penolakan izin tidak membuat aplikasi crash`() {
        assertTrue(
            "Penolakan izin harus tampil sebagai pesan foto, bukan exception.",
            layar.contains("vm.reportPhotoProblem("),
        )
    }

    @Test
    fun `kamera yang tidak tersedia ditangani`() {
        // Perangkat tanpa aplikasi kamera (mis. tablet) tidak boleh crash.
        assertTrue(
            "Peluncuran kamera harus dibungkus try/catch.",
            layar.contains("cameraLauncher.launch(target.uri)") && layar.contains("catch (_: Exception)"),
        )
    }

    /**
     * Urutan penugasan penting: kalau `captureTarget` diisi SETELAH launch,
     * callback hasil bisa membaca nilai lama (null) dan foto hilang.
     */
    @Test
    fun `berkas tujuan ditugaskan sebelum kamera diluncurkan`() {
        val mulai = layar.indexOf("val mulaiKamera: () -> Unit = {")
        assertTrue(mulai >= 0)
        val blok = layar.substring(mulai, layar.indexOf("val mintaIzinKamera", mulai))
        val posisiTugas = blok.indexOf("captureTarget = target")
        val posisiLaunch = blok.indexOf("cameraLauncher.launch(target.uri)")
        assertTrue("Keduanya harus ada di blok mulaiKamera.", posisiTugas >= 0 && posisiLaunch >= 0)
        assertTrue(
            "captureTarget harus diisi SEBELUM launch (sekarang tugas=$posisiTugas, launch=$posisiLaunch).",
            posisiTugas < posisiLaunch,
        )
    }
}
