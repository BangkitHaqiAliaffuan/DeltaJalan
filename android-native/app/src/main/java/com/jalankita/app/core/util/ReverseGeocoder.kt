package com.jalankita.app.core.util

import android.util.Log
import com.jalankita.app.BuildConfig
import com.jalankita.app.core.network.KECAMATAN_SIDOARJO
import com.jalankita.app.core.network.SidoarjoBounds
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.MediaType.Companion.toMediaType
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Named
import javax.inject.Singleton

/**
 * Reverse geocoding nama jalan + alamat dari koordinat GPS (setelah EXIF foto).
 *
 * Port PERSIS rantai 5-tier Frontend-stable/src/hooks/useLocationFromPhoto.ts
 * (`reverseGeocode`): hasil sama untuk koordinat yang sama.
 *
 *   Tier 1  Nominatim   — https://nominatim.openstreetmap.org/reverse
 *   Tier 2  LocationIQ  — https://us1.locationiq.com/v1/reverse (dilewati bila key kosong)
 *   Tier 3  OSRM Nearest— https://router.project-osrm.org/nearest/v1/driving (roadName tersnap)
 *   Tier 4  Overpass    — https://overpass-api.de/api/interpreter (named highway 500 m)
 *   Tier 5  Wilayah-id  — https://wilayah-id-restapi.vercel.app/.../boundaries/reverse
 *                         (enrichment admin: desa/kecamatan/kabupaten/provinsi/kodepos)
 *
 * Tier 1-4 mengisi `namaJalan` (berhenti di tier pertama yang berhasil);
 * tier 5 SELALU jalan untuk hierarki wilayah, lalu [buildFullAddress] menyalin
 * `fullAddress` gaya frontend ("Jl. Raya Porong, Kludan, Kec. Tanggulangin, ...").
 *
 * Aturan nama jalan:
 *  - `road` sah → `roadFound = true`, field nama jalan dikunci (user tak boleh edit).
 *  - `road` kosong → area fallback (hamlet/neighbourhood/suburb/…), `roadFound = false`.
 *  - Semua gagal → `namaJalan = ""`, `roadFound = false` (user isi manual).
 */
