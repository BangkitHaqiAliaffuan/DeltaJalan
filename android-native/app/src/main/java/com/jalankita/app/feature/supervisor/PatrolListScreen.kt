package com.jalankita.app.feature.supervisor

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.jalankita.app.core.network.PATROL_FREKUENSI
import com.jalankita.app.core.network.PATROL_HARI
import com.jalankita.app.core.network.PATROL_HARI_LABEL
import com.jalankita.app.core.network.PATROL_JENIS_TUGAS
import com.jalankita.app.core.network.PATROL_MIN_HARI
import com.jalankita.app.core.network.PatrolSchedule
import com.jalankita.app.core.network.TeamDto
import com.jalankita.app.feature.supervisor.components.TeamSearchSelect
import com.jalankita.app.feature.home.components.EmptyState
import com.jalankita.app.feature.home.components.SkeletonCard
import com.jalankita.app.ui.components.AppIcon
import com.jalankita.app.ui.components.BrandPrimaryButton
import com.jalankita.app.ui.components.BrandSecondaryButton
import com.jalankita.app.ui.components.BrandTextField
import com.jalankita.app.ui.components.ErrorBox
import com.jalankita.app.ui.components.InfoBox
import com.jalankita.app.ui.components.WarningBox
import com.jalankita.app.ui.theme.BrandBlue
import com.jalankita.app.ui.theme.BrandBlueLight
import com.jalankita.app.ui.theme.ErrorRed
import com.jalankita.app.ui.theme.SuccessGreen
import com.jalankita.app.ui.theme.TextDark
import com.jalankita.app.ui.theme.TextMuted
import java.time.LocalDate

/**
 * Daftar jadwal patroli supervisor — port supervisor/patrol-schedule/index.tsx (PS3–PS5).
 * Hero + tombol "Jadwal Baru" + grid kartu + 3 modal (create/edit, generate, delete).
 */
@Composable
fun PatrolListScreen(
    vm: PatrolViewModel,
    onOpenDetail: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    var modal by remember { mutableStateOf<PatrolModal?>(null) }
    var editId by remember { mutableStateOf<String?>(null) }
    var deleteId by remember { mutableStateOf<String?>(null) }
    var genId by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) { vm.load() }

    LazyColumn(
        modifier = modifier.fillMaxWidth(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(bottom = 24.dp),
    ) {
        // ── Hero ──
        item {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Brush.horizontalGradient(listOf(BrandBlue, BrandBlueLight)))
                    .padding(20.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text("Jadwal Patroli Rutin", color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                        Spacer(Modifier.height(2.dp))
                        Text("Atur pola patroli rutin tim satgas", color = Color(0xFFBFDBFE), fontSize = 13.sp)
                    }
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(Color.White.copy(alpha = 0.15f))
                            .padding(horizontal = 10.dp, vertical = 4.dp),
                    ) {
                        Text("SUPERVISOR", color = Color(0xFFBFDBFE), fontSize = 10.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }

        item {
            Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 16.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Daftar Jadwal Patroli", color = TextDark, fontSize = 16.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                    BrandPrimaryButton("+ Jadwal Baru", onClick = {
                        editId = null
                        modal = PatrolModal.CREATE
                    })
                }
            }
        }

        when {
            vm.listLoading && vm.schedules.isEmpty() -> items(3) {
                SkeletonCard(modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp).height(180.dp))
            }
            vm.schedules.isEmpty() -> item {
                Column(modifier = Modifier.padding(horizontal = 16.dp)) {
                    EmptyState(
                        icon = AppIcon.CalendarMonth,
                        title = "Belum ada jadwal patroli rutin",
                        subtitle = "Buat jadwal pertama untuk mengatur pola patroli tim.",
                    )
                    Spacer(Modifier.height(12.dp))
                    BrandPrimaryButton("Buat Jadwal Baru", onClick = { modal = PatrolModal.CREATE }, modifier = Modifier.fillMaxWidth())
                }
            }
            else -> items(vm.schedules, key = { it.id }) { s ->
                PatrolScheduleCardS(
                    schedule = s,
                    onDetail = { onOpenDetail(s.id) },
                    onEdit = { editId = s.id; modal = PatrolModal.EDIT },
                    onDelete = { deleteId = s.id },
                    onToggle = { vm.toggle(s.id) },
                    onGenerate = { genId = s.id; modal = PatrolModal.GENERATE },
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp),
                )
            }
        }
    }

    // ── Modal Create/Edit ──
    if (modal == PatrolModal.CREATE || modal == PatrolModal.EDIT) {
        val editing = modal == PatrolModal.EDIT
        val schedule = if (editing) vm.schedules.firstOrNull { it.id == editId } else null
        PatrolFormDialog(
            editing = editing,
            initial = schedule,
            teams = if (editing) vm.teams else vm.availableTeams(),
            preview = vm.preview,
            previewLoading = vm.previewLoading,
            busy = vm.busy,
            onPreview = { vm.loadPreview(it) },
            onDismiss = { if (!vm.busy) { modal = null; vm.clearPreview() } },
            onSubmit = { form ->
                if (editing && editId != null) vm.update(editId!!, form) { modal = null; vm.clearPreview() }
                else vm.create(form) { modal = null; vm.clearPreview() }
            },
        )
    }

    // ── Modal Generate ──
    if (modal == PatrolModal.GENERATE && genId != null) {
        GenerateDialog(
            busy = vm.busy,
            onDismiss = { if (!vm.busy) modal = null },
            onConfirm = { start, end -> vm.generate(genId!!, start, end) { modal = null } },
        )
    }

    // ── Modal Delete ──
    deleteId?.let { id ->
        AlertDialog(
            onDismissRequest = { if (!vm.busy) deleteId = null },
            title = { Text("Hapus Jadwal", fontWeight = FontWeight.Bold) },
            text = {
                Text(
                    "Yakin ingin menghapus jadwal ini? Shift aktif yang belum memiliki laporan akan ikut dihapus.",
                    fontSize = 13.sp,
                )
            },
            confirmButton = {
                BrandPrimaryButton("Hapus", onClick = { vm.delete(id) { deleteId = null } }, loading = vm.busy)
            },
            dismissButton = {
                TextButton(onClick = { deleteId = null }) { Text("Batal", color = TextMuted) }
            },
        )
    }
}

