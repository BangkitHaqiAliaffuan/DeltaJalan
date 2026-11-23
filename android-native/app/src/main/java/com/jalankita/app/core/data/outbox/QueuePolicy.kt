package com.jalankita.app.core.data.outbox

/**
 * Semua aturan antrean dalam satu tempat — fungsi murni, tanpa Android,
 * supaya bisa diuji di JVM tanpa emulator.
 *
 * Angka-angka di sini berasal dari batas server, bukan selera:
 * - Foto inspeksi maksimal **2 hari** (`ReportController::MAX_PHOTO_AGE_DAYS`).
 *   Item inspeksi yang menganggur lebih lama tidak akan pernah diterima —
 *   percuma diulang terus, jadi harus ditandai kedaluwarsa.
 * - Foto laporan warga maksimal **7 hari** (`WargaReportController::MAX_PHOTO_AGE_DAYS`).
 * - Batas laporan harian per akun warga **5** (`DAILY_LIMIT`) → status
 *   menunggu kuota sampai tengah malam WIB, bukan diulang terus.
 */
object QueuePolicy {

    /** Percobaan sebelum item dianggap gagal (429 tidak dihitung). */
    const val MAX_ATTEMPTS = 8

    /** Batas jumlah item agar berkas antrean tidak tumbuh tanpa kendali. */
    const val MAX_ITEMS = 30

    /** Batas ukuran total outbox (foto) dalam byte. */
    const val MAX_OUTBOX_BYTES = 50L * 1024L * 1024L

    const val INSPECTION_MAX_AGE_DAYS = 2
    const val WARGA_MAX_AGE_DAYS = 7

    private const val DAY_MS = 24L * 60L * 60L * 1000L
    private const val WIB_OFFSET_MS = 7L * 60L * 60L * 1000L

    /** Kode server yang berarti "tunggu sampai besok", bukan gagal. */
    val QUOTA_ERROR_CODES = setOf(
        "DAILY_LIMIT_EXCEEDED",
        "FINGERPRINT_LIMIT_EXCEEDED",
        "DEVICE_LIMIT_EXCEEDED",
        "IP_LIMIT_EXCEEDED",
    )

    fun maxAgeDays(kind: String): Int = when (kind) {
        QueuedSubmission.KIND_WARGA_REPORT -> WARGA_MAX_AGE_DAYS
        else -> INSPECTION_MAX_AGE_DAYS
    }

    /**
     * Batas waktu kirim sebuah item. Dihitung dari waktu foto diambil bila
     * diketahui (itu yang diperiksa server), bukan dari waktu masuk antrean.
     */
    fun expiresAt(
        kind: String,
        photoTakenAt: Long?,
        createdAt: Long,
    ): Long = (photoTakenAt ?: createdAt) + maxAgeDays(kind) * DAY_MS

    fun isExpired(item: QueuedSubmission, now: Long = System.currentTimeMillis()): Boolean =
        item.status != QueuedSubmission.STATUS_EXPIRED && item.expiresAt > 0L && item.expiresAt <= now

    fun isQuotaError(code: String?, message: String? = null): Boolean {
        if (code != null && code in QUOTA_ERROR_CODES) return true
        // Jaring pengaman bila server hanya mengirim pesan.
        val text = message?.lowercase() ?: return false
        return text.contains("batas laporan harian") ||
            text.contains("batas harian") ||
            text.contains("coba lagi besok")
    }

    /**
     * Status setelah satu kegagalan.
     *
     * Urutan penting: kuota → kedaluwarsa → batas percobaan → ulangi.
     * Kalau kuota tidak dipisahkan, 8 percobaan (±2 jam dengan backoff
     * eksponensial) menghabiskan jatah dan item dibuang padahal besok
     * pagi pasti berhasil.
     */
    fun statusAfterFailure(
        item: QueuedSubmission,
        errorCode: String?,
        message: String?,
        now: Long = System.currentTimeMillis(),
        quotaBlocked: Boolean = false,
    ): String = when {
        quotaBlocked || isQuotaError(errorCode, message) -> QueuedSubmission.STATUS_WAITING_QUOTA
        isExpired(item, now) -> QueuedSubmission.STATUS_EXPIRED
        item.attempts + 1 >= MAX_ATTEMPTS -> QueuedSubmission.STATUS_FAILED
        else -> QueuedSubmission.STATUS_RETRYING
    }

    /** Percobaan ini dihitung ke [MAX_ATTEMPTS]? Kuota tidak dihitung. */
    fun countsAsAttempt(status: String): Boolean =
        status != QueuedSubmission.STATUS_WAITING_QUOTA

    /**
     * Tengah malam WIB berikutnya — saat kuota harian server direset.
     * WIB = UTC+7 tanpa DST, jadi aritmetika sederhana sudah tepat.
     */
    fun nextQuotaReset(now: Long = System.currentTimeMillis()): Long {
        val wibNow = now + WIB_OFFSET_MS
        val startOfDayWib = wibNow - (wibNow % DAY_MS)
        return startOfDayWib + DAY_MS - WIB_OFFSET_MS
    }

    /** Label sisa waktu untuk UI dan notifikasi. Murni, bisa diuji. */
    fun remainingLabel(remainingMs: Long): String {
        if (remainingMs <= 0L) return "foto sudah kedaluwarsa"
        val hours = remainingMs / (60L * 60L * 1000L)
        return when {
            hours >= 48L -> "${hours / 24L} hari lagi"
            hours >= 24L -> "1 hari lagi"
            hours >= 1L -> "$hours jam lagi"
            else -> "kurang dari 1 jam"
        }
    }

    /**
     * Apakah item boleh dikirim oleh sesi yang sedang aktif.
     *
     * Item tanpa pemilik (impor dari versi lama, atau dibuat sebelum sesi
     * aktif) tetap boleh dikirim agar kiriman pengguna tidak menggantung.
     * Item milik akun lain **tidak boleh**: server memakai `user_id` dari sesi
     * berjalan, jadi mengirimnya akan mencatat laporan orang lain atas nama
     * akun ini.
     */
    fun belongsTo(itemUserId: String?, currentUserId: String?): Boolean {
        if (itemUserId == null || currentUserId == null) return true
        return itemUserId == currentUserId
    }

    /** Alasan yang ditampilkan saat item ditandai kedaluwarsa. */
    fun expiredMessage(kind: String): String = if (kind == QueuedSubmission.KIND_WARGA_REPORT) {
        "Foto sudah lebih dari $WARGA_MAX_AGE_DAYS hari, server menolak laporan lama."
    } else {
        "Foto sudah lebih dari $INSPECTION_MAX_AGE_DAYS hari, server menolak bukti inspeksi lama."
    }
}
