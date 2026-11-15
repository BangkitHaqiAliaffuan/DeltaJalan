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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.jalankita.app.core.network.SurveyTask
import com.jalankita.app.ui.components.AppIcon
import com.jalankita.app.ui.theme.BrandBlue
import com.jalankita.app.ui.theme.SuccessGreen
import com.jalankita.app.ui.theme.TextDark
import com.jalankita.app.ui.theme.TextMuted
import com.jalankita.app.ui.util.buildCalendarWeeks
import com.jalankita.app.ui.util.namaBulan
import java.time.LocalDate
import java.time.YearMonth

/**
 * Kalender bulanan jadwal patroli tim (tab Tugas) — pengganti daftar baris.
 * Setiap tanggal yang punya sesi disorot dengan warna kecamatan; ketuk tanggal
 * untuk melihat sesi hari itu, ketuk sesi untuk membuka detailnya.
 *
 * Sumber data: GET /survei (`DashboardViewModel.surveys`). `tanggal_patroli`
 * bisa berformat ISO penuh, jadi selalu dinormalisasi lewat `substringBefore("T")`.
 */
@Composable
fun PatrolTeamCalendar(
    surveys: List<SurveyTask>,
    loading: Boolean,
    onOpenSession: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    var current by remember { mutableStateOf(YearMonth.now()) }
    var selectedDate by remember { mutableStateOf<LocalDate?>(null) }
    var navigated by remember { mutableStateOf(false) }

    val sessionsByDate = remember(surveys) {
        surveys
            .mapNotNull { task ->
                // Jangan sampai sesi hilang dari daftar hanya karena tanggalnya beda format.
                val date = parseSurveyDate(task.tanggalPatroli)
                    ?: parseSurveyDate(task.createdAt)
                    ?: return@mapNotNull null
                date to task
            }
            .groupBy({ it.first }, { it.second })
            .mapValues { (_, list) -> list.sortedBy { it.jamMulai.orEmpty() } }
    }

    // Warna stabil per kecamatan: urutan alfabetis dari seluruh data, bukan per bulan.
    val kecamatanColors = remember(surveys) {
        surveys
            .map { it.kecamatan?.trim().orEmpty().ifBlank { LAINNYA } }
            .distinct()
            .sorted()
            .mapIndexed { index, kec -> kec to KECAMATAN_PALETTE[index % KECAMATAN_PALETTE.size] }
            .toMap()
    }

    fun colorOf(task: SurveyTask): KecColor =
        kecamatanColors[task.kecamatan?.trim().orEmpty().ifBlank { LAINNYA }]
            ?: KECAMATAN_PALETTE.first()

    val today = remember { LocalDate.now() }

    // Bila bulan berjalan tidak punya sesi (mis. jadwal bulan lalu), lompat ke
    // bulan terdekat yang ada sesinya — kecuali pengguna sudah menekan panah.
    LaunchedEffect(sessionsByDate) {
        if (navigated) return@LaunchedEffect
        val thisMonth = YearMonth.from(today)
        if (sessionsByDate.keys.none { YearMonth.from(it) == thisMonth }) {
            sessionsByDate.keys
                .minByOrNull { kotlin.math.abs(java.time.temporal.ChronoUnit.DAYS.between(today, it)) }
                ?.let { current = YearMonth.from(it) }
        }
    }

    val monthSessions = remember(sessionsByDate, current) {
        sessionsByDate
            .filterKeys { YearMonth.from(it) == current }
            .toSortedMap()
            .flatMap { (_, list) -> list }
    }
    val displayedSessions = selectedDate?.let { sessionsByDate[it].orEmpty() } ?: monthSessions
    val weekDays = listOf("Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min")

    Column(modifier = modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .background(Color.White)
                .border(1.dp, Color(0xFFE2E8F0), RoundedCornerShape(12.dp)),
        ) {
            // Header navigasi bulan
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFFF8FAFC))
                    .padding(horizontal = 12.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(
                    AppIcon.ChevronLeft,
                    contentDescription = "Bulan sebelumnya",
                    tint = Color(0xFF475569),
                    modifier = Modifier.size(22.dp).clickable {
                        current = current.minusMonths(1)
                        selectedDate = null
                        navigated = true
                    },
                )
                Text(
                    "${namaBulan(current.monthValue)} ${current.year}",
                    color = TextDark, fontSize = 15.sp, fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.weight(1f),
                )
                Icon(
                    AppIcon.ChevronRight,
                    contentDescription = "Bulan berikutnya",
                    tint = Color(0xFF475569),
                    modifier = Modifier.size(22.dp).clickable {
                        current = current.plusMonths(1)
                        selectedDate = null
                        navigated = true
                    },
                )
            }
            HorizontalDivider(color = Color(0xFFE2E8F0))

            Column(modifier = Modifier.padding(8.dp)) {
                Row(modifier = Modifier.fillMaxWidth()) {
                    weekDays.forEach { d ->
                        Text(
                            d, color = TextMuted, fontSize = 11.sp, fontWeight = FontWeight.SemiBold,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.weight(1f).padding(vertical = 6.dp),
                        )
                    }
                }
                buildCalendarWeeks(current).forEach { week ->
                    Row(modifier = Modifier.fillMaxWidth()) {
                        week.forEach { day ->
                            Box(modifier = Modifier.weight(1f).aspectRatio(0.8f).padding(2.dp)) {
                                if (day != null) {
                                    val date = current.atDay(day)
                                    val daySessions = sessionsByDate[date].orEmpty()
                                    CalendarDayCell(
                                        day = day,
                                        isToday = date == today,
                                        isSelected = selectedDate == date,
                                        colors = daySessions.map { colorOf(it) },
                                        onClick = if (daySessions.isEmpty()) {
                                            null
                                        } else {
                                            { selectedDate = if (selectedDate == date) null else date }
                                        },
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }

        if (kecamatanColors.isNotEmpty()) {
            Spacer(Modifier.height(10.dp))
            KecamatanLegend(kecamatanColors)
        }

        Spacer(Modifier.height(12.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = selectedDate?.let { formatTanggal(it) } ?: "Sesi ${namaBulan(current.monthValue)}",
                color = TextDark, fontSize = 14.sp, fontWeight = FontWeight.Bold,
                modifier = Modifier.weight(1f),
            )
            Text(
                text = "${displayedSessions.size} sesi",
                color = TextMuted, fontSize = 12.sp,
            )
            if (selectedDate != null) {
                Spacer(Modifier.width(10.dp))
                Text(
                    "Semua",
                    color = BrandBlue, fontSize = 12.sp, fontWeight = FontWeight.SemiBold,
                    modifier = Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .clickable { selectedDate = null }
                        .padding(horizontal = 8.dp, vertical = 4.dp),
                )
            }
        }
        Spacer(Modifier.height(8.dp))

        when {
            loading && surveys.isEmpty() -> SkeletonCard()
            displayedSessions.isEmpty() -> EmptyState(
                icon = AppIcon.CalendarMonth,
                title = "Belum ada sesi patroli",
                subtitle = if (selectedDate != null) {
                    "Tidak ada jadwal pada tanggal ini"
                } else if (surveys.isEmpty()) {
                    "Jadwal dari supervisor akan muncul di sini"
                } else {
                    "Tidak ada sesi di bulan ini — geser bulan untuk melihat jadwal lain"
                },
            )
            else -> Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                displayedSessions.forEach { task ->
                    PatrolSessionRow(
                        task = task,
                        accent = colorOf(task),
                        onClick = { onOpenSession(task.id) },
                    )
                }
            }
        }
    }
}

/** Tanggal `tanggal_patroli` bisa `Y-m-d` atau ISO penuh. */
private fun parseSurveyDate(raw: String?): LocalDate? {
    if (raw.isNullOrBlank()) return null
    return runCatching { LocalDate.parse(raw.substringBefore("T")) }.getOrNull()
}

private fun formatTanggal(date: LocalDate): String =
    "${date.dayOfMonth} ${namaBulan(date.monthValue)} ${date.year}"

// ── Warna per kecamatan ────────────────────────────────────────────────────

private const val LAINNYA = "Lainnya"

private data class KecColor(val bg: Color, val border: Color, val fg: Color)

private val KECAMATAN_PALETTE = listOf(
    KecColor(Color(0xFFEFF6FF), Color(0xFFBFDBFE), Color(0xFF1D4ED8)), // biru
    KecColor(Color(0xFFECFDF5), Color(0xFFA7F3D0), Color(0xFF047857)), // hijau
    KecColor(Color(0xFFFFFBEB), Color(0xFFFDE68A), Color(0xFFB45309)), // kuning
    KecColor(Color(0xFFF5F3FF), Color(0xFFDDD6FE), Color(0xFF6D28D9)), // ungu
    KecColor(Color(0xFFFFF1F2), Color(0xFFFECDD3), Color(0xFFBE123C)), // merah
    KecColor(Color(0xFFECFEFF), Color(0xFFA5F3FC), Color(0xFF0E7490)), // sian
    KecColor(Color(0xFFF7FEE7), Color(0xFFD9F99D), Color(0xFF4D7C0F)), // limau
    KecColor(Color(0xFFFFF7ED), Color(0xFFFED7AA), Color(0xFFC2410C)), // jingga
)

@Composable
private fun CalendarDayCell(
    day: Int,
    isToday: Boolean,
    isSelected: Boolean,
    colors: List<KecColor>,
    onClick: (() -> Unit)?,
) {
    val accent = colors.firstOrNull()
    val shape = RoundedCornerShape(8.dp)
    val bg = when {
        isSelected -> accent?.bg ?: Color(0xFFEFF6FF)
        accent != null -> accent.bg.copy(alpha = 0.55f)
        else -> Color.Transparent
    }
    val borderColor = when {
        isSelected -> BrandBlue
        accent != null -> accent.border
        else -> Color.Transparent
    }
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(bg)
            .border(if (isSelected) 2.dp else 1.dp, borderColor, shape)
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)
            .padding(4.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            modifier = if (isToday) {
                Modifier.size(20.dp).clip(CircleShape).background(BrandBlue)
            } else {
                Modifier
            },
            contentAlignment = Alignment.Center,
        ) {
            Text(
                "$day",
                color = when {
                    isToday -> Color.White
                    accent != null -> accent.fg
                    else -> TextMuted
                },
                fontSize = 11.sp,
                fontWeight = if (isToday) FontWeight.Bold else FontWeight.Medium,
            )
        }
        Spacer(Modifier.weight(1f))
        if (colors.isNotEmpty()) {
            Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                colors.take(3).forEach { c ->
                    Box(
                        modifier = Modifier
                            .size(5.dp)
                            .clip(CircleShape)
                            .background(c.fg),
                    )
                }
            }
        }
    }
}

