package com.jalankita.app.core.data

import android.content.Context
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import com.jalankita.app.core.worker.InspectionUploadWorker
import com.squareup.moshi.JsonClass
import com.squareup.moshi.Moshi
import com.squareup.moshi.Types
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import java.io.File
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

@JsonClass(generateAdapter = true)
data class PendingInspectionResult(
    val id: String = UUID.randomUUID().toString(),
    val assignmentId: String,
    val sessionId: String?,
    val condition: String?,
    val notes: String?,
    // Dimensi hasil ukur petugas (meter), ikut disimpan agar tidak hilang saat
    // submit dilakukan offline lalu dikirim ulang oleh worker.
    val kerusakanPanjang: Double? = null,
    val kerusakanLebar: Double? = null,
    val kerusakanKedalaman: Double? = null,
    val roadName: String? = null,
    val district: String? = null,
    val discovered: Boolean = false,
    val latitude: Double?,
    val longitude: Double?,
    val photoPaths: List<String>,
    val idempotencyKey: String,
    val retryCount: Int = 0,
    val lastError: String? = null,
    val terminal: Boolean = false,
    val createdAt: Long = System.currentTimeMillis(),
)

@Singleton
class OfflineInspectionQueue @Inject constructor(
    @ApplicationContext private val context: Context,
    private val moshi: Moshi,
) {
    private val queueFile = File(context.filesDir, "pending_inspection_results.json")
    private val listType = Types.newParameterizedType(List::class.java, PendingInspectionResult::class.java)
    private val adapter by lazy { moshi.adapter<List<PendingInspectionResult>>(listType) }
    private val mutex = Mutex()

    suspend fun enqueue(item: PendingInspectionResult) = mutex.withLock {
        withContext(Dispatchers.IO) {
            val current = readItems().filterNot { it.idempotencyKey == item.idempotencyKey }.toMutableList()
            current.add(item)
            save(current)
            scheduleSync()
        }
    }

    suspend fun list(): List<PendingInspectionResult> = mutex.withLock {
        withContext(Dispatchers.IO) { readItems() }
    }

    suspend fun remove(id: String) = mutex.withLock {
        withContext(Dispatchers.IO) { save(readItems().filterNot { it.id == id }) }
    }

    suspend fun update(item: PendingInspectionResult) = mutex.withLock {
        withContext(Dispatchers.IO) { save(readItems().map { if (it.id == item.id) item else it }) }
    }

    private fun readItems(): List<PendingInspectionResult> {
        if (!queueFile.exists()) return emptyList()
        return runCatching { adapter.fromJson(queueFile.readText()).orEmpty() }.getOrDefault(emptyList())
    }

    private fun save(items: List<PendingInspectionResult>) {
        val encoded = adapter.toJson(items)
        val temp = File(queueFile.parentFile, "${queueFile.name}.tmp")
        temp.writeText(encoded)
        if (!temp.renameTo(queueFile)) {
            queueFile.writeText(encoded)
            temp.delete()
        }
    }

    fun scheduleSync() {
        val request = OneTimeWorkRequestBuilder<InspectionUploadWorker>()
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .build()
        WorkManager.getInstance(context).enqueueUniqueWork(
            "InspectionUploadWorker",
            // REPLACE (sama seperti OfflineReportQueue): worker membaca antrean
            // sekali di awal, jadi item yang masuk saat worker lain masih
            // berjalan tidak akan terkirim bila memakai KEEP. Worker idempoten
            // lewat `idempotency_key`, jadi aman dibatalkan lalu dijalankan ulang.
            ExistingWorkPolicy.REPLACE,
            request,
        )
    }
}
