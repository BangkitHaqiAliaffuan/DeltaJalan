package com.jalankita.app.core.data.outbox

import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import java.io.File
import kotlin.io.path.createTempDirectory
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * Tes lapisan penyimpanan antrean — dijalankan di JVM tanpa Android karena
 * [OutboxStore] hanya memakai `java.io.File`.
 */
class OutboxStoreTest {

    private lateinit var root: File
    private lateinit var moshi: Moshi
    private lateinit var store: OutboxStore

    @Before
    fun siapkan() {
        root = createTempDirectory("outbox-test").toFile()
        moshi = Moshi.Builder().add(KotlinJsonAdapterFactory()).build()
        store = OutboxStore(root, moshi)
    }

    private fun item(id: String = "a1", kind: String = QueuedSubmission.KIND_WARGA_REPORT) =
        QueuedSubmission(
            id = id,
            kind = kind,
            expiresAt = System.currentTimeMillis() + 60_000,
            roadName = "Jl. Ahmad Yani",
            district = "Sidoarjo",
            latitude = -7.44,
            longitude = 112.70,
        )

    @Test
    fun `simpan lalu baca mengembalikan item yang sama`() {
        assertTrue(store.save(listOf(item("a1"), item("a2"))))
        val load = store.load()
        assertFalse(load.corrupted)
        assertEquals(listOf("a1", "a2"), load.items.map { it.id })
        assertEquals("Jl. Ahmad Yani", load.items.first().roadName)
    }

    @Test
    fun `berkas kosong atau belum ada berarti antrean kosong`() {
        assertTrue(store.load().items.isEmpty())
        assertTrue(store.save(emptyList()))
        assertTrue(store.load().items.isEmpty())
    }

    @Test
    fun `tidak meninggalkan berkas temp setelah menyimpan`() {
        store.save(listOf(item("a1")))
        val sisa = File(root, "queues").listFiles()?.map { it.name }.orEmpty()
        assertEquals(listOf(OutboxStore.OUTBOX_FILE), sisa)
    }

    @Test
    fun `berkas terpotong diselamatkan per item, bukan dibuang seluruhnya`() {
        val utuh = "{${'"'}id${'"'}:${'"'}a1${'"'},${'"'}kind${'"'}:${'"'}warga_report${'"'}," +
            "${'"'}status${'"'}:${'"'}pending${'"'},${'"'}idempotencyKey${'"'}:${'"'}k1${'"'}," +
            "${'"'}createdAt${'"'}:0,${'"'}expiresAt${'"'}:99,${'"'}photoPaths${'"'}:[${'"'}/x.jpg${'"'}]," +
            "${'"'}attempts${'"'}:0}"
        // Item kedua terpotong di tengah — persis kondisi proses dimatikan saat menulis.
        val rusak = "[$utuh, {\"id\":\"a2\",\"kind\":\"warga_rep"
        File(root, "queues").mkdirs()
        File(root, "queues/${OutboxStore.OUTBOX_FILE}").writeText(rusak)

        val load = store.load()

        assertTrue("berkas rusak harus dilaporkan", load.corrupted)
        assertEquals("item utuh tetap terselamatkan", listOf("a1"), load.items.map { it.id })
        assertTrue(
            "berkas rusak dipindahkan, bukan dihapus",
            File(root, "queues").listFiles().orEmpty().any { it.name.contains(".corrupt-") },
        )
    }

    @Test
    fun `kurung kurawal di dalam teks tidak memotong item`() {
        val raw = "[{\"id\":\"a1\",\"kind\":\"warga_report\",\"status\":\"pending\"," +
            "\"idempotencyKey\":\"k1\",\"createdAt\":0,\"expiresAt\":9,\"attempts\":0," +
            "\"photoPaths\":[],\"description\":\"lubang {besar} \\\"parah\\\"\"}]"
        val hasil = store.salvage(raw)
        assertEquals(1, hasil.size)
        assertEquals("lubang {besar} \"parah\"", hasil.first().description)
    }

    @Test
    fun `foto disalin ke penyimpanan permanen dan bisa dihapus`() {
        val asal = File(root, "cache_foto.jpg").apply { writeText("isi-foto") }
        val tersimpan = store.copyPhotos("a1", listOf(asal))

        assertEquals(1, tersimpan.size)
        assertTrue(File(tersimpan.first()).exists())
        assertTrue("foto harus di luar cache", tersimpan.first().contains("outbox"))
        assertTrue(store.totalPhotoBytes() > 0)

        store.deletePhotos(tersimpan)
        assertFalse(File(tersimpan.first()).exists())
        assertEquals(0L, store.totalPhotoBytes())
    }

    @Test
    fun `berkas sumber yang hilang tidak menghasilkan path palsu`() {
        val tersimpan = store.copyPhotos("a2", listOf(File(root, "tidak-ada.jpg")))
        assertTrue(tersimpan.isEmpty())
    }

    @Test
    fun `salvage mengabaikan objek tanpa id dan memakai nilai bawaan untuk field opsional`() {
        val hasil = store.salvage(
            "[{\"kind\":\"warga_report\"}," +
                "{\"id\":\"a3\",\"kind\":\"warga_report\"}]",
        )
        assertEquals("objek tanpa id diabaikan", listOf("a3"), hasil.map { it.id })
        assertEquals(
            "field yang hilang memakai nilai bawaan, bukan membuat item gagal dibaca",
            QueuedSubmission.STATUS_PENDING,
            hasil.first().status,
        )
    }

    @Test
    fun `load setelah quarantine mengembalikan antrean kosong tanpa melempar`() {
        File(root, "queues").mkdirs()
        File(root, "queues/${OutboxStore.OUTBOX_FILE}").writeText("bukan json sama sekali")
        val load = store.load()
        assertTrue(load.items.isEmpty())
        assertNotNull(store.queueFile().parentFile)
        assertTrue(store.load().items.isEmpty())
    }
}
