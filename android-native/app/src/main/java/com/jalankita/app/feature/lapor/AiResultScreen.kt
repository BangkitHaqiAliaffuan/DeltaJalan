package com.jalankita.app.feature.lapor

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.jalankita.app.core.network.DetectionDto
import com.jalankita.app.feature.lapor.components.KecamatanDropdown
import com.jalankita.app.ui.components.AppIcon
import com.jalankita.app.ui.components.BrandPrimaryButton
import com.jalankita.app.ui.components.BrandTextField
import com.jalankita.app.ui.components.DuplicateWarningCard
import com.jalankita.app.ui.components.ErrorBox
import com.jalankita.app.ui.components.FieldLabel
import com.jalankita.app.ui.components.PatrolContextBanner
import com.jalankita.app.ui.components.RoadAutocompleteField
import com.jalankita.app.ui.components.SuccessBox
import com.jalankita.app.ui.theme.BrandBlue
import com.jalankita.app.ui.theme.DeltaJalanTypography
import com.jalankita.app.ui.theme.SuccessGreen
import com.jalankita.app.ui.theme.TextDark
import com.jalankita.app.ui.theme.TextMuted

/**
 * Layar hasil AI + form laporan petugas (multi-foto). Menampilkan:
 *  - galeri per-foto (foto + overlay bbox + daftar deteksi) — port `DeteksiFoto` ai-result web
 *  - form: nama jalan, kecamatan (18 dropdown), dimensi PER FOTO, catatan
 *  - submit → POST /api/reports/batch → layar sukses (report_code)
 */
@Composable
fun AiResultScreen(
    vm: LaporViewModel,
    reporterName: String,
    onDone: () -> Unit,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    // Layar sukses
    val saved = vm.savedReport
    if (saved != null) {
        Column(
            modifier.fillMaxSize().padding(24.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Icon(AppIcon.CheckCircle, null, tint = SuccessGreen, modifier = Modifier.size(72.dp))
            Spacer(Modifier.height(16.dp))
            Text("Laporan Terkirim", style = DeltaJalanTypography.headlineLarge.copy(fontSize = 24.sp), color = Color.White)
            Spacer(Modifier.height(8.dp))
            Text(
                "Kode laporan:\n${saved.reportCode}",
                color = Color.White, fontWeight = FontWeight.SemiBold,
                style = DeltaJalanTypography.bodySmall,
            )
            Spacer(Modifier.height(8.dp))
            saved.systemNotes?.takeIf { it.contains("[PERINGATAN]") }?.let {
                SuccessBox("Catatan sistem: lokasi foto berbeda >500 m dari koordinat form. Laporan tetap tersimpan & akan direview.")
            }
            Spacer(Modifier.height(24.dp))
            BrandPrimaryButton(text = "Lapor Lagi", onClick = { vm.reset(); onDone() })
        }
        return
    }

    Column(modifier.fillMaxSize().padding(16.dp)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier.size(40.dp).clip(RoundedCornerShape(50)).background(Color.White.copy(alpha = .9f))
                    .clickable { onBack() },
                contentAlignment = Alignment.Center,
            ) { Icon(AppIcon.ArrowBack, "Kembali", tint = BrandBlue, modifier = Modifier.size(22.dp)) }
            Spacer(Modifier.size(12.dp))
            Text("Hasil Analisis", style = DeltaJalanTypography.headlineLarge.copy(fontSize = 20.sp), color = Color.White)
        }

        Spacer(Modifier.height(16.dp))
        Column(
            Modifier.fillMaxWidth().weight(1f).verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            vm.error?.let { ErrorBox(it) }

            // Peringatan duplikat (non-blokir) — dari cek SHA-256 + spatial.
            vm.duplicateWarning?.let { w ->
                DuplicateWarningCard(warning = w, onDismiss = { vm.dismissDuplicateWarning() })
            }

            // Banner sesi cek rutin (hanya bila dari sesi patroli).
            if (vm.surveyTaskId != null) {
                PatrolContextBanner(roadName = vm.surveyRoadName, kecamatan = vm.surveyKecamatan)
            }

            // Ringkasan AI keseluruhan
            Box(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp))
                    .background(Color.White.copy(alpha = 0.95f)).padding(16.dp),
            ) {
                Column {
                    Text("Ringkasan AI", style = DeltaJalanTypography.labelMedium, color = TextDark)
                    Spacer(Modifier.height(4.dp))
                    Text("Foto: ${vm.photos.size}", color = TextMuted, fontSize = 13.sp)
                    Text("Total deteksi: ${vm.totalDetections}", color = TextMuted, fontSize = 13.sp)
                    Text("Keparahan: ${vm.overallSeverity ?: "-"}", color = TextMuted, fontSize = 13.sp)
                }
            }

            // ── Galeri per-foto + form dimensi per foto (port ai-result web) ──
            vm.photos.forEachIndexed { i, p ->
                androidx.compose.runtime.key(i) {
                Column(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp))
                        .background(Color.White.copy(alpha = 0.95f))
                        .border(1.dp, Color(0xFFE2E8F0), RoundedCornerShape(12.dp))
                        .padding(12.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("Foto ${i + 1}", color = TextDark, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                        Spacer(Modifier.weight(1f))
                        val dets = p.detections
                        Text(
                            if (dets.isEmpty()) "Tidak ada deteksi" else "${dets.size} deteksi",
                            color = if (dets.isEmpty()) TextMuted else BrandBlue,
                            fontSize = 12.sp, fontWeight = FontWeight.SemiBold,
                        )
                    }
                    // Foto + overlay bbox
                    Box(
                        Modifier.fillMaxWidth().aspectRatio(4f / 3f)
                            .clip(RoundedCornerShape(10.dp)).background(Color(0xFFF1F5F9)),
                    ) {
                        AsyncImage(
                            model = p.uri, contentDescription = "Foto ${i + 1}",
                            contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize(),
                        )
                        BboxOverlay(detections = p.detections)
                    }
                    // Daftar deteksi
                    if (p.detections.isNotEmpty()) {
                        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            p.detections.forEach { d -> DetectionRow(d) }
                        }
                    }
                    // Dimensi per foto (backend batch butuh array per foto)
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text("Panjang (m)", color = TextMuted, fontSize = 11.sp)
                            BrandTextField(
                                value = p.panjang,
                                onValueChange = { vm.updatePhotoDimensi(i, panjang = it) },
                                placeholder = "0.0", enabled = !vm.busy,
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal, imeAction = ImeAction.Next),
                            )
                        }
                        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text("Lebar (m)", color = TextMuted, fontSize = 11.sp)
                            BrandTextField(
                                value = p.lebar,
                                onValueChange = { vm.updatePhotoDimensi(i, lebar = it) },
                                placeholder = "0.0", enabled = !vm.busy,
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal, imeAction = ImeAction.Next),
                            )
                        }
                    }
                }
                }
            }

            // ── Form laporan (header) ──
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    FieldLabel("Nama Jalan")
                    if (vm.geocoding) {
                        Spacer(Modifier.size(8.dp))
                        CircularProgressIndicator(color = BrandBlue, strokeWidth = 2.dp, modifier = Modifier.size(13.dp))
                        Spacer(Modifier.size(5.dp))
                        Text("Mencari nama jalan…", color = TextMuted, fontSize = 11.sp)
                    } else if (vm.roadNameLocked) {
                        Spacer(Modifier.size(6.dp))
                        Text("Dari GPS", color = BrandBlue, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                    } else if (vm.surveyTaskId != null) {
                        Spacer(Modifier.size(6.dp))
                        Text("Dari sesi patroli", color = BrandBlue, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                    }
                }
                RoadAutocompleteField(
                    value = vm.roadName,
                    onValueChange = { vm.onRoadQueryChange(it) },
                    suggestions = if (vm.surveyTaskId != null || vm.roadNameLocked) emptyList() else vm.roadSuggestions,
                    loading = vm.roadSearchLoading,
                    enabled = !vm.busy && vm.surveyTaskId == null,
                    onPick = { vm.pickRoadSuggestion(it) },
                    placeholder = "cth: Jl. Raya Sidoarjo",
                )
            }

            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    FieldLabel("Kecamatan")
                    if (vm.surveyTaskId != null) {
                        Spacer(Modifier.size(6.dp))
                        Text("Dari sesi patroli", color = BrandBlue, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                    }
                }
                KecamatanDropdown(
                    selected = vm.district,
                    onSelect = { vm.district = it },
                    enabled = !vm.busy,
                    locked = vm.surveyTaskId != null,
                )
            }

            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                FieldLabel("Catatan (opsional)")
                BrandTextField(
                    value = vm.catatan, onValueChange = { vm.catatan = it },
                    placeholder = "Keterangan tambahan", enabled = !vm.busy,
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                )
            }

            BrandPrimaryButton(
                text = "Simpan Laporan (${vm.photos.size} foto)",
                loading = vm.busy && vm.stage == LaporStage.SUBMITTING,
                loadingText = "Menyimpan…",
                onClick = { vm.submit() },
            )
        }
    }
}

