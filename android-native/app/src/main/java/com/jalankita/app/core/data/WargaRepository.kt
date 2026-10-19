package com.jalankita.app.core.data

import com.jalankita.app.core.network.ApiService
import com.jalankita.app.core.network.RatingRequest
import com.jalankita.app.core.network.RemainingDto
import com.jalankita.app.core.network.WargaDetailData
import com.jalankita.app.core.network.WargaListResponse
import com.jalankita.app.core.network.WargaMapData
import com.jalankita.app.core.network.WargaReportDto
import com.jalankita.app.core.network.WargaSubmitData
import com.jalankita.app.core.network.WargaSubmitResponse
import com.squareup.moshi.Moshi
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import retrofit2.HttpException
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Akses endpoint warga (role:warga) — replikasi warga/index.tsx + warga/lapor.tsx.
 * ATURAN KERAS: repository ini hanya dipakai sesi warga; jangan campur dengan
 * endpoint petugas (backend tidak memfilter role warga di sana).
 */
@Singleton
class WargaRepository @Inject constructor(
    private val api: ApiService,
    private val moshi: Moshi,
) {
    private val textMedia = "text/plain".toMediaType()

    /** GET /api/warga/reports — daftar + meta. */
    suspend fun reports(
        perPage: Int = 10,
        page: Int = 1,
        status: String? = null,
        query: String? = null,
    ): DashboardResult<WargaListResponse> = runCatchingWarga {
        val res = api.wargaReports(
            perPage = perPage,
            page = page,
            status = status,
            q = query?.takeIf { it.isNotBlank() },
        )
        if (!res.success) throw Exception(res.message ?: "Gagal memuat laporan.")
        res
    }

    /** GET /api/warga/reports/{id} — detail + timeline. */
    suspend fun detail(id: String): DashboardResult<WargaDetailData> = runCatchingWarga {
        api.wargaDetail(id).data ?: throw Exception("Laporan tidak ditemukan.")
    }

    /** POST /api/warga/reports/{id}/rating. */
    suspend fun rate(id: String, rating: Int, comment: String?): DashboardResult<String> =
        runCatchingWarga {
            try {
                val res = api.wargaRate(id, RatingRequest(rating, comment?.takeIf { it.isNotBlank() }))
                if (!res.success) throw Exception(res.message ?: "Rating gagal disimpan.")
                res.message ?: "Terima kasih! Penilaian Anda telah disimpan."
            } catch (e: HttpException) {
                if (e.code() == 422) {
                    throw Exception("Hanya laporan selesai yang belum dinilai yang dapat diberi rating.")
                }
                throw e
            }
        }

    /** GET /api/v1/reports/remaining — gate kuota sebelum lapor. */
    suspend fun remaining(): DashboardResult<RemainingDto> = runCatchingWarga {
        api.remaining().data ?: RemainingDto()
    }

    /** GET /api/reports/map-data — sebaran untuk tab Peta warga. */
    suspend fun mapData(): DashboardResult<WargaMapData> = runCatchingWarga {
        val res = api.wargaMapData()
        if (!res.success || res.data == null) throw Exception(res.message ?: "Gagal memuat peta.")
        res.data
    }

    /**
     * DELETE /api/reports/{id} — hapus laporan sendiri.
     * Server: pemilik; status Menunggu Review/Ditinjau/Diedit/Ditolak.
     */
    suspend fun hapus(id: String): DashboardResult<Unit> = runCatchingWarga {
        val res = api.deleteReport(id)
        if (!res.success) throw Exception(res.message ?: "Gagal menghapus laporan.")
    }

    /**
     * POST /api/v1/reports/extract-exif-gps — fallback baca GPS di server.
     * Byte file dibaca PHP tanpa redaksi GPS Android. Best-effort: null bila
     * gagal (jaringan, 401, 422 oversize >5MB, atau memang tanpa GPS).
     * Tidak pernah throw — pemanggil tetap menampilkan guard semula.
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

    /**
     * POST /api/warga/reports — multipart maks 3 foto.
     * TANPA captcha_token dan TANPA field AI (server auto-AI).
     * @throws WargaSubmitException bila 422 (bawa error_code + existing_report).
     */
    suspend fun submit(
        reporterName: String,
        roadName: String,
        district: String,
        latitude: Double,
        longitude: Double,
        description: String?,
        panjang: Double?,
        lebar: Double?,
        fullAddress: String?,
        imageFiles: List<File>,
    ): DashboardResult<WargaSubmitData> {
        return try {
            val res = api.wargaSubmit(
                reporterName = reporterName.toRequestBody(textMedia),
                roadName = roadName.toRequestBody(textMedia),
                district = district.toRequestBody(textMedia),
                latitude = latitude.toString().toRequestBody(textMedia),
                longitude = longitude.toString().toRequestBody(textMedia),
                description = description?.takeIf { it.isNotBlank() }?.toRequestBody(textMedia),
                kerusakanPanjang = panjang?.toString()?.toRequestBody(textMedia),
                kerusakanLebar = lebar?.toString()?.toRequestBody(textMedia),
                fullAddress = fullAddress?.takeIf { it.isNotBlank() }?.toRequestBody(textMedia),
                images = imageFiles.mapIndexed { i, f ->
                    MultipartBody.Part.createFormData(
                        "images[$i]", f.name,
                        f.asRequestBody("image/jpeg".toMediaType()),
                    )
                },
            )
            if (!res.success || res.data == null) {
                throw WargaSubmitException(
                    message = res.errors?.values?.flatten()?.firstOrNull()
                        ?: res.message ?: "Laporan gagal dikirim.",
                    errorCode = res.errorCode,
                    existingReportCode = res.existingReport?.reportCode,
                    existingRoad = res.existingReport?.roadName,
                )
            }
            DashboardResult.Success(res.data)
        } catch (e: WargaSubmitException) {
            throw e
        } catch (e: HttpException) {
            if (e.code() == 401) throw UnauthorizedException()
            // 422 validasi membawa envelope {message, error_code, errors,
            // existing_report} di body — parse agar diagnosis spesifik
            // (KOORDINAT_DILUAR_WILAYAH, PHOTO_TOO_OLD, DUPLICATE_IMAGE, ...)
            // sampai ke UI, bukan pesan generik.
            throw parseSubmitError(e)
        } catch (e: Exception) {
            DashboardResult.Error(e.message ?: "Tidak dapat terhubung ke server.")
        }
    }

    /**
     * Parse body error submit warga. Best-effort: body kosong / bukan JSON /
     * bentuk tak dikenal → fallback pesan generik dengan kode HTTP.
     */
    private fun parseSubmitError(e: HttpException): WargaSubmitException {
        val fallback = WargaSubmitException("Data tidak valid (${e.code()}).", null, null, null)
        return try {
            val raw = e.response()?.errorBody()?.string().takeUnless { it.isNullOrBlank() }
                ?: return fallback
            val parsed = moshi.adapter(WargaSubmitResponse::class.java).fromJson(raw)
                ?: return fallback
            WargaSubmitException(
                message = parsed.errors?.values?.flatten()?.firstOrNull()
                    ?: parsed.message ?: "Laporan gagal dikirim.",
                errorCode = parsed.errorCode,
                existingReportCode = parsed.existingReport?.reportCode,
                existingRoad = parsed.existingReport?.roadName,
            )
        } catch (_: Exception) {
            fallback
        }
    }

    private suspend fun <T> runCatchingWarga(block: suspend () -> T): DashboardResult<T> {
        return try {
            DashboardResult.Success(block())
        } catch (e: WargaSubmitException) {
            throw e
        } catch (e: HttpException) {
            if (e.code() == 401) throw UnauthorizedException()
            if (e.code() == 403) {
                throw Exception("Akses ditolak. Akun ini tidak memiliki akses warga.")
            }
            DashboardResult.Error("Terjadi kesalahan (${e.code()}).")
        } catch (e: UnauthorizedException) {
            throw e
        } catch (e: Exception) {
            DashboardResult.Error(e.message ?: "Tidak dapat terhubung ke server.")
        }
    }
}

/** 422 submit warga — bawa error_code + info laporan terkait (DUPLICATE_IMAGE). */
class WargaSubmitException(
    message: String,
    val errorCode: String?,
    val existingReportCode: String?,
    val existingRoad: String?,
) : Exception(message) {
    /** Pesan siap tampil (termasuk kode laporan terkait bila ada). */
    val displayMessage: String
        get() = buildString {
            append(message)
            if (existingReportCode != null) {
                append("\n\nLaporan terkait: $existingReportCode")
                if (!existingRoad.isNullOrBlank()) append(" ($existingRoad)")
            }
        }

    /** Nama error untuk telemetri/log (bukan ReportError agar tak bentrok). */
    val reportError: ReportError
        get() = ReportError(message ?: "", errorCode)
}
