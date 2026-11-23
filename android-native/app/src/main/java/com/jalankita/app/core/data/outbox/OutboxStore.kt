package com.jalankita.app.core.data.outbox

import com.squareup.moshi.JsonAdapter
import com.squareup.moshi.Moshi
import com.squareup.moshi.Types
import java.io.File
import java.io.FileOutputStream

/**
 * Penyimpanan antrean di disk. Murni `java.io.File` — tidak menyentuh Context,
 * jadi bisa diuji di JVM biasa (tanpa Robolectric/emulator).
 *
 * Tiga jaminan yang sebelumnya tidak ada:
 * 1. **Tulis atomik** — berkas ditulis ke `.tmp` lalu `rename`, sehingga
 *    proses yang mati di tengah penulisan tidak memotong berkas asli.
 * 2. **Pemulihan berkas rusak** — JSON yang tidak bisa dibaca dipindahkan ke
 *    `.corrupt-<waktu>` (bukan dihapus) dan isinya diselamatkan per item.
 * 3. **Foto di `filesDir`** — bukan `cacheDir` yang boleh dibersihkan OS.
 */
class OutboxStore(root: File, moshi: Moshi) {

    data class Load(val items: List<QueuedSubmission>, val corrupted: Boolean)

    private val queueDir = File(root, "queues")
    private val queueFile = File(queueDir, OUTBOX_FILE)
    private val outboxDir = File(root, OUTBOX_DIR)

    private val listAdapter: JsonAdapter<List<QueuedSubmission>> = moshi.adapter(
        Types.newParameterizedType(List::class.java, QueuedSubmission::class.java),
    )
    private val itemAdapter: JsonAdapter<QueuedSubmission> = moshi.adapter(QueuedSubmission::class.java)

    fun queueFile(): File = queueFile

    fun load(): Load {
        if (!queueFile.exists()) return Load(emptyList(), corrupted = false)
        val raw = runCatching { queueFile.readText() }.getOrNull()
        if (raw.isNullOrBlank()) return Load(emptyList(), corrupted = false)

        runCatching { listAdapter.fromJson(raw) }.getOrNull()?.let { parsed ->
            return Load(parsed.filterNotNull(), corrupted = false)
        }
        // Berkas tidak utuh: selamatkan item yang masih bisa dibaca.
        val salvaged = salvage(raw)
        quarantine()
        return Load(salvaged, corrupted = true)
    }

    fun save(items: List<QueuedSubmission>): Boolean = runCatching {
        queueDir.mkdirs()
        val temp = File(queueDir, "$OUTBOX_FILE.tmp")
        FileOutputStream(temp).use { out ->
            out.write(listAdapter.toJson(items).toByteArray())
            out.flush()
            out.fd.sync()
        }
        // renameTo pada filesystem yang sama bersifat atomik.
        if (!temp.renameTo(queueFile)) {
            queueFile.delete()
            if (!temp.renameTo(queueFile)) return false
        }
        true
    }.getOrDefault(false)

    /** Salin foto ke penyimpanan permanen; kembalikan path barunya. */
    fun copyPhotos(id: String, sources: List<File>): List<String> {
        if (sources.isEmpty()) return emptyList()
        val dir = File(outboxDir, id)
        dir.mkdirs()
        val stored = mutableListOf<String>()
        sources.forEachIndexed { index, source ->
            if (!source.exists() || source.length() == 0L) return@forEachIndexed
            val ext = source.extension.takeIf { it.isNotBlank() } ?: "jpg"
            val target = File(dir, "photo_${index + 1}.$ext")
            runCatching {
                source.copyTo(target, overwrite = true)
                stored += target.absolutePath
            }
        }
        return stored
    }

    fun deletePhotos(paths: List<String>) {
        val parents = mutableSetOf<File>()
        paths.forEach { path ->
            val file = File(path)
            parents += file.parentFile ?: return@forEach
            runCatching { file.delete() }
        }
        parents.forEach { dir -> runCatching { dir.delete() } }
    }

    fun totalPhotoBytes(): Long {
        if (!outboxDir.exists()) return 0L
        return outboxDir.walkTopDown().filter { it.isFile }.sumOf { it.length() }
    }

    /** Pindahkan berkas rusak ke samping agar bisa diperiksa, jangan dihapus. */
    fun quarantine(): File? {
        if (!queueFile.exists()) return null
        val target = File(queueDir, "$OUTBOX_FILE.corrupt-${System.currentTimeMillis()}")
        return if (queueFile.renameTo(target)) target else null
    }

    /**
     * Ambil objek JSON utuh dari berkas yang terpotong.
     * Penelusuran sadar-string: kurung kurawal di dalam nilai string diabaikan.
     */
    fun salvage(raw: String): List<QueuedSubmission> {
        val result = mutableListOf<QueuedSubmission>()
        val buffer = StringBuilder()
        var depth = 0
        var inString = false
        var escaped = false
        for (ch in raw) {
            if (inString) {
                if (depth > 0) buffer.append(ch)
                when {
                    escaped -> escaped = false
                    ch == '\\' -> escaped = true
                    ch == '"' -> inString = false
                }
                continue
            }
            when (ch) {
                '"' -> {
                    inString = true
                    if (depth > 0) buffer.append(ch)
                }
                '{' -> {
                    depth++
                    buffer.append(ch)
                }
                '}' -> {
                    if (depth == 0) continue
                    buffer.append(ch)
                    depth--
                    if (depth == 0) {
                        val potongan = buffer.toString()
                        // `id` punya nilai bawaan (UUID acak), jadi objek tanpa
                        // id tetap "berhasil" dibaca. Periksa teksnya agar item
                        // yang tidak lengkap tidak masuk antrean dengan id palsu.
                        if (potongan.contains("\"id\":")) {
                            runCatching { itemAdapter.fromJson(potongan) }
                                .getOrNull()
                                ?.let { item -> if (item.id.isNotBlank()) result += item }
                        }
                        buffer.setLength(0)
                    }
                }
                else -> if (depth > 0) buffer.append(ch)
            }
        }
        return result
    }

    companion object {
        const val OUTBOX_FILE = "outbox.json"
        const val OUTBOX_DIR = "outbox"
    }
}
