package com.jalankita.app.feature.supervisor

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
}
