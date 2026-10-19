package com.jalankita.app.feature.supervisor.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
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
import com.jalankita.app.core.network.TeamDto
import com.jalankita.app.ui.components.AppIcon
import com.jalankita.app.ui.components.BrandPrimaryButton
import com.jalankita.app.ui.components.BrandTextField
import com.jalankita.app.ui.components.ErrorBox
import com.jalankita.app.ui.components.WarningBox
import com.jalankita.app.ui.theme.BrandBlue
import com.jalankita.app.ui.theme.ErrorRed
import com.jalankita.app.ui.theme.SuccessGreen
import com.jalankita.app.ui.theme.TextDark
import com.jalankita.app.ui.theme.TextMuted

/** Marker untuk pilihan "Lainnya" di daftar dropdown alasan. */
const val SELECT_REJECT_REASON = "Pilih alasan penolakan…"

/**
 * Dialog tolak — port ReviewDrawer reject form & detail-report Tolak Modal.
 * Dropdown alasan baku (REJECT_REASONS) + "Lainnya" → input teks bebas + catatan opsional.
 * Alasan wajib (≤100), catatan opsional (≤500) — di-enforce client.
 */
@Composable
fun TolakFormDialog(
    busy: Boolean,
    onDismiss: () -> Unit,
    onConfirm: (alasan: String, catatan: String?) -> Unit,
) {
    var selectedReason by remember { mutableStateOf("") }
    var isOther by remember { mutableStateOf(false) }
    var otherText by remember { mutableStateOf("") }
    var catatan by remember { mutableStateOf("") }
    var showDropdown by remember { mutableStateOf(false) }

    val alasan = if (isOther) otherText else selectedReason
    val invalid = alasan.isBlank() || alasan.length > 100

    AlertDialog(
        onDismissRequest = { if (!busy) onDismiss() },
        title = { Text("Tolak Laporan", fontWeight = FontWeight.Bold) },
        text = {
            Column(modifier = Modifier.verticalScroll(rememberScrollState())) {
                Text("Alasan penolakan (wajib)", color = TextMuted, fontSize = 12.sp)
                Spacer(Modifier.height(6.dp))
                // Dropdown trigger
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .background(Color.White)
                        .border(1.dp, Color(0xFFD0DAE8), RoundedCornerShape(8.dp))
                        .clickable { showDropdown = !showDropdown }
                        .padding(horizontal = 12.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = when {
                            isOther -> REJECT_OTHER
                            selectedReason.isNotBlank() -> selectedReason
                            else -> SELECT_REJECT_REASON
                        },
                        color = if (selectedReason.isBlank() && !isOther) TextMuted else TextDark,
                        fontSize = 13.sp,
                        modifier = Modifier.weight(1f),
                    )
                    Icon(AppIcon.ChevronDown, contentDescription = null, tint = TextMuted, modifier = Modifier.size(18.dp))
                }
                if (showDropdown) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(max = 220.dp)
                            .verticalScroll(rememberScrollState())
                            .padding(top = 4.dp),
                    ) {
                        REJECT_REASONS.forEach { reason ->
                            DropdownItem(reason, selectedReason == reason && !isOther) {
                                selectedReason = reason
                                isOther = false
                                showDropdown = false
                            }
                        }
                        DropdownItem(REJECT_OTHER, isOther) {
                            isOther = true
                            showDropdown = false
                        }
                    }
                }

                if (isOther) {
                    Spacer(Modifier.height(8.dp))
                    BrandTextField(
                        value = otherText,
                        onValueChange = { if (it.length <= 100) otherText = it },
                        placeholder = "Tulis alasan penolakan (wajib)",
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = false,
                        isError = otherText.isBlank(),
                    )
                }

                Spacer(Modifier.height(10.dp))
                Text("Catatan tambahan (opsional)", color = TextMuted, fontSize = 12.sp)
                Spacer(Modifier.height(6.dp))
                BrandTextField(
                    value = catatan,
                    onValueChange = { if (it.length <= 500) catatan = it },
                    placeholder = "Catatan tambahan…",
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = false,
                )
                if (invalid && (isOther || selectedReason.isNotBlank())) {
                    Spacer(Modifier.height(6.dp))
                    ErrorBox("Alasan wajib diisi (maks 100 karakter).", modifier = Modifier.fillMaxWidth())
                }
            }
        },
        confirmButton = {
            BrandPrimaryButton(
                text = "Tolak Laporan",
                onClick = { onConfirm(alasan.trim(), catatan.trim().takeIf { it.isNotBlank() }) },
                loading = busy,
                enabled = !invalid,
            )
        },
        dismissButton = {
            TextButton(onClick = { if (!busy) onDismiss() }) { Text("Batal", color = TextMuted) }
        },
    )
}

