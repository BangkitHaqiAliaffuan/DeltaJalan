package com.jalankita.app.ui.components

import androidx.compose.ui.graphics.Color

/**
 * Satu-satunya sumber label tahap inspeksi di seluruh aplikasi.
 *
 * ── Mengapa terpusat ──────────────────────────────────────────────────────
 * Label ini muncul di tujuh tempat: kartu laporan di Beranda petugas, tab
 * Laporan, tab Tugas, Beranda supervisor, dua layar warga, dan chip detail
 * supervisor. Sebelumnya tiap tempat menyusun labelnya sendiri, sehingga
 * supervisor melihat "Ditugaskan" pada laporan yang sedang diukur.
 *
 * ── Tahap inspeksi bukan `status` ─────────────────────────────────────────
 * `status` laporan tetap `Ditugaskan` selama inspeksi berjalan, karena memang
 * ada petugas yang ditugaskan. Tahap inspeksi dihitung backend dari ada/
 * tidaknya tugas inspeksi (`inspection_state`) dan tidak disimpan sebagai
 * status — supaya filter, deadline, dan tab "Tugas Saya" tidak ikut berubah.
 *
 * @param source nilai `source` laporan (`warga`, `telegram`, `petugas`).
 * @param state nilai `inspection_state` dari API.
 * @param inspectorName nama petugas bila sudah diketahui.
 * @return label siap tampil, atau null bila laporan tidak sedang/tidak pernah
 *   diinspeksi (pemanggil harus menampilkan status biasa).
 */
data class InspectionLabel(
    val text: String,
    val background: Color,
    val foreground: Color,
    val border: Color,
    val inspectorName: String?,
)

/**
 * Label tahap inspeksi, atau null bila tidak relevan.
 *
 * `source = petugas` selalu null: laporan petugas tidak pernah melewati jalur
 * inspeksi (lihat `TriageService`), jadi menampilkan label inspeksi di sana
 * akan menyesatkan.
 */
fun inspectionLabel(source: String?, state: String?, inspectorName: String?): InspectionLabel? {
    if (source.isNullOrBlank()) return null
    // Petugas melapor = mengukur sekaligus; tidak ada tahap inspeksi terpisah.
    if (source.equals("petugas", ignoreCase = true)) return null

    val text = when (state) {
        "assigned" -> "Menunggu Petugas Ukur"
        "started" -> "Sedang Diinspeksi"
        "submitted" -> "Hasil Siap Review"
        "reviewed" -> "Sudah Diinspeksi"
        // null/"none"/nilai tak dikenal: bukan laporan inspeksi. Nilai tak
        // dikenal sengaja diperlakukan sama agar laporan baru dari backend
        // versi lebih baru tidak menampilkan label karangan.
        else -> return null
    }

    val (bg, fg, border) = colorsFor(state)

    return InspectionLabel(
        text = text,
        background = bg,
        foreground = fg,
        border = border,
        // Nama hanya bermakna bila petugas sudah ditetapkan.
        inspectorName = inspectorName?.takeIf { it.isNotBlank() },
    )
}

private fun colorsFor(state: String): Triple<Color, Color, Color> = when (state) {
    "assigned" -> Triple(Color(0xFFF1F5F9), Color(0xFF475569), Color(0xFFCBD5E1))
    "started" -> Triple(Color(0xFFFEF3C7), Color(0xFFB45309), Color(0xFFFDE68A))
    "submitted" -> Triple(Color(0xFFECFDF5), Color(0xFF047857), Color(0xFFA7F3D0))
    "reviewed" -> Triple(Color(0xFFDCFCE7), Color(0xFF166534), Color(0xFF86EFAC))
    else -> Triple(Color(0xFFF8FAFC), Color(0xFF475569), Color(0xFFE2E8F0))
}
