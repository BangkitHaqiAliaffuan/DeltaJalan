package com.jalankita.app

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.MediaStore
import android.util.Log
import androidx.exifinterface.media.ExifInterface
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Diagnostik mentah: buktikan APA yang sebenarnya dikembalikan MediaProvider
 * untuk tiap metode baca EXIF. Tidak pakai assert — hanya mencetak.
 */
@RunWith(AndroidJUnit4::class)
class ExifRawDiagTest {

    private val ctx: Context get() = InstrumentationRegistry.getInstrumentation().targetContext
    private val TAG = "ExifRawDiag"

    private fun dump(label: String, uri: Uri) {
        Log.i(TAG, "=== $label : $uri (aml=${
            ctx.checkSelfPermission(Manifest.permission.ACCESS_MEDIA_LOCATION) == PackageManager.PERMISSION_GRANTED
        }) ===")
        try {
            val stream = ctx.contentResolver.openInputStream(uri)
            if (stream == null) { Log.w(TAG, "  stream=NULL"); return }
            val exif = ExifInterface(stream)
            val ll = FloatArray(2)
            val got = exif.getLatLong(ll)
            Log.i(TAG, "  getLatLong=$got ll=${ll.toList()}")
            Log.i(TAG, "  lat=${exif.getAttribute(ExifInterface.TAG_GPS_LATITUDE)} ref=${exif.getAttribute(ExifInterface.TAG_GPS_LATITUDE_REF)}")
            Log.i(TAG, "  lng=${exif.getAttribute(ExifInterface.TAG_GPS_LONGITUDE)} ref=${exif.getAttribute(ExifInterface.TAG_GPS_LONGITUDE_REF)}")
            Log.i(TAG, "  dto=${exif.getAttribute(ExifInterface.TAG_DATETIME_ORIGINAL)} dt=${exif.getAttribute(ExifInterface.TAG_DATETIME)}")
            Log.i(TAG, "  make=${exif.getAttribute(ExifInterface.TAG_MAKE)} model=${exif.getAttribute(ExifInterface.TAG_MODEL)}")
            stream.close()
        } catch (e: Exception) {
            Log.w(TAG, "  EXC ${e.javaClass.simpleName}: ${e.message}")
        }
    }

    private fun findBySuffix(want: String): Uri? {
        var mediaUri: Uri? = null
        ctx.contentResolver.query(
            MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
            arrayOf(MediaStore.Images.Media._ID, MediaStore.Images.Media.DISPLAY_NAME),
            null, null, "${MediaStore.Images.Media._ID} DESC",
        )?.use { c ->
            while (c.moveToNext()) {
                if (c.getString(1).contains(want)) {
                    mediaUri = Uri.withAppendedPath(
                        MediaStore.Images.Media.EXTERNAL_CONTENT_URI, c.getLong(0).toString())
                }
            }
        }
        return mediaUri
    }

    @Test
    fun rawDiagnostics() {
        for (want in listOf("dcim_test", "canonical_test")) {
            val u = findBySuffix(want)
            if (u == null) { Log.w(TAG, "$want not found"); continue }
            dump("RAW $want", u)
            dump("REQUIRE_ORIGINAL $want", MediaStore.setRequireOriginal(u))
            // Kolom MediaStore
            val id = u.lastPathSegment!!
            ctx.contentResolver.query(
                MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                arrayOf(MediaStore.Images.Media.LATITUDE, MediaStore.Images.Media.LONGITUDE),
                "${MediaStore.Images.Media._ID}=?", arrayOf(id), null,
            )?.use { c ->
                if (c.moveToFirst()) Log.i(TAG, "COLUMNS $want: lat=${c.getDouble(0)} lng=${c.getDouble(1)}")
            }
        }

        // Baca langsung dari PATH filesystem (bypass MediaProvider) untuk kedua file.
        for (p in listOf(
            "/storage/emulated/0/DCIM/Camera/dcim_test.jpg",
            "/storage/emulated/0/DCIM/Camera/canonical_test.jpg",
        )) {
            try {
                val exif = ExifInterface(p)
                val ll = FloatArray(2)
                val got = exif.getLatLong(ll)
                Log.i(TAG, "FILEPATH $p getLatLong=$got ll=${ll.toList()} dto=${exif.getAttribute(ExifInterface.TAG_DATETIME_ORIGINAL)}")
            } catch (e: Exception) {
                Log.w(TAG, "FILEPATH $p EXC ${e.javaClass.simpleName}: ${e.message}")
            }
        }
    }
}
