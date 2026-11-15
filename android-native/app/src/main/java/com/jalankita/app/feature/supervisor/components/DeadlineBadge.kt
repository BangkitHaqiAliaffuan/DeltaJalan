package com.jalankita.app.feature.supervisor.components

import java.time.Duration
import java.time.Instant
import java.time.OffsetDateTime

/**
 * Util deadline antrean review — varian queue (review.tsx):
 * "Terlambat!"/"< 1 jam"/"X jam"/"X hari".
 *
 * Varian kartu (`cardDeadline`, `DeadlineInfo`, `CardDeadlineRow`, `CardLateBadge`)
 * pindah ke `ui/components/report/ReportCardParts.kt` saat kartu laporan
 * warga/petugas/supervisor disatukan (PR-4 PLAN-kartu-thumbnail-detail-tinggi.md).
 */
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

/** Varian badge queue (review.tsx): "< 1 jam" untuk < 1 jam, bukan "Kurang dari 1 jam". */
fun queueDeadlineText(deadlineReview: String?): String? {
    val h = hoursUntil(deadlineReview) ?: return null
    return when {
        h < 0 -> "Terlambat!"
        h < 1 -> "< 1 jam"
        else -> "$h jam"
    }
}
