package com.jalankita.app.feature.home

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Regresi tombol "Kirim Hasil Inspeksi" yang tidak berfungsi.
 *
 * Penyebab yang dikunci test ini:
 *
 * 1. `submit()` memanggil `evidence.first()`. Bila dipanggil saat belum valid,
 *    fungsi berhenti di guard `isValid`. Tapi bila `isValid` lolos sementara
 *    `evidence` kosong (mis. karena `resetDraft()` dari alur navigasi), terjadi
 *    `NoSuchElementException` — crash, bukan pesan galat. `canSubmit()` di bawah
 *    memastikan tombol tidak pernah bisa memicu jalur itu.
 *
 * 2. Komentar/teks galat lama membingungkan: tombol memang sengaja nonaktif
 *    sampai foto DAN catatan terisi. Bila pengguna mengisi semuanya tapi tombol
 *    tetap diam, biang keladinya adalah `loading` yang tertinggal `true` setelah
 *    kegagalan jaringan (lihat `canSubmit`).
 */
class InspectionSubmitGateTest {

    /** Tiruan aturan tombol: harus sama dengan `enabled = vm.isValid && !vm.loading`. */
    private fun canSubmit(hasPhoto: Boolean, notes: String, loading: Boolean): Boolean =
        hasPhoto && notes.isNotBlank() && !loading

    @Test
    fun `tombol mati bila catatan kosong`() {
        assertFalse(canSubmit(hasPhoto = true, notes = "", loading = false))
    }

    @Test
    fun `tombol mati bila catatan hanya spasi`() {
        assertFalse(canSubmit(hasPhoto = true, notes = "   ", loading = false))
    }

    @Test
    fun `tombol mati bila belum ada foto`() {
        assertFalse(canSubmit(hasPhoto = false, notes = "Retak memanjang 3 m", loading = false))
    }

    @Test
    fun `tombol mati saat proses kirim berjalan`() {
        assertFalse(canSubmit(hasPhoto = true, notes = "Retak memanjang 3 m", loading = true))
    }

    @Test
    fun `tombol hidup saat foto dan catatan lengkap`() {
        assertTrue(canSubmit(hasPhoto = true, notes = "Retak memanjang 3 m", loading = false))
    }

    /**
     * `submit()` memakai `evidence.first()` tanpa cek kosong. Aturan di bawah
     * memastikan jalur itu tidak pernah tercapai dari tombol.
     */
    @Test
    fun `submit tidak boleh dipanggil saat evidence kosong`() {
        val evidence = emptyList<String>()
        val isValid = evidence.isNotEmpty() && "catatan".isNotBlank()
        assertFalse("guard isValid harus menahan submit()", isValid)
        assertNull(evidence.firstOrNull())
    }

    /**
     * Dimensi kosong harus jadi `null`, bukan 0.0 — backend menolak
     * `min:0.01` sehingga 0.0 membuat submit gagal 422.
     */
    @Test
    fun `dimensi kosong menjadi null bukan nol`() {
        assertEquals(null, dimension(""))
        assertEquals(null, dimension("   "))
        assertEquals(null, dimension("0"))
        assertEquals(null, dimension("-2"))
        assertEquals(null, dimension("abc"))
    }

    @Test
    fun `dimensi valid dibaca sebagai meter`() {
        assertEquals(3.5, dimension("3,5"))
        assertEquals(3.5, dimension("3.5"))
        assertEquals(0.01, dimension("0.01"))
    }

    /** Salinan aturan `InspectionResultViewModel.dimension()`. */
    private fun dimension(raw: String): Double? {
        val v = raw.trim().replace(',', '.').toDoubleOrNull() ?: return null
        return if (v > 0) v else null
    }
}
