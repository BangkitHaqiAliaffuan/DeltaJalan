package com.jalankita.app.core.util

/**
 * Tahap reverse geocoding GPS foto → nama jalan / kecamatan / alamat lengkap.
 *
 * Dipakai form lapor warga maupun petugas supaya indikator loading, pesan
 * sukses, dan pesan "isi manual" konsisten. `FAILED` bukan kondisi fatal:
 * pengguna tetap bisa mengisi form secara manual.
 */
enum class GeocodeStage { IDLE, LOADING, DONE, FAILED }
