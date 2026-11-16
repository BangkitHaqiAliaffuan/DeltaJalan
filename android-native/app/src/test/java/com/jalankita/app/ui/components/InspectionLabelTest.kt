package com.jalankita.app.ui.components

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * Penjaga label tahap inspeksi — dipakai kartu laporan di tujuh tempat dan
 * chip detail supervisor.
 *
 * Regresi yang dijaga: kartu laporan hanya menampilkan `status`, sehingga
 * laporan yang sedang diukur tampil sebagai "Ditugaskan" saja dan supervisor
 * tidak bisa membedakannya dari laporan yang sedang diperbaiki.
 */
class InspectionLabelTest {

    @Test
    fun `assigned berarti menunggu petugas ukur`() {
        val l = inspectionLabel("warga", "assigned", null)

        assertEquals("Menunggu Petugas Ukur", l?.text)
        assertNull(l?.inspectorName)
    }

    @Test
    fun `started berarti sedang diinspeksi`() {
        val l = inspectionLabel("warga", "started", "Budi")

        assertEquals("Sedang Diinspeksi", l?.text)
        assertEquals("Budi", l?.inspectorName)
    }

    @Test
    fun `submitted berarti hasil siap review`() {
        assertEquals("Hasil Siap Review", inspectionLabel("warga", "submitted", "Budi")?.text)
    }

    @Test
    fun `reviewed berarti sudah diinspeksi`() {
        assertEquals("Sudah Diinspeksi", inspectionLabel("warga", "reviewed", "Budi")?.text)
    }

    @Test
    fun `laporan tanpa inspeksi tidak diberi label`() {
        // Kartu harus tetap menampilkan status biasa ("Menunggu Review").
        assertNull(inspectionLabel("warga", null, null))
        assertNull(inspectionLabel("warga", "none", null))
    }

    @Test
    fun `laporan petugas tidak pernah berlabel inspeksi`() {
        // Petugas melapor = mengukur sekaligus, tidak ada tahap inspeksi.
        assertNull(inspectionLabel("petugas", "assigned", null))
        assertNull(inspectionLabel("petugas", "started", "Budi"))
    }

    @Test
    fun `state tak dikenal tidak mengarang label`() {
        // Backend versi lebih baru bisa mengirim state baru; lebih baik
        // menampilkan status biasa daripada label yang salah.
        assertNull(inspectionLabel("warga", "tahap-baru", null))
    }

    @Test
    fun `source kosong tidak menghasilkan label`() {
        assertNull(inspectionLabel(null, "started", "Budi"))
        assertNull(inspectionLabel("", "started", "Budi"))
    }

    @Test
    fun `nama petugas kosong diabaikan`() {
        val l = inspectionLabel("warga", "started", "   ")

        assertNotNull(l)
        assertNull(l?.inspectorName)
    }

    @Test
    fun `nama petugas diambil dari state manapun yang punya pelaksana`() {
        // Setelah migrasi inspector_id, nama tersedia sejak petugas menekan Mulai.
        assertEquals("Andi", inspectionLabel("warga", "assigned", "Andi")?.inspectorName)
        assertEquals("Andi", inspectionLabel("warga", "started", "Andi")?.inspectorName)
    }

    @Test
    fun `telegram diperlakukan seperti warga`() {
        // Laporan Telegram berasal dari warga; ikut jalur inspeksi yang sama.
        assertEquals("Sedang Diinspeksi", inspectionLabel("telegram", "started", null)?.text)
    }
}
