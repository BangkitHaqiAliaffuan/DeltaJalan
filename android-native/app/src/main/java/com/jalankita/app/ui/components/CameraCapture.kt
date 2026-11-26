package com.jalankita.app.ui.components

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.ContextCompat
import com.jalankita.app.core.util.DeviceLocation
import com.jalankita.app.core.util.PhotoCapture
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/** Pesan kegagalan jalur kamera — dipakai bersama semua form agar seragam. */
object CameraMessages {
    const val IZIN_KAMERA =
        "Izin kamera ditolak. Aktifkan izin Kamera di pengaturan aplikasi, atau pilih foto lewat Galeri."

    const val IZIN_LOKASI =
        "Izin lokasi ditolak, sehingga foto tidak bisa diberi koordinat. Aktifkan izin Lokasi, " +
            "atau pilih foto dari Galeri."

    const val LOKASI_GAGAL =
        "Lokasi perangkat belum terkunci, jadi foto tidak bisa ditandai koordinat. Nyalakan GPS " +
            "dan tunggu sebentar, atau pilih foto dari Galeri."

    const val STEMPEL_GAGAL =
        "Foto tidak dapat dibaca setelah diambil. Coba lagi, atau pilih foto dari Galeri."

    const val KAMERA_TIDAK_ADA =
        "Aplikasi kamera tidak tersedia di perangkat ini. Gunakan Galeri."
}

/**
 * Satu jalur kamera untuk seluruh formulir pelaporan.
 *
 * Sebelumnya setiap layar menulis sendiri-sendiri: form hasil inspeksi punya
 * jalur kamera, sementara form lapor warga dan petugas hanya menyebut "Kamera"
 * tetapi membuka galeri. Menyatukannya di sini membuat tiga hal selalu ikut:
 *
 * 1. **Izin** — `CAMERA` diminta runtime (manifest sudah mendeklarasikannya;
 *    tanpa izin, sistem menolak membuka aplikasi kamera), `ACCESS_FINE_LOCATION`
 *    diminta sekalian karena dibutuhkan untuk stempel koordinat.
 * 2. **Stempel GPS** — bila aplikasi kamera tidak menulis EXIF GPS (sering:
 *    pengaturan "tag lokasi" kamera mati), koordinat perangkat saat itu
 *    ditambahkan lewat [PhotoCapture.stampLocation]. EXIF kamera tidak ditimpa.
 * 3. **Kebersihan berkas** — berkas sementara di `cacheDir` dibuang bila
 *    pengambilan dibatalkan atau gagal.
 *
 * @param prefix awalan nama berkas (memudahkan penelusuran jenis form).
 * @param onPhoto dipanggil dengan URI berkas yang sudah valid dan berkoordinat.
 * @param onError dipanggil dengan pesan siap tampil saat jalur kamera gagal.
 * @return lambda untuk memulai pengambilan foto.
 */
@Composable
fun rememberCameraCapture(
    prefix: String,
    onPhoto: (Uri) -> Unit,
    onError: (String) -> Unit,
): () -> Unit {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var target by remember { mutableStateOf<PhotoCapture.Target?>(null) }

    val kamera = rememberLauncherForActivityResult(
        ActivityResultContracts.TakePicture(),
    ) { tersimpan ->
        val t = target
        target = null
        if (!tersimpan || t == null) {
            // Dibatalkan pengguna: jangan tinggalkan berkas kosong di cache.
            PhotoCapture.discard(t)
            return@rememberLauncherForActivityResult
        }
        scope.launch {
            // Pembacaan/penulisan EXIF + pencarian lokasi itu IO: jalankan di
            // Dispatchers.IO supaya UI tidak tersendat pada foto 5 MB. Callback
            // `onPhoto`/`onError` tetap kembali ke Main untuk memperbarui state.
            val galat = withContext(Dispatchers.IO) {
                if (PhotoCapture.hasGps(t.file)) {
                    null
                } else if (!DeviceLocation.hasPermission(context)) {
                    PhotoCapture.discard(t)
                    CameraMessages.IZIN_LOKASI
                } else {
                    val fix = DeviceLocation.current(context)
                    when {
                        fix == null -> {
                            PhotoCapture.discard(t)
                            CameraMessages.LOKASI_GAGAL
                        }
                        !PhotoCapture.stampLocation(t.file, fix.first, fix.second) -> {
                            PhotoCapture.discard(t)
                            CameraMessages.STEMPEL_GAGAL
                        }
                        else -> null
                    }
                }
            }
            if (galat == null) onPhoto(t.uri) else onError(galat)
        }
    }

    fun bukaKamera() {
        val t = PhotoCapture.newTarget(context, prefix)
        // Ditugaskan SEBELUM launch: hasil bisa kembali sangat cepat, dan
        // menugaskan setelah launch membuat callback membaca nilai lama.
        target = t
        try {
            kamera.launch(t.uri)
        } catch (_: Exception) {
            PhotoCapture.discard(t)
            target = null
            onError(CameraMessages.KAMERA_TIDAK_ADA)
        }
    }

    val izin = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) { hasil ->
        if (hasil[Manifest.permission.CAMERA] == true) {
            bukaKamera()
        } else {
            onError(CameraMessages.IZIN_KAMERA)
        }
    }

    return {
        val punyaKamera = ContextCompat.checkSelfPermission(
            context, Manifest.permission.CAMERA,
        ) == PackageManager.PERMISSION_GRANTED
        if (punyaKamera && DeviceLocation.hasPermission(context)) {
            bukaKamera()
        } else {
            izin.launch(
                arrayOf(
                    Manifest.permission.CAMERA,
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION,
                ),
            )
        }
    }
}

/** Cek izin kamera tanpa meminta (untuk menonaktifkan tombol bila perlu). */
fun hasCameraPermission(context: Context): Boolean =
    ContextCompat.checkSelfPermission(
        context, Manifest.permission.CAMERA,
    ) == PackageManager.PERMISSION_GRANTED
