package com.jalankita.app.core.util

import android.Manifest
import android.content.ContentResolver
import android.content.Context
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.DocumentsContract
import android.provider.MediaStore
import android.util.Log
import androidx.core.content.ContextCompat
import androidx.exifinterface.media.ExifInterface
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

/**
 * Validasi anti-fraud tanggal foto — replikasi PERSIS
 * Frontend-stable/src/lib/validatePhotoDate.ts (aturan + pesan identik).
 *
 * Aturan:
 *  1. Tidak ada metadata tanggal (EXIF)  → tolak (no_exif_date)
 *  2. Foto > MAX_AGE_DAYS hari yang lalu  → tolak (too_old)
 *  3. Tanggal foto di masa depan          → tolak (future_date)
 *  4. Gagal baca EXIF                     → tolak (exif_read_error)
 *  5. Lolos semua                         → valid
 *
 * Catatan: HANYA berlaku untuk foto dari galeri. Foto dari kamera langsung
 * (real-time) tidak divalidasi tanggalnya (lihat konsumen).
 */
object ExifValidator {

    const val MAX_AGE_DAYS = 2
    /** Batas umur foto laporan warga — kontrak: WargaReportController::MAX_PHOTO_AGE_DAYS. */
    const val MAX_AGE_DAYS_WARGA = 7

    private const val TAG = "ExifValidator"

    enum class Status { VALID, NO_EXIF_DATE, TOO_OLD, FUTURE_DATE, EXIF_READ_ERROR, NO_GPS }

    data class Result(
        val status: Status,
        val photoDateMillis: Long? = null,
        val ageDays: Int? = null,
        val title: String = "",
        val message: String = "",
        val lat: Double? = null,
        val lng: Double? = null,
    ) {
        val isValid: Boolean get() = status == Status.VALID
    }

    /** Baca EXIF dari Uri; tampilkan status tanggal + GPS. */
    fun validate(
        context: Context,
        uri: Uri,
        requireGps: Boolean = true,
        checkDate: Boolean = true,
        maxAgeDays: Int = MAX_AGE_DAYS,
    ): Result {
        // Buka EXIF dari stream yang SUDAH dibetulkan izinnya (setRequireOriginal)
        // bila ACCESS_MEDIA_LOCATION ada — meniru tryReadGps() di PhotoExifGpsPlugin.java.
        // Tanpa langkah ini, Android 10+ menghapus GPS (dan bisa juga tanggal) dari stream.
        val exif = openExif(context, uri) ?: return noExif()

        val rawDate = exif.getAttribute(ExifInterface.TAG_DATETIME_ORIGINAL)
            ?: exif.getAttribute(ExifInterface.TAG_DATETIME_DIGITIZED)
            ?: exif.getAttribute(ExifInterface.TAG_DATETIME)

        // Kamera real-time (checkDate=false): lewati semua validasi tanggal.
        if (checkDate) {
            if (rawDate.isNullOrBlank()) return noExif()

            val photoDate = parseExifDate(rawDate) ?: return Result(
                status = Status.EXIF_READ_ERROR,
                title = "Format Tanggal Tidak Terbaca",
                message = "Format tanggal pada metadata foto tidak dapat dibaca. " +
                    "Upload ditolak — gunakan foto asli dari kamera perangkat Anda.",
            )

            val ageDays = diffCalendarDays(photoDate, System.currentTimeMillis())

            if (ageDays < 0) {
                return Result(
                    status = Status.FUTURE_DATE,
                    photoDateMillis = photoDate,
                    ageDays = ageDays,
                    title = "Tanggal Foto Tidak Valid",
                    message = "Metadata foto menunjukkan tanggal pengambilan ${formatDateId(photoDate)}, " +
                        "yang merupakan tanggal di masa depan. Hal ini mengindikasikan metadata foto " +
                        "telah dimanipulasi. Gunakan foto asli yang diambil langsung dari kamera.",
                )
            }

            if (ageDays > maxAgeDays) {
                return Result(
                    status = Status.TOO_OLD,
                    photoDateMillis = photoDate,
                    ageDays = ageDays,
                    title = "Foto Terlalu Lama",
                    message = "Foto ini diambil pada ${formatDateId(photoDate)} ($ageDays hari yang lalu). " +
                        "Sistem hanya menerima foto yang diambil maksimal $maxAgeDays hari terakhir " +
                        "untuk memastikan laporan mencerminkan kondisi jalan terkini. " +
                        "Silakan ambil foto baru di lokasi kerusakan.",
                )
            }
        }

        // GPS (selalu divalidasi bila requireGps)
        val latLng = readGpsRobust(context, uri, exif)
        if (requireGps && latLng == null) {
            // Authority dicatat: pola kegagalan berbeda per sumber URI
            // (Photo Picker menolak requireOriginal; Downloads tak terindeks).
            Log.w(TAG, "NO_GPS uri=$uri authority=${uri.authority}")
            return Result(
                status = Status.NO_GPS,
                title = "Foto Tanpa Data Lokasi",
                message = "Foto ini tidak memiliki metadata lokasi (EXIF GPS). " +
                    "Aktifkan GPS pada perangkat Anda saat mengambil foto, " +
                    "atau gunakan kamera langsung untuk hasil terbaik.",
            )
        }

        return Result(
            status = Status.VALID,
            photoDateMillis = rawDate?.let { parseExifDate(it) },
            lat = latLng?.first,
            lng = latLng?.second,
        )
    }