@Singleton
class ReverseGeocoder @Inject constructor(
    @Named("reverseGeocode") private val client: OkHttpClient,
) {
    private val tag = "ReverseGeocoder"

    /** Key LocationIQ — dari BuildConfig (local.properties). Kosong = tier 2 dilewati. */
    private val locationIqKey: String = BuildConfig.LOCATIONIQ_KEY

    private val jsonMedia = "application/x-www-form-urlencoded".toMediaType()

    /** Hasil reverse geocoding siap pakai UI (subset relevan dari frontend). */
    data class Result(
        /** Nama jalan ternormalisasi ("Jalan X" → "Jl. X"); "" bila tak ada. */
        val namaJalan: String,
        /** true bila `address.road` sah & spesifik (field nama jalan boleh dikunci). */
        val roadFound: Boolean,
        /** Salah satu dari 18 kecamatan Sidoarjo, atau null. */
        val kecamatan: String?,
        /** Enrichment Wilayah-id (bisa null bila tier 5 gagal). */
        val desa: String?,
        val kabupaten: String?,
        val provinsi: String?,
        val kodePos: String?,
        /** Alamat lengkap gabungan, gaya constructFullAddress frontend. */
        val fullAddress: String?,
    ) {
        companion object {
            val EMPTY = Result("", false, null, null, null, null, null, null)
        }
    }

    /**
     * Jalankan rantai reverse geocoding. Selalu mengembalikan [Result]
     * (EMPTY bila koordinat di luar Sidoarjo) — tidak pernah melempar.
     *
     * Seluruh panggilan OkHttp di sini **blocking** (`execute()`), jadi WAJIB
     * dijalankan di [Dispatchers.IO]. Pemanggil (`viewModelScope` = Main thread)
     * tidak perlu tahu — `withContext` memindahkan eksekusi ke IO secara transparan.
     * Tanpa ini → `NetworkOnMainThreadException` (message null) di setiap tier.
     */
    suspend fun reverseGeocode(lat: Double, lng: Double): Result = withContext(Dispatchers.IO) {
        if (!SidoarjoBounds.contains(lat, lng)) {
            return@withContext Result.EMPTY.copy(fullAddress = "Lokasi di luar Kabupaten Sidoarjo")
        }

        var namaJalan = ""
        var roadFound = false
        var kecamatan: String? = null

        // ── Tier 1: Nominatim ────────────────────────────────────────────────
        runCatching {
            val url = "https://nominatim.openstreetmap.org/reverse" +
                "?lat=$lat&lon=$lng&format=jsonv2&zoom=18&addressdetails=1&accept-language=id"
            val body = get(url) ?: return@runCatching
            val addr = body.optJSONObject("address") ?: JSONObject()
            val road = firstNonBlank(
                addr.optString("road"), addr.optString("pedestrian"),
                addr.optString("path"), addr.optString("cycleway"), addr.optString("footway"),
            )
            if (road != null) {
                roadFound = true
                namaJalan = normalizeRoad(road)
            } else {
                namaJalan = areaFallback(addr) ?: ""
            }
            kecamatan = matchKecamatan(
                addr.optString("city_district"), addr.optString("suburb"),
                addr.optString("municipality"), addr.optString("neighbourhood"),
                addr.optString("town"), addr.optString("village"),
                addr.optString("city"), addr.optString("county"),
            )
        }.onFailure { Log.w(tag, "tier1 Nominatim: ${it.message}") }

        // ── Tier 2: LocationIQ (bila nama jalan belum ketemu & key tersedia) ──
        if (namaJalan.isBlank() && locationIqKey.isNotBlank()) {
            runCatching {
                val url = "https://us1.locationiq.com/v1/reverse" +
                    "?key=$locationIqKey&lat=$lat&lon=$lng&format=json&addressdetails=1&zoom=18&accept-language=id"
                val body = get(url) ?: return@runCatching
                val addr = body.optJSONObject("address") ?: JSONObject()
                val road = firstNonBlank(
                    addr.optString("road"), addr.optString("path"),
                    addr.optString("pedestrian"), addr.optString("cycleway"), addr.optString("footway"),
                )
                if (road != null) {
                    roadFound = true
                    val houseNo = addr.optString("house_number")
                    namaJalan = if (houseNo.isNotBlank()) "$road No. $houseNo" else road
                } else {
                    namaJalan = areaFallback(addr) ?: ""
                }
                if (kecamatan == null) {
                    kecamatan = matchKecamatan(
                        addr.optString("city_district"), addr.optString("suburb"),
                        addr.optString("municipality"), addr.optString("neighbourhood"),
                        addr.optString("town"), addr.optString("village"),
                        addr.optString("city"), addr.optString("county"),
                    )
                }
            }.onFailure { Log.w(tag, "tier2 LocationIQ: ${it.message}") }
        }

        // ── Tier 3: OSRM Nearest (nama jalan tersnap dari graph routing) ──────
        if (namaJalan.isBlank()) {
            runCatching {
                val body = get("https://router.project-osrm.org/nearest/v1/driving/$lng,$lat?number=1")
                    ?: return@runCatching
                if (body.optString("code") != "Ok") return@runCatching
                val wp = body.optJSONArray("waypoints")?.optJSONObject(0) ?: return@runCatching
                val name = wp.optString("name")
                if (name.isNotBlank()) {
                    namaJalan = name
                    roadFound = true
                }
            }.onFailure { Log.w(tag, "tier3 OSRM: ${it.message}") }
        }

        // ── Tier 4: Overpass API (named highway dalam 500 m) ─────────────────
        if (namaJalan.isBlank()) {
            runCatching {
                val query = "[out:json][timeout:10];way(around:500,$lat,$lng)[highway][name];out 3;"
                val body = post(
                    "https://overpass-api.de/api/interpreter",
                    "data=${urlEncode(query)}",
                ) ?: return@runCatching
                val roadName = body.optJSONArray("elements")
                    ?.optJSONObject(0)?.optJSONObject("tags")?.optString("name")
                if (!roadName.isNullOrBlank()) {
                    namaJalan = roadName
                    roadFound = true
                }
            }.onFailure { Log.w(tag, "tier4 Overpass: ${it.message}") }
        }

        // ── Tier 5: Wilayah-id (enrichment admin — SELALU dijalankan) ────────
        var desa: String? = null
        var kabupaten: String? = null
        var provinsi: String? = null
        var kodePos: String? = null
        runCatching {
            val body = get(
                "https://wilayah-id-restapi.vercel.app/api/v1/boundaries/reverse?lat=$lat&lng=$lng",
            )
            val sub = body?.optJSONObject("subdistrict") ?: return@runCatching
            desa = sub.optString("name").takeIf { it.isNotBlank() }?.let(::titleCase)
            kodePos = sub.optString("postal_code").takeIf { it.isNotBlank() }
            kecamatan = matchKecamatan(body.optJSONObject("district")?.optString("name").orEmpty())
                ?: kecamatan
            kabupaten = body.optJSONObject("regency")?.let { reg ->
                val name = reg.optString("name").takeIf { it.isNotBlank() } ?: return@let null
                val type = if (reg.optString("type") == "KOTA") "Kota" else "Kabupaten"
                "$type ${titleCase(name)}"
            }
            provinsi = body.optJSONObject("province")?.optString("name")
                ?.takeIf { it.isNotBlank() }?.let(::titleCase)
        }.onFailure { Log.w(tag, "tier5 Wilayah-id: ${it.message}") }

        val fullAddress = buildFullAddress(namaJalan, desa, kecamatan, kabupaten, provinsi, kodePos)

        Result(
            namaJalan = namaJalan,
            roadFound = roadFound,
            kecamatan = kecamatan,
            desa = desa,
            kabupaten = kabupaten,
            provinsi = provinsi,
            kodePos = kodePos,
            fullAddress = fullAddress,
        )
    }

    // ── HTTP helpers ────────────────────────────────────────────────────────

    private fun get(url: String): JSONObject? {
        val req = Request.Builder()
            .url(url)
            .header("User-Agent", "DeltaJalan/1.0 (Android)")
            .header("Accept", "application/json")
            .build()
        return client.newCall(req).execute().use { res ->
            if (!res.isSuccessful) return null
            res.body?.string()?.let { if (it.isBlank()) null else JSONObject(it) }
        }
    }

    private fun post(url: String, form: String): JSONObject? {
        val req = Request.Builder()
            .url(url)
            .header("User-Agent", "DeltaJalan/1.0 (Android)")
            .post(form.toRequestBody(jsonMedia))
            .build()
        return client.newCall(req).execute().use { res ->
            if (!res.isSuccessful) return null
            res.body?.string()?.let { if (it.isBlank()) null else JSONObject(it) }
        }
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    /** Area fallback bila `road` tidak ada — meniru `areaFallback` frontend. */
    private fun areaFallback(addr: JSONObject): String? = firstNonBlank(
        addr.optString("hamlet"), addr.optString("neighbourhood"),
        addr.optString("suburb"), addr.optString("village"), addr.optString("town"),
    )

    private fun firstNonBlank(vararg values: String): String? =
        values.firstOrNull { it.isNotBlank() }?.trim()

    /**
     * Normalisasi nama jalan: trim dulu, lalu prefix "Jalan " → "Jl. ".
     * (Trim di depan penting — regex `^Jalan` gagal bila ada spasi pembuka.)
     */
    private fun normalizeRoad(road: String): String =
        road.trim().replace(Regex("^Jalan\\s+", RegexOption.IGNORE_CASE), "Jl. ")

    /**
     * Cocokkan string lokasi ke salah satu 18 kecamatan Sidoarjo.
     * Meniru `matchKecamatan` frontend: buang prefix "kecamatan", cocokkan
     * persis lalu fallback ke `contains`.
     */
    private fun matchKecamatan(vararg rawValues: String): String? {
        val normalized = rawValues.firstOrNull { it.isNotBlank() }
            ?.lowercase()
            ?.replace(Regex("kecamatan\\s*", RegexOption.IGNORE_CASE), "")
            ?.trim()
            ?: return null
        KECAMATAN_SIDOARJO.firstOrNull { it.equals(normalized, ignoreCase = true) }?.let { return it }
        return KECAMATAN_SIDOARJO.firstOrNull { normalized.contains(it.lowercase()) }
    }

    /** "kabupaten" → "Kabupaten" (meniru `titleCase` frontend). */
    private fun titleCase(str: String): String =
        str.lowercase().split(" ").joinToString(" ") { w ->
            w.replaceFirstChar { if (it.isLowerCase()) it.titlecase() else it.toString() }
        }

    /**
     * Gabung alamat gaya `constructFullAddress` frontend:
     * "Jl. Raya Porong, Kludan, Kec. Tanggulangin, Kabupaten Sidoarjo, Jawa Timur 61272".
     */
    private fun buildFullAddress(
        namaJalan: String,
        desa: String?,
        kecamatan: String?,
        kabupaten: String?,
        provinsi: String?,
        kodePos: String?,
    ): String? {
        val parts = buildList {
            if (namaJalan.isNotBlank()) add(namaJalan)
            desa?.let { add(it) }
            kecamatan?.let { add("Kec. $it") }
            kabupaten?.let { add(it) }
            provinsi?.let { add(it) }
            kodePos?.let { add(it) }
        }
        return if (parts.isEmpty()) null else parts.joinToString(", ")
    }

    private fun urlEncode(s: String): String =
        java.net.URLEncoder.encode(s, "UTF-8")

    companion object {
        /** Klien khusus: timeout pendek agar rantai 5-tier tidak menggantung lama. */
        fun defaultClient(): OkHttpClient = OkHttpClient.Builder()
            .connectTimeout(8, TimeUnit.SECONDS)
            .readTimeout(8, TimeUnit.SECONDS)
            .callTimeout(10, TimeUnit.SECONDS)
            .build()
    }
}
