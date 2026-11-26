package com.jalankita.app.feature.supervisor

import java.io.File
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Penjaga CTA pada kartu tinjauan supervisor.
 *
 * Keluhan pengguna: kartu "Perlu Review" hanya punya chip ikon 13 sp
 * (`iconOnly = true`) sehingga tidak terlihat seperti pekerjaan utama, dan
 * kartu statistik "Perlu Review" tidak bisa diketuk sama sekali.
 *
 * Aturannya sekarang: laporan berstatus "Menunggu Review" mendapat tombol
 * lebar penuh berlabel, plus aksen warna, dan kartu statistiknya membuka tab
 * antrean.
 */
class DashboardReviewCtaTest {

    private val akar: File = listOf(
        File("src/main/java/com/jalankita/app"),
        File("app/src/main/java/com/jalankita/app"),
    ).first { it.exists() }

    private val dashboard: String by lazy {
        File(akar, "feature/supervisor/SupervisorDashboardScreen.kt").readText()
    }

    @Test
    fun `kartu menunggu review memakai tombol penuh berlabel`() {
        assertTrue(
            "kartu review harus punya primaryAction berlabel",
            dashboard.contains("primaryAction = if (perluReview)"),
        )
        assertTrue(
            "label CTA harus jelas, bukan sekadar \"Detail\"",
            dashboard.contains("CardAction(\"Tinjau Laporan\""),
        )
    }

    @Test
    fun `status menunggu review memakai aksen`() {
        assertTrue(
            dashboard.contains("accentColor = if (perluReview)"),
        )
    }

    @Test
    fun `chip ikon kecil tidak dipakai untuk kartu menunggu review`() {
        val blok = dashboard.substringAfter("if (!perluReview)").take(320)
        assertTrue(
            "chip ikon hanya untuk kartu non-review",
            blok.contains("iconOnly = true"),
        )
    }

    @Test
    fun `kartu statistik perlu review bisa diketuk`() {
        val baris = dashboard.lines().firstOrNull {
            it.contains("\"Perlu Review\"") && it.contains("StatCard(")
        }
        assertTrue("kartu statistik Perlu Review harus ada", baris != null)
        val sesudah = dashboard.substringAfter(baris!!).take(200)
        assertTrue(
            "kartu statistik Perlu Review harus membuka tab menunggu",
            sesudah.contains("selectTab(\"menunggu\")"),
        )
    }

    @Test
    fun `ReportCard mendukung aksi utama dan aksen`() {
        val rc = File(akar, "ui/components/report/ReportCard.kt").readText()
        assertTrue(rc.contains("primaryAction: CardAction? = null"))
        assertTrue(rc.contains("accentColor: Color? = null"))
        assertTrue(rc.contains("BrandPrimaryButton("))
    }
}
