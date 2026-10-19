package com.jalankita.app.core.worker

import android.content.Context
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

/**
 * Jadwal tracking GPS petugas — periodik 15 menit, hanya saat ada jaringan
 * dan baterai tidak sekarat. Unik per aplikasi; KEEP agar tidak ganda.
 * Dipanggil dari sesi petugas saja (MainScaffold); dihentikan saat logout.
 */
object LocationTracking {
    const val WORK_NAME = "location-tracking"

    fun start(context: Context) {
        val req = PeriodicWorkRequestBuilder<LocationWorker>(15, TimeUnit.MINUTES)
            .setConstraints(
                Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .setRequiresBatteryNotLow(true)
                    .build(),
            )
            .addTag(WORK_NAME)
            .build()
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            WORK_NAME,
            ExistingPeriodicWorkPolicy.KEEP,
            req,
        )
    }

    fun stop(context: Context) {
        WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
    }
}