    private fun noExif() = Result(
        status = Status.NO_EXIF_DATE,
        title = "Foto Tanpa Metadata",
        message = "Foto ini tidak memiliki metadata tanggal (EXIF), kemungkinan diunduh dari " +
            "internet atau merupakan screenshot. Upload ditolak — gunakan foto asli yang " +
            "diambil langsung dari kamera perangkat Anda.",
    )

    /**
     * Buka [ExifInterface] dari [uri] dengan cara yang MENGHORMATI Android 10+.
     *
     * Ini inti kesamaan dengan `PhotoExifGpsPlugin.tryReadGps(uri, requireOriginal)`:
     * bila izin `ACCESS_MEDIA_LOCATION` diberikan → bungkus URI dengan
     * `MediaStore.setRequireOriginal()` sebelum `openInputStream()`. Tanpa langkah ini,
     * stream dari DocumentsProvider/MediaStore mengembalikan EXIF TANPA GPS.
     *
     * Urutan: setRequireOriginal (bila diizinkan) → stream mentah → file path langsung.
     */
    private fun openExif(context: Context, uri: Uri): ExifInterface? {
        // 1. setRequireOriginal — jalur utama (sama seperti Capacitor).
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && hasMediaLocationPermission(context)) {
            tryOpen(context, MediaStore.setRequireOriginal(uri))?.let { return it }
            // URI hasil picker bisa DocumentsProvider; konversi dulu lalu coba lagi.
            convertToMediaStoreUri(uri)?.let { mediaUri ->
                tryOpen(context, MediaStore.setRequireOriginal(mediaUri))?.let { return it }
            }
        }

        // 2. Stream mentah (URI asli).
        tryOpen(context, uri)?.let { return it }

