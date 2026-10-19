package com.jalankita.app.core.util

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat

/**
 * Izin MediaStore yang dibutuhkan agar tag EXIF GPS TIDAK dihapus Android.
 *
 * - Android 13+ (API 33+) : `READ_MEDIA_IMAGES`
 * - Android 12- (API ≤32) : `READ_EXTERNAL_STORAGE`
 * - Android 10+ (API 29+) : `ACCESS_MEDIA_LOCATION` — WAJIB, tanpanya GPS di-redact
 *
 * Semua izin ini hanya relevan Android 10+; pada API < 29 EXIF GPS dibaca apa adanya.
 */
object MediaPermissions {

    /** Daftar izin yang perlu diminta runtime untuk membaca EXIF GPS dari galeri. */
    fun required(): List<String> {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return emptyList()
        val perms = mutableListOf<String>()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            perms += Manifest.permission.READ_MEDIA_IMAGES
        } else {
            perms += Manifest.permission.READ_EXTERNAL_STORAGE
        }
        perms += Manifest.permission.ACCESS_MEDIA_LOCATION
        return perms
    }

    /** Izin apa saja dari [required] yang belum diberikan. */
    fun missing(context: Context): List<String> =
        required().filter {
            ContextCompat.checkSelfPermission(context, it) != PackageManager.PERMISSION_GRANTED
        }

    fun allGranted(context: Context): Boolean = missing(context).isEmpty()
}
