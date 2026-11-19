package com.jalankita.app.feature.supervisor

import com.jalankita.app.core.network.SupervisorInspectionResult
import com.jalankita.app.core.network.SupervisorReportDetail
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * Penjaga kontrak tahap inspeksi antara backend dan aplikasi supervisor.
 *
 * `inspection_state` BUKAN nilai `status` laporan — ia dihitung backend dari
 * tugas inspeksi (`InspectionProgressService`). Supervisor memakainya untuk
 * membedakan "menunggu petugas ukur" / "sedang diukur" / "siap review",
 * sesuatu yang dulu tidak terlihat karena semuanya berstatus `Ditugaskan`.
 */
class InspectionStateContractTest {

    private val adapter = Moshi.Builder()
        .add(KotlinJsonAdapterFactory())
        .build()
        .adapter(SupervisorReportDetail::class.java)

    @Test
    fun `state assigned terbaca beserta nama petugas`() {
        val d = adapter.fromJson(
            """{"id":"r-1","status":"Ditugaskan","source":"warga",
               "has_inspection":true,"inspection_state":"assigned",
               "inspector_name":"Budi Santoso"}""",
        )!!

        assertEquals("assigned", d.inspectionState)
        assertEquals("Budi Santoso", d.inspectorName)
        // Status laporan TIDAK berubah saat masuk jalur inspeksi.
        assertEquals("Ditugaskan", d.status)
    }

    @Test
    fun `state started menandakan petugas sedang di lokasi`() {
        val d = adapter.fromJson(
            """{"id":"r-1","status":"Ditugaskan","source":"warga",
               "inspection_state":"started","inspector_name":"Andi"}""",
        )!!

        assertEquals("started", d.inspectionState)
        assertEquals("Andi", d.inspectorName)
    }

    @Test
    fun `state submitted berarti menunggu review`() {
        val d = adapter.fromJson(
            """{"id":"r-1","status":"Ditugaskan","source":"warga",
               "inspection_state":"submitted","inspector_name":"Budi"}""",
        )!!

        assertEquals("submitted", d.inspectionState)
    }

    @Test
    fun `laporan tanpa inspeksi tetap aman bila field tidak dikirim`() {
        // Klien harus tetap jalan terhadap backend versi lama.
        val d = adapter.fromJson("""{"id":"r-1","status":"Menunggu Review","source":"warga"}""")!!

        assertNull(d.inspectionState)
        assertNull(d.inspectorName)
    }

    @Test
    fun `nama petugas null saat baru dijadwalkan`() {
        // Penugasan masih di tingkat tim; orangnya belum ditentukan.
        val d = adapter.fromJson(
            """{"id":"r-1","status":"Ditugaskan","source":"warga",
               "inspection_state":"assigned","inspector_name":null}""",
        )!!

        assertEquals("assigned", d.inspectionState)
        assertNull(d.inspectorName)
    }

    /**
     * Regresi: detail supervisor tidak pernah memuat isi hasil ukur petugas.
     *
     * Backend dulu hanya mengirim `inspection_state` + `inspector_name`, jadi
     * layar detail menampilkan badge "Sudah Diinspeksi" tanpa catatan, dimensi,
     * maupun foto bukti. Test ini mengunci bentuk payload barunya.
     */
    @Test
    fun `hasil inspeksi terbaca lengkap di detail supervisor`() {
        val d = adapter.fromJson(
            """{"id":"r-1","status":"Ditinjau","source":"warga",
               "has_inspection":true,"inspection_state":"submitted",
               "inspector_name":"Rizky Firmansyah",
               "inspection_result":{"id":"res-1","condition":"Rusak Sedang",
                 "notes":"Lubang memanjang di lajur kiri",
                 "kerusakan_panjang":3.5,"kerusakan_lebar":5.0,"kerusakan_kedalaman":2.0,
                 "jenis_perkerasan":"aspal","kepadatan_lalu_lintas":"padat",
                 "inspector_name":"Rizky Firmansyah",
                 "photos":[{"id":"p-1","url":"/storage/inspection/a.jpg","sort_order":0}]}}""",
        )!!

        val hasil = d.inspectionResult!!
        assertEquals("Rusak Sedang", hasil.condition)
        assertEquals("Lubang memanjang di lajur kiri", hasil.notes)
        assertEquals("aspal", hasil.jenisPerkerasan)
        assertEquals("padat", hasil.kepadatanLaluLintas)
        assertEquals(3.5, hasil.kerusakanPanjang!!, 0.001)
        assertEquals(1, hasil.photos?.size)
        // Ringkasan dimensi dipakai langsung oleh kartu di layar detail.
        assertEquals("3.5 \u00d7 5 \u00d7 2 m", hasil.dimensiText)
    }

    @Test
    fun `laporan tanpa hasil inspeksi tetap aman`() {
        val d = adapter.fromJson(
            """{"id":"r-2","status":"Menunggu Review","source":"warga",
               "has_inspection":false,"inspection_state":"none","inspection_result":null}""",
        )!!

        assertNull(d.inspectionResult)
        assertNull(d.inspectorName)
    }

    @Test
    fun `dimensi yang tidak diukur ditandai strip`() {
        val hasil = SupervisorInspectionResult(
            id = "res-2",
            kerusakanPanjang = 3.0,
            kerusakanLebar = null,
            kerusakanKedalaman = null,
        )

        assertEquals("3 \u00d7 - \u00d7 - m", hasil.dimensiText)
    }
}
