package com.jalankita.app.feature.supervisor

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
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.jalankita.app.core.network.PatrolSchedule
import com.jalankita.app.core.network.PatrolTask
import com.jalankita.app.feature.home.components.SkeletonCard
import com.jalankita.app.feature.home.components.formatDateShort
import com.jalankita.app.ui.util.Waktu
import com.jalankita.app.ui.components.AppIcon
import com.jalankita.app.ui.components.safeContentPaddingValues
import com.jalankita.app.ui.components.BrandPrimaryButton
import com.jalankita.app.ui.components.BrandSecondaryButton
import com.jalankita.app.ui.components.DetailErrorState
import com.jalankita.app.ui.theme.BrandBlue
import com.jalankita.app.ui.theme.BrandBlueLight
import com.jalankita.app.ui.theme.SuccessGreen
import com.jalankita.app.ui.theme.TextDark
import com.jalankita.app.ui.theme.TextMuted
import com.jalankita.app.ui.util.buildCalendarWeeks
import com.jalankita.app.ui.util.namaBulan
import com.jalankita.app.ui.util.quandoDayName
import com.jalankita.app.ui.util.startOfWeek
import java.time.LocalDate
import java.time.YearMonth

/**
 * Detail jadwal patroli + kalender bulanan — port supervisor/patrol-schedule.detail.tsx (PS6).
 * Kalender: sel biru = hari patroli terjadwal, hijau = task sudah digenerate (+N laporan),
 * lingkaran penuh = hari ini.
 */
