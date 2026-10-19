package com.jalankita.app.feature.home.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Badge pill status/severity — port Frontend-stable/src/components/jk/StatusBadge.tsx
 * + src/styles.css ::--badge-* (hex persis).
 */
enum class BadgeVariant(val label: String, val bg: Color, val fg: Color, val border: Color) {
    BAIK("Baik", Color(0xFFD1FAE5), Color(0xFF065F46), Color(0xFF6EE7B7)),
    RINGAN("Rusak Ringan", Color(0xFFFEF3C7), Color(0xFF92400E), Color(0xFFFCD34D)),
    SEDANG("Rusak Sedang", Color(0xFFFFEDD5), Color(0xFF9A3412), Color(0xFFFDBA74)),
    BERAT("Rusak Berat", Color(0xFFE11D48), Color(0xFFFFFFFF), Color(0xFFE11D48)),
    DIPROSES("Diproses", Color(0xFFEFF6FF), Color(0xFF1E40AF), Color(0xFF93C5FD)),
    SELESAI("Selesai", Color(0xFF10B981), Color(0xFFFFFFFF), Color(0xFF10B981)),
    DITOLAK("Ditolak", Color(0xFFE11D48), Color(0xFFFFFFFF), Color(0xFFE11D48)),
    MENUNGGU("Menunggu", Color(0xFFFEF3C7), Color(0xFF92400E), Color(0xFFFCD34D)),
}

/** Normalisasi string API → varian (port persis normalizeVariant StatusBadge.tsx:39-49). */
fun normalizeVariant(raw: String?): BadgeVariant {
    val s = (raw ?: "").lowercase().filter { it in 'a'..'z' }
    return when {
        "berat" in s -> BadgeVariant.BERAT
        "sedang" in s -> BadgeVariant.SEDANG
        "ringan" in s -> BadgeVariant.RINGAN
        "baik" in s -> BadgeVariant.BAIK
        "selesai" in s || "done" in s -> BadgeVariant.SELESAI
        "proses" in s || "sedangdiperbaiki" in s -> BadgeVariant.DIPROSES
        "tolak" in s || "reject" in s -> BadgeVariant.DITOLAK
        "tugas" in s -> BadgeVariant.DIPROSES
        else -> BadgeVariant.MENUNGGU
    }
}

/** Label status DB → label tampil (port konvensi review/home: Ditinjau → Menunggu Review). */
fun statusLabel(status: String?): String = when (status) {
    "Ditinjau" -> "Menunggu Review"
    "Diedit" -> "Menunggu Review"
    null -> "Menunggu"
    else -> status
}

@Composable
fun StatusBadge(
    raw: String?,
    labelOverride: String? = null,
    modifier: Modifier = Modifier,
) {
    val variant = remember(raw) { normalizeVariant(raw) }
    val shape = RoundedCornerShape(999.dp)
    Box(
        modifier = modifier
            .background(variant.bg, shape)
            .border(1.dp, variant.border, shape)
            .padding(horizontal = 10.dp, vertical = 2.dp),
    ) {
        Text(
            text = labelOverride ?: if (variant == BadgeVariant.MENUNGGU ||
                variant == BadgeVariant.DIPROSES
            ) {
                statusLabel(raw)
            } else {
                variant.label
            },
            color = variant.fg,
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
        )
    }
}
