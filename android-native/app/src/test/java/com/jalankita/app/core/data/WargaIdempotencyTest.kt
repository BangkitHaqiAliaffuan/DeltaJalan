package com.jalankita.app.core.data

import java.io.File
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Kontrak idempotensi laporan warga di sisi Android.
 *
 * ── Regresi yang dijaga ──────────────────────────────────────────────────
 * Antrean offline mengirim ulang laporan yang gagal karena sinyal hilang.
 * Bila permintaan pertama ternyata SUDAH tersimpan di server (hanya responsnya
 * yang hilang), percobaan kedua tanpa kunci idempotensi membuat laporan ganda
 * atau ditolak `DUPLICATE_IMAGE` — pengguna lalu diberi tahu "gagal" padahal
 * laporannya ada.
 *
 * Kuncinya harus **satu per draft**: kiriman langsung dan salinan antrean
 * memakai kunci yang sama, dan kunci baru hanya dibuat setelah laporan
 * benar-benar tersimpan. Karena itu perilakunya bergantung pada urutan di
 * ViewModel, tes ini membaca kode sumber.
 */
class WargaIdempotencyTest {

    private val akar: File = listOf(
        File("src/main/java/com/jalankita/app"),
        File("app/src/main/java/com/jalankita/app"),
    ).first { it.exists() }

    private fun baca(relatif: String): String = File(akar, relatif).readText()

    @Test
    fun `klien mengirim kunci idempotensi ke server`() {
        val api = baca("core/network/ApiService.kt")
        assertTrue(
            "endpoint warga/reports harus menerima bagian idempotency_key",
            api.contains("""@Part("idempotency_key") idempotencyKey: RequestBody? = null"""),
        )

        val repo = baca("core/data/WargaRepository.kt")
        assertTrue(
            "submit() harus meneruskan kunci",
            Regex("""idempotencyKey = idempotencyKey\?\.takeIf \{ it\.isNotBlank\(\) \}\?\.toRequestBody""")
                .containsMatchIn(repo),
        )
    }

    @Test
    fun `satu kunci dipakai bersama oleh kiriman langsung dan antrean`() {
        val vm = baca("feature/warga/WargaLaporViewModel.kt")

        assertTrue(
            "kunci disimpan per draft",
            vm.contains("private var draftIdempotencyKey: String"),
        )
        assertTrue(
            "kiriman langsung memakai kunci draft",
            vm.contains("idempotencyKey = draftIdempotencyKey,"),
        )
        assertTrue(
            "item antrean memakai kunci yang SAMA, bukan kunci acak baru",
            vm.contains("idempotencyKey = draftIdempotencyKey,") &&
                !vm.contains("idempotencyKey = UUID.randomUUID().toString(),"),
        )
    }

    @Test
    fun `kunci baru hanya dibuat setelah laporan tersimpan`() {
        val vm = baca("feature/warga/WargaLaporViewModel.kt")

        assertTrue(
            "kunci diperbarui pada jalur sukses",
            Regex("""savedReport = res\.data[\s\S]{0,400}?draftIdempotencyKey = UUID\.randomUUID\(\)\.toString\(\)""")
                .containsMatchIn(vm),
        )
        assertTrue(
            "reset() memulai draft baru dengan kunci baru",
            Regex("""queuedOffline = false[\s\S]{0,120}?draftIdempotencyKey = UUID\.randomUUID\(\)\.toString\(\)""")
                .containsMatchIn(vm),
        )
    }

    @Test
    fun `worker mengirim kunci dari antrean`() {
        val worker = baca("core/worker/ReportUploadWorker.kt")
        assertTrue(
            "worker harus memakai kunci item antrean",
            worker.contains("idempotencyKey = item.idempotencyKey,"),
        )
        assertFalse(
            "worker tidak boleh membuat kunci baru — itu mematikan idempotensi",
            worker.contains("UUID.randomUUID()"),
        )
    }
}
