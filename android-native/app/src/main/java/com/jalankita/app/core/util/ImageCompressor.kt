package com.jalankita.app.core.util

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.net.Uri
import android.provider.MediaStore
import android.util.Log
import androidx.exifinterface.media.ExifInterface
import java.io.File
import java.io.FileOutputStream

/**
 * Kompres gambar & salin Uri → File di cache (replikasi `compressImage` frontend).
 * Dipakai untuk menurunkan ukuran sebelum upload (server batas 5 MB).
 *
 * PENTING: Panggil SETELAH validasi EXIF (kompresi membuang EXIF).
 * GPS EXIF disalin ulang otomatis ke hasil kompres agar server bisa memverifikasi lokasi.
 */
object ImageCompressor {

    private const val TAG = "ImageCompressor"
    private const val MAX_DIMEN = 1600
    private const val JPEG_QUALITY = 85

    /**
     * Baca Uri → Bitmap (downsample) → rotasi sesuai EXIF → simpan JPEG ke cache,
     * lalu **tulis GPS EXIF** ke hasil kompres.
     *
     * Bitmap.compress() membuang seluruh EXIF (termasuk GPS) karena hanya menulis
     * pixel. Server butuh GPS di dalam foto untuk verifikasi `gps_mismatch`.
     *
     * GPS ditulis dari [lat]/[lng] yang SUDAH divalidasi (dari ExifValidator) —
     * nilai ini kebal redaksi Android 10+. Bila [lat]/[lng] null, dicoba salin dari
     * sumber via stream ber-`setRequireOriginal` (butuh ACCESS_MEDIA_LOCATION).
     *
     * @param lat garis lintang GPS hasil validasi (null bila tak ada).
     * @param lng garis bujur GPS hasil validasi (null bila tak ada).
     * @param outName nama file di cache. Default null → dibuat unik per panggilan;
     *   JANGAN pakai nama tetap untuk multi-foto (file saling menimpa di disk
     *   sehingga submit N foto mengirim byte identik N kali).
     * @return File JPEG hasil kompres, atau null bila gagal.
     */
    fun compressToFile(
        context: Context,
        uri: Uri,
        lat: Double? = null,
        lng: Double? = null,
        outName: String? = null,
    ): File? {
        return try {
            val bitmap = decodeSampled(context, uri) ?: return null
            val rotated = applyExifRotation(context, uri, bitmap)
            val out = File(
                context.cacheDir,
                outName ?: "upload_${System.nanoTime()}.jpg",
            )
            FileOutputStream(out).use { fos ->
                rotated.compress(Bitmap.CompressFormat.JPEG, JPEG_QUALITY, fos)
            }
            if (rotated !== bitmap) bitmap.recycle()
            rotated.recycle()

            // Kompresi membuang EXIF → tulis ulang GPS agar server bisa verifikasi.
            writeGpsExif(context, uri, out, lat, lng)
            out
        } catch (e: Exception) {
            null
        }
    }

    /** Salin Uri apa adanya (tanpa kompres) ke cache — untuk foto asli kamera. */
    fun copyToCache(context: Context, uri: Uri, outName: String): File? {
        return try {
            val out = File(context.cacheDir, outName)
            context.contentResolver.openInputStream(uri)?.use { input ->
                FileOutputStream(out).use { output -> input.copyTo(output) }
            }
            if (out.exists() && out.length() > 0) out else null
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Salin byte ASLI (dengan EXIF) dari [uri] ke cache — untuk fallback
     * ekstrak GPS di server (`POST v1/reports/extract-exif-gps`).
     * Beda dari [compressToFile]: tanpa downscale/rotasi sehingga EXIF utuh.
     *
     * Urutan buka: `setRequireOriginal` dulu (menembus redaksi GPS Android 10+
     * bila ACCESS_MEDIA_LOCATION diberikan — byte yang disalin tetap ber-GPS),
     * lalu stream mentah sebagai fallback. Menyalin stream mentah yang
     * ter-redact TIDAK berguna (server ikut tidak menemukan GPS).
     */
    fun copyOriginalToCache(
        context: Context,
        uri: Uri,
        outName: String = "exif_fallback.jpg",
    ): File? {
        val targets = buildList {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
                add(MediaStore.setRequireOriginal(uri))
            }
            add(uri)
        }
        for (t in targets) {
            try {
                context.contentResolver.openInputStream(t)?.use { input ->
                    val out = File(context.cacheDir, outName)
                    FileOutputStream(out).use { output -> input.copyTo(output) }
                    if (out.exists() && out.length() > 0) return out
                }
            } catch (e: Exception) {
                Log.w(TAG, "copyOriginalToCache gagal untuk $t: ${e.message}")
            }
        }
        return null
    }

    private fun decodeSampled(context: Context, uri: Uri): Bitmap? {
        val opts = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        context.contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, opts) }

        var scale = 1
        while (opts.outWidth / scale > MAX_DIMEN || opts.outHeight / scale > MAX_DIMEN) {
            scale *= 2
        }

