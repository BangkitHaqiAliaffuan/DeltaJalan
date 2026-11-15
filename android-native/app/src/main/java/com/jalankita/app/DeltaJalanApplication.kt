package com.jalankita.app

import android.app.Application
import androidx.work.Configuration
import coil.ImageLoader
import coil.disk.DiskCache
import coil.memory.MemoryCache
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
 *
 * [ImageLoader] global: cache memori 25% + disk 250 MB dan
 * `respectCacheHeaders(false)`, karena `/storage/` di prod tidak mengirim
 * `Cache-Control` sehingga loader default bisa membuang thumbnail setiap kali.
 */
@HiltAndroidApp
class DeltaJalanApplication : Application(), Configuration.Provider {
    override fun onCreate() {
        super.onCreate()
        MapLibre.getInstance(this)
        coil.Coil.setImageLoader(
            ImageLoader.Builder(this)
                .memoryCache {
                    MemoryCache.Builder(this).maxSizePercent(0.25).build()
                }
                .diskCache {
                    DiskCache.Builder()
                        .directory(cacheDir.resolve("image_cache"))
                        .maxSizeBytes(250L * 1024 * 1024)
                        .build()
                }
                .respectCacheHeaders(false)
                .crossfade(180)
                .build(),
        )
    }

    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder()
            .setWorkerFactory(LocationWorkerFactory(this))
            .build()
}
