package com.jalankita.app.core.util

import android.util.Log
import java.io.InputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * Parser GPS EXIF **byte-level** (mandiri, tanpa androidx.exifinterface).
 *
 * ## Kenapa perlu ini?
 * Pada perangkat nyata (Samsung A21s, Android 12) `androidx.exifinterface` (diuji
 * 1.3.7 & 1.4.1) **GAGAL membaca GPS** dari file JPEG yang jelas-jelas punya GPS
 * (diverifikasi PIL/piexif; round-trip ExifInterface membuktikan lib itu bisa baca
 * GPS yang ia tulis sendiri). Tag tanggal terbaca, tag GPS `null` total. Ini
 * kemungkinan bug parser pada struktur IFD tertentu.
 *
 * Parser ini membaca langsung struktur TIFF: APP1("Exif") → IFD0 → tag 0x8825
 * (GPSInfoIFD) → GPSLatitude(0x0002)/Ref(0x0001)/Longitude(0x0004)/Ref(0x0003).
 * Pendekatan yang sama dipakai ekstraktor server (tier PEL raw-bytes).
 */
object RawExifGps {

    private const val TAG = "RawExifGps"

    private const val TAG_GPS_INFO_IFD = 0x8825
    private const val TAG_GPS_LAT_REF = 0x0001
    private const val TAG_GPS_LAT = 0x0002
    private const val TAG_GPS_LNG_REF = 0x0003
    private const val TAG_GPS_LNG = 0x0004

    /**
     * Baca GPS dari stream JPEG.
     * @return Pair(lat, lng) atau null bila tidak ada/tidak valid.
     */
    fun read(input: InputStream): Pair<Double, Double>? {
        return try {
            input.use { readInternal(it.readBytes()) }
        } catch (e: Exception) {
            Log.w(TAG, "gagal baca stream: ${e.message}")
            null
        }
    }

    /** @return Pair(lat,lng) atau null. */
    private fun readInternal(jpeg: ByteArray): Pair<Double, Double>? {
        if (jpeg.size < 4 || jpeg[0] != 0xFF.toByte() || jpeg[1] != 0xD8.toByte()) return null

        // Cari segmen APP1 dengan header "Exif\0\0".
        var i = 2
        while (i + 4 <= jpeg.size) {
            if (jpeg[i] != 0xFF.toByte()) return null
            val marker = jpeg[i + 1].toInt() and 0xFF
            // Marker tanpa panjang (SOI/EOI/RSTn).
            if (marker == 0xD8 || marker == 0xD9 || (marker in 0xD0..0xD7)) { i += 2; continue }
            if (i + 4 > jpeg.size) return null
            val segLen = ((jpeg[i + 2].toInt() and 0xFF) shl 8) or (jpeg[i + 3].toInt() and 0xFF)
            if (segLen < 2) return null
            val segEnd = i + 2 + segLen
            if (segEnd > jpeg.size) return null
            if (marker == 0xE1 && segLen >= 8 &&
                jpeg[i + 4] == 'E'.code.toByte() && jpeg[i + 5] == 'x'.code.toByte() &&
                jpeg[i + 6] == 'i'.code.toByte() && jpeg[i + 7] == 'f'.code.toByte()
            ) {
                val tiffOffset = i + 10 // lewati "Exif\0\0"
                return parseTiffGps(jpeg, tiffOffset, segEnd)
            }
            i = segEnd
        }
        return null
    }

