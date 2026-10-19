package com.jalankita.app.feature.notif

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.jalankita.app.core.network.NotifItemDto
import com.jalankita.app.feature.home.components.EmptyState
import com.jalankita.app.feature.home.components.SkeletonCard
import com.jalankita.app.ui.components.AppIcon
import com.jalankita.app.ui.components.BrandPrimaryButton
import com.jalankita.app.ui.theme.BrandBlue
import com.jalankita.app.ui.theme.ContainerLow
import com.jalankita.app.ui.theme.PillShape
import com.jalankita.app.ui.theme.TextDark
import com.jalankita.app.ui.theme.TextMuted
import java.text.SimpleDateFormat
import java.util.Locale

/** "baru saja / Nm / Nj / Nh" — cermin timeAgo() notifications.tsx:22-32. */
private fun timeAgo(createdAt: String?): String {
    if (createdAt.isNullOrBlank()) return ""
    return try {
        val parsed = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)
            .parse(createdAt.substringBefore('.').substringBefore('+').substringBefore('Z'))
            ?: return ""
        val diff = System.currentTimeMillis() - parsed.time
        val mins = diff / 60_000
        if (mins < 1) return "baru saja"
        if (mins < 60) return "${mins}m"
        val hours = mins / 60
        if (hours < 24) return "${hours}j"
        "${hours / 24}h"
    } catch (_: Exception) {
        ""
    }
}

/** Tanggal pendek "12 Okt 2026, 08:45" — cermin formatDate short web. */
private fun shortDate(createdAt: String?): String {
    if (createdAt.isNullOrBlank()) return ""
    return try {
        val parsed = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)
            .parse(createdAt.substringBefore('.').substringBefore('+').substringBefore('Z'))
            ?: return ""
        SimpleDateFormat("d MMM yyyy, HH:mm", Locale("id")).format(parsed)
    } catch (_: Exception) {
        createdAt.take(16).replace('T', ' ')
    }
}

/**
 * Layar Notifikasi — replikasi routes/notifications.tsx.
 * Dipakai 3 scaffold (petugas/warga/supervisor); tap item hanya menandai
 * dibaca (tanpa navigasi, sama seperti web).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NotifScreen(
    vm: NotifViewModel,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    LaunchedEffect(Unit) {
        if (vm.items.isEmpty() && !vm.loading) vm.load(reset = true)
        vm.loadUnread()
    }
    val ptr = rememberPullToRefreshState()
    var confirmDelete by remember { mutableStateOf(false) }

    Column(modifier = modifier.fillMaxSize()) {
        // Header — judul + aksi (cermin PageLayout title + right actions web).
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 8.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack) {
                Icon(AppIcon.ArrowBack, contentDescription = "Kembali", tint = TextMuted)
            }
            Text(
                text = "Semua Notifikasi",
                color = TextDark,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.weight(1f),
            )
            TextButton(onClick = vm::markAllRead) {
                Text("Tandai dibaca", color = BrandBlue, fontSize = 11.sp, fontWeight = FontWeight.Medium)
            }
            TextButton(onClick = { confirmDelete = true }) {
                Text("Hapus semua", color = Color(0xFFDC2626), fontSize = 11.sp, fontWeight = FontWeight.Medium)
            }
        }
        // Chip filter tipe (cermin types[] web — filter client-side).
        LazyRow(
            contentPadding = PaddingValues(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            items(NOTIF_FILTERS) { (label, value) ->
                val selected = vm.filter == value
                Box(
                    modifier = Modifier
                        .clip(PillShape)
                        .background(if (selected) BrandBlue else ContainerLow)
                        .clickable(onClick = { vm.applyFilter(value) })
                        .padding(horizontal = 14.dp, vertical = 8.dp),
                ) {
                    Text(
                        text = label,
                        color = if (selected) Color.White else TextDark,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium,
                    )
                }
            }
        }
        Spacer(Modifier.height(8.dp))
        PullToRefreshBox(
            isRefreshing = vm.refreshing,
            state = ptr,
            onRefresh = { vm.load(reset = true) },
            modifier = Modifier.fillMaxSize(),
        ) {
            val visible = vm.visibleItems
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 24.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                if (!vm.loading && visible.isEmpty()) {
                    item(key = "empty") {
                        EmptyState(
                            icon = AppIcon.Notifications,
                            title = "Tidak ada notifikasi",
                            subtitle = "Notifikasi laporan dan tugas akan tampil di sini.",
                        )
                    }
                } else {
                    if (vm.loading && vm.items.isEmpty()) {
                        items(5) { SkeletonCard() }
                    }
                    items(visible, key = { "notif-${it.id}" }) { item ->
                        NotifRow(item = item, onClick = { vm.markRead(item) })
                    }
                    if (vm.page < vm.lastPage) {
                        item(key = "more") {
                            BrandPrimaryButton(
                                text = "Muat lebih banyak",
                                onClick = { vm.load() },
                                loading = vm.loading,
                                loadingText = "Memuat…",
                            )
                        }
                    }
                }
            }
        }
    }
    if (confirmDelete) {
        AlertDialog(
            onDismissRequest = { confirmDelete = false },
            title = { Text("Hapus Semua Notifikasi?", fontWeight = FontWeight.Bold, color = TextDark) },
            text = { Text("Semua notifikasi akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.") },
            confirmButton = {
                TextButton(
                    onClick = { confirmDelete = false; vm.deleteAll() },
                    enabled = !vm.deleteBusy,
                ) { Text("Hapus", color = Color(0xFFDC2626), fontWeight = FontWeight.Bold) }
            },
            dismissButton = {
                TextButton(onClick = { confirmDelete = false }) { Text("Batal", color = TextMuted) }
            },
        )
    }
}

/** Satu baris notifikasi — unread: bg #EFF6FF + dot biru (cermin web). */
@Composable
private fun NotifRow(item: NotifItemDto, onClick: () -> Unit) {
    val unread = item.isUnread
    val shape = RoundedCornerShape(8.dp)
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(if (unread) Color(0xFFEFF6FF) else Color.White, shape)
            .border(1.dp, if (unread) Color(0xFFBFDBFE) else Color(0xFFE2E8F0), shape)
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.Top,
    ) {
        Box(
            modifier = Modifier
                .padding(top = 4.dp)
                .size(8.dp)
                .clip(androidx.compose.foundation.shape.CircleShape)
                .background(if (unread) Color(0xFF2563EB) else Color.Transparent),
        )
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(
                text = item.data?.message ?: "(tanpa pesan)",
                color = TextDark,
                fontSize = 13.sp,
                lineHeight = 18.sp,
            )
            Spacer(Modifier.height(6.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(text = shortDate(item.createdAt), color = TextMuted, fontSize = 10.sp)
                Text(text = " • ", color = TextMuted, fontSize = 10.sp)
                Text(text = timeAgo(item.createdAt), color = TextMuted, fontSize = 10.sp)
            }
        }
    }
}

/** Format tanggal untuk dipakai lintas layar (dipakai ulang bila perlu). */
@Suppress("unused")
fun formatNotifDate(iso: String?): String = shortDate(iso)
