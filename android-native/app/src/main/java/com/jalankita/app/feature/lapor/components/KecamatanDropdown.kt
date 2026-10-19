package com.jalankita.app.feature.lapor.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.jalankita.app.core.network.KECAMATAN_SIDOARJO
import com.jalankita.app.ui.components.AppIcon
import com.jalankita.app.ui.theme.BorderInput
import com.jalankita.app.ui.theme.BrandBlue
import com.jalankita.app.ui.theme.DeltaJalanTypography
import com.jalankita.app.ui.theme.TextDark
import com.jalankita.app.ui.theme.TextPlaceholder

/** Dropdown 18 kecamatan Sidoarjo (wajib valid agar server menerima). */
@Composable
fun KecamatanDropdown(
    selected: String,
    onSelect: (String) -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    /** Terkunci dari sesi cek rutin: nilai tidak boleh diubah (ikon gembok). */
    locked: Boolean = false,
) {
    var expanded by remember { mutableStateOf(false) }
    val shape = RoundedCornerShape(8.dp)
    val interactive = enabled && !locked

    Box(modifier.fillMaxWidth()) {
        Row(
            Modifier
                .fillMaxWidth()
                .height(44.dp)
                .clip(shape)
                .background(if (locked) Color(0xFFF1F5F9) else Color.White)
                .border(1.dp, BorderInput, shape)
                .clickable(enabled = interactive) { expanded = true }
                .padding(horizontal = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = selected.ifBlank { "Pilih kecamatan" },
                color = if (selected.isBlank()) TextPlaceholder else TextDark,
                fontSize = 16.sp,
                modifier = Modifier.weight(1f),
            )
            Icon(
                if (locked) AppIcon.Lock else AppIcon.ChevronDown,
                contentDescription = if (locked) "Terkunci dari sesi patroli" else null,
                tint = TextPlaceholder,
                modifier = Modifier.size(20.dp),
            )
        }
        if (interactive) {
            DropdownMenu(
                expanded = expanded,
                onDismissRequest = { expanded = false },
                modifier = Modifier.heightIn(max = 320.dp).background(Color.White),
            ) {
                // JANGAN pakai LazyColumn di dalam DropdownMenu: menu M3 sudah
                // scrollable internal; lazy bersarang diukur dengan height
                // tak-terhingga → IllegalStateException (crash) saat dibuka.
                KECAMATAN_SIDOARJO.forEach { kec ->
                    DropdownMenuItem(
                        text = { Text(kec, style = DeltaJalanTypography.labelMedium, color = TextDark) },
                        onClick = {
                            onSelect(kec)
                            expanded = false
                        },
                    )
                }
            }
        }
    }
}
