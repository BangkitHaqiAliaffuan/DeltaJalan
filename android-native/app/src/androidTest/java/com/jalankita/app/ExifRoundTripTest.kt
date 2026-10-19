package com.jalankita.app

import android.content.Context
import android.net.Uri
import android.util.Log
import androidx.exifinterface.media.ExifInterface
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

/**
 * Round-trip: tulis GPS dengan ExifInterface ke file yang GAGAL dibaca, lalu baca
 * kembali. Juga bandingkan bila kita tulis tag mentah satu per satu.
 */
@RunWith(AndroidJUnit4::class)
class ExifRoundTripTest {

    private val ctx: Context get() = InstrumentationRegistry.getInstrumentation().targetContext
    private val TAG = "ExifRT"

    @Test
    fun roundTrip() {
        val src = File("/storage/emulated/0/DCIM/Camera/dcim_test.jpg")
        if (!src.exists()) { Log.w(TAG, "src missing"); return }

        // Salin ke cache lalu tulis GPS via setLatLong.
        val dst = File(ctx.cacheDir, "rt_test.jpg")
        src.inputStream().use { i -> dst.outputStream().use { o -> i.copyTo(o) } }

        val before = ExifInterface(dst.absolutePath)
        Log.i(TAG, "BEFORE: dto=${before.getAttribute(ExifInterface.TAG_DATETIME_ORIGINAL)} " +
            "lat=${before.getAttribute(ExifInterface.TAG_GPS_LATITUDE)}")

        // Tulis GPS via API tingkat tinggi.
        before.setLatLong(-7.442088, 112.727285)
        before.saveAttributes()

        val after = ExifInterface(dst.absolutePath)
        val ll = FloatArray(2)
        val got = after.getLatLong(ll)
        Log.i(TAG, "AFTER setLatLong: getLatLong=$got ll=${ll.toList()} " +
            "lat=${after.getAttribute(ExifInterface.TAG_GPS_LATITUDE)} " +
            "ref=${after.getAttribute(ExifInterface.TAG_GPS_LATITUDE_REF)}")

        // Tulis tag GPS mentah manual.
        val dst2 = File(ctx.cacheDir, "rt_manual.jpg")
        src.inputStream().use { i -> dst2.outputStream().use { o -> i.copyTo(o) } }
        val m = ExifInterface(dst2.absolutePath)
        m.setAttribute(ExifInterface.TAG_GPS_LATITUDE_REF, "S")
        m.setAttribute(ExifInterface.TAG_GPS_LATITUDE, "7/1,26/1,31517879/1000000")
        m.setAttribute(ExifInterface.TAG_GPS_LONGITUDE_REF, "E")
        m.setAttribute(ExifInterface.TAG_GPS_LONGITUDE, "112/1,43/1,38226719/1000000")
        m.saveAttributes()
        val a2 = ExifInterface(dst2.absolutePath)
        val ll2 = FloatArray(2)
        val got2 = a2.getLatLong(ll2)
        Log.i(TAG, "AFTER manual: getLatLong=$got2 ll=${ll2.toList()} " +
            "lat=${a2.getAttribute(ExifInterface.TAG_GPS_LATITUDE)}")

        // Buktikan file round-trip bisa dibaca PIL nanti (tarik ke host).
        Log.i(TAG, "rt_test path=${dst.absolutePath} size=${dst.length()}")
        Log.i(TAG, "rt_manual path=${dst2.absolutePath} size=${dst2.length()}")
    }
}
