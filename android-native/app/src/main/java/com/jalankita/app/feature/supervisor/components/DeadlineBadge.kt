package com.jalankita.app.feature.supervisor.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.time.Duration
import java.time.Instant
import java.time.OffsetDateTime

/**
 * Util deadline — port deadlineText di ReportCard.tsx:66-79 & ReviewDrawer.tsx:162-171.
 * Varian kartu: "Terlambat!"/"Kurang dari 1 jam"/"X jam"/"X hari".
 * Varian queue : "Terlambat!"/"< 1 jam"/"X jam"/"X hari".
 */
data class DeadlineInfo(val text: String, val color: Color, val overdue: Boolean)

private val RED = Color(0xFFE11D48)
private val AMBER = Color(0xFFF59E0B)
private val EMERALD = Color(0xFF10B981)

private fun hoursUntil(iso: String?): Long? {
    if (iso.isNullOrBlank()) return null
    return try {
        val t = OffsetDateTime.parse(iso).toInstant()
        val d = Duration.between(Instant.now(), t)
        if (d.isNegative) -1L else d.toHours()
    } catch (_: Exception) {
        null
    }
}

/**
 * Teks deadline kartu laporan (ReportCard.tsx). Null bila tidak ditampilkan
 * (status Selesai/Ditolak, atau deadline kosong).
 */
fun cardDeadline(status: String?, deadlineResolusi: String?, deadlineReview: String?, show: Boolean): DeadlineInfo? {
    if (!show) return null
    if (status == "Selesai" || status == "Ditolak") return null
    val iso = deadlineResolusi ?: deadlineReview ?: return null
    val h = hoursUntil(iso) ?: return null
    val text = when {
        h < 0 -> "Terlambat!"
        h < 1 -> "Kurang dari 1 jam"
        h < 24 -> "$h jam"
        else -> "${h / 24} hari"
    }
    val color = if (text == "Terlambat!") RED else EMERALD
    return DeadlineInfo(text, color, overdue = text == "Terlambat!")
}

/** Varian badge queue (review.tsx): "< 1 jam" untuk < 1 jam, bukan "Kurang dari 1 jam". */
fun queueDeadlineText(deadlineReview: String?): String? {
    val h = hoursUntil(deadlineReview) ?: return null
    return when {
        h < 0 -> "Terlambat!"
        h < 1 -> "< 1 jam"
        else -> "$h jam"
    }
}

/** Badge "Deadline" di grid kartu (dot + teks). */
@Composable
fun CardDeadlineRow(info: DeadlineInfo) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(
            modifier = Modifier
                .size(8.dp)
                .clip(CircleShape)
                .background(info.color),
        )
        Spacer(Modifier.width(4.dp))
        Text(info.text, color = info.color, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
    }
}

/** Badge kotak kecil "Terlambat"/"Mendesak"/"X jam" di header kartu (ReportCard.tsx:135-145). */
@Composable
fun CardLateBadge(text: String, bg: Color, fg: Color, border: Color) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(4.dp))
            .background(bg)
            .border(1.dp, border, RoundedCornerShape(4.dp))
            .padding(horizontal = 6.dp, vertical = 2.dp),
    ) {
        Text(text, color = fg, fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
    }
}
