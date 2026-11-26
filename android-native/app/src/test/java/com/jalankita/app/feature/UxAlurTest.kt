package com.jalankita.app.feature

import java.io.File
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Penjaga alur UX hasil perbaikan layar notifikasi dan form lapor.
 *
 * Tiga perilaku yang mudah hilang saat refactor dan tidak terlihat oleh
 * kompilator:
 *
 * 1. Notifikasi bertaut laporan membuka detail laporan (sebelumnya hanya
 *    menandai dibaca, chevronnya menyesatkan).
 * 2. "Hapus semua" selalu lewat dialog konfirmasi yang menyebut cakupannya.
 * 3. Tombol kembali di form lapor menanyakan konfirmasi bila ada draf
 *    (foto / catatan) supaya isian tidak hilang tanpa peringatan.
 */
class UxAlurTest {

    private fun readSource(relatif: String): String {
        val kandidat = listOf(
            File("src/main/java/com/jalankita/app/$relatif"),
            File("app/src/main/java/com/jalankita/app/$relatif"),
        )
        val file = kandidat.firstOrNull { it.exists() }
        assertTrue("Sumber tidak ditemukan untuk $relatif", file != null)
        return file!!.readText()
    }

    /** Potongan sumber setelah jangkar — tempat isi signature berada. */
    private fun sesudah(sumber: String, jangkar: String, panjang: Int = 700): String {
        val idx = sumber.indexOf(jangkar)
        assertTrue("Jangkar '$jangkar' tidak ditemukan", idx >= 0)
        return sumber.substring(idx, minOf(sumber.length, idx + panjang))
    }

    @Test
    fun `notifikasi bertaut laporan membuka detail di semua scaffold`() {
        val layar = readSource("feature/notif/NotifScreen.kt")
        assertTrue(
            "Layar notifikasi harus menerima callback buka laporan.",
            layar.contains("onOpenReport: ((String) -> Unit)? = null"),
        )
        assertTrue(
            "Callback harus dipanggil dengan id laporan dari payload notifikasi.",
            Regex("""repId[\s\S]{0,200}onOpenReport\(repId\)""").containsMatchIn(layar),
        )
        assertTrue(
            "Baris tanpa laporan (repId null) tidak boleh memanggil callback.",
            layar.contains("if (repId != null && onOpenReport != null)"),
        )
        listOf(
            "MainActivity.kt",
            "feature/warga/WargaScaffold.kt",
            "feature/supervisor/SupervisorScaffold.kt",
        ).forEach { berkas ->
            assertTrue(
                "$berkas harus meneruskan aksi buka laporan ke layar notifikasi.",
                readSource(berkas).contains("onOpenReport"),
            )
        }
    }

    @Test
    fun `hapus semua notifikasi lewat dialog yang menyebut cakupan`() {
        val layar = readSource("feature/notif/NotifScreen.kt")
        assertTrue(
            "Judul dialog harus menyebut 'semua' agar cakupan jelas.",
            layar.contains("Hapus Semua Notifikasi?"),
        )
        assertTrue(
            "Penghapusan hanya boleh terjadi setelah konfirmasi.",
            Regex("""onPrimary\s*=\s*\{[^}]*vm\.deleteAll\(\)""").containsMatchIn(layar),
        )
        assertTrue(
            "Ikon hapus tetap harus punya label suara.",
            layar.contains("contentDescription = \"Hapus semua\""),
        )
    }

    @Test
    fun `form lapor petugas dan warga minta konfirmasi sebelum membuang draf`() {
        val petugas = readSource("feature/lapor/LaporScreen.kt")
        assertTrue("Petugas: tombol kembali harus lewat requestBack().", petugas.contains("requestBack()"))
        assertTrue("Petugas: harus memakai BackHandler.", petugas.contains("BackHandler("))
        assertTrue("Petugas: konfirmasi draf harus memakai JkDialog.", petugas.contains("JkDialog("))
        assertTrue(
            "Petugas: draf dianggap ada bila foto sudah dipilih.",
            Regex("""if \(vm\.photos\.isNotEmpty\(\)\)[\s\S]{0,120}showDiscardConfirm = true""")
                .containsMatchIn(petugas),
        )

        val warga = readSource("feature/warga/WargaLaporScreen.kt")
        assertTrue("Warga: tombol kembali harus lewat requestBack().", warga.contains("requestBack()"))
        assertTrue("Warga: harus memakai BackHandler.", warga.contains("BackHandler("))
        assertTrue("Warga: konfirmasi draf harus memakai JkDialog.", warga.contains("JkDialog("))
        assertTrue(
            "Warga: catatan yang sudah diketik juga dihitung sebagai draf.",
            warga.contains("laporVm.catatan.isNotBlank()"),
        )
    }

    @Test
    fun `parameter modifier tetap opsional pertama di layar yang diubah`() {
        listOf(
            "feature/notif/NotifScreen.kt" to "fun NotifScreen(",
            "feature/warga/WargaLaporScreen.kt" to "fun WargaLaporScreen(",
        ).forEach { (berkas, jangkar) ->
            val sig = sesudah(readSource(berkas), jangkar)
            val posModifier = sig.indexOf("modifier: Modifier = Modifier")
            val posLain = sig.indexOf("onOpenReport").takeIf { it >= 0 }
                ?: sig.indexOf("onOpenQueue")
            assertTrue("$berkas: modifier wajib ada di signature.", posModifier >= 0)
            assertTrue(
                "$berkas: modifier harus sebelum parameter opsional lain (lint ModifierParameter).",
                posLain < 0 || posModifier < posLain,
            )
        }
    }

    @Test
    fun `tombol utama nonaktif tampil abu-abu bukan biru pucat`() {
        val sumber = readSource("ui/components/TextField.kt")
        assertTrue(
            "Status nonaktif harus punya latar abu-abu eksplisit.",
            sumber.contains("disabled -> Modifier.background(Color(0xFFE2E8F0)"),
        )
        assertTrue(
            "Teks saat nonaktif harus abu-abu, bukan putih.",
            sumber.contains("if (disabled) Color(0xFF94A3B8)"),
        )
    }
}
