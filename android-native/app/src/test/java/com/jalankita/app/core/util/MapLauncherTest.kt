package com.jalankita.app.core.util

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Penjaga `MapLauncher` — jalur navigasi petugas ke titik inspeksi.
 *
 * Yang dijaga:
 *  1. Koordinat tidak valid TIDAK boleh menghasilkan intent (mencegah
 *     `geo:null,null` atau crash pada data server yang kosong).
 *  2. Format koordinat selalu titik desimal (bukan koma) — koma pada URI
 *     memisahkan lat/lng sehingga akan merusak parsing aplikasi peta.
 *  3. Label jalan ter-encode sehingga karakter seperti spasi/paren tidak
 *     memotong query.
 */
class MapLauncherTest {

    @Test
    fun `koordinat valid diterima`() {
        assertTrue(MapLauncher.isValidCoordinate(-7.4445851, 112.7270596))
        assertTrue(MapLauncher.isValidCoordinate(0.1, 0.1))
    }

    @Test
    fun `koordinat null atau di luar rentang ditolak`() {
        assertFalse(MapLauncher.isValidCoordinate(null, 112.7))
        assertFalse(MapLauncher.isValidCoordinate(-7.4, null))
        assertFalse(MapLauncher.isValidCoordinate(null, null))
        assertFalse(MapLauncher.isValidCoordinate(91.0, 112.7))
        assertFalse(MapLauncher.isValidCoordinate(-7.4, 181.0))
        assertFalse(MapLauncher.isValidCoordinate(Double.NaN, 112.7))
        assertFalse(MapLauncher.isValidCoordinate(Double.POSITIVE_INFINITY, 112.7))
    }

    @Test
    fun `null island ditolak`() {
        // 0,0 hampir pasti data kosong yang terisi default, bukan jalan di Sidoarjo.
        assertFalse(MapLauncher.isValidCoordinate(0.0, 0.0))
    }

    @Test
    fun `format koordinat memakai titik desimal enam digit`() {
        assertEquals("-7.444585", MapLauncher.fmt(-7.4445851))
        assertEquals("112.727060", MapLauncher.fmt(112.7270596))
        assertEquals("-7.444585, 112.727060", MapLauncher.coordinateText(-7.4445851, 112.7270596))
        // Tidak boleh ada koma desimal (locale Indonesia), karena koma adalah pemisah lat/lng.
        assertFalse(MapLauncher.coordinateText(-7.5, 112.5).contains("-7,5"))
    }

    @Test
    fun `geo uri berisi q dengan label ter-encode`() {
        val uri = MapLauncher.geoUri(-7.4445851, 112.7270596, "Jl. Raya Buduran (Barat)")
        assertTrue(uri.startsWith("geo:-7.444585,112.727060?q=-7.444585,112.727060("))
        // Label harus ter-encode di dalam kurung: spasi & kurung jadi %20/%28.
        assertTrue(uri.endsWith("Jl.%20Raya%20Buduran%20%28Barat%29)"))
        assertFalse("label tidak boleh mengandung spasi mentah", uri.contains(" "))
    }

    @Test
    fun `geo uri tanpa label tetap valid`() {
        val uri = MapLauncher.geoUri(-7.4445851, 112.7270596)
        assertEquals("geo:-7.444585,112.727060?q=-7.444585,112.727060", uri)
    }

    @Test
    fun `web uri memakai bentuk search api 1`() {
        val url = MapLauncher.webUri(-7.4445851, 112.7270596)
        assertEquals(
            "https://www.google.com/maps/search/?api=1&query=-7.444585,112.727060",
            url,
        )
    }
}
