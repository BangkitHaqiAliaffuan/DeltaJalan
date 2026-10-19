package com.jalankita.app.core.data

import com.jalankita.app.core.network.ApiService
import com.jalankita.app.core.network.DuplicateCheckPhoto
import com.jalankita.app.core.network.DuplicateCheckRequest
import com.jalankita.app.core.network.DuplicateCheckResponse
import com.jalankita.app.core.util.sha256Hex
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton

/** Foto tervalidasi + koordinat untuk pengecekan duplikat. */
data class DuplicatePhotoInput(
    val file: File,
    val lat: Double,
    val lng: Double,
)

/**
 * Cek duplikat laporan (endpoint publik `/api/v1/reports/check-duplicate`).
 * Best-effort: dipakai petugas & warga sebelum submit; kegagalan → Error
 * (pemanggil memperlakukannya sebagai "tidak ada duplikat", jangan blokir).
 */
@Singleton
class DuplicateRepository @Inject constructor(
    private val api: ApiService,
) {
    suspend fun check(photos: List<DuplicatePhotoInput>): DashboardResult<DuplicateCheckResponse> =
        withContext(Dispatchers.IO) {
            try {
                val payload = photos.map {
                    DuplicateCheckPhoto(hash = sha256Hex(it.file), lat = it.lat, lng = it.lng)
                }
                val first = photos.firstOrNull()
                val res = api.checkDuplicate(
                    DuplicateCheckRequest(
                        latitude = first?.lat,
                        longitude = first?.lng,
                        photos = payload,
                    ),
                )
                DashboardResult.Success(res)
            } catch (e: Exception) {
                DashboardResult.Error(e.message ?: "Gagal memeriksa duplikat.")
            }
        }
}
