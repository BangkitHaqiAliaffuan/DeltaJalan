package com.jalankita.app.core.util

import android.content.Context
import android.net.Uri
import androidx.core.content.FileProvider
import androidx.exifinterface.media.ExifInterface
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Menyiapkan berkas tujuan untuk kamera bawaan perangkat.
 *
 * Kenapa lewat kamera, bukan galeri saja: foto yang diambil langsung membawa
 * EXIF GPS dari perangkat saat itu, sehingga lokasi hasil inspeksi benar-benar
 * terikat ke tempat petugas berdiri. Foto galeri bisa saja diambil berhari-hari
 * lalu di tempat lain — persis celah yang ditutup `InspectionPhotoGuard` di
 * server.
 *
 * Berkas ditulis ke `cacheDir` (dicakup `cache-path` di `res/xml/file_paths.xml`),
 * jadi tidak perlu izin penyimpanan dan tidak menyisakan sampah di galeri
 * pengguna. Aplikasi kamera menerima URI lewat FileProvider — `file://` sudah
 * dilarang sejak Android 7.
 */
object PhotoCapture {

    /** Berkas tujuan + URI yang diserahkan ke aplikasi kamera. */
    data class Target(val uri: Uri, val file: File)

    private const val FOLDER = "kamera"

    /**
     * Buat berkas kosong baru dan URI-nya.
     *
     * Nama memakai stempel waktu agar tiap pengambilan punya berkas sendiri;
     * memakai satu nama tetap membuat foto lama tertimpa sebelum sempat dibaca.
     */
    fun newTarget(context: Context, prefix: String = "INS"): Target {
        val folder = File(context.cacheDir, FOLDER).apply { mkdirs() }
        val file = File(folder, "${prefix}_${System.currentTimeMillis()}.jpg")
        file.createNewFile()

        val uri = FileProvider.getUriForFile(
            context,
            "${context.packageName}.fileprovider",
            file,
        )

        return Target(uri, file)
    }

    /** Hapus berkas sementara; aman dipanggil walau berkas sudah tidak ada. */
    fun discard(target: Target?) {
        runCatching { target?.file?.delete() }
    }

    /**
     * Apakah berkas hasil kamera sudah membawa koordinat EXIF.
     *
     * Dipakai untuk memutuskan **perlu stempel atau tidak**: EXIF dari aplikasi
     * kamera (bila ada) lebih kaya — akurasi, arah, altitude — jadi tidak boleh
     * ditimpa. Bernilai `false` untuk berkas yang tidak bisa dibaca sekaligus.
     */
    fun hasGps(file: File?): Boolean {
        if (file == null || !file.exists() || file.length() == 0L) return false
        return runCatching { ExifInterface(file).latLong != null }.getOrDefault(false)
    }

    /**
     * Tambal EXIF GPS + tanggal pengambilan ke berkas hasil kamera.
     *
     * Kenapa perlu: aplikasi kamera pihak ketiga tidak wajib menulis tag GPS
     * (`TakePicture` hanya menyerahkan URI). Tanpa tambalan ini, foto ditolak
     * `ExifValidator` dan petugas/warga tidak bisa menyelesaikan pelaporan
     * padahal lokasi perangkat menyala.
     *
     * Nilai yang **sudah ada tidak ditimpa**: GPS kamera lebih presisi, dan
     * tanggal kamera adalah waktu pengambilan sebenarnya. Tanggal hanya diisi
     * bila kosong, memakai [takenAt] (saat tombol kamera ditekan) supaya server
     * tetap bisa memeriksa umur foto.
     *
     * @return `true` bila berkas kini punya GPS dan tanggal (atau sudah punya).
     */
    fun stampLocation(
        file: File?,
        lat: Double,
        lng: Double,
        takenAt: Long = System.currentTimeMillis(),
    ): Boolean {
        if (file == null || !file.exists() || file.length() == 0L) return false
        if (!lat.isFinite() || !lng.isFinite()) return false
        return runCatching {
            val exif = ExifInterface(file)
            var berubah = false

            if (exif.latLong == null) {
                exif.setLatLong(lat, lng)
                berubah = true
            }

            // Server menolak foto tanpa tanggal (PHOTO_TOO_OLD / tanggal hilang),
            // dan kamera yang tidak menulis GPS biasanya juga tidak menulis tanggal.
            if (exif.getAttribute(ExifInterface.TAG_DATETIME_ORIGINAL).isNullOrBlank()) {
                val cap = formatExifDate(takenAt)
                exif.setAttribute(ExifInterface.TAG_DATETIME_ORIGINAL, cap)
                if (exif.getAttribute(ExifInterface.TAG_DATETIME).isNullOrBlank()) {
                    exif.setAttribute(ExifInterface.TAG_DATETIME, cap)
                }
                if (exif.getAttribute(ExifInterface.TAG_DATETIME_DIGITIZED).isNullOrBlank()) {
                    exif.setAttribute(ExifInterface.TAG_DATETIME_DIGITIZED, cap)
                }
                berubah = true
            }

            if (berubah) exif.saveAttributes()
            exif.latLong != null
        }.getOrDefault(false)
    }

    /**
     * Format tanggal yang diminta EXIF ("yyyy:MM:dd HH:mm:ss").
     *
     * Dipisah sebagai fungsi murni supaya formatnya bisa diuji tanpa perangkat;
     * salah format di sini membuat server menganggap tanggal foto tidak terbaca.
     */
    fun formatExifDate(millis: Long): String =
        SimpleDateFormat("yyyy:MM:dd HH:mm:ss", Locale.US).format(Date(millis))
}
