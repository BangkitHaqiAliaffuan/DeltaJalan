package com.jalankita.app.ui.util

import java.time.LocalDate
import java.time.YearMonth

/**
 * Utilitas kalender bersama (Senin-berbasis) — dipakai kalender patroli
 * supervisor (`PatrolCalendar`) dan kalender jadwal tim di tab Tugas.
 * Sebelumnya fungsi-fungsi ini privat di `PatrolDetailScreen.kt`.
 */

/** Grid minggu (Senin..Minggu) untuk bulan tsb; null = sel kosong. */
fun buildCalendarWeeks(ym: YearMonth): List<List<Int?>> {
    val first = ym.atDay(1)
    // offset Senin-berbasis: 1(Sen)=0 … 7(Min)=6
    val offset = (first.dayOfWeek.value + 6) % 7
    val total = ym.lengthOfMonth()
    val cells = mutableListOf<Int?>()
    repeat(offset) { cells.add(null) }
    (1..total).forEach { cells.add(it) }
    while (cells.size % 7 != 0) cells.add(null)
    return cells.chunked(7)
}

fun namaBulan(m: Int): String =
    listOf(
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember",
    )[m - 1]

/** Awal minggu (Senin) dari tanggal tsb — dipakai hitungan frekuensi dua_mingguan. */
fun startOfWeek(d: LocalDate): LocalDate = d.minusDays((d.dayOfWeek.value % 7).toLong())

fun quandoDayName(d: LocalDate): String =
    when (d.dayOfWeek.value) {
        1 -> "Senin"; 2 -> "Selasa"; 3 -> "Rabu"; 4 -> "Kamis"; 5 -> "Jumat"; 6 -> "Sabtu"; else -> "Minggu"
    }
