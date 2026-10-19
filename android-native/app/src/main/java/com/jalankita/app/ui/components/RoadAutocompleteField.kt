package com.jalankita.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.jalankita.app.core.data.RoadSuggestion
import com.jalankita.app.ui.theme.BrandBlue
import com.jalankita.app.ui.theme.TextDark
import com.jalankita.app.ui.theme.TextMuted

/**
 * Kolom nama jalan dengan dropdown saran LocationIQ. Saat [suggestions] kosong
 * hanya menampilkan kolom biasa (fallback manual bila LocationIQ tak dikonfigurasi).
 */
@Composable
fun RoadAutocompleteField(
    value: String,
    onValueChange: (String) -> Unit,
    suggestions: List<RoadSuggestion>,
    loading: Boolean,
    enabled: Boolean,
    onPick: (RoadSuggestion) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String = "cth. Jl. Raya Porong",
) {
    Column(modifier = modifier.fillMaxWidth()) {
        BrandTextField(
            value = value,
            onValueChange = onValueChange,
            placeholder = placeholder,
            enabled = enabled,
        )
        if (loading) {
            Spacer(Modifier.height(4.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                CircularProgressIndicator(color = BrandBlue, strokeWidth = 2.dp, modifier = Modifier.size(13.dp))
                Spacer(Modifier.width(6.dp))
                Text("Mencari nama jalan…", color = TextMuted, fontSize = 11.sp)
            }
        }
        if (suggestions.isNotEmpty()) {
            Spacer(Modifier.height(6.dp))
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(10.dp))
                    .background(androidx.compose.ui.graphics.Color.White)
                    .border(1.dp, androidx.compose.ui.graphics.Color(0xFFE2E8F0), RoundedCornerShape(10.dp)),
            ) {
                suggestions.forEachIndexed { i, s ->
                    if (i > 0) HorizontalDivider(color = androidx.compose.ui.graphics.Color(0xFFE2E8F0))
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onPick(s) }
                            .padding(horizontal = 12.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(AppIcon.Map, contentDescription = null, tint = BrandBlue, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(10.dp))
                        Text(
                            s.displayLabel,
                            color = TextDark,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Medium,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                }
            }
        }
    }
}
