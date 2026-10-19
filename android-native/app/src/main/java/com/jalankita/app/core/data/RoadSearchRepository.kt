package com.jalankita.app.core.data

import com.jalankita.app.BuildConfig
import com.jalankita.app.core.network.KECAMATAN_SIDOARJO
import com.jalankita.app.core.network.SidoarjoBounds
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import java.net.URLEncoder
import javax.inject.Inject
import javax.inject.Named
import javax.inject.Singleton

/** Saran nama jalan hasil LocationIQ Autocomplete (terfilter Sidoarjo). */
data class RoadSuggestion(
    val roadName: String,
    val kecamatan: String?,
    val lat: Double,
    val lng: Double,
    val displayLabel: String,
)

/**
 * Autocomplete nama jalan via LocationIQ — port `useRoadSearch.ts`.
 * Dua lapis filter: `viewbox`+`bounded=1` server-side, lalu saring koordinat
 * di dalam bbox Sidoarjo + `display_name`/kota menyebut "Sidoarjo" + kecamatan
 * termasuk 18 kecamatan. Bila `BuildConfig.LOCATIONIQ_KEY` kosong → [isConfigured]
 * false (UI memakai input manual).
 */
@Singleton
class RoadSearchRepository @Inject constructor(
    @Named("reverseGeocode") private val client: OkHttpClient,
) {
    private val key: String = BuildConfig.LOCATIONIQ_KEY

    val isConfigured: Boolean get() = key.isNotBlank()

    suspend fun search(query: String): List<RoadSuggestion> = withContext(Dispatchers.IO) {
        val q = query.trim()
        if (key.isBlank() || q.length < MIN_QUERY_LENGTH) return@withContext emptyList()
        try {
            val url = "https://us1.locationiq.com/v1/autocomplete" +
                "?key=$key" +
                "&q=${enc("$q Sidoarjo")}" +
                "&format=json&addressdetails=1&limit=10&countrycodes=id" +
                "&viewbox=${SidoarjoBounds.MIN_LNG},${SidoarjoBounds.MIN_LAT}," +
                "${SidoarjoBounds.MAX_LNG},${SidoarjoBounds.MAX_LAT}" +
                "&bounded=1&accept-language=id"
            val request = Request.Builder().url(url).get().build()
            val body = client.newCall(request).execute().use { resp ->
                if (!resp.isSuccessful) return@use null
                resp.body?.string()
            } ?: return@withContext emptyList()

            parse(body)
        } catch (_: Exception) {
            emptyList()
        }
    }

    private fun parse(body: String): List<RoadSuggestion> {
        val arr = JSONArray(body)
        val out = mutableListOf<RoadSuggestion>()
        for (i in 0 until arr.length()) {
            val item = arr.optJSONObject(i) ?: continue
            val lat = item.optString("lat").toDoubleOrNull() ?: continue
            val lng = item.optString("lon").toDoubleOrNull() ?: continue

            if (!SidoarjoBounds.contains(lat, lng)) continue

            val displayName = item.optString("display_name")
            if (!displayName.lowercase().contains("sidoarjo")) continue

            val addr = item.optJSONObject("address")
            val cityFields = listOf("city", "county", "town", "state_district", "village")
                .map { addr?.optString(it).orEmpty() }
            if (cityFields.none { it.lowercase().contains("sidoarjo") }) continue

            val roadName = firstNonBlank(
                addr?.optString("road"),
                addr?.optString("path"),
                addr?.optString("pedestrian"),
                addr?.optString("cycleway"),
                addr?.optString("footway"),
            ) ?: displayName.split(",").firstOrNull()?.trim()
                ?.takeIf { it.isNotBlank() && !it.lowercase().contains("sidoarjo") }
                ?: continue

            val kecamatan = listOf(
                addr?.optString("city_district"),
                addr?.optString("suburb"),
                addr?.optString("town"),
                addr?.optString("village"),
                addr?.optString("city"),
                addr?.optString("county"),
            ).firstNotNullOfOrNull { matchKecamatan(it) } ?: continue

            out += RoadSuggestion(
                roadName = normalizeRoad(roadName),
                kecamatan = kecamatan,
                lat = lat,
                lng = lng,
                displayLabel = "$roadName, Kec. $kecamatan, Sidoarjo",
            )
        }
        // Dedup by (roadName, kecamatan).
        val seen = HashSet<String>()
        return out.filter { seen.add("${it.roadName.lowercase()}|${it.kecamatan}") }
    }

    private fun matchKecamatan(raw: String?): String? {
        val n = raw?.takeIf { it.isNotBlank() }
            ?.lowercase()
            ?.replace(Regex("kecamatan\\s*"), "")
            ?.trim()
            ?: return null
        KECAMATAN_SIDOARJO.firstOrNull { it.equals(n, ignoreCase = true) }?.let { return it }
        return KECAMATAN_SIDOARJO.firstOrNull { n.contains(it.lowercase()) }
    }

    private fun normalizeRoad(road: String): String =
        road.trim().replace(Regex("^Jalan\\s+", RegexOption.IGNORE_CASE), "Jl. ")

    private fun firstNonBlank(vararg values: CharSequence?): String? =
        values.firstOrNull { !it.isNullOrBlank() }?.toString()?.trim()

    private fun enc(s: String): String = URLEncoder.encode(s, "UTF-8")

    companion object {
        const val MIN_QUERY_LENGTH = 3
    }
}
