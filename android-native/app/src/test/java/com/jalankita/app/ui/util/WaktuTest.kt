package com.jalankita.app.ui.util

import java.time.Instant
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * Kontrak [Waktu] — semua tanggal dari server ditampilkan dalam WIB.
 *
 * Bentuk masukan nyata dari backend (diverifikasi dengan `php -r` pada
 * `Carbon::toJSON()`):
 * - model Eloquent → `2026-11-26T01:23:45.000000Z` (UTC)
 * - `Report.php::toIso8601String()` → `2026-11-26T08:23:45+07:00`
 * - kolom `date` (`tanggal_patroli`) → tanggal 26 Nov 00:00 WIB menjadi
 *   `2026-11-25T17:00:00.000000Z`
 */
class WaktuTest {

    @Test
    fun `utc digeser ke wib`() {
        // 01:23 UTC = 08:23 WIB — inilah bug "meleset 7 jam" yang diperbaiki.
        assertEquals("26 Nov 2026, 08:23", Waktu.tanggalJam("2026-11-26T01:23:45.000000Z"))
    }

    @Test
    fun `dua bentuk zona menghasilkan tampilan sama`() {
        val utc = Waktu.tanggalJam("2026-11-26T01:23:45.000000Z")
        val wib = Waktu.tanggalJam("2026-11-26T08:23:45+07:00")
        assertEquals(utc, wib)
        assertEquals("26 Nov 2026, 08:23", wib)
    }

    @Test
    fun `tanggal kolom tidak mundur sehari`() {
        // Jadwal patroli 26 Nov: server mengirim 25 Nov 17:00Z.
        val iso = "2026-11-25T17:00:00.000000Z"
        assertEquals("26 Nov 2026", Waktu.tanggalSaja(iso))
        assertEquals(java.time.LocalDate.of(2026, 11, 26), Waktu.tanggalWib(iso))
    }

    @Test
    fun `tanggal saja tidak mengarang jam`() {
        assertEquals("26 Nov 2026", Waktu.tanggalSaja("2026-11-26"))
        assertEquals("26 Nov 2026", Waktu.tanggalJam("2026-11-26"))
        assertNull("tanggal tanpa jam tidak boleh tampil 00:00", Waktu.jamSaja("2026-11-26"))
        assertEquals("08:23", Waktu.jamSaja("2026-11-26T01:23:45Z"))
    }

    @Test
    fun `waktu relatif berjenjang`() {
        val now = Instant.parse("2026-11-26T08:23:45Z").toEpochMilli()
        assertEquals("baru saja", Waktu.relatif("2026-11-26T08:23:30Z", now))
        assertEquals("5m", Waktu.relatif("2026-11-26T08:18:45Z", now))
        assertEquals("3j", Waktu.relatif("2026-11-26T05:23:45Z", now))
        assertEquals("1h", Waktu.relatif("2026-11-25T06:23:45Z", now))
    }

    @Test
    fun `notifikasi baru masuk tetap baru saja`() {
        // Regresi BUG-2: dulu "Z" dipotong lalu dibaca WIB → tampil "7j".
        val terkirim = "2026-11-26T01:00:00.000000Z" // = 08:00 WIB
        val now = Instant.parse("2026-11-26T01:00:30Z").toEpochMilli()
        assertEquals("baru saja", Waktu.relatif(terkirim, now))
    }

    @Test
    fun `tanggal relatif hari ini kemarin dan lampau`() {
        // Hari ini dihitung dari jam dinding WIB saat tes berjalan, jadi hanya
        // bentuk lampau yang bisa dikunci di sini.
        assertEquals("Kemarin", Waktu.tanggalRelatif(
            Instant.now().minusSeconds(24 * 60 * 60L).toString(),
        ))
        val lampau = "2026-01-05T01:00:00Z"
        assertEquals("5 Jan 2026", Waktu.tanggalRelatif(lampau))
    }

    @Test
    fun `masukan rusak tidak melempar`() {
        assertNull(Waktu.tanggalJam(null))
        assertNull(Waktu.tanggalJam(""))
        assertNull(Waktu.tanggalJam("   "))
        assertNull(Waktu.tanggalJam("bukan tanggal"))
        assertNull(Waktu.tanggalSaja("null"))
        assertNull(Waktu.relatif(null, System.currentTimeMillis()))
    }
}
