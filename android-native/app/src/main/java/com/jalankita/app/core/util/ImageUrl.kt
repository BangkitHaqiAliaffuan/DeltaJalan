package com.jalankita.app.core.util

import com.jalankita.app.BuildConfig

/**
 * Port Frontend-stable/src/lib/imageUrl.ts ::resolveImageUrl.
 * Backend mengembalikan path relatif `/storage/...` — Coil butuh URL absolut.
 */
object ImageUrl {
    private val apiOrigin: String by lazy {
        runCatching {
            val u = java.net.URL(BuildConfig.API_BASE_URL.trimEnd('/'))
            "${u.protocol}://${u.host}${if (u.port != -1) ":${u.port}" else ""}"
        }.getOrDefault("")
    }

    /** Path relatif → absolut; URL absolut lolos; localhost dev ditulis ulang ke origin API. */
    fun resolve(url: String?): String? {
        if (url.isNullOrBlank()) return null
        val absolute = runCatching { java.net.URL(url) }.getOrNull()
        if (absolute != null) {
            val host = absolute.host
            if (host == "localhost" || host == "127.0.0.1" || host == "10.0.2.2") {
                if (apiOrigin.isNotBlank()) return url.replace(absolute.let {
                    "${it.protocol}://${it.host}${if (it.port != -1) ":${it.port}" else ""}"
                }, apiOrigin)
            }
            return url
        }
        if (apiOrigin.isBlank()) return url
        val sep = if (url.startsWith("/")) "" else "/"
        return "$apiOrigin$sep$url"
    }
}
