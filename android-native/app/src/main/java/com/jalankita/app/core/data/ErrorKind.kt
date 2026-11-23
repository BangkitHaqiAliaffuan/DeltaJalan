package com.jalankita.app.core.data

import com.jalankita.app.core.data.outbox.QueuePolicy
import java.io.IOException

/**
 * Jenis kegagalan sebuah operasi jaringan.
 *
 * Sebelumnya pemanggil menebak "offline atau bukan" dari **teks pesan**
 * (`message.contains("koneksi"|"network"|"host")`). Cara itu gagal untuk pesan
 * bawaan OkHttp berbahasa Inggris seperti "Failed to connect to …:443", sehingga
 * laporan warga yang gagal terkirim saat sinyal hilang TIDAK masuk antrean
 * offline dan fotonya terbuang. Klasifikasi sekarang dilakukan sekali di
 * lapisan repository dan diteruskan sebagai tipe, bukan teks.
 */
enum class ErrorKind {
    /** Gangguan sementara: jaringan mati, timeout, server 5xx/408/429. Layak dicoba ulang. */
    NETWORK,

    /** Ditolak server: 4xx validasi/izin. Mencoba ulang tidak akan pernah berhasil. */
    SERVER,
}

/**
 * Klasifikasi dari exception yang tidak membawa kode HTTP (mis. IOException
 * dari OkHttp). Semua [IOException] — termasuk UnknownHostException,
 * ConnectException, SocketTimeoutException, dan SSLException — dianggap
 * gangguan sementara. Sisanya (Moshi/JSON, bug logika) dianggap permanen agar
 * antrean offline tidak berputar tanpa akhir.
 */
fun classifyFailure(e: Throwable): ErrorKind = when (e) {
    is IOException -> ErrorKind.NETWORK
    else -> ErrorKind.SERVER
}

/** Klasifikasi dari kode status HTTP. 408/425/429/5xx = sementara. */
fun classifyStatus(code: Int): ErrorKind = when {
    code >= 500 -> ErrorKind.NETWORK
    code == 408 || code == 425 || code == 429 -> ErrorKind.NETWORK
    else -> ErrorKind.SERVER
}

/**
 * Batas percobaan unggah ulang — **satu angka** dengan
 * [com.jalankita.app.core.data.outbox.QueuePolicy.MAX_ATTEMPTS].
 *
 * Dulu konstanta ini berdiri sendiri dan worker memakainya untuk memutuskan
 * "buang atau ulangi". Sekarang keputusan itu milik `QueuePolicy`; konstanta di
 * sini hanya alias supaya tidak ada dua batas yang bisa berbeda diam-diam.
 */
val MAX_UPLOAD_ATTEMPTS: Int = QueuePolicy.MAX_ATTEMPTS

/**
 * Putusan untuk satu item antrean offline: berhenti mencoba atau ulangi nanti.
 * Dipakai bersama oleh [com.jalankita.app.core.worker.InspectionUploadWorker]
 * dan [com.jalankita.app.core.worker.ReportUploadWorker] supaya aturannya satu.
 */
fun shouldGiveUp(error: DashboardResult.Error, retryCount: Int): Boolean =
    error.isPermanent || retryCount >= MAX_UPLOAD_ATTEMPTS

