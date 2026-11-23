package com.jalankita.app.core.data

import java.io.File
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Penjaga regresi untuk dua cacat alur offline yang pernah ada:
 *
 * 1. `InspectionResultViewModel` hanya mengantrekan hasil inspeksi di dalam
 *    `catch (e: Exception)`, padahal repository membungkus semua kegagalan
 *    menjadi [DashboardResult.Error] → jalur antrean tidak pernah dijalankan.
 * 2. `WargaLaporViewModel` mendeteksi "offline" dengan mencocokkan teks pesan,
 *    sehingga kegagalan jaringan berbahasa Inggris tidak masuk antrean.
 *
 * Tes ini membaca kode sumber (pola yang sama dengan InspectionSubmitGateTest
 * dan JkDialogStyleTest) karena perilaku sebenarnya bergantung pada struktur
 * pemanggilan, bukan pada satu fungsi murni.
 */
class OfflineQueueWiringTest {

    private val akar: File = listOf(
        File("src/main/java/com/jalankita/app"),
        File("app/src/main/java/com/jalankita/app"),
    ).first { it.exists() }

    private fun baca(relatif: String): String = File(akar, relatif).readText()

    private fun tanpaKomentar(teks: String): String = teks
        .lineSequence()
        .filterNot { it.trimStart().startsWith("//") }
        .joinToString("\n")

    @Test
    fun `hasil inspeksi diantrekan saat gangguan jaringan, bukan hanya saat exception`() {
        val kode = tanpaKomentar(baca("feature/home/InspectionResultViewModel.kt"))

        assertTrue(
            "submit() harus menyimpan ke antrean offline ketika Error.isNetwork",
            Regex("""is DashboardResult\.Error ->[\s\S]{0,200}?result\.isNetwork[\s\S]{0,200}?simpanHasilOffline""")
                .containsMatchIn(kode),
        )
        assertTrue(
            "temuan lapangan juga harus diantrekan",
            Regex("""is DashboardResult\.Error ->[\s\S]{0,200}?result\.isNetwork[\s\S]{0,200}?simpanTemuanOffline""")
                .containsMatchIn(kode),
        )
        assertTrue(
            "helper penyimpanan wajib memanggil outbox.enqueue",
            kode.contains("outbox.enqueue("),
        )
        assertTrue(
            "penolakan server tidak boleh diantrekan",
            kode.contains("} else {\n                            error = result.message"),
        )
    }

    @Test
    fun `laporan warga tidak lagi menebak offline dari teks pesan`() {
        val kode = tanpaKomentar(baca("feature/warga/WargaLaporViewModel.kt"))

        assertFalse(
            "heuristik teks pesan harus sudah dihapus",
            kode.contains("""message.contains("koneksi"""") ||
                kode.contains("""message.contains("network"""") ||
                kode.contains("""message.contains("host""""),
        )
        assertTrue("harus memakai res.isNetwork", kode.contains("res.isNetwork"))
        assertTrue(
            "catch generik memakai classifyFailure",
            kode.contains("classifyFailure(e) == ErrorKind.NETWORK"),
        )
    }

    @Test
    fun `worker tidak menebak kegagalan permanen dari teks pesan`() {
        val inspeksi = tanpaKomentar(baca("core/worker/InspectionUploadWorker.kt"))
        assertFalse(
            "contains(\"422\") tidak boleh dipakai lagi",
            inspeksi.contains("""message.contains("422")"""),
        )
        assertTrue("status kegagalan diputuskan QueuePolicy", inspeksi.contains("QueuePolicy."))
        assertTrue("status hasil menulis lewat repository", inspeksi.contains("outbox.markFailure("))
        assertFalse(
            "single() pada daftar foto melempar exception saat >1 foto",
            inspeksi.contains("files.single()"),
        )

        val warga = tanpaKomentar(baca("core/worker/ReportUploadWorker.kt"))
        assertTrue(
            "worker laporan warga memakai aturan yang sama",
            warga.contains("QueuePolicy.") && warga.contains("outbox.markFailure("),
        )
        assertFalse(
            "worker tidak boleh menyentuh berkas antrean langsung",
            warga.contains("pending_warga_reports.json") || inspeksi.contains("pending_inspection_results.json"),
        )
    }

    @Test
    fun `hanya repository yang menulis berkas antrean`() {
        val sumber = File(akar, ".").walkTopDown()
            .filter { it.isFile && it.extension == "kt" }
            .filterNot { it.path.contains("/core/data/outbox/") }
            .filterNot { it.path.contains("/test/") }

        val pelanggar = sumber.filter { berkas ->
            val teks = tanpaKomentar(berkas.readText())
            teks.contains("outbox.json") || teks.contains("File(appContext.filesDir")
        }.map { it.name }.toList()

        assertTrue("akses langsung ke berkas antrean: $pelanggar", pelanggar.isEmpty())
    }
}
