package com.jalankita.app.core.worker

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.jalankita.app.core.data.DashboardResult
import com.jalankita.app.core.data.UnauthorizedException
import com.jalankita.app.core.data.WargaRepository
import com.jalankita.app.core.data.WargaSubmitException
import com.jalankita.app.core.data.outbox.OutboxRepository
import com.jalankita.app.core.data.outbox.QueuePolicy
import com.jalankita.app.core.data.outbox.QueuedSubmission
import com.jalankita.app.core.notify.QueueNotifier
import kotlinx.coroutines.CancellationException
import java.io.File

/**
 * Mengunggah laporan warga yang tersimpan di antrean.
 *
 * Aturan kegagalan (satu sumber: [QueuePolicy]):
 * - **Kuota harian** (server menolak karena batas 5 laporan/hari) → item
 *   berstatus menunggu kuota, **tidak** dihitung sebagai percobaan, dan worker
 *   menjadwalkan ulang setelah tengah malam WIB. Sebelumnya 8 percobaan habis
 *   dalam ±2 jam lalu item dibuang padahal besok pasti berhasil.
 * - **Gangguan sementara** (jaringan/5xx) → tetap di antrean, `Result.retry()`.
 * - **Ditolak permanen** (422) atau sesi mati (401) → item berstatus gagal
 *   dengan alasan dari server, fotonya disimpan, pengguna diberi tahu.
 */
class ReportUploadWorker(
    private val appContext: Context,
    params: WorkerParameters,
    private val outbox: OutboxRepository,
    private val wargaRepo: WargaRepository,
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result {
        outbox.refresh()
        val pending = outbox.pending(QueuedSubmission.KIND_WARGA_REPORT)
        if (pending.isEmpty()) return Result.success()

        var uploaded = 0
        var transient = 0
        val quotaBlockedIds = mutableListOf<String>()
        val failureReasons = mutableListOf<String>()

        for (item in pending) {
            val files = item.photoPaths.map(::File).filter(File::exists)
            if (files.isEmpty()) {
                failureReasons += "berkas foto hilang dari penyimpanan"
                outbox.markFailure(item.id, "Foto laporan hilang dari penyimpanan.")
                continue
            }

            try {
                val res = wargaRepo.submit(
                    reporterName = item.reporterName.orEmpty(),
                    roadName = item.roadName.orEmpty(),
                    district = item.district.orEmpty(),
                    latitude = item.latitude ?: 0.0,
                    longitude = item.longitude ?: 0.0,
                    description = item.description,
                    panjang = item.panjang,
                    lebar = item.lebar,
                    fullAddress = item.fullAddress,
                    imageFiles = files,
                    // Kunci dari antrean: laporan yang gagal terkirim karena
                    // respons hilang akan dianggap sukses oleh server.
                    idempotencyKey = item.idempotencyKey,
                )
                when (res) {
                    is DashboardResult.Success -> {
                        outbox.markUploaded(item.id)
                        uploaded++
                    }
                    is DashboardResult.Error -> {
                        val quota = QueuePolicy.isQuotaError(null, res.message)
                        val status = outbox.markFailure(
                            item.id,
                            res.message,
                            errorCode = null,
                            quotaBlocked = quota,
                        )
                        when (status) {
                            QueuedSubmission.STATUS_WAITING_QUOTA -> quotaBlockedIds += item.id
                            QueuedSubmission.STATUS_FAILED,
                            QueuedSubmission.STATUS_EXPIRED,
                            -> failureReasons += res.message
                            QueuedSubmission.STATUS_RETRYING,
                            QueuedSubmission.STATUS_PENDING,
                            -> transient++
                            else -> Unit
                        }
                    }
                }
            } catch (_: WargaSubmitException) {
                // 422 validasi (mis. PHOTO_TOO_OLD) — mengulang tidak menolong.
                outbox.markFailure(item.id, "Laporan ditolak server (data tidak valid).")
                failureReasons += "laporan ditolak server"
            } catch (_: UnauthorizedException) {
                outbox.markFailure(item.id, "Sesi berakhir, silakan masuk kembali.")
                failureReasons += "sesi berakhir"
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                val status = outbox.markFailure(
                    item.id,
                    e.message,
                    quotaBlocked = QueuePolicy.isQuotaError(null, e.message),
                )
                when (status) {
                    QueuedSubmission.STATUS_WAITING_QUOTA -> quotaBlockedIds += item.id
                    QueuedSubmission.STATUS_FAILED,
                    QueuedSubmission.STATUS_EXPIRED,
                    -> failureReasons += (e.message ?: "gangguan berulang")
                    QueuedSubmission.STATUS_RETRYING,
                    QueuedSubmission.STATUS_PENDING,
                    -> transient++
                    else -> Unit
                }
            }
        }

        if (uploaded > 0) {
            QueueNotifier.uploaded(
                appContext,
                QueueNotifier.ID_WARGA_UPLOADED,
                "Laporan Terkirim",
                "$uploaded laporan offline berhasil dikirim.",
            )
        }
        if (failureReasons.isNotEmpty()) {
            QueueNotifier.failed(
                appContext,
                QueueNotifier.ID_WARGA_FAILED,
                failureReasons.size,
                failureReasons,
            )
        }
        if (quotaBlockedIds.isNotEmpty()) {
            QueueNotifier.waitingQuota(appContext, quotaBlockedIds.size)
            outbox.scheduleQuotaRetry(QueuePolicy.nextQuotaReset() - System.currentTimeMillis())
        }

        return if (transient > 0) Result.retry() else Result.success()
    }
}
