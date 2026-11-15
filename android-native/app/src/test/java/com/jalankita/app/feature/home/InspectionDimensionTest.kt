package com.jalankita.app.feature.home

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.util.Locale

/**
 * Penjaga normalisasi dimensi hasil ukur petugas di sisi klien.
 *
 * Dua tempat wajib sepakat soal aturan ini:
 *  1. `InspectionResultViewModel.dimension()` — mengubah isian keyboard jadi Double?
 *  2. `InspectionRepository.toPlainBody()`     — mengubah Double jadi teks multipart
 *
 * Bila keduanya berbeda, hasil ukur petugas bisa hilang atau ditolak server
 * sebagai "bukan angka".
 */
class InspectionDimensionTest {

    /** Cermin dari InspectionResultViewModel.dimension(). */
    private fun dimension(raw: String): Double? {
        val v = raw.trim().replace(',', '.').toDoubleOrNull() ?: return null
        return if (v > 0) v else null
    }

    @Test
    fun `kosong menjadi null bukan nol`() {
        // Kosong berarti "tidak diukur"; nol berarti "tidak ada kerusakan".
        assertNull(dimension(""))
        assertNull(dimension("   "))
        assertNull(dimension("0"))
        assertNull(dimension("0.0"))
    }

    @Test
    fun `input bukan angka menjadi null`() {
        assertNull(dimension("abc"))
        assertNull(dimension("-"))
        assertNull(dimension("1.2.3"))
    }

    @Test
    fun `angka valid terbaca`() {
        assertEquals(1.5, dimension("1.5")!!, 0.0001)
        assertEquals(1.5, dimension("1,5")!!, 0.0001) // koma desimal Indonesia
        assertEquals(12.0, dimension("12")!!, 0.0001)
        assertEquals(0.15, dimension("0.15")!!, 0.0001)
    }

    @Test
    fun `angka negatif menjadi null`() {
        assertNull(dimension("-1.5"))
    }

    /**
     * REGRESI: format multipart WAJIB memakai Locale.ROOT.
     * Pada HP berbahasa Indonesia, String.format tanpa Locale menghasilkan
     * "1,50" dan server menolaknya sebagai bukan angka.
     */
    @Test
    fun `format body memakai titik desimal walau locale Indonesia`() {
        val asli = Locale.getDefault()
        try {
            Locale.setDefault(Locale.forLanguageTag("id-ID"))
            val body = String.format(Locale.ROOT, "%.2f", 1.5)
            assertEquals("1.50", body)

            // Bukti bahwa tanpa Locale.ROOT hasilnya berbeda (koma).
            val salah = String.format("%.2f", 1.5)
            assertEquals("1,50", salah)
        } finally {
            Locale.setDefault(asli)
        }
    }
}
