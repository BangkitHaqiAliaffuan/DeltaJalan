package com.jalankita.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LocalTextStyle
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.jalankita.app.ui.theme.BorderInput
import com.jalankita.app.ui.theme.BrandBlue
import com.jalankita.app.ui.theme.BrandBlueLight
import com.jalankita.app.ui.theme.DeltaJalanTypography
import com.jalankita.app.ui.theme.ErrorRed
import com.jalankita.app.ui.theme.TextDark
import com.jalankita.app.ui.theme.TextHint
import com.jalankita.app.ui.theme.TextPlaceholder

/**
 * Field teks bergaya frontend (bukan Material OutlinedTextField):
 * tinggi 44dp, border 1px, radius 8, label di atas, ikon opsional di kiri.
 * Replikasi kelas Tailwind: `h-11 pl-10 pr-4 border border-[#c4c5d5] rounded-lg`.
 */
@Composable
fun BrandTextField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    modifier: Modifier = Modifier,
    leadingIcon: ImageVector? = null,
    trailingContent: (@Composable () -> Unit)? = null,
    isError: Boolean = false,
    visualTransformation: VisualTransformation = VisualTransformation.None,
    keyboardOptions: KeyboardOptions = KeyboardOptions.Default,
    keyboardActions: KeyboardActions = KeyboardActions.Default,
    enabled: Boolean = true,
    singleLine: Boolean = true,
    containerColor: Color = Color.White,
) {
    val interaction = remember { MutableInteractionSource() }
    val focused by interaction.collectIsFocusedAsState()

    val borderColor = when {
        isError -> ErrorRed
        focused -> BrandBlue
        else -> BorderInput
    }
    val shape = RoundedCornerShape(8.dp)

    BasicTextField(
        value = value,
        onValueChange = onValueChange,
        enabled = enabled,
        singleLine = singleLine,
        interactionSource = interaction,
        visualTransformation = visualTransformation,
        keyboardOptions = keyboardOptions,
        keyboardActions = keyboardActions,
        cursorBrush = SolidColor(BrandBlue),
        textStyle = LocalTextStyle.current.merge(
            DeltaJalanTypography.labelMedium.copy(
                fontWeight = androidx.compose.ui.text.font.FontWeight.Normal,
                fontSize = 16.sp,
                color = TextDark,
            ),
        ),
        modifier = modifier
            .fillMaxWidth()
            .heightIn(min = 44.dp)
            .clip(shape)
            .background(containerColor)
            .border(if (focused) 1.5.dp else 1.dp, borderColor, shape),
        decorationBox = { inner ->
            Row(
                Modifier.fillMaxWidth().padding(
                    start = if (leadingIcon != null) 14.dp else 16.dp,
                    end = if (trailingContent != null) 44.dp else 16.dp,
                ),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                if (leadingIcon != null) {
                    Icon(
                        leadingIcon,
                        contentDescription = null,
                        tint = TextPlaceholder,
                        modifier = Modifier.size(18.dp),
                    )
                    Spacer(Modifier.size(8.dp))
                }
                Box(Modifier.weight(1f), contentAlignment = Alignment.CenterStart) {
                    if (value.isEmpty()) {
                        Text(placeholder, color = TextPlaceholder, fontSize = 16.sp)
                    }
                    inner()
                }
            }
            // trailing (toggle mata)
            if (trailingContent != null) {
                Box(Modifier.fillMaxWidth().padding(end = 6.dp), contentAlignment = Alignment.CenterEnd) {
                    trailingContent()
                }
            }
        },
    )
}

/** Label di atas field: Inter 14 semibold #0F172A, jarak bawah 6dp. */
@Composable
fun FieldLabel(text: String) {
    Text(text, style = DeltaJalanTypography.labelMedium, color = TextDark)
}

/** Teks bantuan kecil (info), 11sp #64748B dengan ikon opsional. */
@Composable
fun FieldHint(text: String, icon: ImageVector? = null) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        if (icon != null) {
            Icon(icon, contentDescription = null, tint = TextHint, modifier = Modifier.size(12.dp))
            Spacer(Modifier.size(4.dp))
        }
        Text(text, color = TextHint, fontSize = 11.sp)
    }
}

