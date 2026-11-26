package com.jalankita.app.core.util

import java.io.File
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Penjaga agar perbaikan waktu & kestabilan daftar tidak kambuh.
 *
 * Aturannya:
 * 1. Tidak ada layar yang mem-parse tanggal server sendiri — semuanya lewat [Waktu].
 * 2. Daftar yang bisa bertambah digabung lewat `gabungUnik`, bukan `+`.
 * 3. Key `LazyColumn` yang berbasis data server harus memuat indeks.
 */
class StabilitasDaftarTest {

    private val akar: File = listOf(
        File("src/main/java/com/jalankita/app"),
        File("app/src/main/java/com/jalankita/app"),
    ).first { it.exists() }

    private fun semuaKode(): List<Pair<String, String>> =
        File(akar, "").walkTopDown()
            .filter { it.isFile && it.extension == "kt" }
            .map { it.relativeTo(akar).invariantSeparatorsPath to it.readText() }
            .toList()

    @Test
    fun `tidak ada layar yang memotong akhiran zona tanggal`() {
        val pelanggar = semuaKode()
            .filter { (path, isi) ->
                path != "ui/util/Waktu.kt" &&
                    (isi.contains("substringBefore(\"Z\")") || isi.contains("substringBefore('Z')") ||
                        isi.contains("substringBefore('+')"))
            }
            .map { it.first }

        assertTrue(
            "potong-string akhiran zona membuat waktu meleset 7 jam; pakai Waktu. Pelanggar: $pelanggar",
            pelanggar.isEmpty(),
        )
    }

    @Test
    fun `tidak ada SimpleDateFormat untuk timestamp ISO`() {
        val pelanggar = semuaKode()
            .filter { (path, isi) ->
                path != "ui/util/Waktu.kt" &&
                    Regex("""SimpleDateFormat\(\s*"[^"]*'T'""").containsMatchIn(isi)
            }
            .map { it.first }

        assertTrue(
            "timestamp ISO hanya boleh diurai Waktu.kt. Pelanggar: $pelanggar",
            pelanggar.isEmpty(),
        )
    }

    @Test
    fun `format tanggal tidak lagi mengurai sendiri`() {
        val format = File(akar, "feature/home/components/Format.kt").readText()

        assertTrue("formatDateShort harus memakai Waktu", format.contains("fun formatDateShort(iso: String): String = Waktu.tanggalJam(iso) ?: iso"))
        assertTrue(
            "formatDateRelative harus memakai Waktu",
            format.contains("fun formatDateRelative(dateStr: String): String = Waktu.tanggalRelatif(dateStr) ?: dateStr"),
        )
        assertTrue("tidak boleh ada OffsetDateTime.parse lokal", !format.contains("OffsetDateTime.parse"))
    }

    @Test
    fun `notifikasi digabung tanpa id ganda`() {
        val vm = File(akar, "feature/notif/NotifViewModel.kt").readText()

        assertTrue(vm.contains("items.gabungUnik(r.data.items) { it.id }"))
        assertTrue(
            "read_at tidak boleh diisi sentinel \"now\"",
            !vm.contains("readAt = \"now\"") && vm.contains("Instant.now().toString()"),
        )
    }

    @Test
    fun `key daftar yang berbasis data server memuat indeks`() {
        val warga = File(akar, "feature/warga/WargaDetailScreen.kt").readText()
        assertTrue(
            "timeline warga: dua event pada detik sama tidak boleh bertabrakan",
            warga.contains("key = { \"tl-\$it-\${timeline[it].createdAt}-\${timeline[it].newStatus}\" }"),
        )

        val review = File(akar, "feature/supervisor/InspectionReviewScreen.kt").readText()
        assertTrue(
            "foto bukti review: key memuat indeks",
            review.contains("key = { idx, photo -> \"bukti-\${photo.id ?: \"foto\"}-\$idx\" }"),
        )

        val detail = File(akar, "feature/supervisor/SupervisorDetailScreen.kt").readText()
        assertTrue(
            "foto bukti hasil inspeksi: key memuat indeks",
            detail.contains("key = { idx, f -> \"bukti-\${f.id ?: \"foto\"}-\$idx\" }"),
        )
    }

    @Test
    fun `hari ini dihitung dari wib`() {
        val pelanggar = semuaKode()
            .filter { (path, isi) ->
                path.startsWith("feature/") && isi.contains("LocalDate.now()")
            }
            .map { it.first }

        assertTrue(
            "\"hari ini\" harus Waktu.hariIniWib() agar perangkat UTC tidak mencari jadwal kemarin. Pelanggar: $pelanggar",
            pelanggar.isEmpty(),
        )
    }

    @Test
    fun `layar tetap memakai Waktu untuk tanggal patroli`() {
        val sesi = File(akar, "feature/home/PatrolSessionScreen.kt").readText()
        assertTrue(
            "tanggal_patroli adalah kolom tanggal: jangan tampilkan jam palsu 00:00",
            sesi.contains("Waktu.tanggalSaja(it)"),
        )

        val kalender = File(akar, "feature/home/components/PatrolTeamCalendar.kt").readText()
        assertTrue(
            "kalender tim harus menghitung tanggal WIB, bukan 10 karakter pertama UTC",
            kalender.contains("Waktu.tanggalWib(raw)") && !kalender.contains("substringBefore(\"T\")"),
        )
    }
}
