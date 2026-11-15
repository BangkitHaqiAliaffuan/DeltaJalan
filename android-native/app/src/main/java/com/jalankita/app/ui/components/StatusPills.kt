package com.jalankita.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
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
import com.jalankita.app.feature.home.components.displayStatus
import com.jalankita.app.feature.home.components.statusDotColor
import com.jalankita.app.ui.theme.ErrorRed
import java.util.Locale

/**
 * Pill status laporan lintas-role (severity / status / sumber).
 *
 * Sebelumnya tiga komponen ini `private` di `SupervisorDetailScreen.kt`, jadi
 * layar petugas tidak bisa memakainya dan hanya menampilkan teks polos. Setelah
 * dinaikkan ke sini, supervisor dan petugas memakai tampilan yang **identik** —
 * satu sumber kebenaran, bukan dua salinan yang lambat laun melenceng.
 */

/** Baris badge: severity + status + sumber. Sumber `petugas` disembunyikan (default laporan petugas). */
@Composable
fun BadgeRow(
    severity: String?,
    status: String?,
    source: String?,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        severity?.takeIf { it.isNotBlank() }?.let { SeverityPill(it) }
        StatusPill(status)
        source?.takeIf { it != "petugas" }?.let { SourcePill(it) }
    }
}

/** Pill severity — warna mengikuti kata kunci tingkat kerusakan. */
@Composable
fun SeverityPill(severity: String, modifier: Modifier = Modifier) {
    val (bg, fg) = when {
        severity.contains("Berat", true) -> ErrorRed to Color.White
        severity.contains("Sedang", true) -> Color(0xFFFFF7ED) to Color(0xFFF97316)
        severity.contains("Ringan", true) -> Color(0xFFFFFBEB) to Color(0xFFF59E0B)
        severity.contains("Baik", true) -> Color(0xFFE8F5E9) to Color(0xFF2E7D32)
        else -> Color(0xFFF8FAFC) to Color(0xFF64748B)
    }
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(999.dp))
            .background(bg)
            .padding(horizontal = 12.dp, vertical = 4.dp),
    ) {
        Text(
            severity.uppercase(Locale.US),
            color = fg,
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
        )
    }
}

/** Pill status dengan dot berwarna — memakai helper yang sama dengan kartu laporan. */
@Composable
fun StatusPill(status: String?, modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(999.dp))
            .background(Color.White)
            .border(1.dp, Color(0xFFE2E8F0), RoundedCornerShape(999.dp))
            .padding(horizontal = 12.dp, vertical = 4.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier
                    .size(8.dp)
                    .clip(RoundedCornerShape(999.dp))
                    .background(statusDotColor(status)),
            )
            Spacer(Modifier.width(6.dp))
            Text(
                displayStatus(status),
                color = Color(0xFF475569),
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
            )
        }
    }
}

/** Pill asal laporan (warga / telegram / petugas). */
@Composable
fun SourcePill(source: String, modifier: Modifier = Modifier) {
    val (bg, fg, border) = when (source) {
        "warga" -> Triple(Color(0xFFFAF5FF), Color(0xFF7C3AED), Color(0xFFE9D5FF))
        "telegram" -> Triple(Color(0xFFF0F9FF), Color(0xFF0284C7), Color(0xFFBAE6FD))
        else -> Triple(Color(0xFFEFF6FF), Color(0xFF2563EB), Color(0xFFBFDBFE))
    }
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(999.dp))
            .background(bg)
            .border(1.dp, border, RoundedCornerShape(999.dp))
            .padding(horizontal = 10.dp, vertical = 4.dp),
    ) {
        Text(
            source.replaceFirstChar { it.uppercase() },
            color = fg,
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
        )
    }
}

/**
 * Pill jalur laporan — membedakan tiga asal yang bermakna berbeda bagi supervisor:
 *
 *  - `Laporan Warga`   : warga melapor, dinilai tidak perlu inspeksi lapangan.
 *  - `Hasil Inspeksi`  : warga melapor, sudah diverifikasi & diukur petugas.
 *  - `Laporan Petugas` : petugas sendiri yang menemukan di lapangan.
 *
 * Hanya label TAMPILAN. Nilai `status` di backend tidak berubah, sehingga filter
 * dan laporan yang sudah ada tetap konsisten.
 *
 * @param source nilai mentah `source` dari API (`warga`, `telegram`, `petugas`).
 * @param hasInspection true bila laporan punya tugas inspeksi (pernah/b sedang diukur).
 */
@Composable
fun TrackPill(source: String?, hasInspection: Boolean, modifier: Modifier = Modifier) {
    val label = when {
        source == null || source.isBlank() -> return
        source.equals("petugas", ignoreCase = true) -> "Laporan Petugas"
        hasInspection -> "Hasil Inspeksi"
        else -> "Laporan Warga"
    }

    val (bg, fg, border) = when {
        source.equals("petugas", ignoreCase = true) ->
            Triple(Color(0xFFEFF6FF), Color(0xFF2563EB), Color(0xFFBFDBFE))
        hasInspection ->
            Triple(Color(0xFFECFDF5), Color(0xFF047857), Color(0xFFA7F3D0))
        else ->
            Triple(Color(0xFFF8FAFC), Color(0xFF475569), Color(0xFFE2E8F0))
    }

    Box(
        modifier = modifier
            .clip(RoundedCornerShape(999.dp))
            .background(bg)
            .border(1.dp, border, RoundedCornerShape(999.dp))
            .padding(horizontal = 10.dp, vertical = 4.dp),
    ) {
        Text(label, color = fg, fontSize = 10.sp, fontWeight = FontWeight.Bold)
    }
}
