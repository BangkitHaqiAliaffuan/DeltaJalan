package com.jalankita.app.feature.supervisor.components

/**
 * Port Frontend-stable/src/lib/rejectReasons.ts — alasan penolakan baku.
 * "Lainnya" (OTHER) memicu input teks bebas.
 */
val REJECT_REASONS: List<String> = listOf(
    "Foto tidak jelas / buram",
    "Lokasi tidak sesuai dengan foto",
    "Kerusakan tidak signifikan",
    "Duplikat laporan",
    "Bukan kerusakan jalan",
    "Data tidak lengkap",
    "Koordinat tidak akurat",
)

/** Marker pilihan "Lainnya" (nilai sentinel seperti REJECT_OTHER_VALUE web). */
const val REJECT_OTHER = "Lainnya"

/** Marker host untuk pilihan "Lainnya" di dropdown. */
const val REJECT_OTHER_VALUE = "__other__"

private val REJECT_REASON_REGEX = Regex("\\(alasan:\\s*(.*?),\\s*catatan:")
private val REJECT_CATATAN_REGEX = Regex("catatan:\\s*(.*?)\\)")

/** Ekstrak alasan dari `system_notes` ("[REJECTED] … (alasan: X, catatan: Y)"). Port extractRejectReason. */
fun extractRejectReason(systemNotes: String?): String? {
    if (systemNotes.isNullOrBlank()) return null
    REJECT_REASON_REGEX.find(systemNotes)?.let { return it.groupValues[1].trim() }
    if (systemNotes.contains("alasan:")) {
        val after = systemNotes.substringAfter("alasan:")
        return after.substringBefore(",").trim().takeIf { it.isNotBlank() }
    }
    return null
}

/** Ekstrak catatan dari `system_notes`. Port extractRejectCatatan (nilai "-" → null). */
fun extractRejectCatatan(systemNotes: String?): String? {
    if (systemNotes.isNullOrBlank()) return null
    val v = REJECT_CATATAN_REGEX.find(systemNotes)?.groupValues?.get(1)?.trim() ?: return null
    return if (v == "-") null else v
}
