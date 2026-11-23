package com.jalankita.app.feature.queue

import com.jalankita.app.core.data.outbox.QueuedSubmission
import org.junit.Assert.assertEquals
import org.junit.Test

/** Teks layar antrean — batas waktu relatif mudah salah, jadi diuji eksplisit. */
class QueueFormatTest {

    private val menit = 60_000L
    private val jam = 60 * menit
    private val hari = 24 * jam

    private fun item(kind: String, district: String? = "Sidoarjo", createdAt: Long = 0L) =
        QueuedSubmission(kind = kind, district = district, createdAt = createdAt)

    @Test
    fun `jenis kiriman punya label yang jelas`() {
        assertEquals("Laporan warga", QueueFormat.jenis(item(QueuedSubmission.KIND_WARGA_REPORT)))
        assertEquals("Hasil inspeksi", QueueFormat.jenis(item(QueuedSubmission.KIND_INSPECTION_RESULT)))
        assertEquals("Temuan lapangan", QueueFormat.jenis(item(QueuedSubmission.KIND_DISCOVERED_REPORT)))
        assertEquals("Kiriman", QueueFormat.jenis(item("jenis_baru_dari_versi_lain")))
    }

    @Test
    fun `umur memakai satuan yang paling masuk akal`() {
        val sekarang = 10 * hari
        assertEquals("baru saja", QueueFormat.umur(sekarang, sekarang))
        assertEquals("baru saja", QueueFormat.umur(sekarang + 5 * menit, sekarang))
        assertEquals("5 menit lalu", QueueFormat.umur(sekarang - 5 * menit, sekarang))
        assertEquals("3 jam lalu", QueueFormat.umur(sekarang - 3 * jam, sekarang))
        assertEquals("2 hari lalu", QueueFormat.umur(sekarang - 2 * hari, sekarang))
    }

    @Test
    fun `lokasi dan umur digabung tanpa bagian kosong`() {
        val sekarang = 3 * jam
        assertEquals(
            "Sidoarjo · 2 jam lalu",
            QueueFormat.lokasiDanUmur(item(QueuedSubmission.KIND_WARGA_REPORT, createdAt = jam), sekarang),
        )
        assertEquals(
            "2 jam lalu",
            QueueFormat.lokasiDanUmur(
                item(QueuedSubmission.KIND_WARGA_REPORT, district = "  ", createdAt = jam),
                sekarang,
            ),
        )
    }
}
