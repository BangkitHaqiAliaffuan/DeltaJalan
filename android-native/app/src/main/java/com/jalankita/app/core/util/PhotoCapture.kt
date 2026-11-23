package com.jalankita.app.core.util

import android.content.Context
import android.net.Uri
import androidx.core.content.FileProvider
import java.io.File

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
}
