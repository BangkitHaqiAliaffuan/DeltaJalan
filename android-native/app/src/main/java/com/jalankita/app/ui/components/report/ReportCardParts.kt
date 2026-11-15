package com.jalankita.app.ui.components.report

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.jalankita.app.ui.components.AppIcon
import com.jalankita.app.ui.theme.TextMuted
import com.jalankita.app.ui.util.pciColor
import com.jalankita.app.ui.util.pciConditionLabel
import com.jalankita.app.ui.util.pciText
import java.time.Duration
import java.time.Instant
import java.time.OffsetDateTime

/*
 * Bagian kartu laporan yang dipakai `ReportCard` (ui/components/report).
 *
 * Dipindah dari `feature/supervisor/components/{DeadlineBadge,PciCard,CardAction}.kt`
 * saat kartu warga/petugas/supervisor disatukan
 * (PR-4 PLAN-kartu-thumbnail-detail-tinggi.md), agar komponen `ui/` tidak
 * mengimpor paket fitur.
 */

private val RED = Color(0xFFE11D48)
private val EMERALD = Color(0xFF10B981)
private val DIVIDER = Color(0xFFF1F5F9)

/** Teks + warna deadline satu kartu. */
data class DeadlineInfo(val text: String, val color: Color, val overdue: Boolean)

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
 * (status Selesai/Ditolak, `show = false`, atau deadline kosong).
 */
fun cardDeadline(
    status: String?,
    deadlineResolusi: String?,
    deadlineReview: String?,
    show: Boolean,
): DeadlineInfo? {
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

/** Badge kotak kecil "Terlambat"/"Duplikat"/"Warga" di header kartu. */
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

/** Baris PCI kartu: ikon + "PCI n — label" (ReportCard.tsx:288-295). */
@Composable
fun CardPciRow(score: Double?) {
    if (score == null) return
    Row(verticalAlignment = Alignment.CenterVertically) {
        Icon(AppIcon.Construction, contentDescription = null, tint = TextMuted, modifier = Modifier.size(14.dp))
        Spacer(Modifier.width(6.dp))
        Text(
            text = "PCI ${pciText(score, 0)} — ${pciConditionLabel(score)}",
            color = pciColor(score),
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
        )
    }
}

/** Satu sel di grid meta kartu: label uppercase + isi. */
@Composable
fun GridCell(label: String, modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    Column(modifier = modifier) {
        Text(
            text = label.uppercase(),
            color = Color(0xFF94A3B8),
            fontSize = 9.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 1.sp,
        )
        Spacer(Modifier.height(2.dp))
        content()
    }
}

/** Divider tipis antar seksi kartu. */
@Composable
fun CardDivider() {
    Box(Modifier.fillMaxWidth().height(1.dp).background(DIVIDER))
}

// ── Aksi kartu ─────────────────────────────────────────────────────────────
// Model + tombol dipindah dari feature/supervisor/components/CardAction.kt dan
// SupervisorReportCard.kt agar ReportCard (ui/) tidak mengimpor paket fitur.

/** Varian tombol aksi kartu (port CardActions.tsx). */
enum class CardActionVariant { PRIMARY, SECONDARY, DESTRUCTIVE }

/** Model aksi kartu — port Frontend-stable/src/components/jk/report-card/types.ts. */
data class CardAction(
    val label: String,
    val icon: ImageVector? = null,
    val iconOnly: Boolean = false,
    val variant: CardActionVariant = CardActionVariant.SECONDARY,
    val disabled: Boolean = false,
    val onClick: () -> Unit,
)

/** Tombol aksi kartu 11sp bold rounded-lg untuk satu [CardAction]. */
@Composable
fun CardActionButton(action: CardAction) {
    val (bg, fg, borderColor) = when (action.variant) {
        CardActionVariant.PRIMARY -> Triple(Color(0xFF1E40AF), Color.White, Color(0xFF1E40AF))
        CardActionVariant.SECONDARY -> Triple(Color.White, Color(0xFF1E40AF), Color(0xFF1E40AF))
        CardActionVariant.DESTRUCTIVE -> Triple(Color(0xFFFEF2F2), RED, Color(0xFFFECACA))
    }
    val shape = RoundedCornerShape(8.dp)
    Row(
        modifier = Modifier
            .clip(shape)
            .background(if (action.disabled) bg.copy(alpha = 0.4f) else bg)
            .border(1.dp, borderColor, shape)
            .clickable(enabled = !action.disabled, onClick = action.onClick)
            .padding(horizontal = if (action.iconOnly) 8.dp else 12.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        action.icon?.let {
            Icon(it, contentDescription = action.label, tint = fg, modifier = Modifier.size(13.dp))
            if (!action.iconOnly) Spacer(Modifier.width(4.dp))
        }
        if (!action.iconOnly) {
            Text(action.label, color = fg, fontSize = 11.sp, fontWeight = FontWeight.Bold)
        }
    }
}
