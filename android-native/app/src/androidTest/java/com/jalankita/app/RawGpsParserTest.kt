package com.jalankita.app

import android.content.Context
import android.util.Log
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.jalankita.app.core.util.RawExifGps
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

/**
 * Uji parser GPS EXIF RAW (byte-level) — pendekatan yang kebal terhadap bug
 * androidx.exifinterface pada file tertentu.
 */
@RunWith(AndroidJUnit4::class)
class RawGpsParserTest {
    private val TAG = "RawGpsTest"
    private val ctx: Context get() = InstrumentationRegistry.getInstrumentation().targetContext

    @Test
    fun parseRawGpsFromTestFiles() {
        val files = listOf(
            "/storage/emulated/0/DCIM/Camera/dcim_test.jpg",
            "/storage/emulated/0/DCIM/Camera/canonical_test.jpg",
            "/storage/emulated/0/DCIM/Camera/var_full.jpg",
        )
        var anyOk = false
        for (p in files) {
            val f = File(p)
            if (!f.exists()) { Log.w(TAG, "$p MISSING"); continue }
            val gps = RawExifGps.read(f.inputStream())
            Log.i(TAG, "$p -> $gps")
            if (gps != null) anyOk = true
        }
        assertTrue("Parser RAW gagal membaca GPS dari file uji", anyOk)
    }
}
