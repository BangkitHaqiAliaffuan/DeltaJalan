package com.jalankita.app.feature.supervisor.components

import androidx.compose.ui.graphics.vector.ImageVector

/**
 * Model aksi kartu — port Frontend-stable/src/components/jk/report-card/types.ts (ActionButton).
 * Var: primary / secondary / destructive.
 */
enum class CardActionVariant { PRIMARY, SECONDARY, DESTRUCTIVE }

data class CardAction(
    val label: String,
    val icon: ImageVector? = null,
    val iconOnly: Boolean = false,
    val variant: CardActionVariant = CardActionVariant.SECONDARY,
    val disabled: Boolean = false,
    val onClick: () -> Unit,
)
