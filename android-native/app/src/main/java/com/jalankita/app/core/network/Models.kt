package com.jalankita.app.core.network

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/** Envelope standar backend untuk endpoint yang membungkus payload di `data`. */
@JsonClass(generateAdapter = true)
data class ApiEnvelope<T>(
    val success: Boolean,
    val message: String? = null,
    val data: T? = null,
)

/**
 * Payload generik endpoint aksi tanpa data kaya (`{status}` bila ada).
 * PENGGANTI `Unit` sebagai argumen [ApiEnvelope] — Moshi tidak punya adapter
 * untuk `kotlin.Unit` sehingga `ApiEnvelope<Unit>` melempar
 * "Unable to create converter" saat converter dibuat (lazy per-method).
 * Field tak dikenal diabaikan; `data` absen → null.
 */
@JsonClass(generateAdapter = true)
data class StatusPayload(
    val status: String? = null,
)

/**
 * POST /api/auth/login — backend mengembalikan bentuk FLAT
 * `{success, message, token, user}` (bukan envelope `data`).
 * Kontrak: backend_POSTGRESQL/app/Http/Controllers/AuthController.php ::login.
 */
@JsonClass(generateAdapter = true)
data class LoginResponse(
    val success: Boolean,
    val message: String? = null,
    val token: String? = null,
    val user: UserDto? = null,
)

/**
 * GET /api/auth/me — bentuk FLAT `{success, user}`.
 * Kontrak: AuthController.php ::me.
 */
@JsonClass(generateAdapter = true)
data class MeResponse(
    val success: Boolean,
    val message: String? = null,
    val user: UserDto? = null,
)

@JsonClass(generateAdapter = true)
data class LoginRequest(
    val email: String,
    val password: String,
)

/**
 * POST /api/auth/google — body berisi Firebase ID token (bukan Google ID token).
 * Kontrak: backend_POSTGRESQL/app/Http/Controllers/GoogleAuthController.php ::login.
 */
@JsonClass(generateAdapter = true)
data class GoogleLoginRequest(
    @Json(name = "firebase_token") val firebaseToken: String,
)

@JsonClass(generateAdapter = true)
data class GoogleProfileDto(
    val name: String,
    val email: String,
)

/**
 * Respons Google login: langsung `{token,user}` untuk warga lama yang sudah
 * punya phone, atau `{needs_onboarding,onboarding_token,profile}` untuk akun baru
 * / akun lama tanpa phone.
 */
@JsonClass(generateAdapter = true)
data class GoogleLoginResponse(
    val success: Boolean,
    val message: String? = null,
    @Json(name = "needs_onboarding") val needsOnboarding: Boolean = false,
    @Json(name = "is_new_user") val isNewUser: Boolean = false,
    @Json(name = "missing_fields") val missingFields: List<String>? = null,
    @Json(name = "onboarding_token") val onboardingToken: String? = null,
    val profile: GoogleProfileDto? = null,
    val token: String? = null,
    val user: UserDto? = null,
)

/**
 * POST /api/auth/google/complete — password hanya wajib untuk akun baru.
 * Moshi tidak menyerialkan null, jadi akun lama hanya mengirim token + phone.
 */
@JsonClass(generateAdapter = true)
data class CompleteGoogleOnboardingRequest(
    @Json(name = "onboarding_token") val onboardingToken: String,
    val phone: String,
    val password: String? = null,
    @Json(name = "password_confirmation") val passwordConfirmation: String? = null,
)

/** POST /api/auth/phone — melengkapi phone untuk sesi Sanctum yang sudah ada. */
@JsonClass(generateAdapter = true)
data class CompletePhoneRequest(
    val phone: String,
)

/**
 * POST /api/auth/register — body. Kontrak: AuthController.php ::register.
 * Response sukses: `{success, message, data:{id,name,email,phone,role}}` (201).
 * Response gagal 422: `{success:false, message, errors:{field:[...]}}`.
 */
@JsonClass(generateAdapter = true)
data class RegisterRequest(
    val name: String,
    val email: String,
    val phone: String,
    val password: String,
    @Json(name = "password_confirmation") val passwordConfirmation: String,
)

@JsonClass(generateAdapter = true)
data class RegisterResponse(
    val success: Boolean,
    val message: String? = null,
    val data: RegisteredUserDto? = null,
    /** errors: peta field → daftar pesan (validasi 422). */
    val errors: Map<String, List<String>>? = null,
)

@JsonClass(generateAdapter = true)
data class RegisteredUserDto(
    val id: Long,
    val name: String,
    val email: String?,
    val phone: String?,
    val role: String,
)

@JsonClass(generateAdapter = true)
data class FcmTokenRequest(
    @Json(name = "fcm_token") val fcmToken: String,
    @Json(name = "device_info") val deviceInfo: Map<String, String>? = null,
)

