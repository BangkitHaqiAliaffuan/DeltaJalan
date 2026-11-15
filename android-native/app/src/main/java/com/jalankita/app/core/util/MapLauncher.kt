package com.jalankita.app.core.util

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri

/**
 * Membuka satu titik koordinat di aplikasi peta perangkat.
 *
 * **Satu sumber kebenaran** untuk semua "buka di peta". Sebelumnya URL ditulis
 * ulang di tiga tempat dengan dua bentuk berbeda:
 *  - `DetailSections.kt`              → `google.com/maps?q=`
 *  - `WargaDetailScreen.kt`           → `google.com/maps/search/?api=1&query=`
 *  - `SupervisorDetailScreen.kt`      → `google.com/maps?q=`
 * Perbedaan itu membuat perilaku antar-layar tidak seragam. Semua sekarang
 * memakai helper ini.
 *
 * **Urutan percobaan:**
 *  1. Skema `geo:` → membuka aplikasi peta **pilihan pengguna** (Google Maps,
 *     Waze, HERE, OsmAnd, …). Ini yang paling membantu petugas: mereka bisa
 *     langsung memakai navigasi turn-by-turn bawaan aplikasi favoritnya,
 *     bukan sekadar membuka browser.
 *  2. Bila tidak ada aplikasi peta, jatuh ke `https://www.google.com/maps/...`
 *     yang selalu bisa dibuka browser.
 *
 * Pemanggil TIDAK perlu menangani exception: [open] mengembalikan `false`
 * ketika kedua jalur gagal, sehingga UI bisa menampilkan pesan tanpa crash
 * (`ActivityNotFoundException` pada perangkat tanpa aplikasi peta).
 */
object MapLauncher {

    /** Batas bawah/atas koordinat yang valid — menjaga dari data server yang rusak. */
    private const val MIN_LAT = -90.0
    private const val MAX_LAT = 90.0
    private const val MIN_LNG = -180.0
    private const val MAX_LNG = 180.0

    /** True bila [lat]/[lng] berada di rentang koordinat yang masuk akal. */
    fun isValidCoordinate(lat: Double?, lng: Double?): Boolean {
        if (lat == null || lng == null) return false
        if (lat.isNaN() || lng.isNaN()) return false
        if (lat.isInfinite() || lng.isInfinite()) return false
        // 0,0 adalah "Null Island" — backend tidak pernah punya jalan di sana,
        // jadi hampir pasti data kosong yang terisi default.
        if (lat == 0.0 && lng == 0.0) return false
        return lat in MIN_LAT..MAX_LAT && lng in MIN_LNG..MAX_LNG
    }

    /**
     * URI skema `geo:` — aplikasi peta native.
     * `q=lat,lng(label)` menaruh pin berlabel; label di-escape agar karakter
     * seperti `(`/`)`/`,` pada nama jalan tidak merusak parsing.
     */
    fun geoUri(lat: Double, lng: Double, label: String? = null): String {
        val query = "${fmt(lat)},${fmt(lng)}"
        val safeLabel = label?.trim()?.takeIf { it.isNotBlank() }?.let { "(${encode(it)})" } ?: ""
        return "geo:$query?q=$query$safeLabel"
    }

    /**
     * URI web Google Maps. Dipakai sebagai fallback dan untuk berbagi tautan.
     * Bentuk `search/?api=1&query=` adalah yang paling stabil lintas platform
     * (Android, iOS, desktop) dan tidak memerlukan API key.
     */
    fun webUri(lat: Double, lng: Double, label: String? = null): String {
        val query = "${fmt(lat)},${fmt(lng)}"
        // Label hanya dipakai bila ada; parameter `query_place_id` sengaja tidak
        // dikirim karena kita tidak punya place id dari backend.
        val suffix = label?.trim()?.takeIf { it.isNotBlank() }?.let { "&query_place=${encode(it)}" } ?: ""
        return "https://www.google.com/maps/search/?api=1&query=$query$suffix"
    }

    /**
     * Persen-encode komponen URI.
     *
     * Memakai `URLEncoder` JDK, BUKAN `android.net.Uri.encode`: `Uri` adalah
     * stub kosong pada unit test JVM ("Method encode not mocked"), sehingga
     * logika ini tak bisa diuji dan mudah rusak tanpa ketahuan. `URLEncoder`
     * murni Java → deterministik dan teruji.
     *
     * `URLEncoder` meng-encode spasi menjadi `+` (aturan form-encoding); spasi
     * dikembalikan menjadi `%20` agar aman di dalam query URI peta.
     */
    internal fun encode(value: String): String =
        java.net.URLEncoder.encode(value, "UTF-8").replace("+", "%20")

    /**
     * Buka [lat],[lng] di aplikasi peta, fallback ke browser.
     *
     * @param label nama tempat (mis. nama jalan) untuk memberi konteks pada pin.
     * @return `true` bila ada Activity yang berhasil menangani intent.
     */
    fun open(context: Context, lat: Double?, lng: Double?, label: String? = null): Boolean {
        if (!isValidCoordinate(lat, lng)) return false
        val la = lat!!
        val ln = lng!!

        // 1) Aplikasi peta native (geo:). Dibungkus runCatching: perangkat tanpa
        //    aplikasi peta melempar ActivityNotFoundException.
        if (launch(context, Intent(Intent.ACTION_VIEW, Uri.parse(geoUri(la, ln, label))))) {
            return true
        }

        // 2) Browser / Google Maps versi web.
        return launch(context, Intent(Intent.ACTION_VIEW, Uri.parse(webUri(la, ln, label))))
    }

    /** Kirim intent bila ada penangan; kembalikan false bila tidak ada / gagal. */
    private fun launch(context: Context, intent: Intent): Boolean = try {
        // FLAG_ACTIVITY_NEW_TASK wajib bila context bukan Activity (mis. Application).
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        if (intent.resolveActivity(context.packageManager) == null) {
            false
        } else {
            context.startActivity(intent)
            true
        }
    } catch (_: ActivityNotFoundException) {
        false
    } catch (_: SecurityException) {
        // Beberapa OEM membatasi intent keluar aplikasi.
        false
    }

    /**
     * Format koordinat 6 desimal (≈11 cm) seperti `LokasiCard` supervisor.
     *
     * Memakai `Locale.ROOT`, bukan `Locale.US`: keduanya menghasilkan titik
     * desimal, tetapi `ROOT` bebas asumsi lokal perangkat dan tidak akan pernah
     * bergeser bila LOCALE berubah — koordinat dengan koma tidak valid di URI.
     */
    fun fmt(value: Double): String = String.format(java.util.Locale.ROOT, "%.6f", value)

    /** Teks koordinat siap tampil: `-7.444585, 112.727060`. */
    fun coordinateText(lat: Double, lng: Double): String = "${fmt(lat)}, ${fmt(lng)}"
}
