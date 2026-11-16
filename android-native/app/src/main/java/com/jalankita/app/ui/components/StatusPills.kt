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
 * Pill jalur & tahap laporan — menjawab satu pertanyaan supervisor:
 * "laporan ini sekarang ada di tangan siapa?"
 *
 *  - `Laporan Warga`        : warga melapor, tidak perlu inspeksi lapangan.
 *  - `Menunggu Petugas Ukur`: sudah dijadwalkan, petugas belum mulai.
 *  - `Sedang Diinspeksi`    : petugas sudah di lokasi, hasil belum dikirim.
 *  - `Hasil Siap Review`    : pengukuran sudah dikirim, menunggu keputusan.
 *  - `Sudah Diinspeksi`     : supervisor sudah memutuskan.
 *
 * Istilah di atas didefinisikan di `InspectionLabel.kt`, bukan di sini.
 *  - `Laporan Petugas`      : petugas sendiri yang menemukan di lapangan.
 *
 * Tahap inspeksi TIDAK disimpan sebagai `status` laporan — ia turunan dari
 * ada/tidaknya tugas inspeksi, dihitung backend (`inspection_state`). Karena
 * itu filter status dan laporan lama tetap konsisten.
 *
 * @param source nilai mentah `source` dari API (`warga`, `telegram`, `petugas`).
 * @param inspectionState `assigned`/`started`/`submitted`/`reviewed`/`none`.
 * @param inspectorName nama petugas bila sudah diketahui, untuk ditampilkan
 *   sebagai keterangan di bawah label.
 */
@Composable
fun TrackPill(
    source: String?,
    inspectionState: String?,
    modifier: Modifier = Modifier,
    inspectorName: String? = null,
) {
    // Label disusun oleh `inspectionLabel()` — sumber yang sama dengan kartu
    // laporan, agar chip dan kartu tidak pernah berbeda istilah.
    val petugas = source?.equals("petugas", ignoreCase = true) == true
    val inspeksi = inspectionLabel(source, inspectionState, inspectorName)

    val label: String
    val bg: Color
    val fg: Color
    val border: Color
    if (inspeksi != null) {
        label = inspeksi.text
        bg = inspeksi.background
        fg = inspeksi.foreground
        border = inspeksi.border
    } else if (petugas) {
        label = "Laporan Petugas"
        bg = Color(0xFFEFF6FF)
        fg = Color(0xFF2563EB)
        border = Color(0xFFBFDBFE)
    } else if (source.isNullOrBlank()) {
        return
    } else {
        label = "Laporan Warga"
        bg = Color(0xFFF8FAFC)
        fg = Color(0xFF475569)
        border = Color(0xFFE2E8F0)
    }

    Row(
        modifier = modifier
            .clip(RoundedCornerShape(999.dp))
            .background(bg)
            .border(1.dp, border, RoundedCornerShape(999.dp))
            .padding(horizontal = 10.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label, color = fg, fontSize = 10.sp, fontWeight = FontWeight.Bold)
        // Nama petugas hanya bermakna saat inspeksi sudah punya pelaksana.
        if (inspeksi?.inspectorName != null) {
            Text(" · ", color = fg.copy(alpha = 0.6f), fontSize = 10.sp)
            Text(inspeksi.inspectorName, color = fg, fontSize = 10.sp, maxLines = 1)
        }
    }
}
