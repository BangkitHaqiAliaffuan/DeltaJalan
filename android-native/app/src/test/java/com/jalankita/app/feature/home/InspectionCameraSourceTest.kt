package com.jalankita.app.feature.home

import java.io.File
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Penjaga sumber foto hasil inspeksi: kamera langsung + galeri.
 *
 * Latar belakang: server kini menolak foto yang jauh dari titik laporan dan
 * memeriksa sebaran antar foto. Foto galeri bisa diambil berhari-hari lalu di
 * tempat lain, jadi form menawarkan TAMBAHAN jalur kamera yang merekam EXIF
 * GPS saat pengambilan. Test ini mengunci bahwa kedua form (inspeksi dan
 * temuan) memakai `TakePicture` dengan berkas tujuan FileProvider, bahwa
 * pembatalan membuang berkas cache, dan bahwa `file_paths.xml` mencakup
 * `cache-path` (kalau tidak, kamera melempar saat meminta berbagi URI).
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
        assertTrue(
            "Sumber tidak ditemukan. Dicoba: ${kandidat.joinToString { it.absolutePath }}",
            file != null,
        )
        return file!!.readText()
    }

    /** Hitung kemunculan teks apa adanya — `toRegex()` salah di sini karena '(' dianggap grup. */
    private fun hitung(sumber: String, teks: String): Int = sumber.split(teks).size - 1

    private val layar = readSource("feature/home/InspectionResultScreen.kt")

    @Test
    fun `form inspeksi memakai TakePicture`() {
        assertTrue(
            "Form harus membuka kamera lewat TakePicture (bukan ACTION_IMAGE_CAPTURE mentah).",
            layar.contains("ActivityResultContracts.TakePicture()"),
        )
    }

    @Test
    fun `form temuan juga memakai TakePicture`() {
        // Dua launcher kamera diharapkan: satu per form.
        val jumlah = hitung(layar, "ActivityResultContracts.TakePicture()")
        assertTrue(
            "Harus ada launcher kamera di form inspeksi DAN form temuan (ditemukan $jumlah).",
            jumlah >= 2,
        )
    }

    @Test
    fun `berkas tujuan dibuat sebelum kamera dibuka`() {
        assertTrue(
            "Berkas tujuan harus dibuat dulu (PhotoCapture.newTarget) baru kamera diluncurkan.",
            layar.contains("PhotoCapture.newTarget(context)"),
        )
    }

    @Test
    fun `pembatalan kamera membuang berkas cache`() {
        // Kalau petugas menutup kamera tanpa menyimpan, berkas kosong di cache
        // harus dihapus agar tidak menumpuk di tiap percobaan.
        val jumlah = hitung(layar, "PhotoCapture.discard(target)")
        assertTrue("Discard harus dipanggil di kedua form (ditemukan $jumlah).", jumlah >= 2)
    }

    @Test
    fun `tombol kamera dan galeri tersedia di kedua form`() {
        // Label galeri berbeda antar form ("Galeri" / "Ganti" saat foto sudah
        // ada), jadi yang dihitung adalah ikonnya, bukan teksnya.
        val kamera = hitung(layar, "\"Kamera\"")
        val galeri = hitung(layar, "AppIcon.Gallery")
        assertTrue("Harus ada tombol Kamera di dua form (ditemukan $kamera).", kamera >= 2)
        assertTrue("Harus ada tombol Galeri di dua form (ditemukan $galeri).", galeri >= 2)
    }

    @Test
    fun `PhotoCapture menulis ke cacheDir dan memakai authority FileProvider`() {
        val fabrik = readSource("core/util/PhotoCapture.kt")
        assertTrue(fabrik.contains("context.cacheDir"))
        assertTrue(fabrik.contains("\"${'$'}{context.packageName}.fileprovider\""))
        // Setiap pengambilan memakai berkas baru — satu nama tetap akan
        // menimpa foto yang belum sempat dibaca.
        assertTrue(fabrik.contains("System.currentTimeMillis()"))
    }

    @Test
    fun `file_paths_xml mencakup cache-path untuk kamera`() {
        val paths = readSource("xml/file_paths.xml")
        assertTrue(
            "FileProvider harus mengizinkan cache-path, kalau tidak TakePicture melempar.",
            paths.contains("<cache-path") && paths.contains("path=\"."),
        )
    }

    @Test
    fun `manifest mendeklarasikan intent IMAGE_CAPTURE di queries`() {
        val manifest = readSource("AndroidManifest.xml")
        // Android 11+ menyembunyikan aplikasi lain; tanpa deklarasi ini
        // TakePicture bisa gagal menemukan aplikasi kamera.
        assertTrue(
            "Manifest harus memuat <queries> berisi android.media.action.IMAGE_CAPTURE.",
            manifest.contains("android.media.action.IMAGE_CAPTURE"),
        )
        assertTrue(
            "Authority FileProvider harus memakai \${applicationId}.fileprovider.",
            manifest.contains("\${applicationId}.fileprovider"),
        )
    }
}