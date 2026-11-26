package com.jalankita.app.core.util

import java.io.File
import java.nio.file.Files
import java.util.regex.Pattern
import org.junit.After
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Kontrak penambalan EXIF oleh [PhotoCapture].
 *
 * `androidx.exifinterface` menyentuh kelas `android.*` saat inisialisasi, jadi
 * tulis-baca EXIF sungguhan hanya bisa dibuktikan di perangkat/emulator. Yang
 * diuji di sini adalah bagian yang menentukan benar-salahnya:
 *
 * - fungsi murni format tanggal (salah format ⇒ server menganggap tanggal foto
 *   tidak terbaca),
 * - perilaku aman untuk berkas null/tidak ada/koordinat tidak wajar,
 * - isi implementasi: GPS hanya ditulis bila belum ada, tanggal hanya diisi
 *   bila kosong, dan EXIF kamera tidak pernah ditimpa.
 */
class PhotoCaptureStampTest {

    private val sementara: MutableList<File> = mutableListOf()

    private val akar: File = listOf(
        File("src/main/java/com/jalankita/app"),
        File("app/src/main/java/com/jalankita/app"),
    ).first { it.exists() }

    @After
    fun bersihkan() {
        sementara.forEach { runCatching { it.delete() } }
    }

    private fun baca(relatif: String): String = File(akar, relatif).readText()

    @Test
    fun `tanggal exif memakai format yang dibaca server`() {
        val teks = PhotoCapture.formatExifDate(1_700_000_000_000L)
        val pola = Pattern.compile("\\d{4}:\\d{2}:\\d{2} \\d{2}:\\d{2}:\\d{2}")
        assertTrue("format harus 'yyyy:MM:dd HH:mm:ss', dapat: $teks", pola.matcher(teks).matches())
        // 14 Nov 2023 22:13:20 UTC — WIB bisa bergeser, jadi cukup cek tanggal masuk akal.
        assertTrue(teks.startsWith("2023:11:1"))
    }

    @Test
    fun `berkas null atau tidak ada tidak diklaim berhasil`() {
        assertFalse(PhotoCapture.hasGps(null))
        assertFalse(PhotoCapture.stampLocation(null, -7.4, 112.6))

        val hilang = Files.createTempFile("kamera-", ".jpg").toFile().also {
            it.delete()
            sementara += it
        }
        assertFalse(PhotoCapture.hasGps(hilang))
        assertFalse(PhotoCapture.stampLocation(hilang, -7.4, 112.6))
    }

    @Test
    fun `berkas kosong nol byte tidak dianggap ber-gps`() {
        val kosong = Files.createTempFile("kamera-", ".jpg").toFile().also { sementara += it }
        assertFalse(PhotoCapture.hasGps(kosong))
        assertFalse(PhotoCapture.stampLocation(kosong, -7.4, 112.6))
    }

    @Test
    fun `stempel tidak menimpa gps dan tanggal yang sudah ada`() {
        val kode = baca("core/util/PhotoCapture.kt")

        assertTrue(
            "GPS hanya ditulis bila kosong",
            kode.contains("if (exif.latLong == null) {"),
        )
        assertTrue(
            "tanggal hanya diisi bila kosong",
            kode.contains("if (exif.getAttribute(ExifInterface.TAG_DATETIME_ORIGINAL).isNullOrBlank())"),
        )
        assertTrue(
            "nilai GPS ditulis lewat API resmi (bukan attribute mentah)",
            kode.contains("exif.setLatLong(lat, lng)"),
        )
        assertTrue(
            "perubahan harus disimpan",
            kode.contains("exif.saveAttributes()"),
        )
        assertTrue(
            "koordinat tidak wajar ditolak sebelum menyentuh berkas",
            kode.contains("if (!lat.isFinite() || !lng.isFinite()) return false"),
        )
    }

    @Test
    fun `jalur kamera memakai stempel hanya bila exif kamera kosong`() {
        val helper = baca("ui/components/CameraCapture.kt")
        assertTrue(helper.contains("if (!PhotoCapture.hasGps(t.file))"))
    }
}
