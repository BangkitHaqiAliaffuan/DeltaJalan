package com.jalankita.app.feature.queue

import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Kontrak navigasi layar antrean.
 *
 * ── Regresi yang dijaga ──────────────────────────────────────────────────
 * Antrean offline sebelumnya *write-only*: pengguna tidak punya satu pun jalan
 * menuju kiriman yang belum terkirim. Layar ini harus bisa dibuka dari tiga
 * pintu — banner Beranda, notifikasi sinkronisasi, dan (kelak) tombol di layar
 * hasil — untuk **dua** kerangka navigasi berbeda (warga & petugas). Petugas
 * memakai `MainScreen`, warga memakai `WargaScreen` sendiri; lupa salah satu
 * berarti separuh pengguna tidak bisa melihat antreannya.
 */
class QueueNavigationTest {

    private val akar: File = listOf(
        File("src/main/java/com/jalankita/app"),
        File("app/src/main/java/com/jalankita/app"),
    ).first { it.exists() }

    private fun baca(relatif: String): String = File(akar, relatif).readText()

    @Test
    fun `layar antrean terpasang di kedua kerangka navigasi`() {
        val petugas = baca("MainActivity.kt")
        val warga = baca("feature/warga/WargaScaffold.kt")

        assertTrue("petugas butuh MainScreen.QUEUE", petugas.contains("QUEUE"))
        assertTrue("petugas merender QueueScreen", petugas.contains("MainScreen.QUEUE -> QueueScreen("))
        assertTrue("warga butuh WargaScreen.QUEUE", warga.contains("WargaScreen.QUEUE"))
        assertTrue("warga merender QueueScreen", warga.contains("WargaScreen.QUEUE -> QueueScreen("))
    }

    @Test
    fun `tombol back perangkat menutup layar antrean`() {
        val petugas = baca("MainActivity.kt")
        val warga = baca("feature/warga/WargaScaffold.kt")

        assertTrue(
            "back dari antrean petugas harus ke Beranda, bukan keluar aplikasi",
            petugas.contains("BackHandler(enabled = mainScreen == MainScreen.QUEUE)"),
        )
        assertTrue(
            "back dari antrean warga harus ke Beranda",
            warga.contains("BackHandler(enabled = wargaScreen == WargaScreen.QUEUE)"),
        )
    }

    @Test
    fun `banner beranda hanya tampil saat ada kiriman tertunda`() {
        val petugas = baca("MainActivity.kt")
        val warga = baca("feature/warga/WargaScaffold.kt")
        val banner = baca("feature/queue/QueueScreen.kt")

        assertTrue(petugas.contains("QueueBanner("))
        assertTrue(warga.contains("QueueBanner("))
        assertTrue(
            "banner harus hilang bila antrean kosong",
            banner.contains("if (jumlah <= 0 && gagal <= 0) return"),
        )
    }

    @Test
    fun `notifikasi sinkronisasi membuka layar antrean`() {
        val notifier = baca("core/notify/QueueNotifier.kt")
        val petugas = baca("MainActivity.kt")
        val warga = baca("feature/warga/WargaScaffold.kt")

        assertTrue(
            "notifier harus menandai intent untuk membuka antrean",
            notifier.contains("putExtra(EXTRA_OPEN_QUEUE, true)"),
        )
        assertTrue(
            "MainActivity membaca extra yang sama, bukan teks lepas",
            petugas.contains("QueueNotifier.EXTRA_OPEN_QUEUE"),
        )
        assertFalse(
            "jangan pakai string lepas: mudah tidak sinkron dengan notifier",
            petugas.contains("\"open_queue\""),
        )
        assertTrue("petugas membuka antrean dari notifikasi", petugas.contains("openQueue = pendingQueue"))
        assertTrue("warga menerima tanda buka antrean", warga.contains("openQueue: Boolean = false"))
        assertTrue(
            "warga benar-benar berpindah ke layar antrean",
            warga.contains("LaunchedEffect(openQueue)") && warga.contains("onNavigate(WargaScreen.QUEUE)"),
        )
    }

    @Test
    fun `layar hasil menawarkan jalan ke antrean`() {
        val inspeksi = baca("feature/home/InspectionResultScreen.kt")
        val vmInspeksi = baca("feature/home/InspectionResultViewModel.kt")
        val wargaLapor = baca("feature/warga/WargaLaporScreen.kt")

        assertTrue(
            "status tersimpan offline harus jadi state VM, bukan dicocokkan dari teks pesan",
            vmInspeksi.contains("var tersimpanOffline by mutableStateOf(false)"),
        )
        assertTrue(
            "flag diisi dari hasil penyimpanan",
            vmInspeksi.contains("tersimpanOffline = tersimpan"),
        )
        assertEquals(
            "form inspeksi dan form temuan sama-sama menawarkan tautan antrean",
            2,
            inspeksi.split("PintuAntrean(tampil = vm.tersimpanOffline").size - 1,
        )
        assertTrue(
            "dialog laporan warga offline punya tombol menuju antrean",
            wargaLapor.contains("Lihat Antrean Kirim"),
        )
    }

    @Test
    fun `layar antrean memberi aksi kirim dan batal`() {
        val layar = baca("feature/queue/QueueScreen.kt")
        val vm = baca("feature/queue/QueueViewModel.kt")

        assertTrue(layar.contains("onKirim = { vm.kirimUlang(item.id) }"))
        assertTrue(layar.contains("onBatalkan = { akanDihapus = item }"))
        assertTrue("perlu konfirmasi sebelum hapus", layar.contains("JkDialog("))
        assertTrue("bisa kirim semua sekaligus", layar.contains("vm.kirimUlang(null)"))
        assertTrue(vm.contains("outbox.retryNow("))
        assertTrue(vm.contains("outbox.cancel("))
    }

    @Test
    fun `layar menampilkan alasan gagal dari server dan sisa waktu foto`() {
        val layar = baca("feature/queue/QueueScreen.kt")

        assertTrue("alasan server harus terlihat", layar.contains("item.lastError"))
        assertTrue(
            "sisa waktu sebelum foto kedaluwarsa harus terlihat",
            layar.contains("QueuePolicy.remainingLabel("),
        )
        assertTrue(
            "item kedaluwarsa tidak ditawari kirim ulang",
            layar.contains("item.status != QueuedSubmission.STATUS_EXPIRED"),
        )
    }
}