@JsonClass(generateAdapter = true)
data class UserDto(
    val id: Long,
    val name: String,
    val email: String?,
    val phone: String?,
    val role: String,
    @Json(name = "role_label") val roleLabel: String?,
    @Json(name = "team_id") val teamId: String?,
    @Json(name = "team_name") val teamName: String?,
    /** Warga lama tanpa nomor telepon wajib melengkapinya sebelum akses fitur. */
    @Json(name = "needs_phone") val needsPhone: Boolean = false,
)

/** GET /api/app/version — config-based, tanpa auth. */
@JsonClass(generateAdapter = true)
data class AppVersionDto(
    @Json(name = "min_version_code") val minVersionCode: Int,
    @Json(name = "latest_version_code") val latestVersionCode: Int,
    @Json(name = "apk_url") val apkUrl: String,
    @Json(name = "force_update") val forceUpdate: Boolean,
)

// ── Fase 2: Alur Lapor ───────────────────────────────────────────────────────

/**
 * POST /api/analyze — respons FLAT dari FastAPI (via ReportController@analyze).
 * Kontrak: ReportController.php:87-114 (return `$aiData['data']` langsung, 200).
 */
@JsonClass(generateAdapter = true)
data class AnalyzeResponse(
    val total: Int = 0,
    @Json(name = "overall_severity") val overallSeverity: String? = null,
    val confidence: Double? = null,
    @Json(name = "image_result") val imageResult: String? = null,
    val detections: List<DetectionDto>? = null,
)

@JsonClass(generateAdapter = true)
data class DetectionDto(
    /** Diisi server batch; FastAPI single mengirim `class` (lihat [className]). */
    @Json(name = "type") val type: String? = null,
    @Json(name = "class") val className: String? = null,
    val severity: String? = null,
    val confidence: Double? = null,
    /** Bbox ternormalisasi [x1,y1,x2,y2] via [BboxAdapter] (objek/array → list). */
    val bbox: List<Double>? = null,
) {
    /** Nama kelas efektif: pakai [type], fallback [className] (FastAPI kirim `class`). */
    val effectiveType: String? get() = type ?: className
}

/**
 * Respons error server (422) — `{success:false, message, error_code?, errors?}`.
 * Dipakai untuk memetakan PHOTO_TOO_OLD / DUPLICATE_IMAGE / dst.
 */
@JsonClass(generateAdapter = true)
data class ApiErrorResponse(
    val success: Boolean? = null,
    val message: String? = null,
    @Json(name = "error_code") val errorCode: String? = null,
    val errors: Map<String, List<String>>? = null,
    @Json(name = "existing_report") val existingReport: ExistingReportDto? = null,
)

@JsonClass(generateAdapter = true)
data class ExistingReportDto(
    val id: String? = null,
    @Json(name = "report_code") val reportCode: String? = null,
    @Json(name = "road_name") val roadName: String? = null,
    val district: String? = null,
    val status: String? = null,
)

/** POST /api/reports — respons sukses 201 `{success, message, data:{...}}`. */
@JsonClass(generateAdapter = true)
data class CreateReportResponse(
    val success: Boolean,
    val message: String? = null,
    val data: ReportDataDto? = null,
)

@JsonClass(generateAdapter = true)
data class ReportDataDto(
    val id: String,
    @Json(name = "report_code") val reportCode: String,
    @Json(name = "road_name") val roadName: String? = null,
    val district: String? = null,
    @Json(name = "overall_severity") val overallSeverity: String? = null,
    val status: String? = null,
    @Json(name = "image_original_url") val imageOriginalUrl: String? = null,
    @Json(name = "image_result_url") val imageResultUrl: String? = null,
    @Json(name = "system_notes") val systemNotes: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
)

/** POST /api/v1/reports/extract-exif-gps — fallback ekstrak GPS di server. */
@JsonClass(generateAdapter = true)
data class ExifGpsResponse(
    val lat: Double? = null,
    val lng: Double? = null,
)

/** 18 kecamatan Sidoarjo — salinan PERSIS ReportController::getKecamatanList(). */
val KECAMATAN_SIDOARJO: List<String> = listOf(
    "Sidoarjo", "Buduran", "Gedangan", "Sedati", "Waru", "Taman", "Krian",
    "Balongbendo", "Wonoayu", "Sukodono", "Candi", "Porong", "Krembung",
    "Tulangan", "Tanggulangin", "Jabon", "Tarik", "Prambon",
)

/** Bounding box Kabupaten Sidoarjo — salinan isInSidoarjo() server. */
object SidoarjoBounds {
    const val MIN_LAT = -7.65
    const val MAX_LAT = -7.25
    const val MIN_LNG = 112.50
    const val MAX_LNG = 112.95
    fun contains(lat: Double, lng: Double): Boolean =
        lat in MIN_LAT..MAX_LAT && lng in MIN_LNG..MAX_LNG
}
