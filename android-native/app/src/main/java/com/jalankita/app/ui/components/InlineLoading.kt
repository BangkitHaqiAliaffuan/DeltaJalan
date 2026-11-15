package com.jalankita.app.ui.components

import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.jalankita.app.ui.theme.BrandBlue
import com.jalankita.app.ui.theme.TextMuted

/**
 * Indikator loading satu baris (spinner kecil + teks) untuk status di dalam
 * form: geocoding alamat, pencarian nama jalan, dan sejenisnya.
 *
 * Satu sumber agar ukuran/warna indikator seragam di seluruh layar lapor.
 */
@Composable
fun InlineLoading(
    text: String,
    modifier: Modifier = Modifier,
) {
    Row(modifier, verticalAlignment = Alignment.CenterVertically) {
        CircularProgressIndicator(
            color = BrandBlue,
            strokeWidth = 2.dp,
            modifier = Modifier.size(13.dp),
        )
        Spacer(Modifier.width(6.dp))
        Text(text, color = TextMuted, fontSize = 11.sp)
    }
}
