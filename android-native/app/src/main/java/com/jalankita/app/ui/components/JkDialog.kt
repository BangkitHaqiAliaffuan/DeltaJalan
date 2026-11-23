package com.jalankita.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.jalankita.app.ui.theme.BrandBlue
import com.jalankita.app.ui.theme.DividerLine
import com.jalankita.app.ui.theme.ErrorRed
import com.jalankita.app.ui.theme.TextDark
import com.jalankita.app.ui.theme.TextMuted

/**
 * Kerangka dialog milik DeltaJalan.
 *
 * Kenapa tidak memakai `AlertDialog` bawaan Material 3: dialogs M3 mengambil
 * warna dari `colorScheme.surfaceContainerHigh`, yang TIDAK didefinisikan di
 * `DeltaJalanColors` sehingga Material menurunkannya sendiri — hasilnya kotak
 * abu-keunguan yang tidak cocok dengan putih/biru brand, dan lebarnya mengikuti
 * `usePlatformDefaultWidth` (sempit di layar 720px). Petugas menyebutnya
 * "pop up dari Android dengan warna kurang bagus".
 *
 * Dialog ini memakai `Dialog` polos + kartu putih bergaris yang sama dengan
 * kartu lain di aplikasi, sehingga tampil konsisten di semua perangkat.
 *
 * @param icon ikon kecil di kiri judul (opsional).
 * @param primaryColor warna tombol utama — pakai [ErrorRed] untuk aksi merusak.
 */
@Composable
fun JkDialog(
    title: String,
    onDismissRequest: () -> Unit,
    primaryLabel: String,
    onPrimary: () -> Unit,
    modifier: Modifier = Modifier,
    subtitle: String? = null,
    icon: ImageVector? = null,
    primaryEnabled: Boolean = true,
    primaryColor: Color = BrandBlue,
    secondaryLabel: String = "Batal",
    onSecondary: (() -> Unit)? = null,
    showSecondary: Boolean = true,
    /** Aksi tambahan di bawah tombol utama (mis. "Detail" pada dialog review). */
    extraActions: (@Composable () -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit = {},
) {
    Dialog(
        onDismissRequest = onDismissRequest,
        properties = DialogProperties(usePlatformDefaultWidth = false),
    ) {
        Column(
            modifier = modifier
                .fillMaxWidth(0.9f)
                .widthIn(max = 400.dp)
                .clip(RoundedCornerShape(16.dp))
                .background(Color.White)
                .border(1.dp, DividerLine, RoundedCornerShape(16.dp))
                .padding(20.dp),
        ) {
            // ── Kepala ────────────────────────────────────────────────────
            Row(verticalAlignment = Alignment.CenterVertically) {
                icon?.let {
                    Box(
                        modifier = Modifier
                            .size(32.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .background(primaryColor.copy(alpha = 0.10f)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(it, contentDescription = null, tint = primaryColor, modifier = Modifier.size(18.dp))
                    }
                    Spacer(Modifier.width(10.dp))
                }
                Text(title, color = TextDark, fontSize = 16.sp, fontWeight = FontWeight.Bold)
            }

            subtitle?.let {
                Spacer(Modifier.height(6.dp))
                Text(it, color = TextMuted, fontSize = 12.sp)
            }

            // ── Isi ───────────────────────────────────────────────────────
            // `weight(fill = false)` + scroll: dialog berisi form panjang
            // (mis. Edit Laporan) tidak meluap keluar layar pada perangkat
            // 720x1448, sementara dialog pendek tetap setinggi isinya.
            Spacer(Modifier.height(14.dp))
            Column(
                modifier = Modifier
                    .weight(1f, fill = false)
                    .verticalScroll(rememberScrollState()),
            ) { content() }

            // ── Kaki: satu tombol utama penuh + tombol batal teks ──────────
            Spacer(Modifier.height(18.dp))
            JkDialogPrimaryButton(
                label = primaryLabel,
                onClick = onPrimary,
                enabled = primaryEnabled,
                color = primaryColor,
            )
            extraActions?.let {
                Spacer(Modifier.height(4.dp))
                it()
            }
            if (showSecondary) {
                Spacer(Modifier.height(8.dp))
                JkDialogTextButton(
                    label = secondaryLabel,
                    onClick = onSecondary ?: onDismissRequest,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }
    }
}

/** Tombol utama dialog: penuh selebar kartu, 44dp, warna brand. */
@Composable
fun JkDialogPrimaryButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    color: Color = BrandBlue,
) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(44.dp)
            .clip(RoundedCornerShape(10.dp))
            .background(if (enabled) color else color.copy(alpha = 0.35f))
            .clickable(enabled = enabled, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(label, color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold)
    }
}

/** Tombol batal dialog: teks saja, tanpa latar. */
@Composable
fun JkDialogTextButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    color: Color = TextMuted,
) {
    Box(
        modifier = modifier
            .height(40.dp)
            .clip(RoundedCornerShape(10.dp))
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(label, color = color, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
    }
}

/** Jarak antar elemen isi dialog, dipakai pemanggil agar seragam. */
val JkDialogSpacing = Arrangement.spacedBy(10.dp)
