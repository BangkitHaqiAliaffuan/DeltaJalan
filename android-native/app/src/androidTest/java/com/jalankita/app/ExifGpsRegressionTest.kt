package com.jalankita.app

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.rule.GrantPermissionRule
import com.jalankita.app.core.util.ExifValidator
import com.jalankita.app.core.util.ImageCompressor
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Uji regresi GPS EXIF — memverifikasi [ExifValidator.validate] memulihkan GPS
 * pada kondisi nyata Android 10+ (tag GPS di-redact dari stream content://).
 *
 * Menjalankan:
 *   ./gradlew connectedDebugAndroidTest \
 *     -Pandroid.testInstrumentationRunnerArguments.class=com.jalankita.app.ExifGpsRegressionTest
 *
 * Izin diberikan otomatis via [GrantPermissionRule] (meniru alur picker aplikasi).
 * Prasyarat data: minimal 1 gambar ber-EXIF GPS terindeks MediaStore (mis. hasil kamera
 * di DCIM/Camera). Bila tidak ada, uji di-skip (assumeTrue) — bukan gagal.
 */
@RunWith(AndroidJUnit4::class)
class ExifGpsRegressionTest {

    /** Izin MediaStore yang dibutuhkan agar GPS tidak di-redact Android 10+. */
    @get:Rule
    val permissionRule: GrantPermissionRule = GrantPermissionRule.grant(
        Manifest.permission.ACCESS_MEDIA_LOCATION,
        Manifest.permission.READ_EXTERNAL_STORAGE,
        Manifest.permission.READ_MEDIA_IMAGES,
    )

    private val ctx: Context get() = InstrumentationRegistry.getInstrumentation().targetContext

    /** Gambar terindeks MediaStore (punya _id → bisa diuji Attempt D). */
    private fun indexedImageWithGps(): Pair<Long, String>? = try {
        ctx.contentResolver.query(
            MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
            arrayOf(MediaStore.Images.Media._ID, MediaStore.Images.Media.DISPLAY_NAME),
            null, null,
            "${MediaStore.Images.Media._ID} DESC",
        )?.use { c ->
            var found: Pair<Long, String>? = null
            var scanned = 0
            while (c.moveToNext() && scanned < 40 && found == null) {
                scanned++
                val id = c.getLong(0)
                val name = c.getString(1)
                val uri = Uri.withAppendedPath(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, id.toString())
                val res = ExifValidator.validate(ctx, uri, requireGps = false, checkDate = false)
                if (res.lat != null && res.lng != null) found = id to name
            }
            found
        }
    } catch (e: Exception) {
        null
    }

    @Test
    fun validatorRecoversGpsFromIndexedImage() {
        val granted = ctx.checkSelfPermission(Manifest.permission.ACCESS_MEDIA_LOCATION) ==
            PackageManager.PERMISSION_GRANTED
        android.util.Log.i(
            "ExifGpsReg", "ACCESS_MEDIA_LOCATION=$granted SDK=${Build.VERSION.SDK_INT}",
        )

        val hit = indexedImageWithGps()
        assumeTrue("Tidak ada gambar ber-GPS terindeks MediaStore — uji di-skip", hit != null)
        val (id, name) = hit!!

        val uri = Uri.withAppendedPath(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, id.toString())
        val res = ExifValidator.validate(ctx, uri, requireGps = true, checkDate = false)

        android.util.Log.i("ExifGpsReg", "validate($name id=$id) → lat=${res.lat} lng=${res.lng}")
        assertTrue("GPS harus terbaca (status=${res.status})", res.lat != null && res.lng != null)
        // Koordinat wajar Indonesia (bukan 0,0 / placeholder).
        assertTrue("lat di luar rentang wajar: ${res.lat}", res.lat!! in -11.0..6.0)
        assertTrue("lng di luar rentang wajar: ${res.lng}", res.lng!! in 95.0..141.0)
    }

    @Test
    fun compressorPreservesGpsAfterReencode() {
        val hit = indexedImageWithGps()
        assumeTrue("Tidak ada gambar ber-GPS terindeks MediaStore — uji di-skip", hit != null)
        val (id, name) = hit!!

        val uri = Uri.withAppendedPath(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, id.toString())
        val before = ExifValidator.validate(ctx, uri, requireGps = true, checkDate = false)
        assumeTrue("GPS sumber tidak terbaca, lewati", before.lat != null)

        val out = ImageCompressor.compressToFile(
            ctx, uri, lat = before.lat, lng = before.lng, outName = "regression_compressed.jpg",
        )
        assertTrue("Kompresi gagal", out != null)

        val after = ExifValidator.validate(ctx, Uri.fromFile(out), requireGps = true, checkDate = false)
        android.util.Log.i(
            "ExifGpsReg",
            "kompres: before=${before.lat},${before.lng} after=${after.lat},${after.lng}",
        )
        assertTrue("GPS hilang setelah kompres ($name)", after.lat != null && after.lng != null)
    }
}
