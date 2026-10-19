package com.jalankita.app.core.data

import com.jalankita.app.core.network.ApiService
import com.jalankita.app.core.network.BulkIdsRequest
import com.jalankita.app.core.network.BulkTolakRequest
import com.jalankita.app.core.network.PciOverviewData
import com.jalankita.app.core.network.ReportListResponse
import com.jalankita.app.core.network.SupervisorRegionsData
import com.jalankita.app.core.network.SupervisorReportDetail
import com.jalankita.app.core.network.SupervisorStatsDto
import com.jalankita.app.core.network.TeamDto
import com.jalankita.app.core.network.TeamStatsDto
import com.jalankita.app.core.network.TolakRequest
import com.jalankita.app.core.network.TriageActionRequest
import com.jalankita.app.core.network.TriageActionResponse
import com.jalankita.app.core.network.WargaMapData
import com.squareup.moshi.Moshi
import retrofit2.HttpException
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Akses endpoint supervisor (role:supervisor/admin) — replikasi
 * Frontend-stable/src/routes/supervisor/{index,review}.tsx + detail-report.tsx.
 *
 * ATURAN KERAS: repository ini HANYA dipakai sesi supervisor/admin.
 *
 * ATURAN BISNIS KRITIS (guard client wajib — server tidak menjaga):
 *  1. Routing approve per `source`:
 *       source == "petugas"              → approveReport()
 *       source in ["warga", "telegram"]  → approveAndAssign()
 *     Salah pilih → 422 atau laporan macet di "Hasil AI".
 *  2. confirm-ai TANPA cek role DAN tanpa cek source → hanya panggil bila
 *     source in ["warga", "telegram"].
 *  3. `needs_team:true` HANYA dari approve-and-assign 422 → picker tim → ulangi.
 *  4. Supervisor JANGAN panggil mulai/progress/complete/reopen (server mengizinkan!
 *     lihat PLAN-supervisor §2.3-B) — aksi eksekusi milik petugas.
 */
