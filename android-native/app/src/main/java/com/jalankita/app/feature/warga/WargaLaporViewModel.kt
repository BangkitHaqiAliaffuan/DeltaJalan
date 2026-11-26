package com.jalankita.app.feature.warga

import android.content.Context
import android.net.Uri
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.jalankita.app.core.data.DashboardResult
import com.jalankita.app.core.data.ErrorKind
import com.jalankita.app.core.data.classifyFailure
import com.jalankita.app.core.data.DuplicatePhotoInput
import com.jalankita.app.core.data.DuplicateRepository
import com.jalankita.app.core.data.outbox.OutboxRepository
import com.jalankita.app.core.data.outbox.QueuePolicy
import com.jalankita.app.core.data.outbox.QueuedSubmission
import com.jalankita.app.core.data.RoadSearchRepository
import com.jalankita.app.core.data.RoadSuggestion
import com.jalankita.app.core.data.UnauthorizedException
import com.jalankita.app.core.data.WargaRepository
import com.jalankita.app.core.data.WargaSubmitException
import com.jalankita.app.core.network.DuplicateWarning
import com.jalankita.app.core.network.SidoarjoBounds
import com.jalankita.app.core.network.WargaSubmitData
import com.jalankita.app.core.network.toWarning
import com.jalankita.app.core.util.ExifValidator
import com.jalankita.app.core.util.GeocodeStage
import com.jalankita.app.core.util.ImageCompressor
import com.jalankita.app.core.util.ReverseGeocoder
import java.util.UUID
import com.jalankita.app.feature.lapor.FraudAlert
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull
import java.io.File
import javax.inject.Inject

/** Maks foto per laporan warga — kontrak: store() 'images' max:3. */
const val WARGA_MAX_PHOTOS = 3

/** Batas tunggu reverse geocoding sebelum form dianggap gagal terisi otomatis. */
private const val GEOCODE_TIMEOUT_MS = 12_000L

/** Satu foto tervalidasi siap submit. */
data class WargaPhoto(
    val file: File,
    val uri: Uri,
    val lat: Double,
    val lng: Double,
)

/**
 * Alur lapor warga — replikasi warga/lapor.tsx (mode disederhanakan):
 * multi-foto (maks 3) → validasi EXIF 7 hari + GPS Sidoarjo per foto →
 * form → POST /warga/reports. TANPA langkah /analyze (server auto-AI)
 * dan TANPA captcha_token (server hanya verifikasi bila token dikirim).
 */