private enum class PatrolModal { CREATE, EDIT, GENERATE }

/** Kartu jadwal — port ScheduleCard index.tsx:596-715. */
@Composable
private fun PatrolScheduleCardS(
    schedule: PatrolSchedule,
    onDetail: () -> Unit,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
    onToggle: () -> Unit,
    onGenerate: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val aktif = schedule.status == "aktif"
    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(Color.White)
            .border(1.dp, Color(0xFFE2E8F0), RoundedCornerShape(12.dp))
            .padding(16.dp),
    ) {
        // Header + toggle
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier.size(36.dp).clip(RoundedCornerShape(8.dp)).background(Color(0xFFEEF3FA)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(AppIcon.CalendarMonth, contentDescription = null, tint = BrandBlue, modifier = Modifier.size(18.dp))
            }
            Spacer(Modifier.width(10.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(schedule.team?.name ?: "—", color = TextDark, fontSize = 14.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(frekuensiLabel(schedule.frekuensi), color = TextMuted, fontSize = 11.sp)
            }
            ToggleSwitch(active = aktif, onToggle = onToggle)
        }
        Spacer(Modifier.height(12.dp))

        // Chip hari
        Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            PATROL_HARI.forEach { h ->
                val on = schedule.hari?.contains(h) == true
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .background(if (on) BrandBlue else Color(0xFFF1F5F9))
                        .padding(horizontal = 8.dp, vertical = 4.dp),
                ) {
                    Text(PATROL_HARI_LABEL[h] ?: h, color = if (on) Color.White else Color(0xFF94A3B8), fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
        Spacer(Modifier.height(8.dp))

        // Chip kecamatan (max 5 + N)
        val kec = schedule.kecamatanList.orEmpty()
        if (kec.isNotEmpty()) {
            Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                kec.take(5).forEach { k ->
                    Box(
                        modifier = Modifier.clip(RoundedCornerShape(4.dp)).background(Color(0xFFEEF3FA)).padding(horizontal = 6.dp, vertical = 2.dp),
                    ) { Text(k, color = Color(0xFF476788), fontSize = 10.sp) }
                }
                if (kec.size > 5) {
                    Box(modifier = Modifier.clip(RoundedCornerShape(4.dp)).background(Color(0xFFF1F5F9)).padding(horizontal = 6.dp, vertical = 2.dp)) {
                        Text("+${kec.size - 5}", color = Color(0xFF94A3B8), fontSize = 10.sp)
                    }
                }
            }
            Spacer(Modifier.height(8.dp))
        }

        // Periode + badge
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = buildString {
                    append(formatDateId(schedule.startDate))
                    append(" — ")
                    append(schedule.endDate?.let { formatDateId(it) } ?: "∞")
                },
                color = TextMuted,
                fontSize = 11.sp,
                modifier = Modifier.weight(1f),
            )
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(4.dp))
                    .background(if (aktif) Color(0xFFF0FDF4) else Color(0xFFF8FAFC))
                    .padding(horizontal = 6.dp, vertical = 2.dp),
            ) {
                Text(if (aktif) "Aktif" else "Nonaktif", color = if (aktif) SuccessGreen else Color(0xFF94A3B8), fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
            }
        }
        Spacer(Modifier.height(10.dp))
        Box(Modifier.fillMaxWidth().height(1.dp).background(Color(0xFFE2E8F0)))
        Spacer(Modifier.height(8.dp))

        // Aksi
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            CardActionText("Detail", AppIcon.CalendarMonth, BrandBlue, onDetail)
            CardActionText("Edit", AppIcon.Edit, Color(0xFF475569), onEdit)
            CardActionText("Generate", AppIcon.PlayArrow, BrandBlue, onGenerate)
            Spacer(Modifier.weight(1f))
            CardActionText("Hapus", AppIcon.Delete, ErrorRed, onDelete)
        }
    }
}

