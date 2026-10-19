package com.jalankita.app.feature.lapor

import android.content.Context
import android.net.Uri
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.SnapshotStateList
import androidx.compose.runtime.toMutableStateList
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.jalankita.app.core.data.DashboardRepository
import com.jalankita.app.core.data.DuplicatePhotoInput
import com.jalankita.app.core.data.DuplicateRepository
import com.jalankita.app.core.data.ReportRepository
import com.jalankita.app.core.data.ReportResult
import com.jalankita.app.core.data.DashboardResult
import com.jalankita.app.core.data.RoadSearchRepository
import com.jalankita.app.core.data.RoadSuggestion
import com.jalankita.app.core.data.SurveyRepository
import com.jalankita.app.core.data.UnauthorizedException
import com.jalankita.app.core.network.BatchAnalysisDto
import com.jalankita.app.core.network.DetectionDto
import com.jalankita.app.core.network.DuplicateWarning
import com.jalankita.app.core.network.MAX_PETUGAS_PHOTOS
import com.jalankita.app.core.network.ReportDataDto
import com.jalankita.app.core.network.SidoarjoBounds
import com.jalankita.app.core.network.SurveyTask
import com.jalankita.app.core.network.toWarning
import com.jalankita.app.core.util.ExifValidator
import com.jalankita.app.core.util.ImageCompressor
import com.jalankita.app.core.util.PatrolRotation
import com.jalankita.app.core.util.ReverseGeocoder
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import javax.inject.Inject

/** Tahapan alur lapor (state machine). SELECT = pilih tugas patroli hari ini. */
enum class LaporStage { SELECT, PICK, VALIDATED, ANALYZING, RESULT, SUBMITTING }

/** Modal peringatan EXIF (replikasi `fraudModal` frontend). */
data class FraudAlert(
    val title: String,
    val message: String,
    /** Label tombol aksi opsional (mis. pilih ulang via File) — null = tanpa aksi. */
    val actionLabel: String? = null,
    /** Callback tombol aksi — null = tanpa aksi. */
    val onAction: (() -> Unit)? = null,
)

/**
 * Satu foto dalam laporan petugas (multi-foto, maks [MAX_PETUGAS_PHOTOS]).
 * `latitude`/`longitude` = GPS foto (EXIF atau manual). `detections` diisi hasil analisis batch.
 */
data class PetugasPhoto(
    val file: File,
    val uri: Uri,
    val latitude: Double,
    val longitude: Double,
    val detections: List<DetectionDto> = emptyList(),
    /** Dimensi kerusakan per foto (backend batch butuh array per foto). */
    val panjang: String = "",
    val lebar: String = "",
    val imageResult: String? = null,
)