@Composable
fun PatrolDetailScreen(
    scheduleId: String,
    vm: PatrolViewModel,
    onBack: () -> Unit,
    onOpenTask: (String) -> Unit = {},
    /** Buka sesi patroli (halaman rincian sesi: laporan + antrean inspeksi). */
    onOpenSession: (String) -> Unit = {},
    /** Langsung buka dialog "Antrekan laporan untuk inspeksi" untuk task ini. */
    onQueueInspection: ((String) -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    LaunchedEffect(scheduleId) { if (scheduleId.isNotBlank()) vm.loadDetail(scheduleId) }

    Column(modifier = modifier.fillMaxWidth()) {
        // Top bar
        Row(
            modifier = Modifier.fillMaxWidth().background(Color.White).statusBarsPadding().padding(horizontal = 12.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(AppIcon.ArrowBack, contentDescription = "Kembali", tint = BrandBlue, modifier = Modifier.size(24.dp).clickable(onClick = onBack))
            Spacer(Modifier.width(12.dp))
            Text("Detail Jadwal Patroli", color = TextDark, fontSize = 16.sp, fontWeight = FontWeight.Bold)
        }
        HorizontalDivider(color = Color(0xFFD0DAE8), thickness = 1.dp)

        // Skeleton selama `detail == null && detailError == null` — termasuk frame
        // pertama sebelum pemuatan dimulai. Kotak error hanya untuk kegagalan nyata.
        when {
            vm.detail == null && vm.detailError == null -> LazyColumn(
                modifier = Modifier.fillMaxWidth().padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) { items(3) { SkeletonCard() } }

            vm.detail == null -> DetailErrorState(
                message = vm.detailError ?: "Jadwal tidak dapat dimuat.",
                onRetry = { vm.loadDetail(scheduleId) },
                onBack = onBack,
            )

            else -> PatrolDetailBody(
                schedule = vm.detail!!,
                onOpenTask = onOpenTask,
                onOpenSession = onOpenSession,
                onQueueInspection = onQueueInspection,
            )
        }
    }
}

@Composable
private fun PatrolDetailBody(
    schedule: PatrolSchedule,
    onOpenTask: (String) -> Unit,
    onOpenSession: (String) -> Unit,
    onQueueInspection: ((String) -> Unit)?,
) {
    val tasks = schedule.team?.surveyTasks.orEmpty()
    val tasksByDate = remember(tasks) { tasks.filter { it.tanggalPatroli != null }.associateBy { it.tanggalPatroli!! } }
    // Sesi yang bisa dipakai mengantrekan laporan: task `aktif` hari ini atau
    // yang terjadwal berikutnya. Sebelumnya tombol antrean hanya hidup di
    // PatrolSessionScreen, padahal layar itu tidak bisa dibuka dari sini —
    // akibatnya tombol "Antrekan laporan untuk inspeksi" tak pernah terjangkau.
    val activeTask = remember(tasks) {
        val today = Waktu.hariIniWib()
        tasks
            .filter { it.status == "aktif" }
            .sortedWith(
                compareBy(
                    { taskDate(it)?.isBefore(today) ?: true },
                    { taskDate(it) ?: LocalDate.MAX },
                ),
            )
            .firstOrNull()
    }

    LazyColumn(
        modifier = Modifier.fillMaxWidth(),
        contentPadding = safeContentPaddingValues(horizontal = 0.dp, vertical = 24.dp),
    ) {
        // Hero
        item {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Brush.horizontalGradient(listOf(BrandBlue, BrandBlueLight)))
                    .padding(20.dp),
            ) {
                Text("Detail Jadwal Patroli", color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                Text(schedule.team?.name ?: "—", color = Color(0xFFBFDBFE), fontSize = 13.sp)
            }
        }

        // Kartu info
        item {
            Column(
                modifier = Modifier
                    .padding(16.dp)
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(Color.White)
                    .border(1.dp, Color(0xFFE2E8F0), RoundedCornerShape(12.dp))
                    .padding(16.dp),
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(20.dp)) {
                        InfoStat("Frekuensi", frekuensiLabel(schedule.frekuensi))
                        InfoStat("Status", if (schedule.status == "aktif") "Aktif" else "Nonaktif", if (schedule.status == "aktif") SuccessGreen else TextMuted)
                    }
                    InfoStat("Periode", buildString {
                        append(formatDateId(schedule.startDate))
                        append(" — ")
                        append(schedule.endDate?.let { formatDateId(it) } ?: "∞")
                    })
                    InfoStat("Jam Patroli", "${schedule.jamMulai ?: "09:00"} – ${schedule.jamSelesai ?: "16:00"} WIB")
                    InfoStat("Jenis Tugas", jenisTugasLabel(schedule.alasanTugas))
                }
                if (!schedule.hari.isNullOrEmpty()) {
                    Spacer(Modifier.height(12.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        schedule.hari.forEach { h ->
                            Box(modifier = Modifier.clip(RoundedCornerShape(6.dp)).background(BrandBlue).padding(horizontal = 8.dp, vertical = 4.dp)) {
                                Text(h.take(3), color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
                if (!schedule.kecamatanList.isNullOrEmpty()) {
                    Spacer(Modifier.height(8.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        schedule.kecamatanList.forEach { k ->
                            Box(modifier = Modifier.clip(RoundedCornerShape(4.dp)).background(Color(0xFFEEF3FA)).padding(horizontal = 6.dp, vertical = 2.dp)) {
                                Text(k, color = Color(0xFF476788), fontSize = 10.sp)
                            }
                        }
                    }
                }
            }
        }

        // ── Sesi patroli aktif + antrean inspeksi ──
        // Ditaruh SEBELUM kalender agar supervisor langsung melihat titik masuk
        // alur inspeksi (Skenario 1 plan-komprehensif) tanpa menebak sel tanggal.
        //
        // Kartu tetap dirender walau `activeTask == null` (mis. seluruh shift
        // sudah lewat) — tanpa ini layar kembali jadi jalan buntu sunyi dan
        // supervisor menyangka fitur antrean tidak ada sama sekali.
        if (tasks.isNotEmpty() || activeTask != null) {
            item {
                Column(
                    modifier = Modifier
                        .padding(horizontal = 16.dp)
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color.White)
                        .border(1.dp, Color(0xFFE2E8F0), RoundedCornerShape(12.dp))
                        .padding(16.dp),
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(AppIcon.Assignment, contentDescription = null, tint = BrandBlue, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(8.dp))
                        Text(
                            "Sesi Patroli Aktif",
                            color = TextDark, fontSize = 14.sp, fontWeight = FontWeight.Bold,
                            modifier = Modifier.weight(1f),
                        )
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(6.dp))
                                .background(if (activeTask != null) Color(0xFFECFDF5) else Color(0xFFFEF3C7))
                                .padding(horizontal = 8.dp, vertical = 2.dp),
                        ) {
                            Text(
                                if (activeTask != null) "AKTIF" else "${tasks.size} SHIFT",
                                color = if (activeTask != null) SuccessGreen else Color(0xFFB45309),
                                fontSize = 10.sp, fontWeight = FontWeight.Bold,
                            )
                        }
                    }
                    Spacer(Modifier.height(8.dp))
                    if (activeTask != null) {
                        Text(
                            buildString {
                                taskDate(activeTask)?.let { append(formatDateShort(it.toString())) }
                                activeTask.kecamatan?.let { if (isNotEmpty()) append(" · "); append("Kec. $it") }
                                append(" · ${activeTask.reportsCount} laporan")
                            },
                            color = TextMuted, fontSize = 12.sp,
                        )
                        Spacer(Modifier.height(12.dp))
                        if (onQueueInspection != null) {
                            BrandPrimaryButton(
                                "Antrekan laporan untuk inspeksi",
                                onClick = { onQueueInspection(activeTask.id) },
                                modifier = Modifier.fillMaxWidth(),
                            )
                            Spacer(Modifier.height(8.dp))
                        }
                        BrandSecondaryButton(
                            "Buka Detail Sesi",
                            onClick = { onOpenSession(activeTask.id) },
                            modifier = Modifier.fillMaxWidth(),
                        )
                    } else {
                        Text(
                            "Semua shift jadwal ini sudah lewat. Gunakan tombol Generate "
                                + "untuk membuat shift baru.",
                            color = TextMuted, fontSize = 12.sp,
                        )
                    }
                }
            }
        }

        // Kalender
        item {
            PatrolCalendar(
                schedule = schedule,
                tasksByDate = tasksByDate,
                onOpenTask = onOpenTask,
                modifier = Modifier.padding(horizontal = 16.dp),
            )
        }
    }
}

/**
 * Tanggal patroli sebagai [LocalDate] (WIB), atau null bila kosong/tak terbaca.
 * Backend mengirim `tanggal_patroli` sebagai `2026-11-14T17:00:00.000000Z`
 * (UTC), sedangkan tanggal kalender yang dipakai UI adalah WIB — 14 Nov 17:00Z
 * = 15 Nov 00:00 WIB. Perbandingan string mentah akan bergeser satu hari.
 *
 * Fallback ke 10 karakter pertama tetap dipakai bila offset zona tak terbaca,
 * supaya data lama tidak hilang dari tampilan hanya karena parsing gagal.
 */
private fun taskDate(task: PatrolTask): LocalDate? =
    Waktu.tanggalWib(task.tanggalPatroli)

@Composable
private fun InfoStat(label: String, value: String, valueColor: Color = TextDark) {
    Column {
        Text(label, color = TextMuted, fontSize = 12.sp)
        Text(value, color = valueColor, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun PatrolCalendar(
    schedule: PatrolSchedule,
    tasksByDate: Map<String, PatrolTask>,
    onOpenTask: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    var current by remember { mutableStateOf(YearMonth.now()) }
    val today = Waktu.hariIniWib()

    val patrolDates = remember(schedule) { buildPatrolDateMap(schedule) }
    val withReports = tasksByDate.values.count { it.reportsCount > 0 }

    Column(modifier = modifier.fillMaxWidth()) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(AppIcon.CalendarMonth, contentDescription = null, tint = BrandBlue, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(8.dp))
            Text("Kalender Patroli", color = TextDark, fontSize = 15.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
            Text("${patrolDates.size} hari patroli", color = TextMuted, fontSize = 12.sp)
            Spacer(Modifier.width(8.dp))
            Text("$withReports dengan laporan", color = SuccessGreen, fontSize = 12.sp)
        }
        Spacer(Modifier.height(10.dp))

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .background(Color.White)
                .border(1.dp, Color(0xFFE2E8F0), RoundedCornerShape(12.dp)),
        ) {
            // Header navigasi bulan
            Row(
                modifier = Modifier.fillMaxWidth().background(Color(0xFFF8FAFC)).padding(horizontal = 12.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(AppIcon.ChevronLeft, contentDescription = "Bulan sebelumnya", tint = Color(0xFF475569), modifier = Modifier.size(22.dp).clickable { current = current.minusMonths(1) })
                Text(
                    "${namaBulan(current.monthValue)} ${current.year}",
                    color = TextDark, fontSize = 15.sp, fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.weight(1f),
                )
                Icon(AppIcon.ChevronRight, contentDescription = "Bulan berikutnya", tint = Color(0xFF475569), modifier = Modifier.size(22.dp).clickable { current = current.plusMonths(1) })
            }
            HorizontalDivider(color = Color(0xFFE2E8F0))

            // Grid kalender
            Column(modifier = Modifier.padding(8.dp)) {
                Row(modifier = Modifier.fillMaxWidth()) {
                    listOf("Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min").forEach { d ->
                        Text(d, color = TextMuted, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, textAlign = TextAlign.Center, modifier = Modifier.weight(1f).padding(vertical = 6.dp))
                    }
                }
                val weeks = buildCalendarWeeks(current)
                weeks.forEach { week ->
                    Row(modifier = Modifier.fillMaxWidth()) {
                        week.forEach { day ->
                            Box(modifier = Modifier.weight(1f).aspectRatio(0.72f).padding(2.dp)) {
                                if (day != null) {
                                    val dateStr = current.atDay(day).toString()
                                    val patrolKec = patrolDates[dateStr]
                                    val task = tasksByDate[dateStr]
                                    val isToday = dateStr == today.toString()
                                    CalendarCell(
                                        day = day,
                                        kecamatan = patrolKec,
                                        task = task,
                                        isToday = isToday,
                                        onOpenTask = onOpenTask,
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }

        Spacer(Modifier.height(10.dp))
        // Legenda
        Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            LegendItem(Color(0xFFEFF6FF), Color(0xFFBFDBFE), "Jadwal patroli")
            LegendItem(Color(0xFFECFDF5), Color(0xFFA7F3D0), "Task digenerate")
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(modifier = Modifier.size(14.dp).clip(CircleShape).background(BrandBlue))
                Spacer(Modifier.width(6.dp))
                Text("Hari ini", color = TextMuted, fontSize = 11.sp)
            }
        }
    }
}

@Composable
private fun CalendarCell(
    day: Int,
    kecamatan: String?,
    task: PatrolTask?,
    isToday: Boolean,
    onOpenTask: (String) -> Unit = {},
) {
    val bg = when {
        task != null -> Color(0xFFECFDF5)
        kecamatan != null -> Color(0xFFEFF6FF)
        else -> Color.Transparent
    }
    val border = when {
        task != null -> Color(0xFFA7F3D0)
        kecamatan != null -> Color(0xFFBFDBFE)
        else -> Color.Transparent
    }
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(bg)
            .border(1.dp, border, RoundedCornerShape(8.dp))
            .then(
                if (task != null) Modifier.clickable { onOpenTask(task.id) }
                else Modifier
            )
            .padding(4.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = if (isToday) {
                    Modifier.size(20.dp).clip(CircleShape).background(BrandBlue)
                } else Modifier,
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    "$day",
                    color = when {
                        isToday -> Color.White
                        kecamatan != null -> BrandBlue
                        else -> TextMuted
                    },
                    fontSize = 11.sp,
                    fontWeight = if (isToday) FontWeight.Bold else FontWeight.Medium,
                )
            }
            Spacer(Modifier.weight(1f))
            if (task != null) {
                Icon(AppIcon.CheckCircle, contentDescription = null, tint = SuccessGreen, modifier = Modifier.size(11.dp))
            }
        }
        kecamatan?.let {
            Text(
                it,
                color = if (task != null) Color(0xFF047857) else BrandBlue,
                fontSize = 8.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            if (task != null && task.reportsCount > 0) {
                Text("${task.reportsCount} laporan", color = TextMuted, fontSize = 8.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
    }
}

@Composable
private fun LegendItem(bg: Color, border: Color, label: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(modifier = Modifier.size(14.dp).clip(RoundedCornerShape(3.dp)).background(bg).border(1.dp, border, RoundedCornerShape(3.dp)))
        Spacer(Modifier.width(6.dp))
        Text(label, color = TextMuted, fontSize = 11.sp)
    }
}

// ── Logika kalender (port isPatrolDay + patrolDayMap web) ──────────────────
// Helper grid/nama bulan/hari ada di `ui/util/CalendarUtils.kt` (dipakai juga
// kalender jadwal tim di tab Tugas).

/** Peta tanggal→kecamatan patroli untuk rentang jadwal (kecamatan diputar bergilir). */
private fun buildPatrolDateMap(schedule: PatrolSchedule): Map<String, String> {
    val map = mutableMapOf<String, String>()
    val startStr = schedule.startDate ?: return map
    val kecList = schedule.kecamatanList.orEmpty()
    if (kecList.isEmpty()) return map

    val start = Waktu.tanggalWib(startStr) ?: return map
    val end = schedule.endDate?.let { Waktu.tanggalWib(it) }
        ?: Waktu.hariIniWib().plusYears(1)

    var kecIndex = 0
    var cursor = start
    while (!cursor.isAfter(end)) {
        if (isPatrolDay(cursor, schedule)) {
            map[cursor.toString()] = kecList[kecIndex % kecList.size]
            kecIndex++
        }
        cursor = cursor.plusDays(1)
    }
    return map
}

/** Port isPatrolDay: cek hari + frekuensi (mingguan/dua_mingguan/bulanan). */
private fun isPatrolDay(date: LocalDate, schedule: PatrolSchedule): Boolean {
    val dayName = quandoDayName(date)
    if (schedule.hari?.contains(dayName) != true) return false
    return when (schedule.frekuensi) {
        "dua_mingguan" -> {
            val start = Waktu.tanggalWib(schedule.startDate) ?: return false
            val weeks = java.time.temporal.ChronoUnit.WEEKS.between(startOfWeek(start), startOfWeek(date))
            weeks % 2 == 0L
        }
        "bulanan" -> date.dayOfMonth <= 7
        else -> true
    }
}

private fun jenisTugasLabel(v: String?): String = when (v) {
    "tindak_lanjut" -> "Tindak lanjut"
    "pengaduan" -> "Pengaduan"
    else -> "Rutin"
}
