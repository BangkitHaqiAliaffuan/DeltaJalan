package com.jalankita.app.ui

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.ContextCompat
import com.jalankita.app.core.util.MediaPermissions

private const val TAG = "GalleryPicker"

/**
 * Helper pemilih foto yang MENJAMIN izin MediaStore diminta lebih dulu, LALU
 * membuka picker — urutan yang benar.
 *
 * ## Kenapa dua launcher izin terpisah?
 * `ACCESS_MEDIA_LOCATION` (Android 10+) adalah *runtime* permission yang **tidak
 * menampilkan dialog** dan **tidak terlihat di Settings**. Bila digabung dalam satu
 * `RequestMultiplePermissions` bersama izin media biasa (yang menampilkan dialog),
 * hasil untuk ACCESS_MEDIA_LOCATION sering `false` tanpa interaksi pengguna —
 * sehingga GPS EXIF tetap ter-redact. Karena itu ia diminta pada launcher tersendiri.
 *
 * ## Kenapa picker baru dibuka di dalam callback izin?
 * Bila picker dibuka SEBELUM izin benar-benar diberikan, MediaProvider membuang tag
 * GPS dari stream `content://` (Android 10+). Jadi: minta izin → tunggu hasil →
 * baru `launchPicker()`.
 *
 * @param launchPicker blok yang memanggil `launcher.launch(...)`; dijalankan setelah
 *   semua izin selesai diproses (atau bila platform tidak butuh izin, API < 29).
 */
@Composable
fun rememberGalleryPickerLauncher(launchPicker: () -> Unit): () -> Unit {
    val context = LocalContext.current
    val latestLaunch = rememberUpdatedState(launchPicker)

    // 2) ACCESS_MEDIA_LOCATION — silent grant (tanpa dialog). Callback-nya langsung
    //    membuka picker (atau tidak, tak masalah; 4-attempt tetap dicoba).
    val locationPermLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        Log.i(TAG, "ACCESS_MEDIA_LOCATION granted=$granted")
        latestLaunch.value()
    }

    // 1) Izin media "terlihat" (READ_EXTERNAL_STORAGE / READ_MEDIA_IMAGES) — berdialog.
    //    Setelah selesai (apapun hasilnya), lanjut meminta ACCESS_MEDIA_LOCATION.
    val mediaPermLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) { _ ->
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
            ContextCompat.checkSelfPermission(
                context, Manifest.permission.ACCESS_MEDIA_LOCATION,
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            locationPermLauncher.launch(Manifest.permission.ACCESS_MEDIA_LOCATION)
        } else {
            latestLaunch.value()
        }
    }

    return remember(context) {
        {
            val required = MediaPermissions.required()
            val missingMedia = required.filter {
                // ACCESS_MEDIA_LOCATION ditangani launcher terpisah (silent).
                it != Manifest.permission.ACCESS_MEDIA_LOCATION &&
                    ContextCompat.checkSelfPermission(context, it) !=
                    PackageManager.PERMISSION_GRANTED
            }
            when {
                // API < 29: tidak ada redaksi GPS, tidak perlu izin.
                required.isEmpty() -> latestLaunch.value()

                // Izin media belum lengkap → minta (berdialog); callback lanjut ke lokasi.
                missingMedia.isNotEmpty() -> mediaPermLauncher.launch(missingMedia.toTypedArray())

                // Izin media OK → pastikan ACCESS_MEDIA_LOCATION → picker.
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
                    ContextCompat.checkSelfPermission(
                        context, Manifest.permission.ACCESS_MEDIA_LOCATION,
                    ) != PackageManager.PERMISSION_GRANTED ->
                    locationPermLauncher.launch(Manifest.permission.ACCESS_MEDIA_LOCATION)

                else -> latestLaunch.value()
            }
            Unit
        }
    }
}
