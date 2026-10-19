package com.jalankita.app

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import android.util.Log
import androidx.exifinterface.media.ExifInterface
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.jalankita.app.core.util.ExifValidator
import com.jalankita.app.core.util.ImageCompressor
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

/**
 * Diagnostik GPS EXIF di DEVICE nyata (SM-A217F, Android 12).
 *
 * Menjalankan:
 *   ./gradlew connectedDebugAndroidTest \
 *     -Pandroid.testInstrumentationRunnerArguments.class=com.jalankita.app.ExifGpsDeviceProbeTest
 *
 * Berbeda dari ExifGpsRegressionTest (yang pakai assumeTrue & di-skip), test ini
 * WAJIB: ia mencari file uji nyata lalu meng-assert GPS terbaca. Tujuannya
 * MEMBUKTIKAN perbaikan Bug A/B di perangkat.
 */
@RunWith(AndroidJUnit4::class)
class ExifGpsDeviceProbeTest {

    // CATATAN: GrantPermissionRule TIDAK dipakai karena ACCESS_MEDIA_LOCATION tidak
    // bisa di-grant via UiAutomation (SecurityException: Error granting runtime
    // permission). Izin diberikan lewat alur UI aplikasi / `adb shell pm grant`
    // sebelum test dijalankan.

    private val ctx: Context get() = InstrumentationRegistry.getInstrumentation().targetContext
    private val TAG = "ExifGpsProbe"

    /** Cari URI MediaStore untuk file uji "fresh" / "dcim_test" via _data path. */
    private fun findTestImage(): Pair<Uri, String>? {
        val want = listOf("dcim_test", "120048_fresh", "120255_fresh", "120300", "120623", "120638")
        ctx.contentResolver.query(
            MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
            arrayOf(MediaStore.Images.Media._ID, MediaStore.Images.Media.DISPLAY_NAME),
            null, null,
            "${MediaStore.Images.Media._ID} DESC",
        )?.use { c ->
            while (c.moveToNext()) {
                val name = c.getString(1) ?: continue
                if (want.any { name.contains(it) }) {
                    val uri = Uri.withAppendedPath(
                        MediaStore.Images.Media.EXTERNAL_CONTENT_URI, c.getLong(0).toString(),
                    )
                    return uri to name
                }
            }
        }
        return null
    }

    @Test
    fun probeGpsFromRealTestImage() {
        val aml = ctx.checkSelfPermission(Manifest.permission.ACCESS_MEDIA_LOCATION) ==
            PackageManager.PERMISSION_GRANTED
        Log.i(TAG, "ACCESS_MEDIA_LOCATION=$aml SDK=${Build.VERSION.SDK_INT}")

        val hit = findTestImage()
        Log.i(TAG, "test image found = $hit")
        assertTrue("File uji tidak ditemukan terindeks MediaStore", hit != null)

        val (uri, name) = hit!!

        // 1) Validasi penuh (tanggal + GPS) seperti alur aplikasi.
        val res = ExifValidator.validate(ctx, uri, requireGps = true, checkDate = true)
        Log.i(TAG, "validate($name) -> status=${res.status} lat=${res.lat} lng=${res.lng} " +
            "date=${res.photoDateMillis}")

        assertTrue(
            "GPS harus terbaca dari $name (status=${res.status})",
            res.lat != null && res.lng != null,
        )
        assertTrue("lat di luar Sidoarjo: ${res.lat}", res.lat!! in -7.65..-7.25)
        assertTrue("lng di luar Sidoarjo: ${res.lng}", res.lng!! in 112.50..112.95)

        // 2) Kompres → file hasil HARUS masih punya GPS (regresi Bug B).
        val out = ImageCompressor.compressToFile(
            ctx, uri, lat = res.lat, lng = res.lng, outName = "probe_compressed.jpg",
        )
        assertTrue("Kompresi gagal", out != null)

        val after = ExifValidator.validate(ctx, Uri.fromFile(out!!), requireGps = true, checkDate = false)
        Log.i(TAG, "setelah kompres -> lat=${after.lat} lng=${after.lng} (file=${out.length()} B)")
        assertTrue("GPS HILANG setelah kompres (Bug B)", after.lat != null && after.lng != null)
    }
}
