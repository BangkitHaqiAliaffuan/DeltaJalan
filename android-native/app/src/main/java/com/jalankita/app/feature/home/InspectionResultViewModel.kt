package com.jalankita.app.feature.home

import android.content.Context
import android.net.Uri
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.jalankita.app.core.data.DashboardResult
import com.jalankita.app.core.data.DiscoveredReportRequest
import com.jalankita.app.core.data.InspectionRepository
import com.jalankita.app.core.data.InspectionSubmitRequest
import com.jalankita.app.core.data.outbox.OutboxRepository
import com.jalankita.app.core.data.outbox.QueuePolicy
import com.jalankita.app.core.data.outbox.QueuedSubmission
import com.jalankita.app.core.data.UnauthorizedException
import com.jalankita.app.core.network.InspectionResultDto
import com.jalankita.app.core.network.SidoarjoBounds
import com.jalankita.app.core.util.ExifValidator
import com.jalankita.app.core.util.ImageCompressor
import com.jalankita.app.ui.theme.*
import dagger.hilt.android.lifecycle.HiltViewModel
import java.io.File
import java.util.UUID
import javax.inject.Inject
import kotlinx.coroutines.launch

private const val MAX_INSPECTION_PHOTOS = 5

data class InspectionEvidence(
    val uri: Uri,
    val file: File,
    val latitude: Double,
    val longitude: Double,
)

