package com.jalankita.app

import android.app.Application
import androidx.work.Configuration
import com.jalankita.app.core.worker.LocationWorkerFactory
import dagger.hilt.android.HiltAndroidApp
import org.maplibre.android.MapLibre

/**
 * WAJIB: [MapLibre.getInstance] sebelum MapView mana pun dibuat —
 * tanpanya konstruktor MapView melempar MapLibreConfigurationException
 * (crash deterministik saat tab Peta dibuka).
 *
 * Prasyarat K8 (Fase 3): init WorkManager manual agar memakai
 * [LocationWorkerFactory] (tanpa dependensi hilt-work). Default
 * InitializationProvider dimatikan di AndroidManifest.
 */
@HiltAndroidApp
class DeltaJalanApplication : Application(), Configuration.Provider {
    override fun onCreate() {
        super.onCreate()
        MapLibre.getInstance(this)
    }

    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder()
            .setWorkerFactory(LocationWorkerFactory(this))
            .build()
}