/**
 * Overlay kotak bbox deteksi AI di atas foto — port `DeteksiFoto` web (ai-result.tsx:220-231).
 * Koordinat bbox adalah fraksi 0..1 (x1,y1,x2,y2) relatif terhadap lebar/tinggi gambar.
 */
@Composable
private fun BboxOverlay(detections: List<DetectionDto>) {
    if (detections.isEmpty()) return
    val stroke = 2.dp
    Canvas(modifier = Modifier.fillMaxSize()) {
        val w = size.width
        val h = size.height
        detections.forEach { d ->
            val b = d.bbox ?: return@forEach
            if (b.size < 4) return@forEach
            val left = (b[0].coerceIn(0.0, 1.0) * w).toFloat()
            val top = (b[1].coerceIn(0.0, 1.0) * h).toFloat()
            val right = (b[2].coerceIn(0.0, 1.0) * w).toFloat()
            val bottom = (b[3].coerceIn(0.0, 1.0) * h).toFloat()
            drawRect(
                color = Color(0xFFEF4444),
                topLeft = Offset(left, top),
                size = Size((right - left).coerceAtLeast(1f), (bottom - top).coerceAtLeast(1f)),
                style = Stroke(width = stroke.toPx()),
            )
        }
    }
}

/** Satu baris deteksi AI: nama kelas + keyakinan + keparahan. */
@Composable
private fun DetectionRow(d: DetectionDto) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(8.dp).clip(RoundedCornerShape(2.dp)).background(Color(0xFFEF4444)))
        Spacer(Modifier.size(8.dp))
        Text(
            d.effectiveType ?: "Kerusakan",
            color = TextDark, fontSize = 13.sp, fontWeight = FontWeight.SemiBold,
            modifier = Modifier.weight(1f),
        )
        d.severity?.let {
            Text(it.replaceFirstChar { c -> c.uppercase() }, color = TextMuted, fontSize = 11.sp)
            Spacer(Modifier.size(8.dp))
        }
        d.confidence?.let {
            Text("${(it * 100).toInt()}%", color = BrandBlue, fontSize = 12.sp, fontWeight = FontWeight.Bold)
        }
    }
}