/** Pesan error di bawah field (11sp merah + ikon). */
@Composable
fun FieldErrorDetail(text: String, icon: ImageVector) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, contentDescription = null, tint = ErrorRed, modifier = Modifier.size(12.dp))
        Spacer(Modifier.size(4.dp))
        Text(text, color = ErrorRed, fontSize = 11.sp)
    }
}

/**
 * Tombol utama bergradien biru — replikasi `bg-gradient-to-r from-[#1e40af] to-[#2e68d8]`.
 * Menampilkan spinner + label saat `loading`.
 */
@Composable
fun BrandPrimaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null,
    loading: Boolean = false,
    loadingText: String = "Memverifikasi...",
    enabled: Boolean = true,
) {
    val shape = RoundedCornerShape(8.dp)
    val interaction = remember { MutableInteractionSource() }
    androidx.compose.material3.Button(
        onClick = onClick,
        enabled = enabled && !loading,
        interactionSource = interaction,
        shape = shape,
        colors = androidx.compose.material3.ButtonDefaults.buttonColors(
            containerColor = Color.Transparent,
            contentColor = Color.White,
            disabledContainerColor = Color.Transparent,
            disabledContentColor = Color.White,
        ),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(0.dp),
        modifier = modifier.fillMaxWidth().height(44.dp),
    ) {
        Box(
            Modifier
                .fillMaxWidth()
                .height(44.dp)
                .background(
                    brush = Brush.horizontalGradient(listOf(BrandBlue, BrandBlueLight)),
                    shape = shape,
                )
                .then(
                    if (loading || !enabled) {
                        Modifier.background(Color.Black.copy(alpha = 0.15f), shape)
                    } else Modifier,
                ),
            contentAlignment = Alignment.Center,
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (loading) {
                    CircularProgressIndicator(
                        color = Color.White,
                        strokeWidth = 2.dp,
                        modifier = Modifier.size(16.dp),
                    )
                    Spacer(Modifier.size(8.dp))
                    Text(loadingText, style = DeltaJalanTypography.labelMedium, color = Color.White)
                } else {
                    if (icon != null) {
                        Icon(icon, contentDescription = null, tint = Color.White, modifier = Modifier.size(20.dp))
                        Spacer(Modifier.size(8.dp))
                    }
                    Text(text, style = DeltaJalanTypography.labelMedium, color = Color.White)
                }
            }
        }
    }
}

/**
 * Tombol sekunder outline — pasangan BrandPrimaryButton.
 * Web: `bg-white text-[#1e40af] border rounded-lg` (aksi sekunder).
 */
@Composable
fun BrandSecondaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null,
    enabled: Boolean = true,
) {
    val shape = RoundedCornerShape(8.dp)
    androidx.compose.material3.OutlinedButton(
        onClick = onClick,
        enabled = enabled,
        shape = shape,
        colors = androidx.compose.material3.ButtonDefaults.outlinedButtonColors(
            contentColor = BrandBlue,
        ),
        border = androidx.compose.foundation.BorderStroke(1.dp, BorderInput),
        modifier = modifier.fillMaxWidth().height(44.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            if (icon != null) {
                Icon(icon, contentDescription = null, tint = BrandBlue,
                    modifier = Modifier.size(20.dp))
                Spacer(Modifier.size(8.dp))
            }
            Text(text, style = DeltaJalanTypography.labelMedium, color = BrandBlue)
        }
    }
}

/** Toggle ikon mata untuk field password. */
@Composable
fun PasswordToggle(visible: Boolean, onToggle: () -> Unit) {
    IconButton(onClick = onToggle, modifier = Modifier.size(28.dp)) {
        Icon(
            imageVector = if (visible) AppIcon.VisibilityOff else AppIcon.Visibility,
            contentDescription = if (visible) "Sembunyikan kata sandi" else "Tampilkan kata sandi",
            tint = TextPlaceholder,
            modifier = Modifier.size(20.dp),
        )
    }
}
