package com.jalankita.app.core.util

import org.junit.Assert.assertEquals
import org.junit.Test

/** Kontrak [gabungUnik] — daftar bertambah tanpa id ganda (BUG-3). */
class ListUtilTest {

    private data class Baris(val id: String, val versi: Int)

    @Test
    fun `halaman baru yang beririsan tidak menduplikasi id`() {
        val halaman1 = listOf(Baris("a", 1), Baris("b", 1), Baris("c", 1))
        val halaman2 = listOf(Baris("c", 2), Baris("d", 1))

        val hasil = halaman1.gabungUnik(halaman2) { it.id }

        assertEquals(listOf("a", "b", "c", "d"), hasil.map { it.id })
        assertEquals("item dari halaman baru harus menang", 2, hasil.first { it.id == "c" }.versi)
    }

    @Test
    fun `urutan halaman lama dipertahankan`() {
        val lama = listOf(Baris("x", 1), Baris("y", 1))
        val baru = listOf(Baris("y", 9))

        assertEquals(listOf("x", "y"), lama.gabungUnik(baru) { it.id }.map { it.id })
    }

    @Test
    fun `halaman kosong mengembalikan daftar apa adanya`() {
        val lama = listOf(Baris("a", 1))
        assertEquals(lama, lama.gabungUnik(emptyList<Baris>()) { it.id })
    }

    @Test
    fun `daftar kosong menerima seluruh halaman baru`() {
        assertEquals(
            listOf("a"),
            emptyList<Baris>().gabungUnik(listOf(Baris("a", 1))) { it.id }.map { it.id },
        )
    }
}
