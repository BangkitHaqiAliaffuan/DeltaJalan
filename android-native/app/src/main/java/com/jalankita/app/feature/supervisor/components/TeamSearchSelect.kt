package com.jalankita.app.feature.supervisor.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.jalankita.app.core.network.TeamDto
import com.jalankita.app.ui.components.AppIcon
import com.jalankita.app.ui.components.BrandTextField
import com.jalankita.app.ui.theme.BrandBlue
import com.jalankita.app.ui.theme.TextDark
import com.jalankita.app.ui.theme.TextMuted

/**
 * Picker tim dengan pencarian — padanan Frontend-stable SearchSelect (single-select).
 * Dipakai modal jadwal patroli: pilih tim satgas lalu kecamatan terisi otomatis.
 */
@Composable
fun TeamSearchSelect(
    teams: List<TeamDto>,
    selectedTeamId: String,
    onSelect: (TeamDto) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String = "Cari tim satgas...",
) {
    var expanded by remember { mutableStateOf(false) }
    var search by remember { mutableStateOf("") }

    val selected = teams.firstOrNull { it.id == selectedTeamId }
    val filtered = teams.filter { (it.name ?: "").contains(search, ignoreCase = true) }

    Column(modifier = modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(8.dp))
                .background(Color.White)
                .border(1.dp, Color(0xFFD0DAE8), RoundedCornerShape(8.dp))
                .clickable { expanded = !expanded }
                .padding(horizontal = 12.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = selected?.name ?: placeholder,
                color = if (selected != null) TextDark else TextMuted,
                fontSize = 13.sp,
                modifier = Modifier.weight(1f),
            )
            Icon(AppIcon.ChevronDown, contentDescription = null, tint = TextMuted, modifier = Modifier.size(18.dp))
        }

        if (expanded) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 6.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(Color.White)
                    .border(1.dp, Color(0xFFE2E8F0), RoundedCornerShape(8.dp))
                    .padding(8.dp),
            ) {
                BrandTextField(
                    value = search,
                    onValueChange = { search = it },
                    placeholder = "Cari tim...",
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(6.dp))
                if (filtered.isEmpty()) {
                    Text("Tidak ada tim.", color = TextMuted, fontSize = 12.sp, modifier = Modifier.padding(8.dp))
                } else {
                    Column(modifier = Modifier.heightIn(max = 220.dp).verticalScroll(rememberScrollState())) {
                        filtered.forEach { t ->
                            val active = t.id == selectedTeamId
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(6.dp))
                                    .background(if (active) BrandBlue.copy(alpha = 0.08f) else Color.Transparent)
                                    .clickable {
                                        onSelect(t)
                                        expanded = false
                                        search = ""
                                    }
                                    .padding(horizontal = 8.dp, vertical = 10.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(t.name ?: "—", color = TextDark, fontSize = 13.sp, fontWeight = FontWeight.Medium, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                    t.uptd?.nama?.let { Text(it, color = TextMuted, fontSize = 11.sp) }
                                }
                                if (active) {
                                    Icon(AppIcon.CheckCircle, contentDescription = null, tint = BrandBlue, modifier = Modifier.size(16.dp))
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
