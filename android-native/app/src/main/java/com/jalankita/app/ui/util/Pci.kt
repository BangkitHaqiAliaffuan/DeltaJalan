package com.jalankita.app.ui.util

import androidx.compose.ui.graphics.Color

/**
 * Port persis Frontend-stable/src/lib/pci.ts — warna & label kondisi PCI.
 * Dipakai kartu laporan (warna teks) + PciCard (bar & badge).
 */

private data class PciRange(val label: String, val min: Int, val max: Int, val color: Long)

private val CONDITION_MAP = listOf(
    PciRange("Baik", 86, 100, 0xFF22C55E),
    PciRange("Rusak Ringan", 71, 85, 0xFF86EFAC),
    PciRange("Rusak Sedang", 56, 70, 0xFFEAB308),
    PciRange("Rusak Berat", 41, 55, 0xFFF97316),
    PciRange("Kritis", 0, 40, 0xFFEF4444),
)

/** Label kondisi: Baik / Rusak Ringan / Rusak Sedang / Rusak Berat / Kritis. */
fun pciConditionLabel(score: Double?): String {
    if (score == null) return "Kritis"
    return CONDITION_MAP.firstOrNull { score >= it.min && score <= it.max }?.label ?: "Kritis"
}

/** Warna teks/dot PCI (hex persis lib/pci.ts). */
fun pciColor(score: Double?): Color {
    val label = pciConditionLabel(score)
    val hex = CONDITION_MAP.firstOrNull { it.label == label }?.color ?: 0xFF6B7280
    return Color(hex)
}

/** Warna latar + teks badge PCI (bg-*-50 text-*-800 ala Tailwind). */
data class PciBadgeColors(val bg: Color, val fg: Color)

fun pciBgColor(score: Double?): PciBadgeColors = when (pciConditionLabel(score)) {
    "Baik" -> PciBadgeColors(Color(0xFFDCFCE7), Color(0xFF166534))
    "Rusak Ringan" -> PciBadgeColors(Color(0xFFF0FDF4), Color(0xFF15803D))
    "Rusak Sedang" -> PciBadgeColors(Color(0xFFFEF9C3), Color(0xFF854D0E))
    "Rusak Berat" -> PciBadgeColors(Color(0xFFFFF7ED), Color(0xFF9A3412))
    else -> PciBadgeColors(Color(0xFFFEF2F2), Color(0xFF991B1B))
}

/** Format skor PCI utk tampilan: 0 desimal di kartu (web: toFixed(0)), 1 desimal di PciCard. */
fun pciText(score: Double?, decimals: Int = 0): String {
    if (score == null) return "-"
    return String.format(java.util.Locale.US, "%.${decimals}f", score)
}
