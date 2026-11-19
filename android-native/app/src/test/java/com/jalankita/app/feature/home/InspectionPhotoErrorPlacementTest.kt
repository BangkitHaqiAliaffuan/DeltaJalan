package com.jalankita.app.feature.home

import java.io.File
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Penjaga penempatan pesan galat validasi foto.
 *
 * Bug yang dikunci: foto kedaluwarsa (mis. diambil 5 hari lalu) ditolak
 * `ExifValidator`, tetapi pesannya dulu ditulis ke `error` — state yang
 * dirender di DASAR layar, jauh di bawah area gulir. Petugas hanya melihat
 * tombol "Kirim" yang diam dan tidak tahu fotonya yang ditolak.
 *
 * Perbaikannya: galat foto ditulis ke `photoError`, yang dirender tepat di
 * dalam kartu "Foto Bukti Lapangan". Karena ini menyangkut PENEMPATAN state
 * dan bukan nilai balik fungsi, satu-satunya cara menguncinya adalah memeriksa
 * sumber ViewModel.
 */
class InspectionPhotoErrorPlacementTest {

    private fun readSource(relatif: String): String {
        // Test berjalan dengan working directory modul `app/`, tapi beberapa
        // runner memakai akar repo. Coba beberapa kandidat agar tidak rapuh.
        val kandidat = listOf(
            File("src/main/java/com/jalankita/app/$relatif"),
            File("app/src/main/java/com/jalankita/app/$relatif"),
        )
        val file = kandidat.firstOrNull { it.exists() }
        assertTrue(
            "Sumber tidak ditemukan. Dicoba: ${kandidat.joinToString { it.absolutePath }}",
            file != null,
        )
        return file!!.readText()
    }

    /** Ambil isi satu fungsi berdasarkan nama, dari `fun nama(` sampai `}` penutup. */
    private fun badanFungsi(sumber: String, nama: String): String {
        val mulai = sumber.indexOf("fun $nama(")
        assertTrue("Fungsi `$nama` tidak ditemukan", mulai >= 0)
        var kedalaman = 0
        var i = sumber.indexOf("{", mulai)
        val awal = i
        while (i < sumber.length) {
            when (sumber[i]) {
                '{' -> kedalaman++
                '}' -> {
                    kedalaman--
                    if (kedalaman == 0) return sumber.substring(awal, i + 1)
                }
            }
            i++
        }
        error("Kurung kurawal fungsi `$nama` tidak seimbang")
    }

    @Test
    fun `validasi foto memakai photoError bukan error`() {
        val vm = readSource("feature/home/InspectionResultViewModel.kt")
        val addPhotos = badanFungsi(vm, "addPhotos")

        assertTrue(
            "addPhotos harus mengisi photoError agar pesan tampil di kartu foto",
            addPhotos.contains("photoError ="),
        )
        assertFalse(
            "addPhotos tidak boleh mengisi `error` — pesannya tidak akan terlihat",
            Regex("""(^|[^a-zA-Z])error\s*=(?!\s*null)""").containsMatchIn(addPhotos),
        )
    }

    @Test
    fun `kartu foto merender photoError`() {
        val layar = readSource("feature/home/InspectionResultScreen.kt")
        // Dua form (inspeksi & temuan) harus sama-sama menampilkannya.
        val jumlah = Regex("""vm\.photoError\?\.let""").findAll(layar).count()
        assertTrue(
            "Kedua form harus merender vm.photoError di kartu foto, ditemukan $jumlah",
            jumlah == 2,
        )
    }

    @Test
    fun `resetDraft membersihkan photoError`() {
        val vm = readSource("feature/home/InspectionResultViewModel.kt")
        val reset = badanFungsi(vm, "resetDraft")

        assertTrue("resetDraft harus mengosongkan photoError", reset.contains("photoError = null"))
        // Regresi: `submitted` sempat hilang saat photoError ditambahkan.
        assertTrue("resetDraft harus tetap mengosongkan submitted", reset.contains("submitted = null"))
    }

    /**
     * Field WAJIB harus di atas field opsional.
     *
     * Bug lapangan: "Catatan Hasil Pemeriksaan *" berada di dasar form setelah
     * 6 field opsional. Di perangkat 720x1448 field itu berada di bawah lipatan,
     * sehingga petugas mengisi semua yang terlihat, tombol Kirim tetap
     * `enabled=false`, dan tekan tombol tidak menghasilkan reaksi apa pun.
     */
    @Test
    fun `catatan wajib berada di atas field opsional`() {
        val layar = readSource("feature/home/InspectionResultScreen.kt")
        val form = layar.substring(0, layar.indexOf("fun DiscoveredReportScreen("))

        val catatan = form.indexOf("Catatan Hasil Pemeriksaan")
        val perkerasan = form.indexOf("Jenis Perkerasan")

        assertTrue("Field catatan wajib harus ada", catatan >= 0)
        assertTrue("Field jenis perkerasan harus ada", perkerasan >= 0)
        assertTrue(
            "Catatan wajib (index $catatan) harus muncul SEBELUM jenis perkerasan ($perkerasan)",
            catatan < perkerasan,
        )
    }
}
