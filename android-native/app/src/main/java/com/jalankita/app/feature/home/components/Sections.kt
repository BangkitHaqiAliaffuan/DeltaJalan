package com.jalankita.app.feature.home.components

import androidx.compose.foundation.background
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
import androidx.compose.runtime.remember
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
import com.jalankita.app.ui.theme.BrandBlue
import com.jalankita.app.ui.theme.BrandBlueLight
import com.jalankita.app.ui.theme.TextMuted

/**
 * Hero sapaan — port home.tsx:172-187.
 * Web: section full-bleed gradien #1e40af→#2e68d8, p-6, teks putih,
 * subjudul biru-muda, badge peran putih/15.
 */
@Composable
fun GreetingHero(
    greeting: String,
    name: String,
    teamName: String?,
    modifier: Modifier = Modifier,
    badgeLabel: String = "PETUGAS",
    subtitle: String? = null,
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(Brush.linearGradient(listOf(BrandBlue, BrandBlueLight)))
            .padding(24.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.Top,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "$greeting, $name",
                    color = Color.White,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    text = subtitle ?: buildString {
                        if (!teamName.isNullOrBlank()) append("$teamName • ")
                        append("Status pelaporan jalan Kab. Sidoarjo hari ini")
                    },
                    color = Color(0xFFBFDBFE),
                    fontSize = 14.sp,
                )
            }
            Spacer(Modifier.width(8.dp))
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(4.dp))
                    .background(Color.White.copy(alpha = 0.15f))
                    .padding(horizontal = 10.dp, vertical = 4.dp),
            ) {
                Text(
                    text = badgeLabel,
                    color = Color(0xFFBFDBFE),
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    letterSpacing = 1.sp,
                )
            }
        }
    }
}

/** Judul seksi + tautan "Lihat Semua" — port pola home.tsx:251-262. */
@Composable
fun SectionHeader(
    icon: ImageVector,
    title: String,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, contentDescription = null, tint = BrandBlue, modifier = Modifier.size(20.dp))
        Spacer(Modifier.width(8.dp))
        Text(
            text = title,
            color = com.jalankita.app.ui.theme.TextDark,
            fontSize = 15.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.weight(1f),
        )
        if (actionLabel != null && onAction != null) {
            androidx.compose.material3.TextButton(onClick = onAction) {
                Text(
                    text = actionLabel,
                    color = BrandBlue,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                )
            }
        }
    }
}

/** State kosong — port empty-state web (ikon + judul + subjudul + aksi opsional). */
@Composable
fun EmptyState(
    icon: ImageVector = AppIcon.Inbox,
    title: String,
    subtitle: String,
    modifier: Modifier = Modifier,
    action: (@Composable () -> Unit)? = null,
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(vertical = 32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            modifier = Modifier
                .size(48.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(Color(0xFFF1F5F9)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(icon, contentDescription = null, tint = TextMuted, modifier = Modifier.size(22.dp))
        }
        Spacer(Modifier.height(16.dp))
        Text(text = title, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.height(4.dp))
        Text(text = subtitle, color = TextMuted, fontSize = 13.sp)
        if (action != null) {
            Spacer(Modifier.height(16.dp))
            action()
        }
    }
}

/** Skeleton shimmer kartu — port SkeletonCard/pulse web (home.tsx:196-201,391-415). */
@Composable
fun SkeletonCard(modifier: Modifier = Modifier) {
    val shape = remember { RoundedCornerShape(12.dp) }
    val shimmer = rememberShimmerBrush()
    androidx.compose.foundation.layout.Box(
        modifier
            .fillMaxWidth()
            .height(120.dp)
            .clip(shape)
            .background(shimmer, shape),
    )
}

@Composable
private fun rememberShimmerBrush(): Brush {
    val base = Color(0xFFE2E8F0)
    val highlight = Color(0xFFF1F5F9)
    return remember {
        Brush.linearGradient(listOf(base, highlight, base))
    }
}