@HiltViewModel
class LaporViewModel @Inject constructor(
    private val repo: ReportRepository,
    private val geocoder: ReverseGeocoder,
    private val surveyRepo: SurveyRepository,
    private val dashboardRepo: DashboardRepository,
    private val dupRepo: DuplicateRepository,
    private val roadRepo: RoadSearchRepository,
) : ViewModel() {

    var stage by mutableStateOf(LaporStage.SELECT)
        private set

    // ── Jadwal cek rutin hari ini (mode daftar, port upload.tsx) ────────────
    /** Tugas survei tim hari ini (GET /survei?tanggal_patroli=today, server scope tim). */
    var todayTasks by mutableStateOf<List<SurveyTask>>(emptyList())
        private set
    var todayLoading by mutableStateOf(false)
        private set
    var todayError by mutableStateOf<String?>(null)
        private set
    /** Tanggal yang terakhir dimuat (yyyy-MM-dd lokal, cermin todayStr() web). */
    var todayDate by mutableStateOf("")
        private set

    /**
     * Muat jadwal hari ini + susun rotasi kecamatan ekspektasi (port
     * useSurveyList + sortedTasks web). Dipanggil tiap buka layar Lapor
     * (cermin refetchOnMount:"always").
     */
    fun loadTodayTasks(teamId: String?, force: Boolean = false) {
        if (todayLoading) return
        val today = SimpleDateFormat("yyyy-MM-dd", Locale("id")).format(Date())
        if (!force && todayDate == today && todayTasks.isNotEmpty()) return
        viewModelScope.launch {
            todayLoading = true
            todayError = null
            try {
                val tasks = when (val r = surveyRepo.list(tanggalPatroli = today)) {
                    is DashboardResult.Success -> r.data
                    is DashboardResult.Error -> throw Exception(r.message)
                }
                val schedules = if (teamId.isNullOrBlank()) {
                    emptyList()
                } else {
                    when (val r = dashboardRepo.patrolSchedules(teamId)) {
                        is DashboardResult.Success -> r.data
                        is DashboardResult.Error -> emptyList()
                    }
                }
                todayTasks = PatrolRotation.sortExpectedFirst(tasks, schedules)
                todayDate = today
            } catch (_: UnauthorizedException) {
                sessionExpired = true
            } catch (e: Exception) {
                todayError = e.message ?: "Gagal memuat jadwal patroli."
            } finally {
                todayLoading = false
            }
        }
    }

    /** Pilih tugas dari daftar → ikat + masuk mode capture (cermin ?taskId= web). */
    fun pilihTugas(task: SurveyTask) {
        setSurveyTask(task.id, task.roadName, task.kecamatan)
        photos.clear()
        batchId = null
        error = null
        fraudAlert = null
        stage = LaporStage.PICK
    }

    // ── Foto (multi) ──────────────────────────────────────────────────────
    /** Daftar foto laporan (maks [MAX_PETUGAS_PHOTOS]). */
    var photos: SnapshotStateList<PetugasPhoto> = mutableListOf<PetugasPhoto>().toMutableStateList()
        private set
    /** id batch dari POST /analyze-batch — dipakai saat submit /reports/batch. */
    var batchId by mutableStateOf<String?>(null)
        private set

    /**
     * Ubah dimensi (panjang/lebar) satu foto. Mengganti item di SnapshotStateList
     * agar Compose me-recompose (PetugasPhoto bukan @Stable, mutasi field biasa
     * TIDAK memicu recomposition).
     */
    fun updatePhotoDimensi(index: Int, panjang: String? = null, lebar: String? = null) {
        if (index !in photos.indices) return
        val p = photos[index]
        photos[index] = p.copy(
            panjang = panjang ?: p.panjang,
            lebar = lebar ?: p.lebar,
        )
    }

    val canAddMore: Boolean get() = photos.size < MAX_PETUGAS_PHOTOS

    /** GPS foto utama (untuk form + autofill). */
    val exifLat: Double? get() = photos.firstOrNull()?.latitude
    val exifLng: Double? get() = photos.firstOrNull()?.longitude

    // Modal peringatan EXIF
    var fraudAlert by mutableStateOf<FraudAlert?>(null)
        private set

    // Analisis AI (ringkasan; deteksi per foto ada di PetugasPhoto.detections)
    var analyzeResult by mutableStateOf<List<BatchAnalysisDto>>(emptyList())
        private set
    var totalDetections by mutableStateOf(0)
        private set
    var overallSeverity by mutableStateOf<String?>(null)
        private set

    // Form laporan (header laporan; dimensi per foto ada di PetugasPhoto)
    var roadName by mutableStateOf("")
    var district by mutableStateOf("")
    var catatan by mutableStateOf("")

    /** true saat reverse geocoding GPS → auto-isi nama jalan/kecamatan (indikator loading). */
    var geocoding by mutableStateOf(false)
        private set
    /** true bila `roadName` diisi geocoder dari address.road yang sah (boleh dikunci). */
    var roadNameLocked by mutableStateOf(false)
        private set

    // Status
    var busy by mutableStateOf(false)
        private set
    var error by mutableStateOf<String?>(null)
        private set
    var savedReport by mutableStateOf<ReportDataDto?>(null)
        private set

    /**
     * true bila server membalas 401 (token dicabut). MainScaffold memakai ini
     * untuk memanggil authVm.refreshSession() → kembali ke Login.
     */
    var sessionExpired by mutableStateOf(false)
        private set

    /** Id sesi patroli (opsional) — laporan diikat ke sesi cek rutin (`survey_task_id`). */
    var surveyTaskId by mutableStateOf<String?>(null)
        private set

    /** Konteks sesi patroli (banner "Upload laporan untuk:"). */
    var surveyRoadName by mutableStateOf<String?>(null)
        private set
    var surveyKecamatan by mutableStateOf<String?>(null)
        private set

    fun dismissFraudAlert() { fraudAlert = null }
    fun clearError() { error = null }

    // ── Cek duplikat (best-effort, non-blokir) ─────────────────────────────
    var duplicateChecking by mutableStateOf(false)
        private set
    var duplicateWarning by mutableStateOf<DuplicateWarning?>(null)
        private set

    fun dismissDuplicateWarning() { duplicateWarning = null }

    // ── Autocomplete nama jalan (LocationIQ; fallback manual bila key kosong) ──
    private var roadSearchJob: Job? = null
    var roadSuggestions by mutableStateOf<List<RoadSuggestion>>(emptyList())
        private set
    var roadSearchLoading by mutableStateOf(false)
        private set
    val roadSearchEnabled: Boolean get() = roadRepo.isConfigured

    fun onRoadQueryChange(q: String) {
        roadName = q
        roadSearchJob?.cancel()
        if (q.trim().length < RoadSearchRepository.MIN_QUERY_LENGTH) {
            roadSuggestions = emptyList()
            roadSearchLoading = false
            return
        }
        roadSearchLoading = true
        roadSearchJob = viewModelScope.launch {
            delay(400)
            roadSuggestions = roadRepo.search(q)
            roadSearchLoading = false
        }
    }

    /** Pilih saran: isi nama jalan + kecamatan, lalu kunci field. Koordinat tetap dari GPS foto. */
    fun pickRoadSuggestion(s: RoadSuggestion) {
        roadName = s.roadName
        if (!s.kecamatan.isNullOrBlank()) district = s.kecamatan
        roadNameLocked = true
        roadSuggestions = emptyList()
    }

    fun dismissRoadSuggestions() { roadSuggestions = emptyList() }

    /** Set sesi patroli tujuan (tanpa konteks tampilan). */
    fun setSurveyTask(surveyId: String?) { surveyTaskId = surveyId }

    /**
     * Set sesi patroli + konteks tampilan (nama jalan & kecamatan) sekaligus
     * mengisi awal form dari sesi (padanan web upload.tsx).
     */
    fun setSurveyTask(surveyId: String?, roadName: String?, kecamatan: String?) {
        surveyTaskId = surveyId
        surveyRoadName = roadName
        surveyKecamatan = kecamatan
        if (!roadName.isNullOrBlank() && this.roadName.isBlank()) this.roadName = roadName
        if (!kecamatan.isNullOrBlank() && district.isBlank()) district = kecamatan
    }

    /**
     * Tambah beberapa foto sekaligus (maks [MAX_PETUGAS_PHOTOS]).
     * Validasi EXIF (tgl + GPS) + fallback server per foto, lalu kompres.
     * Foto pertama gagal → fraudAlert (blokir). Foto berikutnya gagal → dilewati.
     */
    fun addPhotos(context: Context, uris: List<Uri>, checkDate: Boolean = true) {
        fraudAlert = null
        error = null
        viewModelScope.launch {
            val room = MAX_PETUGAS_PHOTOS - photos.size
            var added = 0
            for (uri in uris.take(room)) {
                val valResult = ExifValidator.validate(context, uri, requireGps = true, checkDate = checkDate)

                var lat = valResult.lat
                var lng = valResult.lng
                // Fallback server saat GPS lokal tak terbaca (redaksi Android 10+).
                if (!valResult.isValid && valResult.status == ExifValidator.Status.NO_GPS) {
                    fetchServerGps(context, uri)?.let { lat = it.first; lng = it.second }
                }

                if (!valResult.isValid && (lat == null || lng == null)) {
                    if (photos.isEmpty() && added == 0) {
                        fraudAlert = FraudAlert(valResult.title, valResult.message)
                        return@launch
                    }
                    continue // foto tambahan gagal → lewati
                }

                val la = lat
                val ln = lng
                if (la == null || ln == null || !SidoarjoBounds.contains(la, ln)) {
                    if (photos.isEmpty() && added == 0) {
                        fraudAlert = FraudAlert(
                            "Foto di Luar Wilayah",
                            "Foto diambil di luar wilayah Kabupaten Sidoarjo. " +
                                "Pastikan Anda berada di lokasi kerusakan saat mengambil foto.",
                        )
                        return@launch
                    }
                    continue
                }

                val compressed = ImageCompressor.compressToFile(context, uri, lat = la, lng = ln)
                if (compressed == null) {
                    if (photos.isEmpty() && added == 0) {
                        error = "Gagal memproses foto. Coba lagi."
                        return@launch
                    }
                    continue
                }
                photos.add(PetugasPhoto(compressed, uri, la, ln))
                added++
            }
            if (added > 0) {
                stage = LaporStage.VALIDATED
                // Auto-isi nama jalan/kecamatan dari GPS foto utama (pola upload warga).
                // Tidak menimpa bila laporan dari sesi patroli (kecamatan terkunci).
                if (surveyTaskId == null && roadName.isBlank()) {
                    val first = photos.firstOrNull()
                    if (first != null) reverseGeocodePrimary(first.latitude, first.longitude)
                }
                runDuplicateCheck()
            }
        }
    }

    /** Cek duplikat (SHA-256 + spatial 6 m). Best-effort: gagal → tanpa warning. */
    private fun runDuplicateCheck() {
        val ps = photos
        if (ps.isEmpty()) return
        viewModelScope.launch {
            duplicateChecking = true
            try {
                when (val r = dupRepo.check(ps.map { DuplicatePhotoInput(it.file, it.latitude, it.longitude) })) {
                    is DashboardResult.Success -> duplicateWarning = r.data.toWarning()
                    is DashboardResult.Error -> duplicateWarning = null
                }
            } finally {
                duplicateChecking = false
            }
        }
    }

    /** Hapus satu foto (batal pilih). */
    fun removePhoto(index: Int) {
        if (index in photos.indices) photos.removeAt(index)
        if (photos.isEmpty()) stage = if (surveyTaskId == null) LaporStage.SELECT else LaporStage.PICK
        batchId = null
        analyzeResult = emptyList()
        duplicateWarning = null
        runDuplicateCheck()
    }

    /**
     * Reverse geocoding koordinat foto lalu auto-isi form (port upload warga):
     *  - `roadName` ← address.road ("Jalan X" → "Jl. X"); field dikunci bila road sah.
     *  - `district` ← kecamatan yang cocok 18 kecamatan Sidoarjo (bila masih kosong).
     * Best-effort: kegagalan tidak mengganggu alur.
     */
    suspend fun reverseGeocodePrimary(lat: Double, lng: Double) {
        if (geocoding) return
        geocoding = true
        try {
            val res = geocoder.reverseGeocode(lat, lng)
            if (res.namaJalan.isNotBlank() && roadName.isBlank()) {
                roadName = res.namaJalan
                roadNameLocked = res.roadFound
            }
            if (res.kecamatan != null && district.isBlank()) {
                district = res.kecamatan
            }
        } catch (_: Exception) {
            // biarkan form apa adanya — user isi manual
        } finally {
            geocoding = false
        }
    }

    /** Fallback GPS server (setRequireOriginal → upload → hapus temp). Best-effort. */
    private suspend fun fetchServerGps(context: Context, uri: Uri): Pair<Double, Double>? {
        return try {
            val tmp = ImageCompressor.copyOriginalToCache(context, uri) ?: return null
            try {
                repo.extractExifGps(tmp)
            } finally {
                tmp.delete()
            }
        } catch (_: Exception) {
            null
        }
    }

    /** POST /api/analyze-batch — analisis semua foto (maks 10). */
    fun analyze() {
        // Tanpa tugas patroli terikat → tolak (cermin `if (!taskId) return` web).
        if (surveyTaskId == null) {
            error = "Pilih tugas patroli hari ini terlebih dahulu."
            return
        }
        if (photos.isEmpty()) return
        viewModelScope.launch {
            busy = true
            error = null
            stage = LaporStage.ANALYZING
            try {
                val first = photos.first()
                val res = repo.analyzeBatch(
                    imageFiles = photos.map { it.file },
                    latitude = first.latitude,
                    longitude = first.longitude,
                )
                when (res) {
                    is ReportResult.Success -> {
                        val bid = res.data.batchId
                        if (bid == null) {
                            error = "Server tidak mengembalikan batch_id."
                            stage = LaporStage.VALIDATED
                            return@launch
                        }
                        batchId = bid
                        val analyses = res.data.analyses.orEmpty()
                        analyzeResult = analyses
                        // Distribusikan deteksi per foto berdasarkan file_index.
                        analyses.forEach { a ->
                            val idx = a.fileIndex
                            if (idx in photos.indices) {
                                photos[idx] = photos[idx].copy(
                                    detections = a.detections.orEmpty(),
                                    imageResult = a.imageResult,
                                )
                            }
                        }
                        totalDetections = analyses.sumOf { it.detections?.size ?: 0 }
                        overallSeverity = analyses.maxByOrNull { it.confidence ?: 0.0 }?.severity
                        stage = LaporStage.RESULT
                    }
                    is ReportResult.Error -> {
                        error = res.error.message
                        stage = LaporStage.VALIDATED
                    }
                }
            } catch (_: UnauthorizedException) {
                sessionExpired = true
            } finally {
                busy = false
            }
        }
    }

    /** POST /api/reports/batch. */
    fun submit() {
        val bid = batchId
        if (bid == null) { error = "Analisis belum selesai."; return }
        // Id sintetis "schedule-*" bukan task nyata → jangan diikat (aturan web).
        val boundTaskId = surveyTaskId?.takeIf { it.isNotBlank() && !it.startsWith("schedule-") }
        if (boundTaskId == null) {
            error = "Pilih tugas patroli hari ini terlebih dahulu."
            return
        }
        if (roadName.isBlank() || district.isBlank()) {
            error = "Lengkapi nama jalan dan kecamatan."
            return
        }
        if (photos.any { it.panjang.isBlank() || it.lebar.isBlank() }) {
            error = "Lengkapi panjang & lebar untuk setiap foto."
            return
        }
        val lat = exifLat
        val lng = exifLng
        if (lat == null || lng == null) {
            error = "Koordinat GPS tidak tersedia."
            return
        }
        // koordinat_sumber: "exif" bila GPS foto sah (bukan fallback manual).
        val koordinatSumber = if (photos.all { SidoarjoBounds.contains(it.latitude, it.longitude) }) "exif" else "manual"

        viewModelScope.launch {
            busy = true
            error = null
            stage = LaporStage.SUBMITTING
            try {
                val res = repo.createReportBatch(
                    batchId = bid,
                    roadName = roadName,
                    district = district,
                    latitude = lat,
                    longitude = lng,
                    koordinatSumber = koordinatSumber,
                    panjang = photos.map { it.panjang.toDoubleOrNull() ?: 0.0 },
                    lebar = photos.map { it.lebar.toDoubleOrNull() ?: 0.0 },
                    catatan = catatan,
                    surveyTaskId = boundTaskId,
                    imageFiles = photos.map { it.file },
                )
                when (res) {
                    is ReportResult.Success -> savedReport = res.data
                    is ReportResult.Error -> {
                        error = buildString {
                            append(res.error.message)
                            res.error.existingReport?.reportCode?.let {
                                append("\n\nLaporan terkait: $it")
                            }
                        }
                        stage = LaporStage.RESULT
                    }
                }
            } catch (_: UnauthorizedException) {
                sessionExpired = true
            } finally {
                busy = false
            }
        }
    }

    /** Reset ke awal (lapor lagi). Jadwal hari ini di-cache (tidak dimuat ulang di sini). */
    fun reset() {
        stage = LaporStage.SELECT
        photos.clear()
        batchId = null
        analyzeResult = emptyList(); totalDetections = 0; overallSeverity = null
        roadName = ""; district = ""; catatan = ""
        error = null; savedReport = null; fraudAlert = null
        geocoding = false; roadNameLocked = false
        duplicateWarning = null; duplicateChecking = false
        roadSuggestions = emptyList(); roadSearchLoading = false
        surveyTaskId = null
        surveyRoadName = null
        surveyKecamatan = null
    }
}
