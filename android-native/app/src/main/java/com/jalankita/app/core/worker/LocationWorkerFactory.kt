package com.jalankita.app.core.worker

import android.content.Context
import androidx.work.ListenableWorker
import androidx.work.WorkerFactory
import androidx.work.WorkerParameters
import com.jalankita.app.core.data.OfflineReportQueue
import com.jalankita.app.core.data.TokenStore
import com.jalankita.app.core.data.WargaRepository
import com.jalankita.app.core.network.ApiService
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.android.EntryPointAccessors
import dagger.hilt.components.SingletonComponent
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking

/** EntryPoint agar WorkerFactory (bukan @HiltWorker) bisa memakai graph Hilt. */
@EntryPoint
@InstallIn(SingletonComponent::class)
interface LocationWorkerEntryPoint {
    fun api(): ApiService
    fun tokenStore(): TokenStore
    fun offlineQueue(): OfflineReportQueue
    fun wargaRepo(): WargaRepository
}

/**
 * Factory custom — prasyarat K8 rencana tanpa dependensi `hilt-work`:
 * WorkManager di-init manual via [com.jalankita.app.DeltaJalanApplication]
 * (default InitializationProvider dimatikan di manifest).
 */
class LocationWorkerFactory(
    private val appContext: Context,
) : WorkerFactory() {
    override fun createWorker(
        appContext: Context,
        workerClassName: String,
        workerParameters: WorkerParameters,
    ): ListenableWorker? {
        val entry = EntryPointAccessors.fromApplication(
            appContext, LocationWorkerEntryPoint::class.java,
        )
        return when (workerClassName) {
            LocationWorker::class.java.name -> {
                val token = runBlocking { entry.tokenStore().token.first() }
                LocationWorker(appContext, workerParameters, entry.api(), token)
            }
            ReportUploadWorker::class.java.name -> {
                ReportUploadWorker(appContext, workerParameters, entry.offlineQueue(), entry.wargaRepo())
            }
            else -> null
        }
    }
}
