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
 *  - `Sedang Diukur`        : petugas sudah di lokasi, hasil belum dikirim.
 *  - `Hasil Siap Review`    : pengukuran sudah dikirim, menunggu keputusan.
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
    if (source == null || source.isBlank()) return
    val isPetugas = source.equals("petugas", ignoreCase = true)

    // Petugas tidak pernah melewati jalur inspeksi (lihat TriageService), jadi
    // labelnya langsung "Laporan Petugas" tanpa memedulikan state.
    val label = when {
        isPetugas -> "Laporan Petugas"
        inspectionState == null || inspectionState == "none" -> "Laporan Warga"
        inspectionState == "assigned" -> "Menunggu Petugas Ukur"
        inspectionState == "started" -> "Sedang Diukur"
        inspectionState == "submitted" -> "Hasil Siap Review"
        inspectionState == "reviewed" -> "Hasil Inspeksi"
        // State tak dikenal jangan disembunyikan: lebih jujur menyebut laporan
        // warga daripada mengaku belum pernah diinspeksi.
        else -> "Laporan Warga"
    }

    val (bg, fg, border) = when {
        isPetugas -> Triple(Color(0xFFEFF6FF), Color(0xFF2563EB), Color(0xFFBFDBFE))
        inspectionState == "started" -> Triple(Color(0xFFFEF3C7), Color(0xFFB45309), Color(0xFFFDE68A))
        inspectionState == "submitted" -> Triple(Color(0xFFECFDF5), Color(0xFF047857), Color(0xFFA7F3D0))
        inspectionState == "reviewed" -> Triple(Color(0xFFECFDF5), Color(0xFF047857), Color(0xFFA7F3D0))
        inspectionState == "assigned" -> Triple(Color(0xFFF1F5F9), Color(0xFF475569), Color(0xFFCBD5E1))
        else -> Triple(Color(0xFFF8FAFC), Color(0xFF475569), Color(0xFFE2E8F0))
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
        if (!inspectorName.isNullOrBlank()) {
            Text(" · ", color = fg.copy(alpha = 0.6f), fontSize = 10.sp)
            Text(inspectorName, color = fg, fontSize = 10.sp, maxLines = 1)
        }
    }
}
