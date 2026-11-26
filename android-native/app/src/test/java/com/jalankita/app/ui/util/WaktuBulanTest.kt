package com.jalankita.app.ui.util

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * Label bulan untuk grafik tren.
 *
 * Server (`ReportController::stats`) mengirim `bulan` berformat `"Y-m"`
 * (mis. `"2026-11"`). Dua tampilan lama salah menanganinya: daftar di dashboard
 * mencetak `"2026-11"` mentah, sedangkan grafik statistik memakai `take(3)`
 * sehingga semua label menjadi `"202"`.
 */
class WaktuBulanTest {

    @Test
    fun `format Y-m menjadi nama bulan singkat`() {
        assertEquals("Nov", Waktu.namaBulanSingkat("2026-11"))
        assertEquals("Jan", Waktu.namaBulanSingkat("2026-01"))
        assertEquals("Des", Waktu.namaBulanSingkat("2025-12"))
        assertEquals("Mei", Waktu.namaBulanSingkat("2026-05"))
    }

    @Test
    fun `bulan tidak berada di rentang 1 sampai 12`() {
        assertNull(Waktu.namaBulanSingkat("2026-13"))
        assertNull(Waktu.namaBulanSingkat("2026-00"))
    }

    @Test
    fun `input aneh tidak melempar exception`() {
        assertNull(Waktu.namaBulanSingkat(null))
        assertNull(Waktu.namaBulanSingkat(""))
        assertNull(Waktu.namaBulanSingkat("November 2026"))
        assertNull(Waktu.namaBulanSingkat("2026"))
        assertNull(Waktu.namaBulanSingkat("2026-ab"))
    }
}
