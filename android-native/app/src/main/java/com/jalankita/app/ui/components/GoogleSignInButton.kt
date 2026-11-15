package com.jalankita.app.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import com.jalankita.app.R
import com.jalankita.app.ui.theme.DeltaJalanTypography

/**
 * Tombol Google Sign-In bergaya resmi: latar putih, border abu-abu, logo G
 * berwarna (jangan di-tint), dan teks gelap.
 */
@Composable
fun GoogleSignInButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    loading: Boolean = false,
    enabled: Boolean = true,
    loadingText: String = "Menghubungkan...",
) {
    val textColor = Color(0xFF3C4043)
    val shape = RoundedCornerShape(8.dp)

    OutlinedButton(
        onClick = onClick,
        enabled = enabled && !loading,
        shape = shape,
        colors = ButtonDefaults.outlinedButtonColors(
            containerColor = Color.White,
            contentColor = textColor,
            disabledContainerColor = Color.White,
            disabledContentColor = textColor.copy(alpha = 0.55f),
        ),
        border = BorderStroke(1.dp, Color(0xFFDADCE0)),
        contentPadding = PaddingValues(horizontal = 16.dp),
        modifier = modifier
            .fillMaxWidth()
            .height(44.dp),
    ) {
        if (loading) {
            CircularProgressIndicator(
                modifier = Modifier.size(18.dp),
                strokeWidth = 2.dp,
                color = Color(0xFF4285F4),
            )
            Spacer(Modifier.width(10.dp))
            Text(
                text = loadingText,
                style = DeltaJalanTypography.labelMedium,
                color = textColor,
            )
        } else {
            Image(
                painter = painterResource(R.drawable.ic_google_g),
                contentDescription = null,
                modifier = Modifier.size(18.dp),
            )
            Spacer(Modifier.width(10.dp))
            Text(
                text = "Lanjutkan dengan Google",
                style = DeltaJalanTypography.labelMedium,
            )
        }
    }
}
