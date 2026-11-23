package com.jalankita.app.core.data.outbox

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Aturan antrean: tenggat dari batas umur foto server, kuota harian, dan
 * batas percobaan. Semua fungsi murni → diuji tanpa Android.
 */
class QueuePolicyTest {

    private val satuHari = 24L * 60L * 60L * 1000L

    private fun item(
        kind: String = QueuedSubmission.KIND_WARGA_REPORT,
        createdAt: Long = 0L,
        expiresAt: Long = 0L,
        attempts: Int = 0,
        status: String = QueuedSubmission.STATUS_PENDING,
    ) = QueuedSubmission(
        id = "a1",
        kind = kind,
        status = status,
        attempts = attempts,
        createdAt = createdAt,
        expiresAt = expiresAt,
    )

    @Test
    fun `foto inspeksi kedaluwarsa dua hari, laporan warga tujuh hari`() {
        assertEquals(2, QueuePolicy.maxAgeDays(QueuedSubmission.KIND_INSPECTION_RESULT))
        assertEquals(2, QueuePolicy.maxAgeDays(QueuedSubmission.KIND_DISCOVERED_REPORT))
        assertEquals(7, QueuePolicy.maxAgeDays(QueuedSubmission.KIND_WARGA_REPORT))

        val mulai = 1_000_000L
        assertEquals(
            mulai + 2 * satuHari,
            QueuePolicy.expiresAt(QueuedSubmission.KIND_INSPECTION_RESULT, null, mulai),
        )
        assertEquals(
            mulai + 7 * satuHari,
            QueuePolicy.expiresAt(QueuedSubmission.KIND_WARGA_REPORT, null, mulai),
        )
    }

    @Test
    fun `tenggat dihitung dari waktu foto diambil, bukan waktu masuk antrean`() {
        val foto = 5 * satuHari
        val masukAntrean = foto + 6 * satuHari
        val tenggat = QueuePolicy.expiresAt(QueuedSubmission.KIND_INSPECTION_RESULT, foto, masukAntrean)
        assertEquals(
            "foto sudah 6 hari saat diantrekan → langsung kedaluwarsa",
            foto + 2 * satuHari,
            tenggat,
        )
        assertTrue(QueuePolicy.isExpired(item(expiresAt = tenggat), now = masukAntrean))
    }

    @Test
    fun `item yang belum lewat tenggat masih aktif`() {
        val now = 10 * satuHari
        assertFalse(QueuePolicy.isExpired(item(expiresAt = now + 1000), now))
        // expiresAt 0 berarti belum dihitung → jangan dianggap kedaluwarsa.
        assertFalse(QueuePolicy.isExpired(item(expiresAt = 0L), now))
    }

    @Test
    fun `kegagalan biasa menjadi retrying lalu failed setelah batas percobaan`() {
        val pertama = QueuePolicy.statusAfterFailure(
            item(attempts = 0, expiresAt = Long.MAX_VALUE),
            errorCode = null,
            message = "Gagal terhubung ke server",
        )
        assertEquals(QueuedSubmission.STATUS_RETRYING, pertama)

        val terakhir = QueuePolicy.statusAfterFailure(
            item(attempts = QueuePolicy.MAX_ATTEMPTS - 1, expiresAt = Long.MAX_VALUE),
            errorCode = null,
            message = "Gagal terhubung ke server",
        )
        assertEquals(QueuedSubmission.STATUS_FAILED, terakhir)
    }

    @Test
    fun `batas harian tidak dihitung sebagai percobaan`() {
        val status = QueuePolicy.statusAfterFailure(
            item(attempts = QueuePolicy.MAX_ATTEMPTS - 1, expiresAt = Long.MAX_VALUE),
            errorCode = "DAILY_LIMIT_EXCEEDED",
            message = "Anda telah mencapai batas laporan harian",
        )
        assertEquals(QueuedSubmission.STATUS_WAITING_QUOTA, status)
        assertFalse(
            "kuota bukan percobaan gagal — kalau dihitung, item dibuang malam ini padahal besok berhasil",
            QueuePolicy.countsAsAttempt(status),
        )
    }

    @Test
    fun `kuota dikenali dari kode maupun pesan server`() {
        assertTrue(QueuePolicy.isQuotaError("DAILY_LIMIT_EXCEEDED"))
        assertTrue(QueuePolicy.isQuotaError(null, "Silakan coba lagi besok."))
        assertFalse(QueuePolicy.isQuotaError("DUPLICATE_IMAGE", "Foto sudah pernah dilaporkan"))
        assertFalse(QueuePolicy.isQuotaError(null, null))
    }

    @Test
    fun `item yang kedaluwarsa ditandai expired bukan dicoba terus`() {
        val status = QueuePolicy.statusAfterFailure(
            item(attempts = 0, expiresAt = 1000L),
            errorCode = null,
            message = "waktu habis",
            now = 5000L,
        )
        assertEquals(QueuedSubmission.STATUS_EXPIRED, status)
    }

    @Test
    fun `reset kuota jatuh pada tengah malam WIB`() {
        val wib = java.time.ZoneId.of("Asia/Jakarta")
        listOf(1_767_272_400_000L, 1_767_300_000_000L, 1_767_350_000_000L).forEach { now ->
            val reset = QueuePolicy.nextQuotaReset(now)
            val waktu = java.time.Instant.ofEpochMilli(reset).atZone(wib)
            assertEquals("tengah malam", 0, waktu.hour)
            assertEquals(0, waktu.minute)
            assertTrue("reset harus sesudah sekarang", reset > now)
            assertTrue("reset maksimal 24 jam lagi", reset - now <= satuHari)
        }
    }

    @Test
    fun `label sisa waktu ramah dibaca`() {
        assertEquals("foto sudah kedaluwarsa", QueuePolicy.remainingLabel(0))
        assertEquals("kurang dari 1 jam", QueuePolicy.remainingLabel(30 * 60 * 1000L))
        assertEquals("6 jam lagi", QueuePolicy.remainingLabel(6 * 60 * 60 * 1000L))
        assertEquals("1 hari lagi", QueuePolicy.remainingLabel(30 * 60 * 60 * 1000L))
        assertEquals("3 hari lagi", QueuePolicy.remainingLabel(3 * satuHari))
    }

    @Test
    fun `kiriman milik akun lain tidak boleh dikirim oleh sesi ini`() {
        assertTrue(QueuePolicy.belongsTo("7", "7"))
        assertFalse(
            "laporan akun A tidak boleh terkirim memakai sesi akun B",
            QueuePolicy.belongsTo("7", "8"),
        )
        assertTrue("item lama tanpa pemilik tetap boleh dikirim", QueuePolicy.belongsTo(null, "8"))
        assertTrue(QueuePolicy.belongsTo("8", null))
    }

    @Test
    fun `batas antrean masuk akal`() {
        assertTrue(QueuePolicy.MAX_ITEMS in 10..100)
        assertTrue(QueuePolicy.MAX_ATTEMPTS in 3..20)
        assertTrue(QueuePolicy.MAX_OUTBOX_BYTES > 10L * 1024 * 1024)
    }
}
