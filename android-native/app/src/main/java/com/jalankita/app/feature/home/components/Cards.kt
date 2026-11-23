package com.jalankita.app.feature.home.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.jalankita.app.ui.components.AppIcon
import com.jalankita.app.ui.components.JkDialog
import com.jalankita.app.ui.theme.BrandBlue
import com.jalankita.app.ui.theme.StatTint
import com.jalankita.app.ui.theme.StatTintBorder
import com.jalankita.app.ui.theme.TextDark
import com.jalankita.app.ui.theme.TextMuted

/**
 * Kartu Overview Operasional — port home.tsx:204-243.
 * Web: gradien #EEF2FF→white, border #C7D2FE, rounded-xl, aspect-square,
 * ikon+angka tengah, label bawah. Hover web → ripple native.
 */
@Composable
fun StatCard(
    icon: ImageVector,
    label: String,
    value: Int?,
    color: Color,
    modifier: Modifier = Modifier,
) {
    val shape = RoundedCornerShape(12.dp)
    Column(
        modifier = modifier
            .aspectRatio(1f)
            .clip(shape)
            .background(Brush.verticalGradient(listOf(StatTint, Color.White)))
            .border(1.dp, StatTintBorder, shape)
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(24.dp))
            Spacer(Modifier.width(6.dp))
            Text(
                text = value?.toString() ?: "—",
                color = color, fontSize = 24.sp, fontWeight = FontWeight.Bold,
            )
        }
        Spacer(Modifier.height(6.dp))
        Text(
            text = label,
            color = color.copy(alpha = 0.8f),
            fontSize = 14.sp,
            fontWeight = FontWeight.Medium,
        )
    }
}

/** Pengganti kartu angka saat /reports/stats gagal — jangan tampilkan 0 palsu. */
@Composable
fun StatErrorCard(
    message: String?,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val shape = RoundedCornerShape(12.dp)
    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(shape)
            .background(Color.White)
            .border(1.dp, Color(0xFFFECACA), shape)
            .padding(16.dp),
    ) {
        Text("Statistik belum dapat dimuat", color = TextDark, fontSize = 14.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(4.dp))
        Text(
            message ?: "Periksa koneksi lalu coba lagi.",
            color = TextMuted, fontSize = 12.sp,
        )
        Spacer(Modifier.height(8.dp))
        Text(
            "Coba lagi",
            color = BrandBlue, fontSize = 13.sp, fontWeight = FontWeight.SemiBold,
            modifier = Modifier
                .clip(RoundedCornerShape(6.dp))
                .clickable(onClick = onRetry)
                .padding(horizontal = 10.dp, vertical = 6.dp),
        )
    }
}

/** Varian tombol aksi kartu (port CardActions.tsx). */
enum class CardActionStyle { PRIMARY, SECONDARY, DESTRUCTIVE }

/** Tombol aksi kartu 11sp bold rounded-lg (port CardActions base). */
@Composable
fun CardActionButton(
    text: String,
    onClick: () -> Unit,
    style: CardActionStyle = CardActionStyle.SECONDARY,
    icon: ImageVector? = null,
    enabled: Boolean = true,
) {
    val shape = RoundedCornerShape(8.dp)
    val (bg, fg, border) = when (style) {
        CardActionStyle.PRIMARY -> Triple(BrandBlue, Color.White, BrandBlue)
        CardActionStyle.SECONDARY -> Triple(Color.White, BrandBlue, BrandBlue)
        CardActionStyle.DESTRUCTIVE -> Triple(Color(0xFFFFF5F5), Color(0xFFDC2626), Color(0xFFFECACA))
    }
    Row(
        modifier = Modifier
            .clip(shape)
            .background(if (enabled) bg else bg.copy(alpha = 0.4f))
            .border(1.dp, border, shape)
            .clickable(enabled = enabled, onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        icon?.let {
            Icon(it, contentDescription = null, tint = fg, modifier = Modifier.size(14.dp))
            Spacer(Modifier.width(4.dp))
        }
        Text(text, color = fg, fontSize = 11.sp, fontWeight = FontWeight.Bold)
    }
}

/** Dialog konfirmasi hapus laporan dari kartu. */
@Composable
fun DeleteConfirmDialog(
    reportCode: String?,
    loading: Boolean,
    onDismiss: () -> Unit,
    onConfirm: () -> Unit,
) {
    // Kartu putih + tombol merah penuh, konsisten dengan dialog lain (JkDialog).
    JkDialog(
        title = "Hapus Laporan?",
        subtitle = "Laporan ${reportCode ?: ""} dihapus permanen beserta fotonya. Tindakan ini tidak dapat dibatalkan.",
        icon = AppIcon.Delete,
        primaryColor = Color(0xFFDC2626),
        primaryLabel = if (loading) "Menghapus..." else "Hapus Laporan",
        primaryEnabled = !loading,
        onPrimary = onConfirm,
        onDismissRequest = onDismiss,
    )
}

/** Placeholder spinner saat thumbnail Coil dimuat dari dalam kartu (dipakai bila perlu). */
@Composable
fun ImageLoadingBox(modifier: Modifier = Modifier) {
    Box(modifier.background(Color(0xFFE8F0FA)), contentAlignment = Alignment.Center) {
        CircularProgressIndicator(color = BrandBlue, modifier = Modifier.size(24.dp))
    }
}
