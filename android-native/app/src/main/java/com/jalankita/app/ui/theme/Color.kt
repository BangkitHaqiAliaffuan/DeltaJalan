package com.jalankita.app.ui.theme

import androidx.compose.ui.graphics.Color

/**
 * Palet DeltaJalan — disalin persis dari Frontend-stable/src/routes (login/daftar).
 * Nilai hex diambil langsung dari kelas Tailwind arbitrary (mis. [#1e40af]).
 */

// ── Biru brand ──────────────────────────────────────────────────────────────
val BrandBlue = Color(0xFF1E40AF)        // #1e40af — border, teks label, tombol (awal gradien)
val BrandBlueLight = Color(0xFF2E68D8)   // #2e68d8 — gradien (akhir), hover
val BrandBlueDark = Color(0xFF0F2B6D)    // #0f2b6d — overlay bawah / gradien gelap

// ── Teks & netral ───────────────────────────────────────────────────────────
val TextDark = Color(0xFF0F172A)         // #0F172A — teks utama
val TextMuted = Color(0xFF475569)        // #475569 — subjudul, link sekunder
val TextHint = Color(0xFF64748B)         // #64748B — teks bantuan (info)
val TextPlaceholder = Color(0xFF757684)  // #757684 — placeholder / ikon input
val BorderInput = Color(0xFFC4C5D5)      // #c4c5d5 — border input
val DividerLine = Color(0xFFE2E8F0)      // #E2E8F0 — garis pemisah header daftar

// ── Error (Tailwind red-*) ──────────────────────────────────────────────────
val ErrorRed = Color(0xFFE11D48)         // #E11D48 — teks & ikon error
val ErrorBg = Color(0xFFFEF2F2)          // red-50
val ErrorBorder = Color(0xFFFECACA)      // red-200

// ── Sukses (Tailwind green-*) ───────────────────────────────────────────────
val SuccessGreen = Color(0xFF16A34A)     // #16A34A — teks & ikon sukses
val SuccessBg = Color(0xFFF0FDF4)        // green-50
val SuccessBorder = Color(0xFFBBF7D0)    // green-200

// ── Peringatan (Tailwind amber-*) — port banner warning web ─────────────────
val WarningAmber = Color(0xFFD97706)     // #D97706 — teks & ikon warning
val WarningBg = Color(0xFFFFFBEB)        // amber-50
val WarningBorder = Color(0xFFFDE68A)    // amber-200

// ── Info (Tailwind blue-*) — port banner info web ───────────────────────────
val InfoBlue = Color(0xFF1A4F8A)         // banner info web
val InfoBg = Color(0xFFEEF3FA)           // bg banner info web
val InfoBorder = Color(0xFFBFDBFE)       // blue-200
val InfoSubtle = Color(0xFFBFDBFE)       // blue-200 — subjudul hero

// ── Surface & container (styles.css @theme) ─────────────────────────────────
val ScreenBg = Color(0xFFF5F7FA)         // scaffold / layar
val ContainerLow = Color(0xFFF1F5F9)     // greeting, search bar, container
val ThumbBg = Color(0xFFE8F0FA)          // placeholder thumbnail foto
val DividerStrong = Color(0xFFD0DAE8)    // divider TopBar/BottomNav/karosel
val StatTint = Color(0xFFEEF2FF)         // awal gradien kartu stat
val StatTintBorder = Color(0xFFC7D2FE)   // border kartu stat

// ── Aksen ───────────────────────────────────────────────────────────────────
val StarAmber = Color(0xFFF59E0B)        // bintang rating aktif
val StarIdle = Color(0xFFCBD5E1)         // bintang rating nonaktif

// ── Dasar ───────────────────────────────────────────────────────────────────
val White = Color(0xFFFFFFFF)
val Black30 = Color(0x4D000000)          // rgba(0,0,0,0.3) untuk shadow card
