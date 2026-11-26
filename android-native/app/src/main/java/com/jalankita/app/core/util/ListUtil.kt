package com.jalankita.app.core.util

/**
 * Gabung dua halaman daftar tanpa id ganda.
 *
 * ── Kenapa perlu ───────────────────────────────────────────────────────
 * Paginasi berbasis offset + data yang bergerak: bila satu notifikasi baru
 * masuk di antara pengambilan halaman 1 dan halaman 2, item yang sama muncul di
 * kedua respons. `items + halamanBaru` menghasilkan id ganda, dan Compose
 * melempar `IllegalArgumentException: Key ... was already used` pada
 * `LazyColumn(key = ...)` — crash, bukan sekadar baris dobel.
 *
 * Item dari [incoming] menang (lebih baru), tetapi **posisinya** mengikuti
 * kemunculan pertama supaya urutan daftar tidak melompat saat pengguna scroll.
 */
fun <T, K> List<T>.gabungUnik(incoming: List<T>, key: (T) -> K): List<T> {
    if (incoming.isEmpty()) return this
    val hasil = LinkedHashMap<K, T>(size + incoming.size)
    forEach { hasil[key(it)] = it }
    incoming.forEach { hasil[key(it)] = it }
    return hasil.values.toList()
}
