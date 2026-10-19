package com.jalankita.app.feature.supervisor.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.jalankita.app.ui.components.AppIcon
import com.jalankita.app.ui.theme.TextDark
import com.jalankita.app.ui.theme.TextMuted
import com.jalankita.app.ui.util.pciBgColor
import com.jalankita.app.ui.util.pciColor
import com.jalankita.app.ui.util.pciConditionLabel
import com.jalankita.app.ui.util.pciText
import java.util.Locale

/**
 * Port Frontend-stable/src/components/jk/PciCard.tsx.
 * Skor besar berwarna + badge kondisi + bar 0–100 + label ujung.
 */
@Composable
fun PciCard(score: Double?, modifier: Modifier = Modifier) {
    if (score == null) return
    val color = pciColor(score)
    val label = pciConditionLabel(score)
    val badge = pciBgColor(score)
    val pct = score.coerceIn(0.0, 100.0) / 100.0

    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(Color.White)
            .padding(16.dp),
    ) {
        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
            Column(modifier = Modifier.weight(1f)) {
                Text("Indeks Kondisi Jalan (PCI)", color = TextMuted, fontSize = 12.sp)
                Spacer(Modifier.height(2.dp))
                Text(
                    text = String.format(Locale.US, "%.1f", score),
                    color = color,
                    fontSize = 28.sp,
                    fontWeight = FontWeight.Bold,
                )
            }
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(999.dp))
                    .background(badge.bg)
                    .padding(horizontal = 10.dp, vertical = 4.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(AppIcon.Construction, contentDescription = null, tint = badge.fg, modifier = Modifier.size(14.dp))
                    Spacer(Modifier.width(4.dp))
                    Text(label, color = badge.fg, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                }
            }
        }
        Spacer(Modifier.height(12.dp))
        // Bar 0–100
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(8.dp)
                .clip(RoundedCornerShape(999.dp))
                .background(Color(0xFFF1F5F9)),
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth(pct.toFloat())
                    .height(8.dp)
                    .clip(RoundedCornerShape(999.dp))
                    .background(color),
            )
        }
        Spacer(Modifier.height(2.dp))
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text("0 (Kritis)", color = TextMuted, fontSize = 10.sp)
            Text("100 (Baik)", color = TextMuted, fontSize = 10.sp)
        }
    }
}

/** Badge PCI inline (kompak) — dipakai di kartu & panel. pciBgColor + teks. */
@Composable
fun PciInlineBadge(score: Double?, modifier: Modifier = Modifier) {
    if (score == null) return
    val badge = pciBgColor(score)
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(999.dp))
            .background(badge.bg)
            .padding(horizontal = 8.dp, vertical = 2.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier
                    .size(6.dp)
                    .clip(RoundedCornerShape(999.dp))
                    .background(pciColor(score)),
            )
            Spacer(Modifier.width(6.dp))
            Text(
                "PCI ${pciText(score, 0)} — ${pciConditionLabel(score)}",
                color = badge.fg,
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
            )
        }
    }
}

/** Baris PCI kartu: ikon road + "PCI n — label" warna pciColor (ReportCard.tsx:288-295). */
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
