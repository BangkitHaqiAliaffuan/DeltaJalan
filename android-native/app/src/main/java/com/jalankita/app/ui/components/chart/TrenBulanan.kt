package com.jalankita.app.ui.components.chart

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.jalankita.app.core.network.MonthlyTrendDto
import com.jalankita.app.ui.theme.BrandBlue
import com.jalankita.app.ui.theme.SuccessGreen
import com.jalankita.app.ui.theme.TextDark
import com.jalankita.app.ui.theme.TextMuted
import com.jalankita.app.ui.theme.WarningAmber
import com.jalankita.app.ui.util.Waktu

/**
 * Grafik tren bulanan — SATU implementasi untuk dashboard & statistik supervisor.
 *
 * Sebelumnya ada dua versi: `MonthlyTrendList` (daftar teks yang mencetak
 * `"2026-11"` mentah) di dashboard, dan `TrendBars` di layar statistik yang
 * memotong label bulan menjadi 3 huruf pertama sehingga keenam bulan tampil
 * `"202"`. Keduanya digantikan komponen ini.
 *
 * Batang ditumpuk menurut komposisi status: tinggi total = volume laporan bulan
 * itu (bukan salah satu status saja). Ketuk batang untuk melihat angka aslinya.
 */
@Composable
fun TrenBulanan(
    tren: List<MonthlyTrendDto>,
    modifier: Modifier = Modifier,
    tinggiBatang: Dp = 132.dp,
) {
    if (tren.isEmpty()) return

    var dipilih by remember(tren) { mutableStateOf<Int?>(null) }
    val maks = tren.maxOf { it.total }.coerceAtLeast(1)
    val adaSisa = tren.any { sisaSegmen(it) > 0 }
    val tinggiBatangEfektif = (tinggiBatang - 18.dp).coerceAtLeast(1.dp)

    val ringkasan = tren.joinToString("; ") { t ->
        val bulan = Waktu.namaBulanSingkat(t.bulan) ?: "?"
        "$bulan total ${t.total}"
    }

    Column(modifier = modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(tinggiBatang)
                .semantics { contentDescription = "Tren 6 bulan: $ringkasan" },
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.Bottom,
        ) {
            tren.forEachIndexed { indeks, t ->
                val terpilih = dipilih == indeks
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .clickable { dipilih = if (terpilih) null else indeks },
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Bottom,
                ) {
                    if (terpilih) {
                        Text(
                            text = "${t.total}",
                            color = TextDark,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                        )
                        Spacer(Modifier.height(2.dp))
                    }
                    BatangBulan(
                        t = t,
                        tinggi = tinggiBatang(t.total, maks, tinggiBatangEfektif),
                    )
                }
            }
        }

        Spacer(Modifier.height(6.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            tren.forEachIndexed { indeks, t ->
                Text(
                    text = Waktu.namaBulanSingkat(t.bulan) ?: "-",
                    color = if (dipilih == indeks) TextDark else TextMuted,
                    fontSize = 10.sp,
                    fontWeight = if (dipilih == indeks) FontWeight.Bold else FontWeight.Normal,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.weight(1f),
                )
            }
        }

        Spacer(Modifier.height(10.dp))
        Legenda(tampilkanLainnya = adaSisa)

        dipilih?.let { indeks ->
            tren.getOrNull(indeks)?.let { t ->
                Spacer(Modifier.height(8.dp))
                Text(
                    text = rincian(t),
                    color = TextDark,
                    fontSize = 11.sp,
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(6.dp))
                        .background(Color(0xFFF1F5F9))
                        .padding(horizontal = 8.dp, vertical = 6.dp),
                )
            }
        }
    }
}