@Composable
private fun DropdownItem(label: String, active: Boolean, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(6.dp))
            .background(if (active) BrandBlue.copy(alpha = 0.08f) else Color.Transparent)
            .clickable(onClick = onClick)
            .padding(horizontal = 10.dp, vertical = 9.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label, color = TextDark, fontSize = 13.sp, modifier = Modifier.weight(1f))
        if (active) Icon(AppIcon.CheckCircle, contentDescription = null, tint = BrandBlue, modifier = Modifier.size(16.dp))
    }
}

/**
 * Dialog pilih tim — port Team Picker Modal detail-report.tsx:1424-1475.
 * Judul "Pilih Tim Satgas" + pesan + daftar tim + tombol "Tugaskan ke Tim Ini".
 */
@Composable
fun TeamPickerSheet(
    teams: List<TeamDto>,
    busy: Boolean,
    onDismiss: () -> Unit,
    onPick: (String) -> Unit,
) {
    var selected by remember { mutableStateOf<String?>(null) }
    AlertDialog(
        onDismissRequest = { if (!busy) onDismiss() },
        title = {
            Column {
                Box(
                    modifier = Modifier
                        .size(44.dp)
                        .clip(RoundedCornerShape(999.dp))
                        .background(Color(0xFFEFF6FF)),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(AppIcon.Assignment, contentDescription = null, tint = Color(0xFF1A4F8A), modifier = Modifier.size(22.dp))
                }
                Spacer(Modifier.height(10.dp))
                Text("Pilih Tim Satgas", fontWeight = FontWeight.Bold, fontSize = 16.sp)
            }
        },
        text = {
            Column {
                Text(
                    "Kecamatan ini belum memiliki tim satgas otomatis. Silakan pilih tim secara manual.",
                    color = TextMuted,
                    fontSize = 13.sp,
                )
                Spacer(Modifier.height(12.dp))
                if (teams.isEmpty()) {
                    ErrorBox("Daftar tim kosong. Hubungi admin.")
                } else {
                    Column(modifier = Modifier.heightIn(max = 260.dp).verticalScroll(rememberScrollState())) {
                        teams.forEach { t ->
                            val active = selected == t.id
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(if (active) BrandBlue.copy(alpha = 0.08f) else Color.Transparent)
                                    .clickable { selected = t.id }
                                    .padding(vertical = 10.dp, horizontal = 8.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Icon(
                                    if (active) AppIcon.CheckCircle else AppIcon.Assignment,
                                    contentDescription = null,
                                    tint = if (active) BrandBlue else TextMuted,
                                    modifier = Modifier.size(18.dp),
                                )
                                Spacer(Modifier.width(10.dp))
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(t.name ?: "-", color = TextDark, fontSize = 14.sp)
                                    t.uptd?.nama?.let { Text(it, color = TextMuted, fontSize = 12.sp) }
                                }
                                Text("${t.membersCount} anggota", color = TextMuted, fontSize = 11.sp)
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            BrandPrimaryButton(
                text = "Tugaskan ke Tim Ini",
                onClick = { selected?.let(onPick) },
                loading = busy,
                enabled = selected != null,
            )
        },
        dismissButton = {
            TextButton(onClick = { if (!busy) onDismiss() }) { Text("Batal", color = TextMuted) }
        },
    )
}