@HiltViewModel
class InspectionResultViewModel @Inject constructor(
    private val repository: InspectionRepository,
    private val outbox: OutboxRepository,
) : ViewModel() {
    var evidence by mutableStateOf<List<InspectionEvidence>>(emptyList())
        private set
    var condition by mutableStateOf("")
    var notes by mutableStateOf("")

    // ── Dimensi hasil ukur petugas (meter) ────────────────────────────────
    // Disimpan sebagai String karena berasal dari keyboard. Sengaja OPSIONAL:
    // petugas tanpa meteran tidak boleh dipaksa mengarang angka.
    var kerusakanPanjang by mutableStateOf("")
    var kerusakanLebar by mutableStateOf("")
    var kerusakanKedalaman by mutableStateOf("")

    // ── Karakteristik lokasi (opsional) ───────────────────────────────────
    // Pilihan tetap, bukan teks bebas: nilainya dipakai untuk menentukan
    // material perbaikan dan prioritas penanganan.
    var jenisPerkerasan by mutableStateOf<String?>(null)
    var kepadatanLaluLintas by mutableStateOf<String?>(null)

    /** Dimensi siap kirim; string kosong / nol / bukan angka menjadi null. */
    private fun dimension(raw: String): Double? {
        val v = raw.trim().replace(',', '.').toDoubleOrNull() ?: return null
        return if (v > 0) v else null
    }
    var roadName by mutableStateOf("")
    var district by mutableStateOf("")
    var error by mutableStateOf<String?>(null)
        private set

    /**
     * Galat khusus VALIDASI FOTO (kedaluwarsa, GPS hilang, di luar Sidoarjo).
     *
     * Dipisah dari [error] karena tempat tampilnya berbeda: pesan ini harus
     * muncul tepat di bawah komponen "Foto Bukti Lapangan", bukan di dasar
     * layar dekat tombol kirim. Dulu keduanya berbagi [error], sehingga petugas
     * yang fotonya kedaluwarsa tidak melihat alasannya — pesannya berada jauh
     * di bawah area gulir dan tampak seperti tombol yang rusak.
     */
    var photoError by mutableStateOf<String?>(null)

    /**
     * Hasil inspeksi/temuan benar-benar tersimpan di antrean perangkat.
     * Dipakai layar untuk menawarkan tombol "Lihat antrean" — sebelumnya
     * pengguna hanya melihat teks "disimpan" tanpa jalan menuju datanya.
     */
    var tersimpanOffline by mutableStateOf(false)
        private set
    var loading by mutableStateOf(false)
        private set
    var submitted by mutableStateOf<InspectionResultDto?>(null)
        private set
    var sessionExpired by mutableStateOf(false)
        private set
    private var draftIdempotencyKey: String? = null
    /** Pemilik draft saat ini (id assignment atau `discovered:<sessionId>`). */
    private var draftOwnerId: String? = null

    /**
     * Siapkan draft untuk satu assignment. ViewModel ini activity-scoped dan
     * dipakai bersama form hasil & form temuan, jadi draft WAJIB direset saat
     * pindah assignment — kalau tidak, foto/catatan/idempotency key assignment
     * sebelumnya ikut terkirim ke assignment lain.
     */
    fun prepare(assignmentId: String) {
        if (draftOwnerId == assignmentId) return
        resetDraft()
        draftOwnerId = assignmentId
    }

    fun prepareDiscovered(sessionId: String) {
        val owner = "discovered:$sessionId"
        if (draftOwnerId == owner) return
        resetDraft()
        draftOwnerId = owner
    }

    fun resetDraft() {
        evidence = emptyList()
        condition = ""
        notes = ""
        kerusakanPanjang = ""
        kerusakanLebar = ""
        kerusakanKedalaman = ""
        jenisPerkerasan = null
        kepadatanLaluLintas = null
        roadName = ""
        district = ""
        error = null
        photoError = null
        submitted = null
        draftIdempotencyKey = null
        tersimpanOffline = false
        draftOwnerId = null
    }

    private fun draftKey(): String = draftIdempotencyKey ?: UUID.randomUUID().toString().also { draftIdempotencyKey = it }

    val canAddMore: Boolean get() = evidence.size < MAX_INSPECTION_PHOTOS
    val isValid: Boolean get() = evidence.isNotEmpty() && notes.isNotBlank()
    val discoveredValid: Boolean get() = roadName.isNotBlank() && district.isNotBlank() && evidence.size == 1 && notes.isNotBlank()

    fun addPhotos(context: Context, uris: List<Uri>, discovered: Boolean = false) {
        if (loading) return
        error = null
        photoError = null
        viewModelScope.launch {
            val room = if (discovered) 1 else MAX_INSPECTION_PHOTOS - evidence.size
            val next = evidence.toMutableList()
            for (uri in uris.take(room)) {
                val validated = ExifValidator.validate(context, uri, requireGps = true, checkDate = true)
                val lat = validated.lat
                val lng = validated.lng
                if (!validated.isValid || lat == null || lng == null) {
                    // Ditaruh di photoError, bukan error: alasannya harus terbaca
                    // tepat di bawah komponen foto (mis. "foto kedaluwarsa").
                    photoError = validated.message.ifBlank { "Foto inspeksi harus memiliki EXIF tanggal dan GPS." }
                    continue
                }
                if (!SidoarjoBounds.contains(lat, lng)) {
                    photoError = "Lokasi foto berada di luar wilayah Kabupaten Sidoarjo."
                    continue
                }
                val compressed = ImageCompressor.compressToFileWithExif(context, uri, lat, lng)
                if (compressed == null) {
                    photoError = "Foto tidak dapat diproses. Silakan pilih foto lain."
                    continue
                }
                // Server memvalidasi ulang tanggal dari file yang diterima; gagal di
                // sini jauh lebih jelas daripada 422 setelah upload.
                if (!compressed.hasDate) {
                    photoError = "Metadata tanggal foto hilang saat diproses. Gunakan foto asli dari kamera perangkat."
                    compressed.file.delete()
                    continue
                }
                next += InspectionEvidence(uri, compressed.file, lat, lng)
            }
            evidence = if (discovered) next.take(1) else next
        }
    }

    fun clearPhotoError() { photoError = null }

    private companion object {
        const val MSG_OFFLINE_HASIL =
            "Tidak dapat terhubung. Hasil inspeksi disimpan dan akan dikirim otomatis saat online."
        const val MSG_OFFLINE_TEMUAN =
            "Tidak dapat terhubung. Temuan disimpan dan akan dikirim otomatis saat online."
        const val MSG_OFFLINE_GAGAL =
            "Tidak dapat terhubung dan antrean offline gagal disimpan. Coba lagi."
    }

    /**
     * Tampilkan masalah foto yang berasal dari LAYAR, bukan dari validasi EXIF
     * (mis. izin kamera ditolak atau tidak ada aplikasi kamera). Tetap masuk
     * `photoError` supaya terbaca di kartu foto, bukan di dasar layar.
     */
    fun reportPhotoProblem(pesan: String) { photoError = pesan }

    fun removePhoto(index: Int) {
        if (index in evidence.indices) evidence = evidence.toMutableList().also { it.removeAt(index) }
    }

    fun submit(assignmentId: String, sessionId: String? = null) {
        if (!isValid) { error = "Tambahkan foto inspeksi dan catatan hasil pemeriksaan."; return }
        // `send()` memakai `evidence.first()` tanpa cek kosong. Guard di atas sudah
        // menjamin tidak kosong, tapi Draft yang ter-reset alur navigasi bisa lolos
        // dengan evidence kosong → NoSuchElementException (crash, bukan pesan galat).
        if (evidence.isEmpty()) { error = "Foto bukti hilang, silakan pilih ulang."; return }
        if (loading) return
        send(assignmentId, sessionId)
    }

    fun submitDiscovered(sessionId: String) {
        if (!discoveredValid) { error = "Isi nama jalan, kecamatan, catatan, dan satu foto temuan."; return }
        val item = evidence.single()
        loading = true
        error = null
        viewModelScope.launch {
            try {
                when (val result = repository.createDiscoveredReport(
                    sessionId,
                    DiscoveredReportRequest(
                        idempotencyKey = draftKey(),
                        roadName = roadName.trim(),
                        district = district.trim(),
                        latitude = item.latitude,
                        longitude = item.longitude,
                        description = notes.trim(),
                        photo = item.file,
                    ),
                )) {
                    is DashboardResult.Success -> submitted = result.data
                    // Gangguan jaringan/server = sementara → simpan ke antrean
                    // offline. Penolakan 4xx = permanen → tampilkan alasannya,
                    // jangan antrekan (mengulang tidak akan pernah berhasil).
                    is DashboardResult.Error ->
                        if (result.isNetwork) {
                            simpanTemuanOffline(sessionId, item, result.message)
                        } else {
                            error = result.message
                        }
                }
            } catch (_: UnauthorizedException) { sessionExpired = true }
            catch (e: Exception) {
                simpanTemuanOffline(sessionId, item, e.message)
            } finally { loading = false }
        }
    }

    private fun send(assignmentId: String, sessionId: String?) {
        val files = evidence.map { it.file }
        val first = evidence.first()
        loading = true
        error = null
        viewModelScope.launch {
            val key = draftKey()
            try {
                when (val result = repository.submitResult(
                    assignmentId,
                    InspectionSubmitRequest(
                        idempotencyKey = key,
                        condition = condition.trim().ifBlank { null },
                        notes = notes.trim(),
                        kerusakanPanjang = dimension(kerusakanPanjang),
                        kerusakanLebar = dimension(kerusakanLebar),
                        kerusakanKedalaman = dimension(kerusakanKedalaman),
                        jenisPerkerasan = jenisPerkerasan,
                        kepadatanLaluLintas = kepadatanLaluLintas,
                        latitude = first.latitude,
                        longitude = first.longitude,
                        photos = files,
                    ),
                )) {
                    is DashboardResult.Success -> submitted = result.data
                    is DashboardResult.Error ->
                        if (result.isNetwork) {
                            simpanHasilOffline(assignmentId, sessionId, key, result.message)
                        } else {
                            error = result.message
                        }
                }
            } catch (_: UnauthorizedException) { sessionExpired = true }
            catch (e: Exception) {
                simpanHasilOffline(assignmentId, sessionId, key, e.message)
            } finally { loading = false }
        }
    }

    /**
     * Simpan hasil inspeksi ke antrean offline.
     *
     * Dulu jalur ini HANYA ada di `catch (e: Exception)`, padahal
     * [com.jalankita.app.core.data.InspectionRepository] membungkus semua
     * kegagalan menjadi [DashboardResult.Error] — akibatnya blok itu tidak
     * pernah dijalankan dan pekerjaan petugas di lokasi tanpa sinyal hilang.
     */
    private suspend fun simpanHasilOffline(
        assignmentId: String,
        sessionId: String?,
        key: String,
        alasan: String?,
    ) {
        val first = evidence.firstOrNull()
        if (first == null) {
            error = "Foto bukti hilang, silakan pilih ulang."
            return
        }
        val now = System.currentTimeMillis()
        val tersimpan = runCatching {
            outbox.enqueue(
                item = QueuedSubmission(
                    kind = QueuedSubmission.KIND_INSPECTION_RESULT,
                    assignmentId = assignmentId,
                    sessionId = sessionId,
                    condition = condition.trim().ifBlank { null },
                    notes = notes.trim(),
                    kerusakanPanjang = dimension(kerusakanPanjang),
                    kerusakanLebar = dimension(kerusakanLebar),
                    kerusakanKedalaman = dimension(kerusakanKedalaman),
                    jenisPerkerasan = jenisPerkerasan,
                    kepadatanLaluLintas = kepadatanLaluLintas,
                    latitude = first.latitude,
                    longitude = first.longitude,
                    idempotencyKey = key,
                    lastError = alasan,
                    createdAt = now,
                    // Foto inspeksi hanya diterima server bila umurnya <= 2 hari.
                    expiresAt = QueuePolicy.expiresAt(
                        QueuedSubmission.KIND_INSPECTION_RESULT, null, now,
                    ),
                ),
                photos = evidence.map { it.file },
            )
        }.getOrDefault(false)
        error = if (tersimpan) MSG_OFFLINE_HASIL else MSG_OFFLINE_GAGAL
        tersimpanOffline = tersimpan
    }

    /** Simpan temuan lapangan (satu foto) ke antrean offline. */
    private suspend fun simpanTemuanOffline(
        sessionId: String,
        item: InspectionEvidence,
        alasan: String?,
    ) {
        val now = System.currentTimeMillis()
        val tersimpan = runCatching {
            outbox.enqueue(
                item = QueuedSubmission(
                    kind = QueuedSubmission.KIND_DISCOVERED_REPORT,
                    assignmentId = sessionId,
                    sessionId = sessionId,
                    notes = notes.trim(),
                    roadName = roadName.trim(),
                    district = district.trim(),
                    latitude = item.latitude,
                    longitude = item.longitude,
                    idempotencyKey = draftKey(),
                    lastError = alasan,
                    createdAt = now,
                    expiresAt = QueuePolicy.expiresAt(
                        QueuedSubmission.KIND_DISCOVERED_REPORT, null, now,
                    ),
                ),
                photos = listOf(item.file),
            )
        }.getOrDefault(false)
        error = if (tersimpan) MSG_OFFLINE_TEMUAN else MSG_OFFLINE_GAGAL
        tersimpanOffline = tersimpan
    }

    fun clearSubmitted() {
        submitted = null
        draftIdempotencyKey = null
        tersimpanOffline = false
    }
}
