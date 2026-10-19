package com.jalankita.app.core.data

import android.content.Context
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
import java.util.UUID
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
    private val listType = Types.newParameterizedType(List::class.java, PendingWargaReport::class.java)
    private val adapter by lazy { moshi.adapter<List<PendingWargaReport>>(listType) }

    suspend fun enqueue(report: PendingWargaReport) = withContext(Dispatchers.IO) {
        val current = list().toMutableList()
        current.add(report)
        save(current)
        scheduleSync()
    }

    suspend fun list(): List<PendingWargaReport> = withContext(Dispatchers.IO) {
        if (!queueFile.exists()) return@withContext emptyList()
        try {
            val json = queueFile.readText()
            adapter.fromJson(json).orEmpty()
        } catch (_: Exception) {
            emptyList()
        }
    }

    suspend fun remove(id: String) = withContext(Dispatchers.IO) {
        val current = list().filterNot { it.id == id }
        save(current)
    }

    private fun save(items: List<PendingWargaReport>) {
        try {
            val json = adapter.toJson(items)
            queueFile.writeText(json)
        } catch (_: Exception) {
        }
    }

    fun scheduleSync() {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        val uploadWork = OneTimeWorkRequestBuilder<ReportUploadWorker>()
            .setConstraints(constraints)
            .build()

        WorkManager.getInstance(context).enqueueUniqueWork(
            "ReportUploadWorker",
            ExistingWorkPolicy.REPLACE,
            uploadWork,
        )
    }
}
