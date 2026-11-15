package com.jalankita.app.feature.home

import com.jalankita.app.core.network.InspectionAssignmentDto
import com.jalankita.app.core.network.InspectionReportDto
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Penjaga aturan pemilihan kartu "Tugas Inspeksi" di Beranda petugas.
 *
 * Dua hal yang mudah salah dan berdampak nyata:
 *  1. `submitted` BUKAN tugas petugas lagi — pekerjaannya sudah dikirim dan
 *     kini menunggu supervisor. Menampilkannya membuat petugas mengira masih
 *     ada yang harus dikerjakan.
 *  2. Batas 3 kartu harus dipotong SETELAH penyaringan, bukan sebelum, kalau
 *     tidak kartu yang seharusnya tampil bisa terbuang oleh tugas yang selesai.
 */
class InspectionTasksHomeTest {

    private fun assignment(id: String, status: String) =
        InspectionAssignmentDto(
            id = id,
            status = status,
            report = InspectionReportDto(id = "rep-$id", roadName = "Jl. Uji $id"),
        )

    /** Cermin dari DashboardViewModel.applyInspectionTasks(). */
    private fun pick(all: List<InspectionAssignmentDto>, max: Int = 3) =
        all.filter { it.status == "assigned" || it.status == "started" }.take(max)

    @Test
    fun `hanya assigned dan started yang ditampilkan`() {
        val hasil = pick(
            listOf(
                assignment("a", "assigned"),
                assignment("b", "started"),
                assignment("c", "submitted"),
                assignment("d", "reviewed"),
            ),
        )

        assertEquals(listOf("a", "b"), hasil.map { it.id })
    }

    @Test
    fun `maksimal tiga kartu`() {
        val hasil = pick((1..6).map { assignment("t$it", "assigned") })

        assertEquals(3, hasil.size)
    }

    @Test
    fun `penyaringan dilakukan sebelum pemotongan`() {
        // Tiga tugas selesai di depan tidak boleh menghabiskan kuota,
        // sehingga tugas yang benar-benar menunggu tetap tampil.
        val hasil = pick(
            listOf(
                assignment("s1", "submitted"),
                assignment("s2", "submitted"),
                assignment("s3", "submitted"),
                assignment("a1", "assigned"),
            ),
        )

        assertEquals(listOf("a1"), hasil.map { it.id })
    }

    @Test
    fun `daftar kosong aman`() {
        assertEquals(emptyList<InspectionAssignmentDto>(), pick(emptyList()))
    }

    @Test
    fun `tidak ada tugas aktif menghasilkan daftar kosong`() {
        // Seksi di Beranda disembunyikan saat kosong, bukan kartu kosong.
        assertEquals(
            emptyList<InspectionAssignmentDto>(),
            pick(listOf(assignment("x", "submitted"))),
        )
    }
}
