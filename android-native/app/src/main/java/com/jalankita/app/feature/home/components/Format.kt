package com.jalankita.app.feature.home.components

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import java.time.Instant
import java.time.OffsetDateTime
import java.time.ZoneId

/** Kode laporan web memakai JetBrains Mono — native memakai monospace sistem. */
fun monospace(): FontFamily = FontFamily.Monospace

/**
 * ISO-8601 → "12 Jan 2026, 08:45" (ringkas ala daftar web).
 * Gagal parsir → tampilkan mentah.
 */
fun formatDateShort(iso: String): String {
    return try {
        val instant = java.time.OffsetDateTime.parse(iso)
        val months = arrayOf(
            "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
            "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
        )
        val m = months[(instant.monthValue - 1).coerceIn(0, 11)]
        val hh = instant.hour.toString().padStart(2, '0')
        val mm = instant.minute.toString().padStart(2, '0')
        "${instant.dayOfMonth} $m ${instant.year}, $hh:$mm"
    } catch (_: Exception) {
        iso
    }
}

/**
 * Port persis Frontend-stable/src/lib/format.ts ::formatDateRelative.
 * "Hari ini, HH:mm" / "Kemarin" / "12 Jan 2026". Gagal → string mentah.
 */
fun formatDateRelative(dateStr: String): String {
    return try {
        val d = OffsetDateTime.parse(dateStr).atZoneSameInstant(ZoneId.systemDefault())
        val now = Instant.now().atZone(ZoneId.systemDefault())
        val days: Long = java.time.Duration.between(d.toInstant(), now.toInstant()).toDays()
        val months = arrayOf(
            "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
            "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
        )
        when {
            days <= 0L -> {
                val h = d.hour.toString().padStart(2, '0')
                val m = d.minute.toString().padStart(2, '0')
                "Hari ini, $h:$m"
            }
            days == 1L -> "Kemarin"
            else -> "${d.dayOfMonth} ${months[(d.monthValue - 1).coerceIn(0, 11)]} ${d.year}"
        }
    } catch (_: Exception) {
        dateStr
    }
}

/**
 * Port lib/format.ts ::statusDotStyle — warna dot status.
 * Ditolak memakai animasi pulse di web; native pakai warna solid (tanpa shimmer).
 */
fun statusDotColor(status: String?): Color = when (status) {
    "Menunggu Review" -> Color(0xFFF59E0B)
    "Ditinjau" -> Color(0xFFF59E0B)
    "Hasil AI" -> Color(0xFF7C3AED)
    "Disetujui" -> Color(0xFF2563EB)
    "Ditolak" -> Color(0xFFE11D48)
    "Sedang Diperbaiki" -> Color(0xFFF97316)
    "Selesai" -> Color(0xFF10B981)
    "Diedit" -> Color(0xFF64748B)
    else -> Color(0xFF64748B)
}

/** Port lib/format.ts ::displayStatus — "Ditinjau" tampil sebagai "Menunggu Review". */
fun displayStatus(status: String?): String =
    if (status == "Ditinjau") "Menunggu Review" else (status ?: "-")

/**
 * Port lib/format.ts ::haversineDistance (meter) + formatDistance.
 * Dipakai kartu duplikasi di detail.
 */
fun haversineDistance(lat1: Double, lng1: Double, lat2: Double, lng2: Double): Double {
    val r = 6371000.0
    fun toRad(deg: Double) = deg * Math.PI / 180.0
    val dLat = toRad(lat2 - lat1)
    val dLng = toRad(lng2 - lng1)
    val a = Math.sin(dLat / 2).pow(2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2).pow(2)
    return r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** Port lib/format.ts ::formatDistance — "850 m" / "1.2 km". */
fun formatDistance(meters: Double): String =
    if (meters < 1000) "${meters.toInt()} m"
    else String.format(java.util.Locale.US, "%.1f km", meters / 1000.0)

private fun Double.pow(exp: Int): Double = Math.pow(this, exp.toDouble())
