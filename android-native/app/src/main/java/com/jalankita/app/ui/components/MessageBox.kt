package com.jalankita.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import com.jalankita.app.ui.theme.DeltaJalanTypography
import com.jalankita.app.ui.theme.ErrorBg
import com.jalankita.app.ui.theme.ErrorBorder
import com.jalankita.app.ui.theme.ErrorRed
import com.jalankita.app.ui.theme.InfoBg
import com.jalankita.app.ui.theme.InfoBlue
import com.jalankita.app.ui.theme.InfoBorder
import com.jalankita.app.ui.theme.SuccessBg
import com.jalankita.app.ui.theme.SuccessBorder
import com.jalankita.app.ui.theme.SuccessGreen
import com.jalankita.app.ui.theme.WarningAmber
import com.jalankita.app.ui.theme.WarningBg
import com.jalankita.app.ui.theme.WarningBorder

/** Kotak pesan generik: bg lembut, border tipis, ikon + teks. */
@Composable
private fun MessageBox(
    text: String,
    icon: ImageVector,
    textColor: Color,
    bgColor: Color,
    borderColor: Color,
    modifier: Modifier = Modifier,
) {
    val shape = RoundedCornerShape(8.dp)
    Row(
        modifier
            .fillMaxWidth()
            .clip(shape)
            .background(bgColor)
            .border(1.dp, borderColor, shape)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.Top,
    ) {
        Icon(icon, contentDescription = null, tint = textColor, modifier = Modifier.size(18.dp).padding(top = 1.dp))
        Spacer(Modifier.size(10.dp))
        Text(text, color = textColor, style = DeltaJalanTypography.bodySmall)
    }
}

@Composable
fun ErrorBox(text: String, modifier: Modifier = Modifier) =
    MessageBox(text, AppIcon.Error, ErrorRed, ErrorBg, ErrorBorder, modifier)

@Composable
fun SuccessBox(text: String, modifier: Modifier = Modifier) =
    MessageBox(text, AppIcon.CheckCircle, SuccessGreen, SuccessBg, SuccessBorder, modifier)

@Composable
fun WarningBox(text: String, modifier: Modifier = Modifier) =
    MessageBox(text, AppIcon.Warning, WarningAmber, WarningBg, WarningBorder, modifier)

@Composable
fun InfoBox(text: String, modifier: Modifier = Modifier) =
    MessageBox(text, AppIcon.Info, InfoBlue, InfoBg, InfoBorder, modifier)
