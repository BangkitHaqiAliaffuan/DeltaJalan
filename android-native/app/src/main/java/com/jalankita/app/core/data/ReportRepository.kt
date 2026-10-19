package com.jalankita.app.core.data

import com.jalankita.app.core.network.AnalyzeBatchResponse
import com.jalankita.app.core.network.AnalyzeResponse
import com.jalankita.app.core.network.ApiErrorResponse
import com.jalankita.app.core.network.ApiService
import com.jalankita.app.core.network.CreateReportResponse
import com.jalankita.app.core.network.DetectionDto
import com.jalankita.app.core.network.ExistingReportDto
import com.jalankita.app.core.network.MulaiRequest
import com.jalankita.app.core.network.ProgressItemDto
import com.jalankita.app.core.network.ReportDataDto
import com.jalankita.app.core.network.UpdateReportData
import com.jalankita.app.core.network.UpdateReportRequest
import com.squareup.moshi.Moshi
import com.squareup.moshi.Types
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import retrofit2.HttpException
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Akses endpoint lapor (Fase 2). Membungkus kesalahan menjadi [ReportResult]
 * agar UI menampilkan pesan yang tepat (termasuk `error_code` server).
 */
@Singleton
class ReportRepository @Inject constructor(
    private val api: ApiService,
    private val moshi: Moshi,
) {
    private val textMedia = "text/plain".toMediaType()
    private val detectionsAdapter = moshi.adapter<List<DetectionDto>>(
        Types.newParameterizedType(List::class.java, DetectionDto::class.java),
    )

    /** POST /api/analyze — analisis AI satu foto. */
    suspend fun analyze(
        imageFile: File,
        latitude: Double?,
        longitude: Double?,
    ): ReportResult<AnalyzeResponse> {
        return runCatchingNetwork {
            api.analyze(
                // PENTING: endpoint /analyze mengharapkan field bernama "file"
                // (ReportController.php:91 `'file' => required`).
                file = imageFile.asFormPart("file"),
                latitude = latitude?.toString()?.toRequestBody(textMedia),
                longitude = longitude?.toString()?.toRequestBody(textMedia),
            )
        }
    }

    /**
     * POST /api/analyze-batch — analisis banyak foto sekaligus (maks 20 server).
     * Field multipart bernama `files[]` (AIController:53 `'files' => array`).
     * `latitude`/`longitude` WAJIB (fallback koordinat bila EXIF kosong).
     */
    suspend fun analyzeBatch(
        imageFiles: List<File>,
        latitude: Double,
        longitude: Double,
    ): ReportResult<AnalyzeBatchResponse> {
        return runCatchingNetwork {
            api.analyzeBatch(
                files = imageFiles.map { it.asFormPart("files[]") },
                latitude = latitude.toString().toRequestBody(textMedia),
                longitude = longitude.toString().toRequestBody(textMedia),
            )
        }
    }

    /**
     * POST /api/reports/batch — simpan laporan multi-foto.
     * `panjang`/`lebar` = dimensi PER FOTO (urutan sama dgn `imageFiles`).
     * `koordinat_sumber`: "exif" bila semua foto ber-GPS, else "manual".
     */
    suspend fun createReportBatch(
        batchId: String,
        roadName: String,
        district: String,
        latitude: Double,
        longitude: Double,
        koordinatSumber: String,
        panjang: List<Double>,
        lebar: List<Double>,
        catatan: String?,
        surveyTaskId: String?,
        imageFiles: List<File>,
    ): ReportResult<ReportDataDto> {
        return runCatchingNetwork {
            val res = api.storeBatch(
                batchId = batchId.toRequestBody(textMedia),
                roadName = roadName.toRequestBody(textMedia),
                district = district.toRequestBody(textMedia),
                latitude = latitude.toString().toRequestBody(textMedia),
                longitude = longitude.toString().toRequestBody(textMedia),
                koordinatSumber = koordinatSumber.toRequestBody(textMedia),
                kerusakanPanjang = panjang.map { it.toString().toRequestBody(textMedia) },
                kerusakanLebar = lebar.map { it.toString().toRequestBody(textMedia) },
                catatan = catatan?.takeIf { it.isNotBlank() }?.toRequestBody(textMedia),
                surveyTaskId = surveyTaskId
                    ?.takeIf { it.isNotBlank() && !it.startsWith("schedule-") }
                    ?.toRequestBody(textMedia),
                files = imageFiles.map { it.asFormPart("files[]") },
            )
            res.data ?: throw Exception(res.message ?: "Laporan gagal disimpan.")
        }
    }

    /** POST /api/reports — simpan laporan tunggal. */
    suspend fun createReport(
        reporterName: String,
        roadName: String,
        district: String,
        latitude: Double,
        longitude: Double,
        panjang: Double,
        lebar: Double,
        catatan: String?,
        imageFile: File,
        ai: AnalyzeResponse?,
        /** Opsional: ikat ke sesi patroli. Id sintetis "schedule-*" → JANGAN dikirim (aturan web). */
        surveyTaskId: String? = null,
    ): ReportResult<ReportDataDto> {
        return runCatchingNetwork {
            val res: CreateReportResponse = api.createReport(
                reporterName = reporterName.toRequestBody(textMedia),
                roadName = roadName.toRequestBody(textMedia),
                district = district.toRequestBody(textMedia),
                latitude = latitude.toString().toRequestBody(textMedia),
                longitude = longitude.toString().toRequestBody(textMedia),
                kerusakanPanjang = panjang.toString().toRequestBody(textMedia),
                kerusakanLebar = lebar.toString().toRequestBody(textMedia),
                catatan = catatan?.takeIf { it.isNotBlank() }?.toRequestBody(textMedia),
                totalDetections = ai?.total?.toString()?.toRequestBody(textMedia),
                overallSeverity = ai?.overallSeverity?.toRequestBody(textMedia),
                aiRawOutput = ai?.detections
                    ?.let { detectionsAdapter.toJson(it) }
                    ?.toRequestBody(textMedia),
                imageResult = ai?.imageResult?.toRequestBody(textMedia),
                // Id sintetis "schedule-..." bukan task nyata → jangan diikat (server exists:survey_tasks,id).
                surveyTaskId = surveyTaskId
                    ?.takeIf { it.isNotBlank() && !it.startsWith("schedule-") }
                    ?.toRequestBody(textMedia),
                image = imageFile.asFormPart("image"),
            )
            res.data ?: throw Exception(res.message ?: "Laporan gagal disimpan.")
        }
    }

    /** Part multipart file gambar dengan nama field eksplisit. */
    private fun File.asFormPart(fieldName: String): MultipartBody.Part =
        MultipartBody.Part.createFormData(fieldName, name, asRequestBody("image/jpeg".toMediaType()))

    // ── Eksekusi lapangan petugas (Ditugaskan → Sedang Diperbaiki → Selesai) ──
    // Kontrak: ReportController::mulai, updateProgress, getProgress, complete.
    // Semua mengembalikan pesan server apa adanya (termasuk 403 tim / 422 status).

    /** POST /api/reports/{id}/mulai — mulai pengerjaan. */
    suspend fun mulai(
        id: String,
        catatan: String?,
        estimasiHari: Int?,
    ): ReportResult<Unit> = runCatchingNetwork {
        val res = api.mulaiReport(
            id,
            MulaiRequest(
                catatan = catatan?.takeIf { it.isNotBlank() },
                estimasiSelesaiHari = estimasiHari?.takeIf { it in 1..90 },
            ),
        )
        if (!res.success) throw Exception(res.message ?: "Gagal memulai pengerjaan.")
    }

    /**
     * POST /api/reports/{id}/progress — upload foto progres + catatan.
     * `imageFile` sebaiknya sudah dikompresi (lihat ImageCompressor).
     */
    suspend fun uploadProgress(
        id: String,
        imageFile: File,
        catatan: String?,
    ): ReportResult<Unit> = runCatchingNetwork {
        val res = api.uploadProgress(
            id = id,
            foto = imageFile.asFormPart("foto"),
            catatan = catatan?.takeIf { it.isNotBlank() }?.toRequestBody(textMedia),
        )
        if (!res.success) throw Exception(res.message ?: "Gagal mengunggah progres.")
    }

    /** GET /api/reports/{id}/progress — riwayat progres untuk timeline. */
    suspend fun progress(id: String): ReportResult<List<ProgressItemDto>> = runCatchingNetwork {
        val res = api.reportProgress(id)
        if (!res.success || res.data == null) throw Exception(res.message ?: "Gagal memuat progres.")
        res.data
    }

    /**
     * POST /api/reports/{id}/complete — selesaikan dengan foto after.
     * Field multipart WAJIB bernama `after_photo[]` (kontrak complete:2736).
     */
    suspend fun complete(
        id: String,
        imageFiles: List<File>,
        catatan: String?,
    ): ReportResult<Unit> = runCatchingNetwork {
        require(imageFiles.isNotEmpty()) { "Pilih minimal 1 foto sesudah perbaikan." }
        val res = api.completeReport(
            id = id,
            catatan = catatan?.takeIf { it.isNotBlank() }?.toRequestBody(textMedia),
            foto = imageFiles.map { it.asFormPart("after_photo[]") },
        )
        if (!res.success) throw Exception(res.message ?: "Gagal menyelesaikan laporan.")
    }

    // ── Edit draft laporan petugas ──────────────────────────────────────────
    // Kontrak: mulaiEdit → PUT update (JSON) → batalEdit.

    /** POST /api/reports/{id}/mulai-edit — kunci draft untuk diedit. */
    suspend fun mulaiEdit(id: String): ReportResult<Unit> = runCatchingNetwork {
        val res = api.mulaiEdit(id)
        if (!res.success) throw Exception(res.message ?: "Laporan tidak dapat diedit.")
    }

    /** POST /api/reports/{id}/batal-edit — batalkan sesi edit. */
    suspend fun batalEdit(id: String): ReportResult<Unit> = runCatchingNetwork {
        val res = api.batalEdit(id)
        if (!res.success) throw Exception(res.message ?: "Gagal membatalkan edit.")
    }

    /** PUT /api/reports/{id} — simpan perubahan (JSON). */
    suspend fun updateReport(id: String, body: UpdateReportRequest): ReportResult<UpdateReportData> =
        runCatchingNetwork {
            val res = api.updateReport(id, body)
            if (!res.success || res.data == null) throw Exception(res.message ?: "Gagal menyimpan perubahan.")
            res.data
        }

    /**
     * DELETE /api/reports/{id} — hapus laporan sendiri.
     * Server: pemilik atau supervisor; status Menunggu Review/Ditinjau/Diedit/Ditolak.
     * (Endpoint sudah ada; sebelumnya hanya dipakai SupervisorViewModel.)
     */
    suspend fun hapus(id: String): ReportResult<Unit> = runCatchingNetwork {
        val res = api.deleteReport(id)
        if (!res.success) throw Exception(res.message ?: "Gagal menghapus laporan.")
    }

    /**
     * Fallback GPS server (padanan WargaRepository.extractExifGps): salin byte asli
     * (setRequireOriginal) lalu minta PHP membaca EXIF tanpa redaksi Android.
     * Batas server 5 MB. Tidak pernah throw — null bila gagal / memang tanpa GPS.
     */
    suspend fun extractExifGps(imageFile: File): Pair<Double, Double>? {
        return try {
            val res = api.extractExifGps(
                MultipartBody.Part.createFormData(
                    "image", imageFile.name,
                    imageFile.asRequestBody("image/jpeg".toMediaType()),
                ),
            )
            val lat = res.lat
            val lng = res.lng
            if (lat != null && lng != null) lat to lng else null
        } catch (_: Exception) {
            null
        }
    }

    /** Jalankan panggilan; petakan HttpException → ReportResult.Error berpola. */
    private suspend fun <T> runCatchingNetwork(block: suspend () -> T): ReportResult<T> {
        return try {
            ReportResult.Success(block())
        } catch (e: HttpException) {
            // 401 = token dicabut → paksa re-login (kontrak AuthRepository).
            // Dilempar agar ViewModel menandai sessionExpired, konsisten dengan
            // DashboardRepository/WargaRepository. JANGAN telan jadi Error biasa.
            if (e.code() == 401) throw UnauthorizedException()
            ReportResult.Error(parseError(e))
        } catch (e: UnauthorizedException) {
            throw e
        } catch (e: Exception) {
            ReportResult.Error(
                ReportError(
                    message = e.message ?: "Tidak dapat terhubung ke server.",
                    errorCode = null,
                ),
            )
        }
    }

    /** Baca body error 422 → ApiErrorResponse (error_code + message + existing_report). */
    private fun parseError(e: HttpException): ReportError {
        val bodyStr = runCatching { e.response()?.errorBody()?.string() }.getOrNull()
        val parsed: ApiErrorResponse? = bodyStr?.let {
            runCatching { moshi.adapter(ApiErrorResponse::class.java).fromJson(it) }.getOrNull()
        }
        val firstFieldError = parsed?.errors?.values?.flatten()?.firstOrNull()
        return ReportError(
            message = parsed?.message ?: firstFieldError ?: "Terjadi kesalahan (${e.code()}).",
            errorCode = parsed?.errorCode,
            existingReport = parsed?.existingReport,
        )
    }
}

/** Hasil operasi lapor tanpa exception. */
sealed interface ReportResult<out T> {
    data class Success<T>(val data: T) : ReportResult<T>
    data class Error(val error: ReportError) : ReportResult<Nothing>
}

/** Detail kesalahan lapor — `message` siap ditampilkan, `errorCode` untuk logika UI. */
data class ReportError(
    val message: String,
    val errorCode: String? = null,
    val existingReport: ExistingReportDto? = null,
) {
    /** true bila foto sudah pernah dipakai (tawarkan fitur bukti foto). */
    val isDuplicate: Boolean get() = errorCode == "DUPLICATE_IMAGE"
}