@Composable
private fun KecamatanLegend(colors: Map<String, KecColor>) {
    val shown = colors.entries.take(6)
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        shown.chunked(3).forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                row.forEach { (kec, color) ->
                    Row(
                        modifier = Modifier.weight(1f),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Box(
                            modifier = Modifier
                                .size(10.dp)
                                .clip(CircleShape)
                                .background(color.fg),
                        )
                        Spacer(Modifier.width(6.dp))
                        Text(
                            kec,
                            color = TextMuted, fontSize = 11.sp,
                            maxLines = 1, overflow = TextOverflow.Ellipsis,
                        )
                    }
                }
                repeat(3 - row.size) { Spacer(Modifier.weight(1f)) }
            }
        }
        if (colors.size > shown.size) {
            Text(
                "+${colors.size - shown.size} kecamatan lain",
                color = TextMuted, fontSize = 11.sp,
            )
        }
    }
}

/**
 * Baris sesi patroli — port task card tugas-saya.tsx PatroliSection.
 * Ketuk → detail sesi (tempat tombol tambah laporan).
 */
@Composable
private fun PatrolSessionRow(
    task: SurveyTask,
    accent: KecColor? = null,
    onClick: () -> Unit,
) {
    val aktif = task.status == "aktif"
    val tint = accent?.fg ?: BrandBlue
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(Color.White)
            .border(1.dp, Color(0xFFE2E8F0), RoundedCornerShape(12.dp))
            .clickable(onClick = onClick)
            .padding(14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .size(36.dp)
                .clip(RoundedCornerShape(8.dp))
                .background(accent?.bg ?: Color(0xFFEEF3FA)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(AppIcon.CalendarMonth, contentDescription = null, tint = tint, modifier = Modifier.size(18.dp))
        }
        Spacer(Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                task.roadName ?: task.kecamatan?.let { "Patroli Kec. $it" } ?: "Sesi Patroli",
                color = TextDark, fontSize = 14.sp, fontWeight = FontWeight.Bold,
                maxLines = 1, overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = listOfNotNull(
                    task.kecamatan?.let { "Kec. $it" },
                    parseSurveyDate(task.tanggalPatroli)?.let { formatTanggal(it) },
                    listOfNotNull(task.jamMulai, task.jamSelesai)
                        .joinToString("–").takeIf { it.isNotBlank() },
                    task.alasanTugas?.replace("_", " "),
                ).joinToString(" • "),
                color = TextMuted, fontSize = 11.sp,
                maxLines = 1, overflow = TextOverflow.Ellipsis,
            )
            if (task.reportsCount > 0) {
                Text("${task.reportsCount} laporan", color = TextMuted, fontSize = 11.sp)
            }
        }
        Box(
            modifier = Modifier
                .clip(RoundedCornerShape(6.dp))
                .background(if (aktif) Color(0xFFF0FDF4) else Color(0xFFF8FAFC))
                .padding(horizontal = 8.dp, vertical = 3.dp),
        ) {
            Text(
                if (aktif) "Aktif" else "Selesai",
                color = if (aktif) SuccessGreen else Color(0xFF94A3B8),
                fontSize = 10.sp, fontWeight = FontWeight.SemiBold,
            )
        }
        Spacer(Modifier.width(6.dp))
        Icon(AppIcon.ChevronRight, contentDescription = null, tint = TextMuted, modifier = Modifier.size(18.dp))
    }
}
