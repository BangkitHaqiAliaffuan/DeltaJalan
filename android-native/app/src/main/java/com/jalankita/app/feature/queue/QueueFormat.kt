package com.jalankita.app.feature.queue

import com.jalankita.app.core.data.outbox.QueuedSubmission

/**
 * Teks yang ditampilkan layar antrean. Dipisah dari Composable supaya bisa
 * diuji di JVM tanpa emulator (batas waktu relatif mudah salah).
 */
object QueueFormat {

    fun jenis(item: QueuedSubmission): String = when (item.kind) {
        QueuedSubmission.KIND_WARGA_REPORT -> "Laporan warga"
        QueuedSubmission.KIND_INSPECTION_RESULT -> "Hasil inspeksi"
        QueuedSubmission.KIND_DISCOVERED_REPORT -> "Temuan lapangan"
        else -> "Kiriman"
    }

    /** Umur kiriman dalam bahasa sehari-hari. */
    fun umur(createdAt: Long, now: Long = System.currentTimeMillis()): String {
        val menit = ((now - createdAt) / 60_000L).coerceAtLeast(0)
        return when {
            menit < 1 -> "baru saja"
            menit < 60 -> "$menit menit lalu"
            menit < 24 * 60 -> "${menit / 60} jam lalu"
            else -> "${menit / (24 * 60)} hari lalu"
        }
    }

    /** Baris lokasi + umur; bagian kosong tidak ditampilkan. */
    fun lokasiDanUmur(item: QueuedSubmission, now: Long = System.currentTimeMillis()): String =
        listOfNotNull(item.district?.takeIf { it.isNotBlank() }, umur(item.createdAt, now))
            .joinToString(" · ")
}
