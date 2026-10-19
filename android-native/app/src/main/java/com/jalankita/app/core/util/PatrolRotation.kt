package com.jalankita.app.core.util

import com.jalankita.app.core.network.PatrolScheduleDto
import com.jalankita.app.core.network.SurveyTask
import java.time.DayOfWeek
import java.time.LocalDate

/**
 * Rotasi kecamatan patroli — port PERSIS Frontend-stable/src/routes/upload.tsx
 * (`isPatrolDay`, `getPatrolDaysCount`, `sortedTasks`). Menentukan kecamatan
 * ekspektasi hari ini dari pola jadwal, lalu menaikkan tugas yang cocok ke atas.
 */
object PatrolRotation {

    private val dayNames = mapOf(
        DayOfWeek.MONDAY to "Senin",
        DayOfWeek.TUESDAY to "Selasa",
        DayOfWeek.WEDNESDAY to "Rabu",
        DayOfWeek.THURSDAY to "Kamis",
        DayOfWeek.FRIDAY to "Jumat",
        DayOfWeek.SATURDAY to "Sabtu",
        DayOfWeek.SUNDAY to "Minggu",
    )

    /** Replikasi `isPatrolDay(date, schedule)` web (hari + frekuensi). */
    fun isPatrolDay(date: LocalDate, hari: List<String>?, frekuensi: String?, startDate: String?): Boolean {
        val dayName = dayNames[date.dayOfWeek] ?: return false
        if (hari == null || !hari.contains(dayName)) return false
        return when (frekuensi) {
            "dua_mingguan" -> {
                val start = runCatching { LocalDate.parse(startDate) }.getOrNull() ?: return false
                // Awal pekan = Minggu (cermin getDay() JS).
                val startWeek = start.minusDays(((start.dayOfWeek.value % 7)).toLong())
                val dateWeek = date.minusDays(((date.dayOfWeek.value % 7)).toLong())
                val weeks = java.time.temporal.ChronoUnit.WEEKS.between(startWeek, dateWeek)
                weeks % 2 == 0L
            }
            "bulanan" -> {
                // Hari ini = kemunculan pertama weekday-nya di bulan berjalan.
                var first = date.withDayOfMonth(1)
                while (first.dayOfWeek != date.dayOfWeek) first = first.plusDays(1)
                first == date
            }
            else -> true
        }
    }

    /**
     * Replikasi `getPatrolDaysCount(schedule, targetDate)` web — hitung hari
     * patroli dari start_date s.d. target. Dibatasi 730 iterasi (pengaman).
     */
    fun getPatrolDaysCount(
        hari: List<String>?,
        frekuensi: String?,
        startDate: String?,
        target: LocalDate,
    ): Int {
        val start = runCatching { LocalDate.parse(startDate) }.getOrNull() ?: return 0
        var count = 0
        var cursor = start
        var guard = 0
        while (!cursor.isAfter(target) && guard++ < 730) {
            if (isPatrolDay(cursor, hari, frekuensi, startDate)) count++
            cursor = cursor.plusDays(1)
        }
        return count
    }

    /**
     * Replikasi `sortedTasks` web — tugas yang kecamatannya masuk ekspektasi
     * hari ini naik ke atas (stabil). Tanpa jadwal cocok → urutan semula.
     */
    fun sortExpectedFirst(
        tasks: List<SurveyTask>,
        schedules: List<PatrolScheduleDto>,
        today: LocalDate = LocalDate.now(),
    ): List<SurveyTask> {
        val expected = mutableSetOf<String>()
        for (s in schedules) {
            val list = s.kecamatanList.orEmpty()
            if (list.isEmpty()) continue
            val days = getPatrolDaysCount(s.hari, s.frekuensi, s.startDate, today)
            if (days < 1) continue
            expected.add(list[(days - 1) % list.size])
        }
        if (expected.isEmpty()) return tasks
        return tasks.sortedBy { if (expected.contains(it.kecamatan ?: "")) 0 else 1 }
    }
}
