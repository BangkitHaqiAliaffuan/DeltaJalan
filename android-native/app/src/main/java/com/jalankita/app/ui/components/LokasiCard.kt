package com.jalankita.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.jalankita.app.core.util.MapLauncher
import com.jalankita.app.ui.map.PhotoLocationMapCard
import com.jalankita.app.ui.theme.BrandBlue
import com.jalankita.app.ui.theme.TextDark
import com.jalankita.app.ui.theme.TextMuted

/**
 * Kartu lokasi dengan titik yang bisa diklik untuk membuka aplikasi peta.
 *
 * Dipakai bersama oleh layar detail laporan (supervisor/petugas) dan detail
 * tugas inspeksi, supaya perilaku "buka di peta" seragam — sebelumnya tiap
 * layar menulis URL sendiri dengan dua bentuk berbeda.
 *
 * Isi:
 *  1. Koordinat 6 desimal (monospace) — acuan presisi bila peta gagal dibuka.
 *  2. Alamat (bila ada) atau nama jalan + kecamatan sebagai pengganti.
 *  3. Peta mini dengan pin, agar petugas langsung mengenali titiknya tanpa
 *     harus membayangkan angka koordinat.
 *  4. Baris "Buka di Google Maps" — seluruh area clickable (target sentuh lebar).
 *
 * Bila koordinat tidak valid, kartu tetap ditampilkan dengan pesan jelas dan
 * tombol nonaktif. Menyembunyikan kartu hanya membuat petugas mengira fitur
 * lokasi tidak ada.
 */
@Composable
fun LokasiCard(
    latitude: Double?,
    longitude: Double?,
    modifier: Modifier = Modifier,
    address: String? = null,
    roadName: String? = null,
    district: String? = null,
    showMiniMap: Boolean = true,
    title: String = "Lokasi",
    mapLabel: String = "Titik kerusakan",
) {
    val context = LocalContext.current
    val hasCoordinate = MapLauncher.isValidCoordinate(latitude, longitude)

    // Alamat siap tampil: alamat lengkap → jalan+kecamatan → null.
    val secondary = address?.takeIf { it.isNotBlank() }
        ?: listOfNotNull(
            roadName?.takeIf { it.isNotBlank() },
            district?.takeIf { it.isNotBlank() }?.let { "Kec. $it" },
        ).joinToString(", ").takeIf { it.isNotBlank() }

    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(Color.White)
            .border(1.dp, Color(0xFFE2E8F0), RoundedCornerShape(12.dp)),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    AppIcon.Map,
                    contentDescription = null,
                    tint = BrandBlue,
                    modifier = Modifier.size(16.dp),
                )
                Spacer(Modifier.width(8.dp))
                Text(title, color = TextDark, fontSize = 13.sp, fontWeight = FontWeight.Bold)
            }
            Spacer(Modifier.height(6.dp))

            if (hasCoordinate) {
                Text(
                    MapLauncher.coordinateText(latitude!!, longitude!!),
                    color = TextMuted,
                    fontSize = 11.sp,
                    fontFamily = FontFamily.Monospace,
                )
                secondary?.let {
                    Spacer(Modifier.height(6.dp))
                    Row(verticalAlignment = Alignment.Top) {
                        Icon(
                            AppIcon.Map,
                            contentDescription = null,
                            tint = TextMuted,
                            modifier = Modifier.size(14.dp),
                        )
                        Spacer(Modifier.width(6.dp))
                        Text(it, color = Color(0xFF475569), fontSize = 12.sp)
                    }
                }

                // Peta mini: pin di titik kerusakan, sekaligus bisa diketuk.
                if (showMiniMap) {
                    Spacer(Modifier.height(10.dp))
                    PhotoLocationMapCard(
                        latitude = latitude,
                        longitude = longitude,
                        label = mapLabel,
                        height = 150.dp,
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                MapLauncher.open(context, latitude, longitude, labelFor(roadName, mapLabel))
                            },
                    )
                }
            } else {
                Text(
                    "Koordinat lokasi tidak tersedia untuk laporan ini. " +
                        "Gunakan nama jalan dan kecamatan di atas sebagai acuan.",
                    color = Color(0xFF92400E),
                    fontSize = 12.sp,
                )
            }
        }

        HorizontalDivider(color = Color(0xFFE2E8F0))

        // Baris aksi — seluruh area clickable agar mudah ditekan saat di lapangan.
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .then(
                    if (hasCoordinate) {
                        Modifier.clickable {
                            MapLauncher.open(context, latitude, longitude, labelFor(roadName, mapLabel))
                        }
                    } else {
                        Modifier
                    },
                )
                .padding(vertical = 12.dp),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                AppIcon.Search,
                contentDescription = null,
                tint = if (hasCoordinate) BrandBlue else TextMuted,
                modifier = Modifier.size(15.dp),
            )
            Spacer(Modifier.width(6.dp))
            Text(
                "Buka di Google Maps",
                color = if (hasCoordinate) BrandBlue else TextMuted,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
            )
        }
    }
}

/** Label pin: nama jalan bila ada, jika tidak pakai label bawaan. */
private fun labelFor(roadName: String?, fallback: String): String =
    roadName?.trim()?.takeIf { it.isNotBlank() } ?: fallback
