package com.jalankita.app.core.data

import com.squareup.moshi.JsonClass

/**
 * Bentuk data antrean **versi lama**. Hanya dipakai `OutboxRepository` untuk
 * memindahkan kiriman pengguna yang belum terkirim saat aplikasi diperbarui;
 * berkas lama dihapus setelah impor. Jangan dipakai untuk kode baru.
 */
@JsonClass(generateAdapter = true)
data class LegacyWargaReport(
    val id: String,
    val reporterName: String,
    val roadName: String,
    val district: String,
    val latitude: Double,
    val longitude: Double,
    val description: String? = null,
    val panjang: Double? = null,
    val lebar: Double? = null,
    val fullAddress: String? = null,
    val photoPaths: List<String> = emptyList(),
    val createdAt: Long = 0L,
    val retryCount: Int = 0,
    val lastError: String? = null,
)

@JsonClass(generateAdapter = true)
data class LegacyInspectionResult(
    val id: String,
    val assignmentId: String,
    val sessionId: String? = null,
    val condition: String? = null,
    val notes: String? = null,
    val kerusakanPanjang: Double? = null,
    val kerusakanLebar: Double? = null,
    val kerusakanKedalaman: Double? = null,
    val jenisPerkerasan: String? = null,
    val kepadatanLaluLintas: String? = null,
    val roadName: String? = null,
    val district: String? = null,
    val discovered: Boolean = false,
    val latitude: Double? = null,
    val longitude: Double? = null,
    val photoPaths: List<String> = emptyList(),
    val idempotencyKey: String,
    val retryCount: Int = 0,
    val lastError: String? = null,
    val terminal: Boolean = false,
    val createdAt: Long = 0L,
)