        val decodeOpts = BitmapFactory.Options().apply { inSampleSize = scale }
        return context.contentResolver.openInputStream(uri)?.use {
            BitmapFactory.decodeStream(it, null, decodeOpts)
        }
    }

    private fun applyExifRotation(context: Context, uri: Uri, bitmap: Bitmap): Bitmap {
        val orientation = try {
            context.contentResolver.openInputStream(uri)?.use { ExifInterface(it) }
                ?.getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)
                ?: ExifInterface.ORIENTATION_NORMAL
        } catch (e: Exception) {
            ExifInterface.ORIENTATION_NORMAL
        }

        val matrix = Matrix()
        when (orientation) {
            ExifInterface.ORIENTATION_ROTATE_90 -> matrix.postRotate(90f)
            ExifInterface.ORIENTATION_ROTATE_180 -> matrix.postRotate(180f)
            ExifInterface.ORIENTATION_ROTATE_270 -> matrix.postRotate(270f)
            else -> return bitmap
        }
        return Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
    }

    /**
     * Tulis tag GPS ke file JPEG [dest].
     *
     * Urutan:
     *  1. Dari [lat]/[lng] hasil validasi (paling andal — kebal redaksi Android 10+).
     *  2. Fallback: salin dari sumber yang dibuka dengan `setRequireOriginal`
     *     (butuh ACCESS_MEDIA_LOCATION). Stream mentah TIDAK dipakai karena GPS-nya
     *     sudah dihapus MediaProvider.
     *
     * Semua jalur juga menyalin tag TANGGAL (DATETIME_ORIGINAL) — server
     * memvalidasi ulang usia foto dari file yang diterima; tanpa tag ini foto
     * utama selalu 422 PHOTO_NO_EXIF_DATE.
     *
     * Best-effort: kegagalan tidak menggagalkan upload.
     */
    private fun writeGpsExif(
        context: Context, srcUri: Uri, dest: File, lat: Double?, lng: Double?,
    ) {
        try {
            val target = ExifInterface(dest)

            // Jalur utama: koordinat hasil validasi (sudah melewati rantai 4-attempt).
            if (lat != null && lng != null && !(lat == 0.0 && lng == 0.0)) {
                target.setLatLong(lat, lng)
                copyDateTags(context, srcUri, target)
                target.saveAttributes()
                Log.d(TAG, "EXIF GPS ditulis dari koordinat validasi: $lat,$lng")
                return
            }

            // Fallback: baca sumber lewat setRequireOriginal (butuh ACCESS_MEDIA_LOCATION),
            // lalu parser RAW byte-level karena exifinterface bisa gagal baca GPS.
            val raw = openSourceRawGps(context, srcUri)
            if (raw != null && !(raw.first == 0.0 && raw.second == 0.0)) {
                target.setLatLong(raw.first, raw.second)
                copyDateTags(context, srcUri, target)
                target.saveAttributes()
                Log.d(TAG, "EXIF GPS disalin (raw parser) ke hasil kompres: $raw")
                return
            }

            // Fallback terakhir: salin atribut mentah GPS bila ada.
            val source = openSourceExif(context, srcUri) ?: return
            val copied = GPS_TAGS.count { tag ->
                val v = source.getAttribute(tag) ?: return@count false
                target.setAttribute(tag, v)
                true
            }
            val dateCopied = DATE_TAGS.count { tag ->
                val v = source.getAttribute(tag) ?: return@count false
                target.setAttribute(tag, v)
                true
            }
            if (copied > 0 || dateCopied > 0) {
                target.saveAttributes()
                Log.d(TAG, "EXIF GPS (raw attrs) disalin: $copied tag, tanggal: $dateCopied tag")
            }
        } catch (e: Exception) {
            Log.w(TAG, "Gagal tulis EXIF GPS ke file kompres: ${e.message}")
        }
    }

    /** Baca GPS dari sumber via parser RAW (setRequireOriginal bila mungkin). */
    private fun openSourceRawGps(context: Context, srcUri: Uri): Pair<Double, Double>? {
        val targets = buildList {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
                add(MediaStore.setRequireOriginal(srcUri))
            }
            add(srcUri)
        }
        for (t in targets) {
            try {
                context.contentResolver.openInputStream(t)?.use { s ->
                    RawExifGps.read(s)?.let { return it }
                }
            } catch (e: Exception) {
                Log.w(TAG, "openSourceRawGps gagal: ${e.message}")
            }
        }
        return null
    }

    /** Buka sumber dengan `setRequireOriginal` bila memungkinkan (Android 10+). */
    private fun openSourceExif(context: Context, srcUri: Uri): ExifInterface? {
        // Coba jalur ber-hak-original dulu (menembus redaksi GPS).
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
            try {
                context.contentResolver.openInputStream(MediaStore.setRequireOriginal(srcUri))
                    ?.use { return ExifInterface(it) }
            } catch (e: Exception) {
                Log.w(TAG, "setRequireOriginal gagal: ${e.message}")
            }
        }
        // Jalur apa adanya (bisa tanpa GPS, tetapi berguna untuk tag lain).
        return try {
            context.contentResolver.openInputStream(srcUri)?.use { ExifInterface(it) }
        } catch (e: Exception) {
            null
        }
    }

    private val GPS_TAGS = listOf(
        ExifInterface.TAG_GPS_LATITUDE,
        ExifInterface.TAG_GPS_LATITUDE_REF,
        ExifInterface.TAG_GPS_LONGITUDE,
        ExifInterface.TAG_GPS_LONGITUDE_REF,
    )

    /** Tag tanggal yang wajib ikut tersalin — server menolak foto tanpa tanggal (7 hari warga). */
    private val DATE_TAGS = listOf(
        ExifInterface.TAG_DATETIME_ORIGINAL,
        ExifInterface.TAG_DATETIME_DIGITIZED,
        ExifInterface.TAG_DATETIME,
    )

    /**
     * Salin tag tanggal dari sumber ke [target]. Best-effort: gagal diam-diam.
     * Dipanggil di semua jalur tulis EXIF agar tanggal foto tidak hilang saat kompres.
     */
    private fun copyDateTags(context: Context, srcUri: Uri, target: ExifInterface) {
        try {
            val source = openSourceExif(context, srcUri) ?: return
            DATE_TAGS.forEach { tag ->
                source.getAttribute(tag)?.let { target.setAttribute(tag, it) }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Gagal salin EXIF tanggal: ${e.message}")
        }
    }
}