@HiltViewModel
class WargaLaporViewModel @Inject constructor(
    private val repo: WargaRepository,
    private val geocoder: ReverseGeocoder,
    private val dupRepo: DuplicateRepository,
    private val roadRepo: RoadSearchRepository,
    private val outbox: OutboxRepository,
) : ViewModel() {

    var photos by mutableStateOf<List<WargaPhoto>>(emptyList())
        private set
    /** Foto dilewati karena gagal validasi (foto ke-2+, meniru server skip+warning). */
    var skippedCount by mutableStateOf(0)
        private set

    var fraudAlert by mutableStateOf<FraudAlert?>(null)
        private set

    /** Tahap reverse geocoding GPS foto utama → jalan/kecamatan/alamat. */
    var geocodeStage by mutableStateOf(GeocodeStage.IDLE)
        private set
    /** Turunan untuk pemanggil lama: true saat geocoding berjalan. */
    val geocoding: Boolean get() = geocodeStage == GeocodeStage.LOADING
    /** true bila nama jalan terisi dari GPS (dari address.road) → field dikunci. */
    var roadNameLocked by mutableStateOf(false)
        private set

    // Form
    var roadName by mutableStateOf("")
    var district by mutableStateOf("")
    var panjang by mutableStateOf("")
    var lebar by mutableStateOf("")
    var catatan by mutableStateOf("")
    var fullAddress by mutableStateOf("")

    var busy by mutableStateOf(false)
        private set
    var error by mutableStateOf<String?>(null)
        private set
    var savedReport by mutableStateOf<WargaSubmitData?>(null)
        private set

    /** Pesan gagal dari jalur yang tidak lewat jaringan (mis. izin kamera/lokasi). */
    fun laporkanMasalahFoto(pesan: String) {
        error = pesan
    }
    var serverWarnings by mutableStateOf<List<String>>(emptyList())
        private set
    var sessionExpired by mutableStateOf(false)
        private set
    var queuedOffline by mutableStateOf(false)
        private set

    // ── Cek duplikat (best-effort, non-blokir) ─────────────────────────────
    var duplicateChecking by mutableStateOf(false)
        private set
    var duplicateWarning by mutableStateOf<DuplicateWarning?>(null)
        private set

    fun dismissDuplicateWarning() { duplicateWarning = null }

    // ── Autocomplete nama jalan (LocationIQ; fallback manual bila key kosong) ──
    private var roadSearchJob: Job? = null

    /**
     * Kunci idempotensi untuk satu draft laporan. Dipakai bersama oleh kiriman
     * langsung dan antrean offline: bila respons hilang di jalan padahal server
     * sudah menyimpan, percobaan ulang mengembalikan laporan yang sama alih-alih
     * membuat duplikat atau ditolak `DUPLICATE_IMAGE`.
     */
    private var draftIdempotencyKey: String = UUID.randomUUID().toString()
    var roadSuggestions by mutableStateOf<List<RoadSuggestion>>(emptyList())
        private set
    var roadSearchLoading by mutableStateOf(false)
        private set
    /** false bila LocationIQ tak dikonfigurasi (key kosong) → input manual saja. */
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

    fun dismissFraudAlert() { fraudAlert = null }
    fun clearError() { error = null }

    val canAddMore: Boolean get() = photos.size < WARGA_MAX_PHOTOS

    fun removePhoto(index: Int) {
        photos = photos.filterIndexed { i, _ -> i != index }
        duplicateWarning = null
        // Tanpa foto tidak ada lagi lokasi foto — jangan biarkan status
        // "terisi dari GPS" menyesatkan. Nama jalan yang sudah diisi dibiarkan.
        if (photos.isEmpty()) geocodeStage = GeocodeStage.IDLE
        runDuplicateCheck()
    }

    /**
     * Tambah foto: validasi EXIF (7 hari + GPS) + cek Sidoarjo.
     * Foto pertama gagal → fraudAlert (blokir, meniru 422 foto-0 server).
     * Foto berikutnya gagal → dilewati + skippedCount (meniru skip server).
     *
     * Bila validasi lokal gagal HANYA karena GPS tak terbaca (NO_GPS) padahal
     * tanggal lolos, dicoba fallback server (Opsi A): byte asli diupload,
     * PHP membaca EXIF tanpa redaksi Android.
     */
    fun addPhotos(context: Context, uris: List<Uri>) {
        fraudAlert = null
        error = null
        viewModelScope.launch {
            val room = WARGA_MAX_PHOTOS - photos.size
            for (uri in uris.take(room)) {
                val valResult = ExifValidator.validate(
                    context, uri,
                    requireGps = true,
                    checkDate = true,
                    maxAgeDays = ExifValidator.MAX_AGE_DAYS_WARGA,
                )
                var lat = valResult.lat
                var lng = valResult.lng
                if (!valResult.isValid && valResult.status == ExifValidator.Status.NO_GPS) {
                    fetchServerGps(context, uri)?.let {
                        lat = it.first
                        lng = it.second
                    }
                }
                if (!valResult.isValid && (lat == null || lng == null)) {
                    if (photos.isEmpty()) {
                        fraudAlert = FraudAlert(valResult.title, valResult.message)
                        return@launch
                    }
                    skippedCount++
                    continue
                }
                val la = lat
                val ln = lng
                if (la == null || ln == null || !SidoarjoBounds.contains(la, ln)) {
                    if (photos.isEmpty()) {
                        fraudAlert = FraudAlert(
                            "Foto di Luar Wilayah",
                            "Foto utama diambil di luar wilayah Kabupaten Sidoarjo. " +
                                "Pastikan Anda berada di lokasi kerusakan saat mengambil foto.",
                        )
                        return@launch
                    }
                    skippedCount++
                    continue
                }
                val compressed = ImageCompressor.compressToFileWithExif(
                    context, uri, lat = la, lng = ln,
                )
                if (compressed == null) {
                    if (photos.isEmpty()) {
                        error = "Gagal memproses foto. Coba lagi."
                        return@launch
                    }
                    skippedCount++
                    continue
                }
                // Server menolak foto tanpa tanggal EXIF (PHOTO_NO_EXIF_DATE).
                // Kompresi membuang EXIF — bila tulis ulang gagal, foto pasti
                // ditolak; tolak lebih awal dengan pesan yang jelas.
                if (!compressed.hasDate) {
                    if (photos.isEmpty()) {
                        fraudAlert = FraudAlert(
                            "Tanggal Foto Tidak Terbaca",
                            "Tanggal foto tidak dapat dibaca setelah diproses. Ambil ulang foto " +
                                "dengan kamera (jangan ambil ulang dari galeri) lalu coba lagi.",
                        )
                        return@launch
                    }
                    skippedCount++
                    continue
                }
                photos = photos + WargaPhoto(compressed.file, uri, la, ln)
            }
            // Setelah foto pertama tervalidasi, reverse geocoding GPS-nya untuk
            // auto-isi nama jalan + kecamatan + alamat lengkap (replikasi frontend:
            // EXIF GPS → reverseGeocode). Hanya dijalankan sekali (foto utama).
            if (photos.isNotEmpty() && roadName.isBlank() && !geocoding) {
                reverseGeocodePrimary()
            }
            runDuplicateCheck()
        }
    }

    /** Cek duplikat (SHA-256 + spatial 6 m). Best-effort: gagal → tanpa warning. */
    private fun runDuplicateCheck() {
        val ps = photos
        if (ps.isEmpty()) return
        viewModelScope.launch {
            duplicateChecking = true
            try {
                when (val r = dupRepo.check(ps.map { DuplicatePhotoInput(it.file, it.lat, it.lng) })) {
                    is DashboardResult.Success -> duplicateWarning = r.data.toWarning()
                    is DashboardResult.Error -> duplicateWarning = null
                }
            } finally {
                duplicateChecking = false
            }
        }
    }

    /**
     * Reverse geocoding koordinat foto UTAMA (foto pertama) lalu isi form:
     *  - `roadName`  ← address.road ("Jalan X" → "Jl. X"); bila road sah, field dikunci.
     *  - `district`  ← kecamatan yang cocok dengan 18 kecamatan Sidoarjo.
     *  - `fullAddress` ← alamat lengkap gabungan (hanya bila field masih kosong).
     * Best-effort: kegagalan tidak mengganggu alur — user tetap isi manual.
     */
    private suspend fun reverseGeocodePrimary() {
        val lat = formLat ?: return
        val lng = formLng ?: return
        geocodeStage = GeocodeStage.LOADING
        try {
            // Rantai 5-tier reverse geocoder bisa lambat (Nominatim → LocationIQ
            // → OSRM → Overpass → Wilayah-id). Batasi agar form tidak menunggu
            // tanpa akhir; lewat batas → FAILED dan user mengisi manual.
            val res = withTimeoutOrNull(GEOCODE_TIMEOUT_MS) { geocoder.reverseGeocode(lat, lng) }
            if (res == null) {
                geocodeStage = GeocodeStage.FAILED
                return
            }
            if (res.namaJalan.isNotBlank()) {
                roadName = res.namaJalan
                roadNameLocked = res.roadFound
            }
            if (res.kecamatan != null && district.isBlank()) {
                district = res.kecamatan
            }
            if (res.fullAddress != null && fullAddress.isBlank()) {
                fullAddress = res.fullAddress
            }
            geocodeStage = if (
                roadName.isNotBlank() || district.isNotBlank() || fullAddress.isNotBlank()
            ) GeocodeStage.DONE else GeocodeStage.FAILED
        } catch (_: Exception) {
            // biarkan form kosong — user isi manual
            geocodeStage = GeocodeStage.FAILED
        }
    }

    /** Koordinat form = GPS foto utama (kontrak: fallback form bila EXIF sekunder kosong). */
    val formLat: Double? get() = photos.firstOrNull()?.lat
    val formLng: Double? get() = photos.firstOrNull()?.lng

    /**
     * Fallback GPS server (Opsi A): salin byte asli via [ImageCompressor.copyOriginalToCache]
     * (setRequireOriginal dulu agar byte ber-GPS bila izin diberikan), upload ke
     * `POST v1/reports/extract-exif-gps`, hapus file temp. Best-effort: null bila
     * gagal — pemanggil tetap menampilkan guard semula. Batas server 5 MB.
     */
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

    /** Batas dimensi server: WargaReportController 'min:0.01','max:100'. */
    private fun parseDimensi(raw: String): Double? = raw
        .trim()
        .replace(',', '.')
        .takeIf { it.isNotEmpty() }
        ?.toDoubleOrNull()
        ?.takeIf { it in 0.01..100.0 }

    /** POST /api/warga/reports. Panjang/lebar opsional (nullable di server). */
    fun submit(reporterName: String) {
        if (photos.isEmpty()) {
            error = "Tambahkan minimal 1 foto kerusakan."
            return
        }
        if (roadName.isBlank() || district.isBlank()) {
            error = "Lengkapi nama jalan dan kecamatan."
            return
        }
        if ((panjang.isNotBlank() && parseDimensi(panjang) == null) ||
            (lebar.isNotBlank() && parseDimensi(lebar) == null)
        ) {
            error = "Panjang dan lebar harus berupa angka 0,01–100 meter, atau kosongkan."
            return
        }
        val lat = formLat
        val lng = formLng
        if (lat == null || lng == null) {
            error = "Koordinat GPS tidak tersedia. Ambil foto dengan GPS aktif."
            return
        }
        viewModelScope.launch {
            busy = true
            error = null
            try {
                when (val res = repo.submit(
                    reporterName = reporterName,
                    roadName = roadName,
                    district = district,
                    latitude = lat,
                    longitude = lng,
                    description = catatan,
                    panjang = parseDimensi(panjang),
                    lebar = parseDimensi(lebar),
                    fullAddress = fullAddress,
                    imageFiles = photos.map { it.file },
                    idempotencyKey = draftIdempotencyKey,
                )) {
                    is DashboardResult.Success -> {
                        savedReport = res.data
                        serverWarnings = res.data.warnings.orEmpty()
                        // Kunci milik laporan yang sudah tersimpan; draft
                        // berikutnya harus memakai kunci baru.
                        draftIdempotencyKey = UUID.randomUUID().toString()
                    }
                    is DashboardResult.Error -> {
                        // Jenis kegagalan datang dari repository ([ErrorKind]),
                        // bukan ditebak dari teks pesan. Tebakan teks gagal untuk
                        // pesan bawaan OkHttp ("Failed to connect to …:443"),
                        // sehingga laporan yang gagal karena sinyal hilang tidak
                        // pernah masuk antrean offline.
                        if (res.isNetwork) {
                            queuedOffline = queueOffline(reporterName, lat, lng)
                        } else {
                            error = res.message
                        }
                    }
                }
            } catch (e: WargaSubmitException) {
                error = e.displayMessage
            } catch (_: UnauthorizedException) {
                sessionExpired = true
            } catch (e: Exception) {
                if (classifyFailure(e) == ErrorKind.NETWORK) {
                    queuedOffline = queueOffline(reporterName, lat, lng)
                } else {
                    error = e.message
                }
            } finally {
                busy = false
            }
        }
    }

    /**
     * Simpan ke antrian offline. Kegagalan tulis TIDAK boleh melempar keluar
     * dari coroutine (akan mematikan app) — tampilkan sebagai `error`.
     * @return true bila laporan benar-benar tersimpan dan akan disinkronkan.
     */
    private suspend fun queueOffline(reporterName: String, lat: Double, lng: Double): Boolean {
        return try {
            val now = System.currentTimeMillis()
            outbox.enqueue(
                item = QueuedSubmission(
                    kind = QueuedSubmission.KIND_WARGA_REPORT,
                    // Kunci sama dengan kiriman langsung yang gagal tadi, supaya
                    // percobaan ulang tidak menduplikasi laporan yang mungkin
                    // sudah tersimpan di server.
                    idempotencyKey = draftIdempotencyKey,
                    reporterName = reporterName,
                    roadName = roadName,
                    district = district,
                    latitude = lat,
                    longitude = lng,
                    description = catatan,
                    panjang = parseDimensi(panjang),
                    lebar = parseDimensi(lebar),
                    fullAddress = fullAddress,
                    createdAt = now,
                    expiresAt = QueuePolicy.expiresAt(
                        QueuedSubmission.KIND_WARGA_REPORT, null, now,
                    ),
                ),
                // Foto disalin ke penyimpanan permanen oleh repository; berkas di
                // cache boleh dihapus sistem kapan saja.
                photos = photos.map { it.file },
            )
        } catch (e: Exception) {
            error = e.message ?: "Laporan gagal disimpan di perangkat. Coba lagi."
            false
        }
    }

    /** Reset ke awal (lapor lagi). */
    fun reset() {
        photos = emptyList()
        skippedCount = 0
        roadName = ""; district = ""; panjang = ""; lebar = ""
        catatan = ""; fullAddress = ""
        error = null; savedReport = null; serverWarnings = emptyList()
        fraudAlert = null
        geocodeStage = GeocodeStage.IDLE; roadNameLocked = false
        duplicateWarning = null; duplicateChecking = false
        roadSuggestions = emptyList(); roadSearchLoading = false
        queuedOffline = false
        draftIdempotencyKey = UUID.randomUUID().toString()
    }
}