@Singleton
class SupervisorRepository @Inject constructor(
    private val api: ApiService,
    private val moshi: Moshi,
) {
    /** GET /api/reports — daftar triase (paginated). */
    suspend fun reports(
        status: String? = null,
        query: String? = null,
        source: String? = null,
        severity: String? = null,
        uptdId: String? = null,
        pci: String? = null,
        sortBy: String? = null,
        limit: Int = 20,
        page: Int = 1,
    ): DashboardResult<ReportListResponse> = runCatchingSup {
        val res = api.supervisorReports(
            status = status,
            q = query?.takeIf { it.isNotBlank() },
            source = source,
            severity = severity,
            uptdId = uptdId,
            pci = pci,
            sortBy = sortBy,
            limit = limit,
            page = page,
        )
        if (!res.success) throw Exception(res.message ?: "Gagal memuat laporan.")
        res
    }

    /** GET /api/reports/{id} — detail untuk supervisor. */
    suspend fun detail(id: String): DashboardResult<SupervisorReportDetail> = runCatchingSup {
        api.supervisorReportDetail(id).data ?: throw Exception("Laporan tidak ditemukan.")
    }

    /** GET /api/reports/stats — statistik supervisor. */
    suspend fun stats(): DashboardResult<SupervisorStatsDto> = runCatchingSup {
        api.supervisorStats().data ?: throw Exception("Statistik tidak tersedia.")
    }

    /** GET /api/reports/stats-by-team. */
    suspend fun statsByTeam(): DashboardResult<List<TeamStatsDto>> = runCatchingSup {
        api.supervisorStatsByTeam().data.orEmpty()
    }

    /** GET /api/reports/map-data — peta supervisor. */
    suspend fun mapData(): DashboardResult<WargaMapData> = runCatchingSup {
        val res = api.supervisorMapData()
        if (!res.success || res.data == null) throw Exception(res.message ?: "Gagal memuat peta.")
        res.data
    }

    /** GET /api/supervisor/regions — wilayah yang disupervisi. */
    suspend fun regions(): DashboardResult<SupervisorRegionsData> = runCatchingSup {
        api.supervisorRegions().data ?: throw Exception("Wilayah tidak tersedia.")
    }

    /** GET /api/teams — daftar tim untuk picker assign (response `{data:[]}` polos). */
    suspend fun teams(): DashboardResult<List<TeamDto>> = runCatchingSup {
        api.teams().data.orEmpty()
    }

    /** GET /api/pci/overview — ringkasan PCI. */
    suspend fun pciOverview(): DashboardResult<PciOverviewData> = runCatchingSup {
        api.pciOverview().data ?: throw Exception("Ringkasan PCI tidak tersedia.")
    }

    /**
     * POST /api/reports/{id}/mulai-review — idempoten, supervisor+admin.
     * Status selain "Menunggu Review" → 200 tanpa mutasi (jangan jadikan error).
     * Best-effort: kegagalan tidak boleh memblokir pembukaan detail.
     */
    suspend fun mulaiReview(id: String): DashboardResult<Unit> = runCatchingSup {
        api.mulaiReview(id)
        Unit
    }

    /**
     * Aksi setujui — ROUTING WAJIB per `source` (lihat ATURAN KERAS #1).
     * @param source nilai `report.source` mentah dari server.
     * @throws IllegalStateException bila source tak dikenal.
     */
    suspend fun approve(
        id: String,
        source: String?,
        priority: String?,
        assignedTeamId: String? = null,
    ): DashboardResult<TriageOutcome> = runCatchingSup {
        val body = TriageActionRequest(priority = priority, assignedTeamId = assignedTeamId)
        val res = when (source) {
            "petugas" -> api.approveReport(id, body)
            "warga", "telegram" -> api.approveAndAssign(id, body)
            else -> throw IllegalStateException("Sumber laporan tak dikenal: $source")
        }
        if (!res.success) {
            throw TriageException(res.message ?: "Aksi gagal.", res.needsTeam, false)
        }
        TriageOutcome(status = res.data?.status, needsTeam = false)
    }

    /**
     * POST /api/reports/bulk-approve — HANYA untuk laporan `source == petugas`.
     * Server men-set `Disetujui` TANPA menugaskan tim; laporan warga/telegram
     * akan jadi orphan bila lewat endpoint ini → guard ada di ViewModel (UI).
     * @return jumlah laporan yang disetujui server.
     */
    suspend fun bulkApprove(ids: List<String>): DashboardResult<Int> = runCatchingSup {
        val res = api.bulkApprove(BulkIdsRequest(ids))
        if (!res.success) throw Exception(res.message ?: "Gagal menyetujui laporan.")
        res.data?.approvedCount ?: 0
    }

    /** POST /api/reports/bulk-tolak — `alasan` wajib (maks 500, dipotong client). */
    suspend fun bulkTolak(ids: List<String>, alasan: String): DashboardResult<Int> = runCatchingSup {
        val res = api.bulkTolak(BulkTolakRequest(ids = ids, alasan = alasan.trim().take(500)))
        if (!res.success) throw Exception(res.message ?: "Gagal menolak laporan.")
        res.data?.rejectedCount ?: 0
    }

    /** POST /api/reports/{id}/tolak — alasan wajib ≤100, catatan ≤500 (client enforce). */
    suspend fun tolak(id: String, alasan: String, catatan: String?): DashboardResult<TriageOutcome> =
        runCatchingSup {
            val res = api.tolakReport(
                id,
                TolakRequest(
                    alasan = alasan.trim().take(100),
                    catatan = catatan?.trim()?.takeIf { it.isNotBlank() }?.take(500),
                ),
            )
            if (!res.success) throw TriageException(res.message ?: "Gagal menolak laporan.", false, false)
            TriageOutcome(status = res.data?.status, needsTeam = false)
        }

    /**
     * POST /api/reports/{id}/confirm-ai — HANYA `source in [warga, telegram]`.
     * Tanpa flag `needs_team` pada 422 → tidak ada retry manual di endpoint ini.
     */
    suspend fun confirmAi(id: String): DashboardResult<TriageOutcome> = runCatchingSup {
        val res = api.confirmAi(id)
        if (!res.success) {
            throw TriageException(res.message ?: "Gagal konfirmasi AI.", res.needsTeam, true)
        }
        TriageOutcome(status = res.data?.status, needsTeam = false)
    }

    /** POST /api/reports/{id}/analyze-ai — sinkron; bisa 502 bila AI gagal. */
    suspend fun analyzeAi(id: String): DashboardResult<Unit> = runCatchingSup {
        api.analyzeAi(id)
        Unit
    }

    /** DELETE /api/reports/{id}/duplicate — hapus marking duplikasi. */
    suspend fun deleteDuplicate(id: String): DashboardResult<Unit> = runCatchingSup {
        api.deleteDuplicate(id)
        Unit
    }

    /** DELETE /api/reports/{id} — supervisor boleh hapus 4 status per kontrak server. */
    suspend fun deleteReport(id: String): DashboardResult<Unit> = runCatchingSup {
        api.deleteReport(id)
        Unit
    }

    private suspend fun <T> runCatchingSup(block: suspend () -> T): DashboardResult<T> {
        return try {
            DashboardResult.Success(block())
        } catch (e: kotlinx.coroutines.CancellationException) {
            // JANGAN telan pembatalan coroutine — teruskan agar pembatalan job
            // (mis. ganti filter saat request lama jalan) benar-benar menghentikan.
            throw e
        } catch (e: TriageException) {
            throw e
        } catch (e: HttpException) {
            if (e.code() == 401) throw UnauthorizedException()
            if (e.code() == 403) throw Exception("Akses ditolak untuk aksi ini.")
            DashboardResult.Error(parseErrorMessage(e))
        } catch (e: UnauthorizedException) {
            throw e
        } catch (e: IllegalStateException) {
            throw e
        } catch (e: Exception) {
            DashboardResult.Error(e.message ?: "Tidak dapat terhubung ke server.")
        }
    }

    /**
     * Ambil `message` dari body error server (422 transisi status / validasi).
     * Best-effort: bentuk tak dikenal → pesan generik dengan kode HTTP.
     */
    private fun parseErrorMessage(e: HttpException): String {
        val fallback = "Terjadi kesalahan (${e.code()})."
        return try {
            val raw = e.response()?.errorBody()?.string().takeUnless { it.isNullOrBlank() } ?: return fallback
            val parsed = moshi.adapter(TriageActionResponse::class.java).fromJson(raw) ?: return fallback
            parsed.message ?: fallback
        } catch (_: Exception) {
            fallback
        }
    }
}

/** Hasil aksi triase sukses. */
data class TriageOutcome(
    val status: String?,
    val needsTeam: Boolean,
)

/**
 * 422 aksi triase — `message` siap tampil; `needsTeam` membawa flag server
 * (`approve-and-assign` saja); `hardFail` menandai endpoint tanpa retry manual
 * (`confirm-ai` gagal petakan tim).
 */
class TriageException(
    message: String,
    val needsTeam: Boolean,
    val hardFail: Boolean,
) : Exception(message)
