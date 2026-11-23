package com.jalankita.app

import android.app.Application
import androidx.work.Configuration
import coil.ImageLoader
import coil.disk.DiskCache
import coil.memory.MemoryCache
import com.jalankita.app.core.data.outbox.OutboxRepository
import com.jalankita.app.core.worker.LocationWorkerFactory
import dagger.hilt.android.HiltAndroidApp
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import org.maplibre.android.MapLibre
import javax.inject.Inject

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

    /**
     * Antrean kiriman. Dibaca sekali saat aplikasi start supaya item yang
     * sudah melewati tenggat langsung ditandai kedaluwarsa (foto inspeksi
     * hanya diterima server ≤2 hari) dan antrean versi lama ikut dipindahkan
     * ke penyimpanan baru.
     */
    @Inject lateinit var outbox: OutboxRepository

    private val appScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onCreate() {
        super.onCreate()
        MapLibre.getInstance(this)
        appScope.launch { outbox.refresh() }
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
