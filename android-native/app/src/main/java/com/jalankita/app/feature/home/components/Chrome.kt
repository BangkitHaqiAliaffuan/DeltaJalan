package com.jalankita.app.feature.home.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
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
import com.jalankita.app.core.network.UserDto
import com.jalankita.app.ui.components.AppIcon
import com.jalankita.app.ui.theme.BrandBlue
import com.jalankita.app.ui.theme.TextMuted

/**
 * TopBar mobile — port jk/TopBar.tsx:50.
 * Web: h-14 (56dp) putih, border-b #D0DAE8, brand + bell + avatar logout.
 * Native: avatar → tab Profil (ganti dropdown web); bell → layar Notifikasi
 * (cermin NotificationBell web) dengan dot merah bila ada yang belum dibaca.
 */
@Composable
fun DeltaTopBar(
    user: UserDto,
    onAvatarClick: () -> Unit,
    modifier: Modifier = Modifier,
    unreadCount: Int = 0,
    onNotifClick: (() -> Unit)? = null,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .height(56.dp)
            .background(Color.White)
            .padding(horizontal = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = "DeltaJalan",
            color = BrandBlue,
            fontSize = 18.sp,
            fontWeight = FontWeight.ExtraBold,
            modifier = Modifier.weight(1f),
        )
        if (onNotifClick != null) {
            Box(
                modifier = Modifier
                    .size(32.dp)
                    .clip(CircleShape)
                    .clickable(onClick = onNotifClick),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = AppIcon.Notifications,
                    contentDescription = "Notifikasi",
                    tint = TextMuted,
                    modifier = Modifier.size(22.dp),
                )
                if (unreadCount > 0) {
                    Box(
                        modifier = Modifier
                            .align(Alignment.TopEnd)
                            .padding(top = 5.dp, end = 5.dp)
                            .size(8.dp)
                            .clip(CircleShape)
                            .background(Color(0xFFE11D48)),
                    )
                }
            }
        }
        val initial = (user.name.firstOrNull()?.uppercase() ?: "?")
        Box(
            modifier = Modifier
                .size(32.dp)
                .clip(CircleShape)
                .background(BrandBlue)
                .clickable(onClick = onAvatarClick),
            contentAlignment = Alignment.Center,
        ) {
            Text(text = initial, color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold)
        }
    }
}

/** Tab bawah petugas — port jk/BottomNav.tsx PETUGAS_ITEMS (Beranda/Tugas/Peta/Laporan). */
enum class PetugasTab(val label: String) {
    BERANDA("Beranda"),
    TUGAS("Tugas"),
    PETA("Peta"),
    LAPORAN("Laporan"),
}

@Composable
fun PetugasBottomNav(
    selected: PetugasTab,
    onSelect: (PetugasTab) -> Unit,
    modifier: Modifier = Modifier,
) {
    val bottomInset = WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding()
    Row(
        modifier = modifier
            .fillMaxWidth()
            .background(Color.White)
            .padding(bottom = bottomInset),
    ) {
        TabItem(PetugasTab.BERANDA, AppIcon.Home, selected, onSelect, Modifier.weight(1f))
        TabItem(PetugasTab.TUGAS, AppIcon.Assignment, selected, onSelect, Modifier.weight(1f))
        TabItem(PetugasTab.PETA, AppIcon.Map, selected, onSelect, Modifier.weight(1f))
        TabItem(PetugasTab.LAPORAN, AppIcon.Description, selected, onSelect, Modifier.weight(1f))
    }
}

@Composable
private fun TabItem(
    tab: PetugasTab,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    selected: PetugasTab,
    onSelect: (PetugasTab) -> Unit,
    modifier: Modifier = Modifier,
) {
    val active = tab == selected
    Column(
        modifier = modifier
            .height(64.dp)
            .clickable(onClick = { onSelect(tab) })
            .background(Color.Transparent)
            .padding(top = 2.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        // Indikator aktif ala web: garis atas 2dp primary.
        Box(
            modifier = Modifier
                .size(width = 24.dp, height = 2.dp)
                .background(if (active) BrandBlue else Color.Transparent),
        )
        Icon(
            imageVector = icon,
            contentDescription = tab.label,
            tint = if (active) BrandBlue else TextMuted,
            modifier = Modifier.size(22.dp),
        )
        Text(
            text = tab.label,
            color = if (active) BrandBlue else TextMuted,
            fontSize = 12.sp,
            fontWeight = if (active) FontWeight.SemiBold else FontWeight.Normal,
        )
    }
}
