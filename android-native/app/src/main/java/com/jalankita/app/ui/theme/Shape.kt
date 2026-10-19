package com.jalankita.app.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.unit.dp

/**
 * Token bentuk DeltaJalan — port radius frontend (rounded-lg/xl/full).
 * Pakai token ini, bukan RoundedCornerShape mentah di layar.
 */
val CardShape = RoundedCornerShape(12.dp)   // rounded-xl — kartu
val InputShape = RoundedCornerShape(8.dp)   // rounded-lg — input, tombol, banner
val PillShape = RoundedCornerShape(999.dp)  // rounded-full — chip, badge
