package com.jalankita.app.core.util

import java.io.File
import java.security.MessageDigest

/** SHA-256 hex dari konten file — dipakai cek duplikat foto (mirror web `computeFileHash`). */
fun sha256Hex(file: File): String? = try {
    val digest = MessageDigest.getInstance("SHA-256")
    file.inputStream().use { input ->
        val buf = ByteArray(8 * 1024)
        while (true) {
            val n = input.read(buf)
            if (n <= 0) break
            digest.update(buf, 0, n)
        }
    }
    digest.digest().joinToString("") { "%02x".format(it) }
} catch (_: Exception) {
    null
}
