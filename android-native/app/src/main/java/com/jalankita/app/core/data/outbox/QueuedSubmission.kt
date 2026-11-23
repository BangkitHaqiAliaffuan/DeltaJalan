package com.jalankita.app.core.data.outbox

import com.squareup.moshi.JsonClass
import java.util.UUID

/**
 * Satu kiriman yang belum berhasil dikirim ke server.
 *
 * Satu model untuk SEMUA jenis kiriman (laporan warga, hasil inspeksi, temuan
 * lapangan). Sebelumnya ada dua berkas antrean terpisah dengan aturan berbeda
 * (satu menulis atomik, satu tidak; satu punya mutex, satu tidak) — sumber
 * kehilangan data. Sekarang satu penyimpanan, satu aturan.
 *
 * Catatan desain: [kind] dan [status] sengaja **String**, bukan enum. Moshi
 * melempar `JsonDataException` untuk nilai enum yang tidak dikenal, dan berkas
 * antrean hidup lebih lama daripada satu versi aplikasi — string membuat
 * antrean lama tetap terbaca setelah aplikasi diperbarui.
 */
@JsonClass(generateAdapter = true)
data class QueuedSubmission(
    val id: String = UUID.randomUUID().toString(),
    val kind: String,
    val status: String = STATUS_PENDING,
    /** Pemilik kiriman. Item hanya boleh dikirim oleh akun pemiliknya. */
    val userId: String? = null,
    val idempotencyKey: String = UUID.randomUUID().toString(),
    val attempts: Int = 0,
    val lastError: String? = null,
    val lastErrorCode: String? = null,
    val createdAt: Long = System.currentTimeMillis(),
    /** Waktu foto diambil (EXIF). null → pakai [createdAt] sebagai perkiraan. */
    val photoTakenAt: Long? = null,
    /** Batas waktu kirim; lewat dari ini server menolak karena foto terlalu tua. */
    val expiresAt: Long = 0L,
    val photoPaths: List<String> = emptyList(),

    // ── Laporan warga ────────────────────────────────────────────────────
    val reporterName: String? = null,
    val roadName: String? = null,
    val district: String? = null,
    val description: String? = null,
    val fullAddress: String? = null,
    val panjang: Double? = null,
    val lebar: Double? = null,

    // ── Hasil inspeksi / temuan lapangan ─────────────────────────────────
    val assignmentId: String? = null,
    val sessionId: String? = null,
    val condition: String? = null,
    val notes: String? = null,
    val kerusakanPanjang: Double? = null,
    val kerusakanLebar: Double? = null,
    val kerusakanKedalaman: Double? = null,
    val jenisPerkerasan: String? = null,
    val kepadatanLaluLintas: String? = null,

    // ── Koordinat ────────────────────────────────────────────────────────
    val latitude: Double? = null,
    val longitude: Double? = null,
) {
    val isWargaReport: Boolean get() = kind == KIND_WARGA_REPORT
    val isInspectionResult: Boolean get() = kind == KIND_INSPECTION_RESULT
    val isDiscoveredReport: Boolean get() = kind == KIND_DISCOVERED_REPORT

    /** Masih bisa dikirim (belum kedaluwarsa / belum menyerah). */
    val isActive: Boolean get() = status != STATUS_EXPIRED

    /** Kiriman yang gagal permanen tetapi datanya masih disimpan untuk pengguna. */
    val isFailed: Boolean get() = status == STATUS_FAILED || status == STATUS_EXPIRED

    /** Sisa waktu sebelum kedaluwarsa (milidetik, boleh negatif). */
    fun remainingMillis(now: Long = System.currentTimeMillis()): Long = expiresAt - now

    companion object {
        const val KIND_WARGA_REPORT = "warga_report"
        const val KIND_INSPECTION_RESULT = "inspection_result"
        const val KIND_DISCOVERED_REPORT = "discovered_report"

        const val STATUS_PENDING = "pending"
        const val STATUS_RETRYING = "retrying"
        const val STATUS_WAITING_QUOTA = "waiting_quota"
        const val STATUS_FAILED = "failed"
        const val STATUS_EXPIRED = "expired"

        val ALL_KINDS = setOf(KIND_WARGA_REPORT, KIND_INSPECTION_RESULT, KIND_DISCOVERED_REPORT)
        val ALL_STATUSES = setOf(
            STATUS_PENDING, STATUS_RETRYING, STATUS_WAITING_QUOTA,
            STATUS_FAILED, STATUS_EXPIRED,
        )
    }
}
