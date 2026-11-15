package com.jalankita.app.core.data

import com.jalankita.app.core.network.*
import com.squareup.moshi.Moshi
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import retrofit2.HttpException
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class InspectionRepository @Inject constructor(
    private val api: ApiService,
    private val moshi: Moshi,
) {
    private val textMedia = "text/plain".toMediaType()
    private val imageMedia = "image/jpeg".toMediaType()

    suspend fun getTasks(date: String? = null): DashboardResult<InspectionTaskPage> = runInspection {
        api.inspectionTasks(date = date?.takeIf { it.isNotBlank() }).data ?: throw Exception("Tugas inspeksi tidak tersedia.")
    }

    suspend fun getTask(id: String): DashboardResult<InspectionAssignmentDto> = runInspection {
        api.inspectionTaskDetail(id).data ?: throw Exception("Assignment inspeksi tidak ditemukan.")
    }

    suspend fun startTask(id: String): DashboardResult<InspectionAssignmentDto> = runInspection {
        api.startInspection(id).data ?: throw Exception("Assignment inspeksi tidak tersedia.")
    }

    suspend fun submitResult(id: String, request: InspectionSubmitRequest): DashboardResult<InspectionResultDto> = runInspection {
        require(request.photos.isNotEmpty()) { "Pilih minimal 1 foto inspeksi." }
        api.submitInspection(id, request.idempotencyKey.toRequestBody(textMedia), request.condition?.toRequestBody(textMedia), request.notes?.toRequestBody(textMedia), request.latitude?.toString()?.toRequestBody(textMedia), request.longitude?.toString()?.toRequestBody(textMedia), request.photos.map { it.asPart("photos[]") }).data
            ?: throw Exception("Hasil inspeksi tidak tersedia.")
    }

    suspend fun createDiscoveredReport(sessionId: String, request: DiscoveredReportRequest): DashboardResult<InspectionResultDto> = runInspection {
        api.submitDiscoveredInspection(sessionId, request.idempotencyKey.toRequestBody(textMedia), request.roadName.toRequestBody(textMedia), request.district.toRequestBody(textMedia), request.latitude?.toString()?.toRequestBody(textMedia), request.longitude?.toString()?.toRequestBody(textMedia), request.description?.toRequestBody(textMedia), request.photo.asPart("photo")).data
            ?: throw Exception("Hasil temuan inspeksi tidak tersedia.")
    }

    /** GET /api/inspection-results/pending — supervisor/admin saja, halaman pertama. */
    suspend fun pending(): DashboardResult<InspectionResultPage> = runInspection {
        api.pendingInspectionResults().data ?: throw Exception("Hasil inspeksi pending tidak tersedia.")
    }

    /**
     * GET /api/inspection-queues/candidates — laporan yang belum punya
     * assignment aktif (assigned/started/submitted). Server yang menyaring,
     * jadi hasilnya langsung bisa diantrekan tanpa risiko 409.
     */
    suspend fun candidates(limit: Int = 30): DashboardResult<List<InspectionQueueCandidateDto>> = runInspection {
        val response = api.inspectionQueueCandidates(limit = limit)
        if (!response.success) {
            throw Exception(response.message ?: "Gagal memuat kandidat inspeksi.")
        }
        response.data.orEmpty()
    }

    /**
     * POST /api/inspection-queues — masukkan laporan ke sesi inspeksi sebuah task.
     *
     * Backend membuat sesi `report_inspection` sendiri bila belum ada, jadi
     * supervisor tidak perlu membuat jadwal khusus lebih dulu. `idempotencyKey`
     * harus stabil untuk percobaan yang sama supaya retry tidak membuat sesi
     * atau assignment ganda.
     */
    suspend fun queue(surveyTaskId: String, reportIds: List<String>, idempotencyKey: String): DashboardResult<InspectionSessionDto> = runInspection {
        val ids = reportIds.distinct()
        require(ids.isNotEmpty()) { "Pilih minimal 1 laporan." }
        api.queueInspection(InspectionQueueRequest(surveyTaskId, ids, idempotencyKey)).data
            ?: throw Exception("Sesi inspeksi tidak tersedia.")
    }

    /**
     * POST /api/inspection-results/{result}/review.
     * Backend membalas bentuk `InspectionResult` untuk accept/return/reject dan
     * bentuk `InspectionSession` untuk reinspect; keduanya dipetakan ke
     * [InspectionReviewData] karena field-nya beririsan.
     */
    suspend fun review(id: String, decision: String, reason: String? = null): DashboardResult<InspectionReviewData> = runInspection {
        require(decision in setOf("accept", "return", "reinspect", "reject")) { "Aksi review inspeksi tidak valid." }
        api.reviewInspection(
            id,
            InspectionReviewRequest(decision, reason?.trim()?.takeIf { it.isNotBlank() }),
        ).data ?: throw Exception("Respons review tidak tersedia.")
    }

    private fun File.asPart(name: String) = MultipartBody.Part.createFormData(name, this.name, asRequestBody(imageMedia))

    private suspend fun <T> runInspection(block: suspend () -> T): DashboardResult<T> = try {
        DashboardResult.Success(block())
    } catch (e: kotlinx.coroutines.CancellationException) {
        throw e
    } catch (e: HttpException) {
        if (e.code() == 401) throw UnauthorizedException()
        DashboardResult.Error(errorMessage(e))
    } catch (e: UnauthorizedException) {
        throw e
    } catch (e: Exception) {
        DashboardResult.Error(e.message ?: "Tidak dapat terhubung ke server.")
    }

    private fun errorMessage(e: HttpException): String {
        val fallback = "Terjadi kesalahan (${e.code()})."
        return try {
            val body = e.response()?.errorBody()?.string().orEmpty()
            val parsed = moshi.adapter(InspectionErrorResponse::class.java).fromJson(body)
            parsed?.errors?.values?.flatten()?.firstOrNull() ?: parsed?.message?.takeIf { it.isNotBlank() } ?: fallback
        } catch (_: Exception) { fallback }
    }
}

data class InspectionSubmitRequest(
    val idempotencyKey: String,
    val condition: String? = null,
    val notes: String? = null,
    val latitude: Double? = null,
    val longitude: Double? = null,
    val photos: List<File>,
)

data class DiscoveredReportRequest(
    val idempotencyKey: String,
    val roadName: String,
    val district: String,
    val latitude: Double? = null,
    val longitude: Double? = null,
    val description: String? = null,
    val photo: File,
)
