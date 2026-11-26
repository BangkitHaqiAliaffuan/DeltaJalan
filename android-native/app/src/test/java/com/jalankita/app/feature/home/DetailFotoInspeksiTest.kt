package com.jalankita.app.feature.home

import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Penjaga "semua foto warga tampil di detail tugas inspeksi".
 *
 * ── Regresi yang dijaga ──────────────────────────────────────────────────
 * `NativeInspectionController::show()` dulu hanya memuat relasi `report`, tanpa
 * `report.photos`. Akibatnya petugas menerima satu foto utama saja (1 dari
 * maksimal 3 foto warga) dan menilai kerusakan dari bukti yang tidak lengkap.
 *
 * Sekarang server mengirim array `photos`, dan layar wajib menampilkannya
 * dengan fallback ke `image_original_url` supaya APK baru tetap waras di
 * backend lama yang belum deploy.
 */
class DetailFotoInspeksiTest {

    private val akar: File = listOf(
        File("src/main/java/com/jalankita/app"),
        File("app/src/main/java/com/jalankita/app"),
    ).first { it.exists() }

    private fun baca(relatif: String): String = File(akar, relatif).readText()

    @Test
    fun `dto menerima daftar foto warga`() {
        val dto = baca("core/network/InspectionModels.kt")

        assertTrue(
            "InspectionReportDto harus punya field photos",
            dto.contains("val photos: List<InspectionReportPhotoDto>? = null"),
        )
        assertTrue(
            "foto membawa URL dan koordinatnya",
            dto.contains("data class InspectionReportPhotoDto(") &&
                dto.contains("@Json(name = \"image_original_url\") val imageOriginalUrl: String? = null"),
        )
    }

    @Test
    fun `layar menampilkan semua foto dan jatuh ke foto utama bila daftar kosong`() {
        val layar = baca("feature/home/InspectionScreens.kt")

        assertTrue(
            "daftar foto digabung dari relasi photos",
            layar.contains("report?.photos?.mapNotNullTo(this) { it.imageOriginalUrl }"),
        )
        assertTrue(
            "foto utama tetap dipakai bila server lama tidak mengirim array",
            layar.contains("val utama = report?.imageOriginalUrl ?: report?.imageOriginalPath"),
        )
        assertTrue(
            "foto tidak digandakan saat sudah ada di daftar",
            layar.contains("if (!utama.isNullOrBlank() && utama !in this) add(utama)"),
        )
    }

    @Test
    fun `foto bisa dibuka layar penuh`() {
        val layar = baca("feature/home/InspectionScreens.kt")

        assertTrue(layar.contains("PhotoViewerDialog("))
        assertTrue(
            "indeks awal mengikuti foto yang diketuk",
            layar.contains("initialIndex = idx"),
        )
        assertTrue(
            "thumbnail menanggapi ketukan",
            layar.contains(".clickable { fotoDibuka = idx }"),
        )
    }

    @Test
    fun `hasil inspeksi petugas juga bisa diperbesar supervisor`() {
        val layar = baca("feature/supervisor/SupervisorDetailScreen.kt")

        assertTrue(layar.contains("PhotoViewerDialog("))
    }

    @Test
    fun `hanya ada satu implementasi penampil foto`() {
        val pemakai = File(akar, "").walkTopDown()
            .filter { it.isFile && it.extension == "kt" }
            .filter { it.readText().contains("fun PhotoViewerDialog(") }
            .map { it.relativeTo(akar).invariantSeparatorsPath }
            .toList()

        assertEquals(
            "penampil foto harus satu (ui/components/PhotoViewer.kt), ditemukan: $pemakai",
            listOf("ui/components/PhotoViewer.kt"),
            pemakai,
        )
    }
}
