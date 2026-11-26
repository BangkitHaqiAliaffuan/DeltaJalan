package com.jalankita.app.ui.components.chart

import androidx.compose.ui.unit.dp
import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Penjaga grafik tren bulanan.
 *
 * Dua masalah nyata yang dikunci di sini:
 * 1. Skala batang tidak boleh membagi nol dan tidak boleh membalik nilai.
 * 2. Hanya boleh ada SATU implementasi grafik tren di aplikasi, dan label bulan
 *    tidak boleh dipotong `take(3)` (`"2026-11"` → `"202"`).
 */
class TrendChartScaleTest {

    private val akar: File = listOf(
        File("src/main/java/com/jalankita/app"),
        File("app/src/main/java/com/jalankita/app"),
    ).first { it.exists() }

    private fun kode(nama: String): String =
        File(akar, nama).readText()

    @Test
    fun `nilai nol menghasilkan tinggi nol`() {
        assertEquals(0.dp, tinggiBatang(0, 10, 100.dp))
    }

    @Test
    fun `nilai maksimum mengisi tinggi penuh`() {
        assertEquals(100.dp, tinggiBatang(10, 10, 100.dp))
        assertEquals(100.dp, tinggiBatang(99, 10, 100.dp)) // di atas maks dijepit
    }

    @Test
    fun `nilai setengah maksimum menghasilkan setengah tinggi`() {
        assertEquals(50.dp, tinggiBatang(5, 10, 100.dp))
    }

    @Test
    fun `nilai negatif dan maks nol tidak membagi nol`() {
        assertEquals(0.dp, tinggiBatang(-3, 10, 100.dp))
        assertEquals(0.dp, tinggiBatang(4, 0, 100.dp))
    }

    @Test
    fun `hanya ada satu implementasi grafik tren`() {
        val stats = kode("feature/supervisor/SupervisorStatsScreen.kt")
        val dashboard = kode("feature/supervisor/SupervisorDashboardScreen.kt")

        assertFalse("TrendBars lama harus sudah dihapus", stats.contains("fun TrendBars"))
        assertFalse("MonthlyTrendList lama harus sudah dihapus", dashboard.contains("MonthlyTrendList"))
        assertTrue("layar statistik memakai grafik bersama", stats.contains("TrenBulanan(tren ="))
        assertTrue("dashboard memakai grafik bersama", dashboard.contains("TrenBulanan(tren ="))
    }

    @Test
    fun `label bulan tidak dipotong mentah`() {
        val pelanggar = File(akar, "").walkTopDown()
            .filter { it.isFile && it.extension == "kt" }
            .filter { it.readText().contains("bulan?.take(3)") }
            .map { it.name }
            .toList()

        assertTrue("masih memotong label bulan: $pelanggar", pelanggar.isEmpty())
    }
}