/** Satu batang: tumpukan status sesuai [SEGMEN], dihitung dari bawah. */
@Composable
private fun BatangBulan(t: MonthlyTrendDto, tinggi: Dp) {
    val shape = RoundedCornerShape(topStart = 4.dp, topEnd = 4.dp)
    if (t.total <= 0) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(2.dp)
                .background(Color(0xFFE2E8F0)),
        )
        return
    }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .height(tinggi)
            .clip(shape),
        verticalArrangement = Arrangement.Bottom,
    ) {
        // Urutan tampilan dari atas ke bawah; legenda memakai urutan yang sama.
        SEGMEN.forEach { segmen ->
            val nilai = segmen.nilai(t)
            if (nilai <= 0) return@forEach
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(nilai.toFloat())
                    .background(segmen.warna),
            )
        }
        // Status yang tidak dirinci (Ditugaskan, Hasil AI, Diedit) tetap harus
        // tampil, kalau tidak batangnya bolong dan tinggi tidak cocok dengan total.
        val sisa = sisaSegmen(t)
        if (sisa > 0) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(sisa.toFloat())
                    .background(WARNA_LAINNYA),
            )
        }
    }
}

@Composable
private fun Legenda(tampilkanLainnya: Boolean) {
    val item = buildList {
        SEGMEN.forEach { add(it.label to it.warna) }
        if (tampilkanLainnya) add("Lainnya" to WARNA_LAINNYA)
    }
    // Dua baris: 5–6 label tidak muat satu baris di layar 320–360 dp.
    Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
        item.chunked(3).forEach { baris ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                baris.forEach { (label, warna) -> KeyLabel(warna = warna, teks = label) }
            }
        }
    }
}

@Composable
private fun KeyLabel(warna: Color, teks: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(
            modifier = Modifier
                .size(8.dp)
                .clip(RoundedCornerShape(2.dp))
                .background(warna),
        )
        Spacer(Modifier.width(3.dp))
        Text(text = teks, color = TextMuted, fontSize = 9.sp, maxLines = 1)
    }
}

private fun rincian(t: MonthlyTrendDto): String {
    val bagian = SEGMEN.mapNotNull { s ->
        val nilai = s.nilai(t)
        if (nilai > 0) "${s.label} $nilai" else null
    }.toMutableList()
    val sisa = sisaSegmen(t)
    if (sisa > 0) bagian += "Lainnya $sisa"
    val bulan = Waktu.namaBulanSingkat(t.bulan) ?: "-"
    return "$bulan · Total ${t.total}" + if (bagian.isEmpty()) "" else " · " + bagian.joinToString(" · ")
}

/**
 * Jumlah laporan pada bulan itu yang tidak tercakup segmen status yang dirinci:
 * `total` menghitung SEMUA status (termasuk `Ditugaskan`, `Hasil AI`, `Diedit`),
 * sedangkan [SEGMEN] hanya merinci lima status akhir.
 */
fun sisaSegmen(t: MonthlyTrendDto): Int =
    (t.total - SEGMEN.sumOf { it.nilai(t) }).coerceAtLeast(0)

/**
 * Tinggi batang proporsional terhadap bulan tertinggi.
 *
 * Aturan yang dikunci tes: nilai 0 → 0 dp, nilai ≥ maks → [tinggi] penuh,
 * nilai negatif dijepit 0, dan `maks` 0 tidak pernah membagi nol.
 */
fun tinggiBatang(nilai: Int, maks: Int, tinggi: Dp): Dp {
    if (nilai <= 0 || maks <= 0) return 0.dp
    val rasio = (nilai.toFloat() / maks.toFloat()).coerceIn(0f, 1f)
    return tinggi * rasio
}

private val WARNA_LAINNYA = Color(0xFF94A3B8)

/** Segmen status pada grafik (urutan = urutan tumpukan dari atas). */
private data class Segmen(
    val label: String,
    val warna: Color,
    val nilai: (MonthlyTrendDto) -> Int,
)

private val SEGMEN = listOf(
    Segmen("Selesai", SuccessGreen) { it.selesai },
    Segmen("Disetujui", BrandBlue) { it.disetujui },
    Segmen("Diperbaiki", Color(0xFF60A5FA)) { it.sedangDiperbaiki },
    Segmen("Menunggu", WarningAmber) { it.menungguReview },
    Segmen("Ditolak", Color(0xFFDC2626)) { it.ditolak },
)
