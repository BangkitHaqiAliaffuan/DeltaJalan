package com.jalankita.app.core.worker

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.jalankita.app.core.data.DashboardResult
import com.jalankita.app.core.data.DiscoveredReportRequest
import com.jalankita.app.core.data.InspectionRepository
import com.jalankita.app.core.data.InspectionSubmitRequest
import com.jalankita.app.core.data.UnauthorizedException
import com.jalankita.app.core.data.outbox.OutboxRepository
import com.jalankita.app.core.data.outbox.QueuePolicy
import com.jalankita.app.core.data.outbox.QueuedSubmission
import com.jalankita.app.core.notify.QueueNotifier
import kotlinx.coroutines.CancellationException
import java.io.File

/**
 * Mengunggah hasil inspeksi dan temuan lapangan yang tersimpan di antrean.
 *
 * Aturan sama dengan [ReportUploadWorker] (satu sumber: [QueuePolicy]).
 * Tambahan khusus inspeksi: foto bukti hanya diterima server bila umurnya
 * ≤2 hari, jadi item yang melewati batas ditandai kedaluwarsa oleh
 * [OutboxRepository.refresh] dan tidak pernah dikirim.
 */
class InspectionUploadWorker(
    private val appContext: Context,
    params: WorkerParameters,
    private val outbox: OutboxRepository,
    private val repository: InspectionRepository,
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result {
        outbox.refresh()
        val pending = outbox.pending().filter {
            it.kind == QueuedSubmission.KIND_INSPECTION_RESULT ||
                it.kind == QueuedSubmission.KIND_DISCOVERED_REPORT
        }
        if (pending.isEmpty()) return Result.success()

        var uploaded = 0
        var transient = 0
        var quotaBlocked = 0
        val failureReasons = mutableListOf<String>()

        for (item in pending) {
            if (item.isDiscoveredReport && item.sessionId.isNullOrBlank()) {
                failureReasons += "sesi patroli tidak ditemukan"
                outbox.markFailure(item.id, "Sesi patroli untuk temuan ini tidak ditemukan.")
                continue
            }
            val files = item.photoPaths.map(::File).filter(File::exists)
            if (files.isEmpty()) {
                failureReasons += "berkas foto hilang dari penyimpanan"
                outbox.markFailure(item.id, "Foto bukti hilang dari penyimpanan.")
                continue
            }

            val result = try {
                if (item.isDiscoveredReport) {
                    repository.createDiscoveredReport(
                        item.sessionId.orEmpty(),
                        DiscoveredReportRequest(
                            idempotencyKey = item.idempotencyKey,
                            roadName = item.roadName.orEmpty(),
                            district = item.district.orEmpty(),
                            latitude = item.latitude,
                            longitude = item.longitude,
                            description = item.notes,
                            photo = files.first(),
                        ),
                    )
                } else {
                    repository.submitResult(
                        item.assignmentId.orEmpty(),
                        InspectionSubmitRequest(
                            idempotencyKey = item.idempotencyKey,
                            condition = item.condition,
                            notes = item.notes,
                            kerusakanPanjang = item.kerusakanPanjang,
                            kerusakanLebar = item.kerusakanLebar,
                            kerusakanKedalaman = item.kerusakanKedalaman,
                            jenisPerkerasan = item.jenisPerkerasan,
                            kepadatanLaluLintas = item.kepadatanLaluLintas,
                            latitude = item.latitude,
                            longitude = item.longitude,
                            photos = files,
                        ),
                    )
                }
            } catch (_: UnauthorizedException) {
                outbox.markFailure(item.id, "Sesi berakhir, silakan masuk kembali.")
                failureReasons += "sesi berakhir"
                continue
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                val status = outbox.markFailure(
                    item.id,
                    e.message,
                    quotaBlocked = QueuePolicy.isQuotaError(null, e.message),
                )
                when (status) {
                    QueuedSubmission.STATUS_WAITING_QUOTA -> quotaBlocked++
                    QueuedSubmission.STATUS_FAILED,
                    QueuedSubmission.STATUS_EXPIRED,
                    -> failureReasons += (e.message ?: "gangguan berulang")
                    QueuedSubmission.STATUS_RETRYING,
                    QueuedSubmission.STATUS_PENDING,
                    -> transient++
                    else -> Unit
                }
                continue
            }

            when (result) {
                is DashboardResult.Success -> {
                    outbox.markUploaded(item.id)
                    uploaded++
                }
                is DashboardResult.Error -> {
                    val status = outbox.markFailure(
                        item.id,
                        result.message,
                        quotaBlocked = QueuePolicy.isQuotaError(null, result.message),
                    )
                    when (status) {
                        QueuedSubmission.STATUS_WAITING_QUOTA -> quotaBlocked++
                        QueuedSubmission.STATUS_FAILED,
                        QueuedSubmission.STATUS_EXPIRED,
                        -> failureReasons += result.message
                        QueuedSubmission.STATUS_RETRYING,
                        QueuedSubmission.STATUS_PENDING,
                        -> transient++
                        else -> Unit
                    }
                }
            }
        }

        if (uploaded > 0) {
            QueueNotifier.uploaded(
                appContext,
                QueueNotifier.ID_INSPECTION_UPLOADED,
                "Hasil Inspeksi Terkirim",
                "$uploaded hasil inspeksi offline berhasil dikirim.",
            )
        }
        if (failureReasons.isNotEmpty()) {
            QueueNotifier.failed(
                appContext,
                QueueNotifier.ID_INSPECTION_FAILED,
                failureReasons.size,
                failureReasons,
            )
        }
        if (quotaBlocked > 0) {
            QueueNotifier.waitingQuota(appContext, quotaBlocked)
            outbox.scheduleQuotaRetry(QueuePolicy.nextQuotaReset() - System.currentTimeMillis())
        }

        return if (transient > 0) Result.retry() else Result.success()
    }
}