        Log.w(TAG, "Tidak bisa membuka EXIF untuk $uri")
        return null
    }

    private fun tryOpen(context: Context, uri: Uri): ExifInterface? = try {
        context.contentResolver.openInputStream(uri)?.use { ExifInterface(it) }
    } catch (e: Exception) {
        Log.w(TAG, "openInputStream gagal untuk $uri: ${e.message}")
        null
    }

    private fun hasMediaLocationPermission(context: Context): Boolean =
        ContextCompat.checkSelfPermission(
            context, Manifest.permission.ACCESS_MEDIA_LOCATION,
        ) == PackageManager.PERMISSION_GRANTED

    /**
     * GPS EXIF dengan rantai 4-attempt — port dari PhotoExifGpsPlugin.java
     * (Versi Capacitor yang terbukti berfungsi). Android 10+ MENGARANG (redact) tag GPS
     * dari stream `openInputStream()` kecuali diberi izin ACCESS_MEDIA_LOCATION;
     * `MediaStore.setRequireOriginal()` + query kolom MediaStore menembus redaksi ini.
     *
     *  D. Query kolom MediaStore LATITUDE/LONGITUDE  (bila MediaStore mengisinya)
     *  A. setRequireOriginal(uri) + stream           (butuh ACCESS_MEDIA_LOCATION)
     *  B. konversi DocumentsProvider→MediaStore + A  (URI picker Android 12)
     *  C. stream mentah (jalur lama)
     *
     * @param exif hasil baca awal; dipakai Attempt C agar tidak buka stream dua kali.
     */
    private fun readGpsRobust(context: Context, uri: Uri, exif: ExifInterface): Pair<Double, Double>? {
        // Attempt R — parser GPS RAW byte-level (kebal bug androidx.exifinterface).
        // Diuji di SM-A217F: exifinterface 1.3.7/1.4.1 GAGAL baca GPS dari file uji,
        // parser raw berhasil. Dicoba lebih dulu karena paling dapat diandalkan.
        rawGpsFromUri(context, uri)?.let {
            Log.d(TAG, "GPS attempt R (raw parser) → $it")
            return it
        }

        // Attempt D — query kolom MediaStore (bypass redaksi, tak butuh stream).
        mediaStoreColumnGps(context, uri)?.let {
            Log.d(TAG, "GPS attempt D (MediaStore column) → $it")
            return it
        }

        // Attempt A — setRequireOriginal pada URI asli.
        readGpsFromStream(context, uri, requireOriginal = true)?.let {
            Log.d(TAG, "GPS attempt A (setRequireOriginal) → $it")
            return it
        }

        // Attempt B — konversi DocumentsProvider URI → MediaStore URI, lalu A.
        val mediaUri = convertToMediaStoreUri(uri)
        if (mediaUri != null) {
            readGpsFromStream(context, mediaUri, requireOriginal = true)?.let {
                Log.d(TAG, "GPS attempt B (convert + setRequireOriginal) → $it")
                return it
            }
        }

        // Attempt C — stream yang sudah dibuka pemanggil (paling lemah).
        readGpsFromExif(exif)?.let {
            Log.d(TAG, "GPS attempt C (raw stream) → $it")
            return it
        }

        Log.w(TAG, "GPS EXIF tidak ditemukan untuk $uri (semua attempt gagal)")
        return null
    }

    /**
     * Attempt R — baca GPS via [RawExifGps] (parser byte-level mandiri).
     * Membuka stream (dengan setRequireOriginal bila memungkinkan) lalu parse TIFF.
     */
    private fun rawGpsFromUri(context: Context, uri: Uri): Pair<Double, Double>? {
        // Coba dengan setRequireOriginal (menembus redaksi) lalu tanpa itu.
        val targets = buildList {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) add(MediaStore.setRequireOriginal(uri))
            add(uri)
        }
        for (target in targets) {
            try {
                context.contentResolver.openInputStream(target)?.use { stream ->
                    RawExifGps.read(stream)?.let { return it }
                }
            } catch (e: Exception) {
                Log.w(TAG, "rawGpsFromUri gagal untuk $target: ${e.message}")
            }
        }
        return null
    }

    /** Baca GPS dari ExifInterface yang sudah ada (Attempt C). */
    private fun readGpsFromExif(exif: ExifInterface): Pair<Double, Double>? {
        exif.latLong?.let { ll ->
            if (isUsableCoord(ll[0], ll[1])) return ll[0] to ll[1]
        }
        return parseDmsPair(
            exif.getAttribute(ExifInterface.TAG_GPS_LATITUDE),
            exif.getAttribute(ExifInterface.TAG_GPS_LATITUDE_REF),
            exif.getAttribute(ExifInterface.TAG_GPS_LONGITUDE),
            exif.getAttribute(ExifInterface.TAG_GPS_LONGITUDE_REF),
        )
    }

    /** Buka [uri] (opsional lewat setRequireOriginal) → baca GPS (Attempt A/B). */
    private fun readGpsFromStream(
        context: Context,
        uri: Uri,
        requireOriginal: Boolean,
    ): Pair<Double, Double>? {
        if (requireOriginal && Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return null
        return try {
            val target = if (requireOriginal) MediaStore.setRequireOriginal(uri) else uri
            context.contentResolver.openInputStream(target)?.use { stream ->
                readGpsFromExif(ExifInterface(stream))
            }
        } catch (e: SecurityException) {
            Log.w(TAG, "SecurityException buka $uri (butuh ACCESS_MEDIA_LOCATION?): ${e.message}")
            null
        } catch (e: Exception) {
            Log.w(TAG, "Gagal baca EXIF stream $uri: ${e.message}")
            null
        }
    }

    /** Attempt D — kolom MediaStore.Images.Media.LATITUDE/LONGITUDE. */
    @Suppress("DEPRECATION")
    private fun mediaStoreColumnGps(context: Context, uri: Uri): Pair<Double, Double>? {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return null

        val mediaId = extractMediaStoreId(uri) ?: return null
        val projection = arrayOf(
            MediaStore.Images.Media.LATITUDE,
            MediaStore.Images.Media.LONGITUDE,
        )
        return try {
            context.contentResolver.query(
                MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                projection,
                "${MediaStore.Images.Media._ID} = ?",
                arrayOf(mediaId.toString()),
                null,
            )?.use { cursor ->
                if (cursor.moveToFirst()) {
                    val lat = cursor.getDouble(0)
                    val lng = cursor.getDouble(1)
                    if (isUsableCoord(lat, lng)) lat to lng else null
                } else {
                    null
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Query kolom MediaStore gagal: ${e.message}")
            null
        }
    }

    /** Ekstrak numeric MediaStore id dari URI DocumentsProvider / MediaStore. */
    @Suppress("DEPRECATION")
    private fun extractMediaStoreId(uri: Uri): Long? {
        if (uri.scheme != ContentResolver.SCHEME_CONTENT) return null
        return try {
            when (uri.authority) {
                "com.android.providers.media.documents" -> {
                    val docId = DocumentsContract.getDocumentId(uri)
                    val parts = docId.split(":")
                    if (parts.size < 2 || parts[0] != "image") return null
                    parts[1].toLongOrNull()
                }
                "media" -> uri.lastPathSegment?.toLongOrNull()
                else -> null
            }
        } catch (e: Exception) {
            Log.w(TAG, "extractMediaStoreId gagal: ${e.message}")
            null
        }
    }

    /** DocumentsProvider URI → MediaStore Images URI (Attempt B). */
    @Suppress("DEPRECATION")
    private fun convertToMediaStoreUri(uri: Uri): Uri? {
        if (uri.scheme != ContentResolver.SCHEME_CONTENT) return null
        if (uri.authority != "com.android.providers.media.documents") return null
        val id = extractMediaStoreId(uri) ?: return null
        return Uri.withAppendedPath(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, id.toString())
    }

    /** Koordinat usable: bukan null dan bukan (0,0) — 0,0 = "laut lepas Ghana", bukan Sidoarjo. */
    private fun isUsableCoord(lat: Double, lng: Double): Boolean =
        !(lat == 0.0 && lng == 0.0)

    /** Parse pasangan DMS + ref (fallback manual). */
    private fun parseDmsPair(
        latDms: String?, latRef: String?, lngDms: String?, lngRef: String?,
    ): Pair<Double, Double>? {
        val lat = parseCoordinate(latDms, latRef, "S") ?: return null
        val lng = parseCoordinate(lngDms, lngRef, "W") ?: return null
        return if (isUsableCoord(lat, lng)) lat to lng else null
    }

    private fun parseCoordinate(dms: String?, ref: String?, negativeRef: String): Double? {
        if (dms.isNullOrBlank()) return null
        val value = parseDms(dms) ?: return null
        return if (ref.equals(negativeRef, ignoreCase = true)) -value else value
    }

    /** Parse "51/1,15/1,2032/100" (derajat,menit,detik) → desimal. */
    private fun parseDms(dms: String): Double? {
        val parts = dms.split(",")
        if (parts.size < 3) return null
        fun frac(s: String): Double {
            val p = s.trim().split("/")
            return if (p.size == 2) p[0].trim().toDouble() / p[1].trim().toDouble() else s.trim().toDouble()
        }
        return try {
            frac(parts[0]) + frac(parts[1]) / 60.0 + frac(parts[2]) / 3600.0
        } catch (e: Exception) {
            null
        }
    }

    /** "YYYY:MM:DD HH:MM:SS" → epoch millis (tengah malam lokal). */
    private fun parseExifDate(raw: String): Long? {
        val normalized = raw.trim().replaceFirst(Regex("^(\\d{4}):(\\d{2}):(\\d{2})"), "$1-$2-$3")
        val fmt = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US)
        return try {
            fmt.parse(normalized)?.time
        } catch (e: Exception) {
            null
        }
    }

    /** Selisih hari kalender (strip jam) — replikasi diffDays(). */
    private fun diffCalendarDays(photoMillis: Long, nowMillis: Long): Int {
        val cal1 = Calendar.getInstance().apply { timeInMillis = photoMillis }
        val cal2 = Calendar.getInstance().apply { timeInMillis = nowMillis }
        val d1 = midnight(cal1)
        val d2 = midnight(cal2)
        return ((d2 - d1) / (1000L * 60 * 60 * 24)).toInt()
    }

    private fun midnight(cal: Calendar): Long {
        val c = cal.clone() as Calendar
        c.set(Calendar.HOUR_OF_DAY, 0)
        c.set(Calendar.MINUTE, 0)
        c.set(Calendar.SECOND, 0)
        c.set(Calendar.MILLISECOND, 0)
        return c.timeInMillis
    }

    private fun formatDateId(millis: Long): String {
        val f = SimpleDateFormat("d MMMM yyyy", Locale("id", "ID"))
        return f.format(java.util.Date(millis))
    }
}
