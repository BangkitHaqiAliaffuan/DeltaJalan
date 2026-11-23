package com.jalankita.app.core.data.outbox

import android.content.Context
import android.util.Log
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import com.jalankita.app.core.data.LegacyInspectionResult
import com.jalankita.app.core.data.LegacyWargaReport
import com.jalankita.app.core.data.TokenStore
import com.jalankita.app.core.worker.InspectionUploadWorker
import com.jalankita.app.core.worker.ReportUploadWorker
import com.squareup.moshi.Moshi
import com.squareup.moshi.Types
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import java.io.File
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Satu-satunya penulis antrean kiriman. Semua UI dan worker lewat sini —
 * tidak ada lagi akses berkas langsung dari tempat lain.
 *
 * Kenapa satu tempat: sebelumnya dua kelas antrean menulis berkas sendiri-sendiri
 * dengan aturan berbeda (satu atomik + mutex, satu tidak). Akibatnya berkas bisa
 * terpotong dan seluruh antrean hilang. Lihat [OutboxStore] untuk jaminan tulis.
 */
@Singleton
class OutboxRepository @Inject constructor(
    @ApplicationContext private val context: Context,
    private val moshi: Moshi,
    private val tokenStore: TokenStore,
) {
    private val tag = "OutboxRepository"
    private val store = OutboxStore(context.filesDir, moshi)
    private val mutex = Mutex()

    private val _snapshot = MutableStateFlow<List<QueuedSubmission>>(emptyList())

    /** Antrean sudah dibaca dari disk pada proses ini. */
    @Volatile private var sudahDimuat = false
    val snapshot: StateFlow<List<QueuedSubmission>> = _snapshot.asStateFlow()

    /** Item yang masih boleh dikirim (bukan kedaluwarsa). */
    suspend fun pending(): List<QueuedSubmission> {
        val items = snapshotItems()
        val userId = currentUserId()
        return items.filter { !it.isFailed && isOwnedBy(it, userId) }
    }

    suspend fun pending(kind: String): List<QueuedSubmission> =
        pending().filter { it.kind == kind }

    /** Semua item milik pengguna aktif, termasuk yang gagal (untuk layar antrean). */
    suspend fun owned(): List<QueuedSubmission> {
        val userId = currentUserId()
        return snapshotItems().filter { isOwnedBy(it, userId) }
    }

    suspend fun refresh() = withContext(Dispatchers.IO) {
        mutex.withLock {
            val loaded = store.load()
            if (loaded.corrupted) {
                Log.w(tag, "Berkas antrean rusak; ${loaded.items.size} item diselamatkan")
            }
            val imported = importLegacyIfNeeded(loaded.items, currentUserId())
            val expired = markExpired(imported, System.currentTimeMillis())
            if (expired.second || loaded.corrupted) store.save(expired.first)
            _snapshot.value = expired.first
            sudahDimuat = true
        }
        Unit
    }

    /**
     * Simpan kiriman ke antrean. [photos] disalin ke penyimpanan permanen —
     * foto di `cacheDir` boleh dibersihkan OS kapan saja, dan item antrean yang
     * kehilangan fotonya tidak bisa dikirim lagi.
     */
    suspend fun enqueue(item: QueuedSubmission, photos: List<File> = emptyList()): Boolean =
        withContext(Dispatchers.IO) {
            mutex.withLock {
                val current = store.load().items.toMutableList()
                if (current.any { it.idempotencyKey == item.idempotencyKey }) {
                    // Sudah ada (kirim ganda karena UI dobel-tap) — jangan duplikat.
                    _snapshot.value = current
                    return@withLock true
                }
                if (current.size >= QueuePolicy.MAX_ITEMS) {
                    Log.w(tag, "Antrean penuh (${QueuePolicy.MAX_ITEMS} item), kiriman ditolak")
                    return@withLock false
                }
                val storedPaths = store.copyPhotos(item.id, photos)
                val stored = item.copy(
                    // Pemilik dicap di sini supaya antrean satu akun tidak pernah
                    // terkirim memakai sesi akun lain setelah berganti pengguna.
                    userId = item.userId ?: currentUserId(),
                    photoPaths = storedPaths,
                    expiresAt = if (item.expiresAt > 0L) item.expiresAt else
                        QueuePolicy.expiresAt(item.kind, item.photoTakenAt, item.createdAt),
                    status = QueuedSubmission.STATUS_PENDING,
                )
                current.add(stored)
                val ok = store.save(current)
                if (!ok) store.deletePhotos(storedPaths)
                _snapshot.value = current
                if (ok) scheduleSync()
                ok
            }
        }

    /** Server menerima item — hapus dari antrean beserta fotonya. */
    suspend fun markUploaded(id: String) = mutate(id) { items, target ->
        store.deletePhotos(target.photoPaths)
        items.removeAll { it.id == id }
        items
    }

    /** Percobaan berikutnya; status ditentukan [QueuePolicy.statusAfterFailure]. */
    suspend fun markFailure(
        id: String,
        message: String?,
        errorCode: String? = null,
        quotaBlocked: Boolean = false,
    ): String? = withContext(Dispatchers.IO) {
        var resulting: String? = null
        mutex.withLock {
            val items = store.load().items.toMutableList()
            val target = items.firstOrNull { it.id == id }
            if (target == null) {
                _snapshot.value = items
                return@withLock
            }
            val status = QueuePolicy.statusAfterFailure(
                target, errorCode, message, quotaBlocked = quotaBlocked,
            )
            val expired = status == QueuedSubmission.STATUS_EXPIRED
            if (expired) store.deletePhotos(target.photoPaths)
            val updated = target.copy(
                status = status,
                attempts = if (QueuePolicy.countsAsAttempt(status)) target.attempts + 1 else target.attempts,
                lastError = message ?: target.lastError,
                lastErrorCode = errorCode ?: target.lastErrorCode,
                photoPaths = if (expired) emptyList() else target.photoPaths,
            )
            for (index in items.indices) if (items[index].id == id) items[index] = updated
            store.save(items)
            _snapshot.value = items
            resulting = status
        }
        resulting
    }

    /** Pengguna membatalkan satu item. */
    suspend fun cancel(id: String) = mutate(id) { items, target ->
        store.deletePhotos(target.photoPaths)
        items.removeAll { it.id == id || it.idempotencyKey == target.idempotencyKey }
        items
    }

    /** Coba kirim sekarang: bersihkan status gagal lalu jalankan worker. */
    suspend fun retryNow(id: String? = null) = withContext(Dispatchers.IO) {
        mutex.withLock {
            val items = store.load().items.toMutableList()
            for (index in items.indices) {
                val item = items[index]
                val matches = id == null || item.id == id
                if (matches && item.status != QueuedSubmission.STATUS_EXPIRED) {
                    items[index] = item.copy(
                        status = QueuedSubmission.STATUS_PENDING,
                        attempts = 0,
                        lastError = null,
                    )
                }
            }
            store.save(items)
            _snapshot.value = items
        }
        scheduleSync()
    }

    /**
     * Tunda unggah sampai kuota harian server direset (tengah malam WIB).
     * Batas harian warga 5 laporan/hari; mengulang terus hanya membakar
     * percobaan lalu item dibuang padahal besok pasti berhasil.
     */
    fun scheduleQuotaRetry(delayMs: Long) {
        val delay = delayMs.coerceIn(60_000L, 12L * 60L * 60L * 1000L)
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()
        val wm = WorkManager.getInstance(context)
        wm.enqueueUniqueWork(
            WORK_QUOTA_WARGA,
            ExistingWorkPolicy.KEEP,
            OneTimeWorkRequestBuilder<ReportUploadWorker>()
                .setConstraints(constraints)
                .setInitialDelay(delay, TimeUnit.MILLISECONDS)
                .build(),
        )
        wm.enqueueUniqueWork(
            WORK_QUOTA_INSPECTION,
            ExistingWorkPolicy.KEEP,
            OneTimeWorkRequestBuilder<InspectionUploadWorker>()
                .setConstraints(constraints)
                .setInitialDelay(delay, TimeUnit.MILLISECONDS)
                .build(),
        )
    }

    fun scheduleSync() {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()
        val wm = WorkManager.getInstance(context)
        wm.enqueueUniqueWork(
            "ReportUploadWorker",
            ExistingWorkPolicy.REPLACE,
            OneTimeWorkRequestBuilder<ReportUploadWorker>()
                .setConstraints(constraints)
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
                .build(),
        )
        wm.enqueueUniqueWork(
            "InspectionUploadWorker",
            ExistingWorkPolicy.REPLACE,
            OneTimeWorkRequestBuilder<InspectionUploadWorker>()
                .setConstraints(constraints)
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
                .build(),
        )
    }

    // ── Internal ─────────────────────────────────────────────────────────

    private suspend fun snapshotItems(): List<QueuedSubmission> {
        // Dibaca sekali per proses; setiap perubahan sudah memperbarui snapshot.
        if (!sudahDimuat) refresh()
        return _snapshot.value
    }

    private suspend fun mutate(
        id: String,
        block: (MutableList<QueuedSubmission>, QueuedSubmission) -> MutableList<QueuedSubmission>,
    ) = withContext(Dispatchers.IO) {
        mutex.withLock {
            val current = store.load().items.toMutableList()
            val target = current.firstOrNull { it.id == id }
            if (target == null) {
                _snapshot.value = current
                return@withLock
            }
            val next = block(current, target)
            store.save(next)
            _snapshot.value = next
        }
        Unit
    }

    private fun isOwnedBy(item: QueuedSubmission, userId: String?): Boolean =
        QueuePolicy.belongsTo(item.userId, userId)

    private suspend fun currentUserId(): String? =
        runCatching { tokenStore.userId.first() }.getOrNull()

    private fun markExpired(items: List<QueuedSubmission>, now: Long): Pair<List<QueuedSubmission>, Boolean> {
        var changed = false
        val next = items.map { item ->
            if (item.status != QueuedSubmission.STATUS_EXPIRED && item.expiresAt in 1..now) {
                changed = true
                item.copy(status = QueuedSubmission.STATUS_EXPIRED, lastError = QueuePolicy.expiredMessage(item.kind))
            } else {
                item
            }
        }
        return next to changed
    }

    /** Impor berkas antrean versi lama agar kiriman pengguna tidak hilang saat pembaruan. */
    private fun importLegacyIfNeeded(
        existing: List<QueuedSubmission>,
        ownerId: String?,
    ): List<QueuedSubmission> {
        val legacyWarga = File(context.filesDir, "pending_warga_reports.json")
        val legacyInspection = File(context.filesDir, "pending_inspection_results.json")
        if (!legacyWarga.exists() && !legacyInspection.exists()) return existing

        val result = existing.toMutableList()
        val wargaAdapter = moshi.adapter<List<LegacyWargaReport>>(
            Types.newParameterizedType(List::class.java, LegacyWargaReport::class.java),
        )
        val inspectionAdapter = moshi.adapter<List<LegacyInspectionResult>>(
            Types.newParameterizedType(List::class.java, LegacyInspectionResult::class.java),
        )

        runCatching {
            val old = wargaAdapter.fromJson(legacyWarga.readText()).orEmpty()
            old.filterNotNull().forEach { report ->
                val moved = store.copyPhotos(report.id, report.photoPaths.map(::File))
                result += QueuedSubmission(
                    id = report.id,
                    kind = QueuedSubmission.KIND_WARGA_REPORT,
                    userId = ownerId,
                    idempotencyKey = report.id,
                    createdAt = report.createdAt,
                    expiresAt = QueuePolicy.expiresAt(
                        QueuedSubmission.KIND_WARGA_REPORT, null, report.createdAt,
                    ),
                    photoPaths = moved.ifEmpty { report.photoPaths },
                    reporterName = report.reporterName,
                    roadName = report.roadName,
                    district = report.district,
                    description = report.description,
                    fullAddress = report.fullAddress,
                    panjang = report.panjang,
                    lebar = report.lebar,
                    latitude = report.latitude,
                    longitude = report.longitude,
                    attempts = report.retryCount,
                    lastError = report.lastError,
                )
            }
            legacyWarga.delete()
        }

        runCatching {
            val old = inspectionAdapter.fromJson(legacyInspection.readText()).orEmpty()
            old.filterNotNull().forEach { item ->
                val kind = if (item.discovered) {
                    QueuedSubmission.KIND_DISCOVERED_REPORT
                } else {
                    QueuedSubmission.KIND_INSPECTION_RESULT
                }
                val moved = store.copyPhotos(item.id, item.photoPaths.map(::File))
                result += QueuedSubmission(
                    id = item.id,
                    kind = kind,
                    userId = ownerId,
                    idempotencyKey = item.idempotencyKey,
                    createdAt = item.createdAt,
                    expiresAt = QueuePolicy.expiresAt(kind, null, item.createdAt),
                    photoPaths = moved.ifEmpty { item.photoPaths },
                    assignmentId = item.assignmentId,
                    sessionId = item.sessionId,
                    condition = item.condition,
                    notes = item.notes,
                    kerusakanPanjang = item.kerusakanPanjang,
                    kerusakanLebar = item.kerusakanLebar,
                    kerusakanKedalaman = item.kerusakanKedalaman,
                    jenisPerkerasan = item.jenisPerkerasan,
                    kepadatanLaluLintas = item.kepadatanLaluLintas,
                    roadName = item.roadName,
                    district = item.district,
                    latitude = item.latitude,
                    longitude = item.longitude,
                    attempts = item.retryCount,
                    lastError = item.lastError,
                )
            }
            legacyInspection.delete()
        }

        return result
    }

    companion object {
        private const val WORK_QUOTA_WARGA = "QuotaRetryWarga"
        private const val WORK_QUOTA_INSPECTION = "QuotaRetryInspection"
    }
}
