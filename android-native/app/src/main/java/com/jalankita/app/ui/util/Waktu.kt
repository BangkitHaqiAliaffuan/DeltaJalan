package com.jalankita.app.ui.util

import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.temporal.ChronoUnit

/**
 * Satu-satunya tempat aplikasi mem-parse tanggal dari server.
 *
 * ── Kenapa modul ini ada ────────────────────────────────────────────────
 * Laravel menyerialkan tanggal model lewat `Carbon::toJSON()`, yaitu **UTC**
 * (`2026-11-26T01:23:45.000000Z`), sementara `Report.php` mengirim satu field
 * dengan `toIso8601String()` (**+07:00**). Sebelumnya tiap layar mem-parse
 * sendiri-sendiri: ada yang menggeser zona, ada yang memakai jam UTC apa
 * adanya (tampil 7 jam lebih awal), dan ada yang memotong akhiran `Z` lalu
 * menganggapnya WIB. Untuk kolom tanggal (`tanggal_patroli` cast `date`) akibat
 * terburuknya jadwal patroli tampil **sehari lebih awal** dengan jam palsu 17:00.
 *
 * ── Aturan ─────────────────────────────────────────────────────────────
 * 1. Semua tampilan memakai **WIB**, bukan zona perangkat: pengguna, data, dan
 *    server semuanya di Sidoarjo; perangkat yang disetel UTC tetap benar.
 * 2. Parser harus toleran: `Z`, offset `+07:00`/negatif, tanpa offset, tanggal
 *    saja, dan mikrodetik. Semua bentuk itu benar-benar dikirim backend.
 * 3. Tanggal-saja diperlakukan sebagai tanggal WIB, bukan hasil geser UTC.
 * 4. Tidak pernah melempar: input rusak/kosong menghasilkan `null`.
 */
object Waktu {

    /** Zona acuan tampilan seluruh aplikasi. */
    val zona: ZoneId = ZoneId.of("Asia/Jakarta")

    private val BULAN = arrayOf(
        "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
        "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
    )

    /** Hasil urai + penanda apakah sumbernya benar-benar memuat jam. */
    private data class Urai(val instant: Instant, val adaJam: Boolean)

    private fun urai(nilai: String?): Urai? {
        val iso = nilai?.trim().orEmpty()
        if (iso.isEmpty()) return null

        // 1) Bentuk ber-zona: "...Z", "...+07:00", "...-05:00" (termasuk mikrodetik).
        runCatching { OffsetDateTime.parse(iso) }.getOrNull()?.let {
            return Urai(it.toInstant(), adaJam = true)
        }
        runCatching { Instant.parse(iso) }.getOrNull()?.let {
            return Urai(it, adaJam = true)
        }
        // 2) Tanpa zona: backend menulisnya dengan app.timezone Asia/Jakarta.
        runCatching { LocalDateTime.parse(iso) }.getOrNull()?.let {
            return Urai(it.atZone(zona).toInstant(), adaJam = true)
        }
        // 3) Tanggal saja: "2026-11-26" (atau sisa apa pun yang 10 karakter pertamanya tanggal).
        runCatching { LocalDate.parse(iso.take(10)) }.getOrNull()?.let {
            return Urai(it.atStartOfDay(zona).toInstant(), adaJam = false)
        }
        return null
    }

    private fun jam(hour: Int, minute: Int): String =
        "${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}"

    private fun tanggalDari(tgl: LocalDate): String =
        "${tgl.dayOfMonth} ${BULAN[(tgl.monthValue - 1).coerceIn(0, 11)]} ${tgl.year}"

    /** Instant dari ISO server; `null` bila tidak bisa diurai. */
    fun instantOrNull(iso: String?): Instant? = urai(iso)?.instant

    /**
     * "Nov" dari bulan server berformat `"2026-11"` (lihat
     * `ReportController::stats` → `format('Y-m')`).
     *
     * Sengaja mengembalikan `null` untuk format yang tidak dikenal, bukan menebak:
     * label grafik yang salah lebih buruk daripada tanpa label.
     */
    fun namaBulanSingkat(bulanIso: String?): String? {
        val bagian = bulanIso?.trim()?.split("-") ?: return null
        if (bagian.size < 2) return null
        val nomor = bagian[1].toIntOrNull() ?: return null
        if (nomor !in 1..12) return null
        return BULAN[nomor - 1]
    }

    /** Tanggal WIB (mis. untuk kalender & jadwal patroli). */
    fun tanggalWib(iso: String?): LocalDate? = urai(iso)?.instant?.atZone(zona)?.toLocalDate()

    /**
     * Tanggal "hari ini" menurut WIB, bukan zona perangkat.
     * Dipakai untuk menyaring jadwal hari ini & mengisi tanggal default; perangkat
     * yang disetel UTC tidak boleh mencari jadwal kemarin.
     */
    fun hariIniWib(): LocalDate = Instant.now().atZone(zona).toLocalDate()

    /** "26 Nov 2026, 08:23" — tanpa jam bila sumbernya tanggal saja. */
    fun tanggalJam(iso: String?): String? {
        val u = urai(iso) ?: return null
        val z = u.instant.atZone(zona)
        val dasar = tanggalDari(z.toLocalDate())
        return if (u.adaJam) "$dasar, ${jam(z.hour, z.minute)}" else dasar
    }

    /** "26 Nov 2026" — untuk kolom tanggal & judul. */
    fun tanggalSaja(iso: String?): String? {
        val tgl = tanggalWib(iso) ?: return null
        return tanggalDari(tgl)
    }

    /** "08:23" — `null` bila sumbernya tidak memuat jam (jangan mengarang 00:00). */
    fun jamSaja(iso: String?): String? {
        val u = urai(iso) ?: return null
        if (!u.adaJam) return null
        val z = u.instant.atZone(zona)
        return jam(z.hour, z.minute)
    }

    /** "baru saja" / "5m" / "3j" / "2h". */
    fun relatif(iso: String?, now: Long = System.currentTimeMillis()): String? {
        val instant = urai(iso)?.instant ?: return null
        val menit = (now - instant.toEpochMilli()) / 60_000L
        return when {
            menit < 1 -> "baru saja"
            menit < 60 -> "${menit}m"
            menit < 24 * 60 -> "${menit / 60}j"
            else -> "${menit / (24 * 60)}h"
        }
    }

    /** "Hari ini, 08:23" / "Kemarin" / "26 Nov 2026". */
    fun tanggalRelatif(iso: String?): String? {
        val u = urai(iso) ?: return null
        val z = u.instant.atZone(zona)
        val hariIni = Instant.now().atZone(zona).toLocalDate()
        val selisih = ChronoUnit.DAYS.between(z.toLocalDate(), hariIni)
        return when {
            selisih == 0L && u.adaJam -> "Hari ini, ${jam(z.hour, z.minute)}"
            selisih == 1L -> "Kemarin"
            else -> tanggalDari(z.toLocalDate())
        }
    }
}