    private fun parseTiffGps(buf: ByteArray, tiffStart: Int, limit: Int): Pair<Double, Double>? {
        if (tiffStart + 8 > limit) return null
        val endian = when {
            buf[tiffStart] == 'I'.code.toByte() && buf[tiffStart + 1] == 'I'.code.toByte() -> ByteOrder.LITTLE_ENDIAN
            buf[tiffStart] == 'M'.code.toByte() && buf[tiffStart + 1] == 'M'.code.toByte() -> ByteOrder.BIG_ENDIAN
            else -> return null
        }
        val bb = ByteBuffer.wrap(buf).order(endian)
        val magic = bb.getShort(tiffStart + 2).toInt() and 0xFFFF
        if (magic != 42) return null
        val ifd0Rel = bb.getInt(tiffStart + 4)
        if (ifd0Rel <= 0) return null
        val ifd0Abs = tiffStart + ifd0Rel
        if (ifd0Abs + 2 > limit) return null

        val gpsIfdRel = findGpsIfdOffset(bb, ifd0Abs, limit) ?: return null
        val gpsIfdAbs = tiffStart + gpsIfdRel
        if (gpsIfdAbs + 2 > limit) return null

        var latRef: String? = null
        var lngRef: String? = null
        var latVal: Double? = null
        var lngVal: Double? = null

        val n = bb.getShort(gpsIfdAbs).toInt() and 0xFFFF
        for (k in 0 until n) {
            val entry = gpsIfdAbs + 2 + k * 12
            if (entry + 12 > limit) break
            val tag = bb.getShort(entry).toInt() and 0xFFFF
            val type = bb.getShort(entry + 2).toInt() and 0xFFFF
            val count = bb.getInt(entry + 4)
            if (count <= 0 || count > 16) continue
            when (tag) {
                TAG_GPS_LAT_REF -> latRef = readAscii(buf, bb, entry, type, count, tiffStart, limit)
                TAG_GPS_LNG_REF -> lngRef = readAscii(buf, bb, entry, type, count, tiffStart, limit)
                TAG_GPS_LAT -> latVal = readRationalTriplet(bb, entry, type, count, tiffStart, limit)
                TAG_GPS_LNG -> lngVal = readRationalTriplet(bb, entry, type, count, tiffStart, limit)
            }
        }

        val lat = applyRef(latVal, latRef, "S") ?: return null
        val lng = applyRef(lngVal, lngRef, "W") ?: return null
        if (lat == 0.0 && lng == 0.0) return null
        return lat to lng
    }

    /** Cari offset RELATIF GPSInfoIFD (tag 0x8825) di IFD0. */
    private fun findGpsIfdOffset(bb: ByteBuffer, ifd0Abs: Int, limit: Int): Int? {
        val n = bb.getShort(ifd0Abs).toInt() and 0xFFFF
        for (k in 0 until n) {
            val entry = ifd0Abs + 2 + k * 12
            if (entry + 12 > limit) return null
            val tag = bb.getShort(entry).toInt() and 0xFFFF
            if (tag == TAG_GPS_INFO_IFD) {
                // type harus LONG(4); nilainya offset relatif ke awal TIFF.
                return bb.getInt(entry + 8)
            }
        }
        return null
    }

    private fun readAscii(
        buf: ByteArray, bb: ByteBuffer, entry: Int, type: Int, count: Int,
        tiffStart: Int, limit: Int,
    ): String? {
        if (type != 2) return null
        val dataOff = if (count <= 4) entry + 8 else tiffStart + bb.getInt(entry + 8)
        if (dataOff < 0 || dataOff + count > limit) return null
        return String(buf, dataOff, count, Charsets.US_ASCII).trim('\u0000', ' ')
    }

    /** Baca 3 RATIONAL (derajat, menit, detik) → desimal. */
    private fun readRationalTriplet(
        bb: ByteBuffer, entry: Int, type: Int, count: Int, tiffStart: Int, limit: Int,
    ): Double? {
        if (type != 5) return null
        // 3 rational * 8 bytes = 24 bytes (selalu di luar entry).
        val dataOff = tiffStart + bb.getInt(entry + 8)
        if (dataOff < 0 || dataOff + 24 > limit) return null
        val nums = DoubleArray(3)
        for (j in 0 until 3) {
            val num = bb.getInt(dataOff + j * 8).toLong() and 0xFFFFFFFFL
            val den = bb.getInt(dataOff + j * 8 + 4).toLong() and 0xFFFFFFFFL
            if (den == 0L) return null
            nums[j] = num.toDouble() / den.toDouble()
        }
        return nums[0] + nums[1] / 60.0 + nums[2] / 3600.0
    }

    private fun applyRef(value: Double?, ref: String?, negativeRef: String): Double? {
        if (value == null) return null
        return if (ref.equals(negativeRef, ignoreCase = true)) -value else value
    }
}
