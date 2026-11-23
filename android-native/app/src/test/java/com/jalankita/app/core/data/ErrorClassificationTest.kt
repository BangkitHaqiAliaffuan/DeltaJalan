package com.jalankita.app.core.data

import java.io.IOException
import java.net.ConnectException
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Penjaga klasifikasi kegagalan jaringan.
 *
 * Latar belakang: dulu pemanggil memutuskan "offline atau bukan" dengan
 * mencocokkan teks pesan (`contains("koneksi"|"host"|"timeout")`). Pesan bawaan
 * OkHttp berbahasa Inggris, sehingga laporan warga yang gagal karena sinyal
 * hilang tidak masuk antrean offline dan fotonya terbuang. Klasifikasi sekarang
 * berasal dari tipe exception / kode HTTP, dan diuji di sini.
 */
class ErrorClassificationTest {

    // ── classifyFailure: exception tanpa kode HTTP ──────────────────────────

    @Test
    fun `gangguan jaringan dianggap sementara`() {
        assertEquals(ErrorKind.NETWORK, classifyFailure(UnknownHostException("no dns")))
        assertEquals(ErrorKind.NETWORK, classifyFailure(ConnectException("refused")))
        assertEquals(ErrorKind.NETWORK, classifyFailure(SocketTimeoutException("timed out")))
        // Pesan OkHttp yang dulu tidak cocok dengan pencocokan teks.
        assertEquals(
            ErrorKind.NETWORK,
            classifyFailure(IOException("Failed to connect to api.deltajalan.web.id/1.2.3.4:443")),
        )
    }

    @Test
    fun `bug logika atau data rusak dianggap permanen`() {
        assertEquals(ErrorKind.SERVER, classifyFailure(IllegalStateException("boom")))
        assertEquals(ErrorKind.SERVER, classifyFailure(IllegalArgumentException("bad json")))
    }

    // ── classifyStatus: kode HTTP ───────────────────────────────────────────

    @Test
    fun `kode 5xx dan 408 425 429 sementara`() {
        listOf(500, 502, 503, 504, 408, 425, 429).forEach {
            assertEquals("kode $it", ErrorKind.NETWORK, classifyStatus(it))
        }
    }

    @Test
    fun `kode 4xx validasi permanen`() {
        listOf(400, 401, 403, 404, 409, 422).forEach {
            assertEquals("kode $it", ErrorKind.SERVER, classifyStatus(it))
        }
    }

    // ── DashboardResult.Error ───────────────────────────────────────────────

    @Test
    fun `error tanpa kode default sementara`() {
        val e = DashboardResult.Error("Tidak dapat terhubung ke server.")
        assertNull(e.code)
        assertTrue(e.isNetwork)
        assertFalse(e.isPermanent)
    }

    @Test
    fun `error 422 permanen dan error 503 sementara`() {
        val ditolak = DashboardResult.Error("Foto terlalu jauh dari lokasi.", code = 422)
        assertTrue(ditolak.isPermanent)
        assertFalse(ditolak.isNetwork)

        val serverSibuk = DashboardResult.Error("Terjadi kesalahan (503).", code = 503)
        assertTrue(serverSibuk.isNetwork)
        assertFalse(serverSibuk.isPermanent)
    }

    @Test
    fun `pesan server tanpa kode tetap bisa diklasifikasi lewat kind`() {
        val e = DashboardResult.Error("Foto terlalu jauh dari lokasi.", kind = ErrorKind.SERVER)
        assertTrue(e.isPermanent)
        assertNull(e.code)
    }

    // ── shouldGiveUp: batas percobaan antrean offline ───────────────────────

    @Test
    fun `gangguan sementara diulang sampai batas percobaan`() {
        val sementara = DashboardResult.Error("jaringan mati")
        assertFalse(shouldGiveUp(sementara, 0))
        assertFalse(shouldGiveUp(sementara, MAX_UPLOAD_ATTEMPTS - 1))
        assertTrue(shouldGiveUp(sementara, MAX_UPLOAD_ATTEMPTS))
        assertTrue(shouldGiveUp(sementara, MAX_UPLOAD_ATTEMPTS + 5))
    }

    @Test
    fun `penolakan server langsung berhenti tanpa menunggu batas`() {
        val permanen = DashboardResult.Error("Ditolak.", code = 422)
        assertTrue(shouldGiveUp(permanen, 0))
    }

    @Test
    fun `batas percobaan masuk akal`() {
        assertTrue("batas harus > 1", MAX_UPLOAD_ATTEMPTS > 1)
        assertTrue("batas harus <= 20", MAX_UPLOAD_ATTEMPTS <= 20)
    }
}
