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
import java.io.File

/**
 * Uji isolasi: apakah androidx.exifinterface bisa baca GPS dari foto KAMERA ASLI
 * perangkat? Bila YA → masalah khusus pada file "fresh" (edited). Bila TIDAK →
 * masalah library/versi umum.
 */
@RunWith(AndroidJUnit4::class)
class ExifNativePhotoTest {

    private val ctx: Context get() = InstrumentationRegistry.getInstrumentation().targetContext
    private val TAG = "ExifNative"

    private fun report(label: String, exif: ExifInterface) {
        val ll = FloatArray(2)
        val got = exif.getLatLong(ll)
        Log.i(TAG, "$label: getLatLong=$got ll=${ll.toList()} " +
            "rawLat=${exif.getAttribute(ExifInterface.TAG_GPS_LATITUDE)} " +
            "rawRef=${exif.getAttribute(ExifInterface.TAG_GPS_LATITUDE_REF)} " +
            "dto=${exif.getAttribute(ExifInterface.TAG_DATETIME_ORIGINAL)}")
    }

    @Test
    fun nativeCameraPhotos() {
        // Semua foto di DCIM/Camera dari kamera asli (bukan file uji).
        val dir = File("/storage/emulated/0/DCIM/Camera")
        val files = dir.listFiles { f -> f.name.endsWith(".jpg") && !f.name.contains("test") }?.take(4) ?: emptyList()
        Log.i(TAG, "camera files: ${files.map { it.name }}")
        for (f in files) {
            try { report("CAMERA ${f.name}", ExifInterface(f.absolutePath)) }
            catch (e: Exception) { Log.w(TAG, "CAMERA ${f.name} EXC ${e.message}") }
        }

        // Bandingkan file uji (edited) — punya GPS menurut PIL.
        for (name in listOf("dcim_test.jpg", "canonical_test.jpg")) {
            val f = File(dir, name)
            if (f.exists()) {
                try { report("TEST $name", ExifInterface(f.absolutePath)) }
                catch (e: Exception) { Log.w(TAG, "TEST $name EXC ${e.message}") }
            }
        }
    }
}
