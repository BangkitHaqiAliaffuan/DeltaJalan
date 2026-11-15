package com.jalankita.app.core.data

import android.content.Context
import android.util.Log
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import com.jalankita.app.core.worker.ReportUploadWorker
import com.squareup.moshi.JsonClass
import com.squareup.moshi.Moshi
import com.squareup.moshi.Types
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.IOException
import java.util.UUID
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton

@JsonClass(generateAdapter = true)
data class PendingWargaReport(
    val id: String = UUID.randomUUID().toString(),
    val reporterName: String,
    val roadName: String,
    val district: String,
    val latitude: Double,
    val longitude: Double,
    val description: String?,
    val panjang: Double?,
    val lebar: Double?,
    val fullAddress: String?,
    val photoPaths: List<String>,
    val createdAt: Long = System.currentTimeMillis(),
)

@Singleton
class OfflineReportQueue @Inject constructor(
    @ApplicationContext private val context: Context,
    private val moshi: Moshi,
) {
    private val queueFile = File(context.filesDir, "pending_warga_reports.json")
    private val TAG = "OfflineReportQueue"
    private val listType = Types.newParameterizedType(List::class.java, PendingWargaReport::class.java)
    private val adapter by lazy { moshi.adapter<List<PendingWargaReport>>(listType) }

    suspend fun enqueue(report: PendingWargaReport) = withContext(Dispatchers.IO) {
        val current = list().toMutableList()
        current.add(report)
        // Jangan klaim "tersimpan offline" bila penulisan gagal (disk penuh/
        // izin): lempar agar UI memberi tahu pengguna, bukan menelan diam-diam.
        if (!save(current)) {
            throw IOException("Laporan gagal disimpan di perangkat. Coba lagi.")
        }
        scheduleSync()
    }

    suspend fun list(): List<PendingWargaReport> = withContext(Dispatchers.IO) {
        if (!queueFile.exists()) return@withContext emptyList()
        try {
            val json = queueFile.readText()
            adapter.fromJson(json).orEmpty()
        } catch (_: Exception) {
            // Berkas antrian korup: JANGAN diam-diam dianggap kosong —
            // save() berikutnya akan menimpa dan menghapus laporan tertahan.
            // Simpan sebagai .corrupt agar data tidak hilang tanpa jejak.
            runCatching {
                val backup = File(context.filesDir, "pending_warga_reports.corrupt.json")
                backup.delete()
                queueFile.renameTo(backup)
            }
            emptyList()
        }
    }

    suspend fun remove(id: String) = withContext(Dispatchers.IO) {
        val current = list().filterNot { it.id == id }
        if (!save(current)) {
            // Item sudah terkirim; kegagalan tulis hanya berarti antrian perlu
            // dibersihkan lagi — beri jejak di log, jangan gagalkan worker.
            Log.w(TAG, "Gagal menulis antrian setelah menghapus $id.")
        }
    }

    /** @return true bila antrian berhasil ditulis ke disk. */
    private fun save(items: List<PendingWargaReport>): Boolean {
        return try {
            val json = adapter.toJson(items)
            queueFile.writeText(json)
            true
        } catch (e: Exception) {
            Log.w(TAG, "Gagal menyimpan antrian laporan offline: ${e.message}")
            false
        }
    }

    fun scheduleSync() {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        // Backoff eksponensial: worker mengembalikan Result.retry() saat
        // upload gagal karena jaringan/server, sehingga WorkManager mencoba
        // lagi bertahap (30s → 1m → 2m → …, maks 5 jam) alih-alih laporan hilang.
        val uploadWork = OneTimeWorkRequestBuilder<ReportUploadWorker>()
            .setConstraints(constraints)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            .build()

        WorkManager.getInstance(context).enqueueUniqueWork(
            "ReportUploadWorker",
            ExistingWorkPolicy.REPLACE,
            uploadWork,
        )
    }
}