@Composable
private fun ToggleSwitch(active: Boolean, onToggle: () -> Unit) {
    Box(
        modifier = Modifier
            .size(width = 40.dp, height = 22.dp)
            .clip(RoundedCornerShape(999.dp))
            .background(if (active) BrandBlue else Color(0xFFCBD5E1))
            .clickable(onClick = onToggle)
            .padding(2.dp),
        contentAlignment = if (active) Alignment.CenterEnd else Alignment.CenterStart,
    ) {
        Box(modifier = Modifier.size(18.dp).clip(RoundedCornerShape(999.dp)).background(Color.White))
    }
}

@Composable
private fun CardActionText(label: String, icon: androidx.compose.ui.graphics.vector.ImageVector, color: Color, onClick: () -> Unit) {
    Row(
        modifier = Modifier.clip(RoundedCornerShape(8.dp)).clickable(onClick = onClick).padding(horizontal = 8.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(14.dp))
        Spacer(Modifier.width(4.dp))
        Text(label, color = color, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
    }
}

/** Form create/edit — port modal index.tsx:321-489. */
@Composable
private fun PatrolFormDialog(
    editing: Boolean,
    initial: PatrolSchedule?,
    teams: List<TeamDto>,
    preview: com.jalankita.app.core.network.PatrolPreview?,
    previewLoading: Boolean,
    busy: Boolean,
    onPreview: (PatrolFormState) -> Unit,
    onDismiss: () -> Unit,
    onSubmit: (PatrolFormState) -> Unit,
) {
    var form by remember {
        mutableStateOf(
            if (initial != null) {
                PatrolFormState(
                    teamId = initial.teamId.orEmpty(),
                    hari = initial.hari.orEmpty(),
                    kecamatanList = initial.kecamatanList.orEmpty(),
                    frekuensi = initial.frekuensi ?: "setiap_minggu",
                    startDate = initial.startDate ?: LocalDate.now().toString(),
                    endDate = initial.endDate.orEmpty(),
                    alasanTugas = initial.alasanTugas ?: "rutin",
                )
            } else {
                PatrolFormState()
            },
        )
    }
    var localError by remember { mutableStateOf<String?>(null) }

    AlertDialog(
        onDismissRequest = { if (!busy) onDismiss() },
        title = { Text(if (editing) "Edit Jadwal Patroli" else "Buat Jadwal Patroli Baru", fontWeight = FontWeight.Bold) },
        text = {
            Column(modifier = Modifier.heightIn(max = 460.dp).verticalScroll(rememberScrollState())) {
                localError?.let { ErrorBox(it, modifier = Modifier.fillMaxWidth()); Spacer(Modifier.height(8.dp)) }

                // Tim
                Text("Tim Satgas *", color = TextDark, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(6.dp))
                TeamSearchSelect(
                    teams = teams,
                    selectedTeamId = form.teamId,
                    onSelect = { t ->
                        // Kecamatan auto-isi dari wilayah UPTD tim (index.tsx:366).
                        form = form.copy(
                            teamId = t.id,
                            kecamatanList = t.uptd?.kecamatanWilayah.orEmpty(),
                        )
                    },
                )
                Spacer(Modifier.height(12.dp))

                // Hari
                Text("Hari Patroli * (minimal $PATROL_MIN_HARI)", color = TextDark, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(6.dp))
                Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    PATROL_HARI.forEach { h ->
                        val on = form.hari.contains(h)
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(6.dp))
                                .background(if (on) BrandBlue else Color.White)
                                .border(1.dp, if (on) BrandBlue else Color(0xFFD0DAE8), RoundedCornerShape(6.dp))
                                .clickable {
                                    form = form.copy(
                                        hari = if (on) form.hari - h else form.hari + h,
                                    )
                                }
                                .padding(horizontal = 8.dp, vertical = 6.dp),
                        ) {
                            Text(PATROL_HARI_LABEL[h] ?: h, color = if (on) Color.White else TextMuted, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
                Spacer(Modifier.height(4.dp))
                Text(
                    text = "Terpilih: ${form.hari.ifEmpty { listOf("—") }.joinToString(", ")}",
                    color = if (form.hari.size in 1 until PATROL_MIN_HARI) ErrorRed else TextMuted,
                    fontSize = 11.sp,
                )
                Spacer(Modifier.height(12.dp))

                // Kecamatan (read-only, otomatis)
                Text("Kecamatan *", color = TextDark, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(6.dp))
                if (form.kecamatanList.isEmpty()) {
                    InfoBox("Pilih tim satgas terlebih dahulu.", modifier = Modifier.fillMaxWidth())
                } else {
                    Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        form.kecamatanList.forEach { k ->
                            Box(modifier = Modifier.clip(RoundedCornerShape(6.dp)).background(Color(0xFFEEF3FA)).padding(horizontal = 8.dp, vertical = 4.dp)) {
                                Text(k, color = BrandBlue, fontSize = 12.sp, fontWeight = FontWeight.Medium)
                            }
                        }
                    }
                    Spacer(Modifier.height(4.dp))
                    Text("${form.kecamatanList.size} kecamatan — otomatis berdasarkan wilayah tim", color = Color(0xFF94A3B8), fontSize = 11.sp)
                }
                Spacer(Modifier.height(12.dp))

                // Frekuensi
                Text("Frekuensi", color = TextDark, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(6.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    PATROL_FREKUENSI.forEach { (value, label) ->
                        val on = form.frekuensi == value
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(8.dp))
                                .background(if (on) BrandBlue else Color.White)
                                .border(1.dp, if (on) BrandBlue else Color(0xFFD0DAE8), RoundedCornerShape(8.dp))
                                .clickable { form = form.copy(frekuensi = value) }
                                .padding(vertical = 8.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(label, color = if (on) Color.White else TextMuted, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                        }
                    }
                }
                Spacer(Modifier.height(12.dp))

                // Tanggal
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text("Mulai *", color = TextDark, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                        Spacer(Modifier.height(4.dp))
                        DateField(form.startDate) { form = form.copy(startDate = it) }
                    }
                    Column(modifier = Modifier.weight(1f)) {
                        Text("Selesai", color = TextDark, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                        Spacer(Modifier.height(4.dp))
                        DateField(form.endDate) { form = form.copy(endDate = it) }
                    }
                }
                Text("Kosongi tanggal selesai untuk tanpa batas.", color = Color(0xFF94A3B8), fontSize = 10.sp)
                Spacer(Modifier.height(12.dp))

                // Jenis tugas
                Text("Jenis Tugas", color = TextDark, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(6.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    PATROL_JENIS_TUGAS.forEach { (value, label) ->
                        val on = form.alasanTugas == value
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(8.dp))
                                .background(if (on) BrandBlue else Color.White)
                                .border(1.dp, if (on) BrandBlue else Color(0xFFD0DAE8), RoundedCornerShape(8.dp))
                                .clickable { form = form.copy(alasanTugas = value) }
                                .padding(vertical = 8.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(label, color = if (on) Color.White else TextMuted, fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
                        }
                    }
                }

                // Preview estimasi (opsional; web tidak menampilkan — native sebagai bantuan)
                Spacer(Modifier.height(10.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    TextButton(onClick = { onPreview(form) }, enabled = !previewLoading && form.validate() == null) {
                        Text(if (previewLoading) "Menghitung…" else "Lihat estimasi shift", color = BrandBlue, fontSize = 12.sp)
                    }
                }
                preview?.let {
                    InfoBox(
                        "Estimasi: ${it.estimatedTasks} shift dalam ${it.totalHari} hari (${it.kecamatanCount} kecamatan).",
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            }
        },
        confirmButton = {
            BrandPrimaryButton(
                text = if (editing) "Perbarui" else "Simpan",
                loading = busy,
                onClick = {
                    val err = form.validate()
                    if (err != null) { localError = err; return@BrandPrimaryButton }
                    localError = null
                    onSubmit(form)
                },
            )
        },
        dismissButton = {
            TextButton(onClick = { if (!busy) onDismiss() }) { Text("Batal", color = TextMuted) }
        },
    )
}

/** Field tanggal sederhana (ISO yyyy-MM-dd). Web pakai <input type=date>; native pakai teks. */
@Composable
private fun DateField(value: String, onChange: (String) -> Unit) {
    BrandTextField(
        value = value,
        onValueChange = { if (it.length <= 10) onChange(it) },
        placeholder = "yyyy-mm-dd",
        modifier = Modifier.fillMaxWidth(),
    )
}

/** Modal generate — port index.tsx:491-552. */
@Composable
private fun GenerateDialog(
    busy: Boolean,
    onDismiss: () -> Unit,
    onConfirm: (String, String) -> Unit,
) {
    var start by remember { mutableStateOf(LocalDate.now().toString()) }
    var end by remember { mutableStateOf(LocalDate.now().plusDays(14).toString()) }
    AlertDialog(
        onDismissRequest = { if (!busy) onDismiss() },
        title = { Text("Generate Shift Patroli", fontWeight = FontWeight.Bold) },
        text = {
            Column {
                WarningBox("Generate shift untuk rentang tanggal berdasarkan pola jadwal.", modifier = Modifier.fillMaxWidth())
                Spacer(Modifier.height(12.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text("Dari Tanggal", color = TextDark, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                        Spacer(Modifier.height(4.dp))
                        DateField(start) { start = it }
                    }
                    Column(modifier = Modifier.weight(1f)) {
                        Text("Sampai Tanggal", color = TextDark, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                        Spacer(Modifier.height(4.dp))
                        DateField(end) { end = it }
                    }
                }
            }
        },
        confirmButton = { BrandPrimaryButton("Generate", loading = busy, onClick = { onConfirm(start, end) }) },
        dismissButton = { TextButton(onClick = { if (!busy) onDismiss() }) { Text("Batal", color = TextMuted) } },
    )
}

// ── Helper ────────────────────────────────────────────────────────────────

internal fun frekuensiLabel(value: String?): String =
    PATROL_FREKUENSI.firstOrNull { it.first == value }?.second ?: (value ?: "—")

/** "2026-01-12" → "12 Januari 2026" (port formatDateId web). */
internal fun formatDateId(dateStr: String?): String {
    if (dateStr.isNullOrBlank()) return "—"
    val months = listOf("Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember")
    return try {
        val parts = dateStr.substringBefore("T").split("-")
        "${parts[2].toInt()} ${months[parts[1].toInt() - 1]} ${parts[0]}"
    } catch (_: Exception) {
        dateStr
    }
}
