package com.jalankita.app

import android.util.Log
import androidx.exifinterface.media.ExifInterface
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

@RunWith(AndroidJUnit4::class)
class ExifVariantTest {
    private val TAG = "ExifVar"

    @Test
    fun variants() {
        val names = listOf(
            "dcim_test.jpg", "canonical_test.jpg",
            "var_full.jpg", "var_nodalt.jpg", "var_order2134.jpg",
        )
        for (n in names) {
            val f = File("/storage/emulated/0/DCIM/Camera/$n")
            if (!f.exists()) { Log.w(TAG, "$n MISSING"); continue }
            try {
                val e = ExifInterface(f.absolutePath)
                val ll = FloatArray(2)
                val got = e.getLatLong(ll)
                Log.i(TAG, "$n: getLatLong=$got ll=${ll.toList()} raw=${e.getAttribute(ExifInterface.TAG_GPS_LATITUDE)}")
            } catch (ex: Exception) {
                Log.w(TAG, "$n EXC ${ex.message}")
            }
        }
    }
}
