package com.jalankita.app.ui.map

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.os.Bundle
import android.util.Log
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import com.jalankita.app.BuildConfig
import com.jalankita.app.core.network.MapReportDto
import com.jalankita.app.core.network.MarkerKind
import com.jalankita.app.ui.theme.BrandBlue
import com.jalankita.app.ui.theme.TextDark
import com.jalankita.app.ui.theme.TextMuted
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.maplibre.android.camera.CameraPosition
import org.maplibre.android.geometry.LatLng
import org.maplibre.android.maps.MapLibreMap
import org.maplibre.android.maps.MapLibreMapOptions
import org.maplibre.android.maps.MapView
import org.maplibre.android.maps.Style
import org.maplibre.android.style.expressions.Expression
import org.maplibre.android.style.layers.FillLayer
import org.maplibre.android.style.layers.LineLayer
import org.maplibre.android.style.layers.PropertyFactory
import org.maplibre.android.style.layers.SymbolLayer
import org.maplibre.android.style.sources.GeoJsonSource
import org.maplibre.geojson.Feature
import org.maplibre.geojson.FeatureCollection
import org.maplibre.geojson.Point

/**
 * Peta sebaran generik (MapLibre) — dipakai tab Peta warga DAN supervisor.
 * Diekstraksi dari WargaPetaScreen (PLAN-supervisor §5.4) agar tak menduplikasi
 * MapView/SymbolLayer/lifecycle. Pemanggil menyuplai data + state; komponen ini
 * murni presentasional.
 *
 * @param sourceId id unik per pemanggil (hindari tabrakan style saat dua layar dipakai bergantian).
 */

private const val KIND_PROP = "kind"
private const val ID_PROP = "reportId"

/** Kamera awal: tengah Kab. Sidoarjo (port SidoarjoBounds server). */
val SIDOARJO_CENTER = LatLng(-7.45, 112.72)
const val SIDOARJO_ZOOM = 10.5

private const val TAG = "ReportMap"

/** Buat dot marker 28dp berwarna [argb] dengan ring putih. */
private fun makeDot(argb: Long): Bitmap {
    val px = 56
    val bmp = Bitmap.createBitmap(px, px, Bitmap.Config.ARGB_8888)
    val c = Canvas(bmp)
    val a = ((argb shr 24) and 0xFF).toInt()
    val r = ((argb shr 16) and 0xFF).toInt()
    val g = ((argb shr 8) and 0xFF).toInt()
    val b = (argb and 0xFF).toInt()
    c.drawCircle(
        px / 2f, px / 2f, px / 2f - 4f,
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.FILL
            setARGB(a, r, g, b)
        },
    )
    c.drawCircle(
        px / 2f, px / 2f, px / 2f - 4f,
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeWidth = 5f
            setARGB(255, 255, 255, 255)
        },
    )
    return bmp
}

private fun MapReportDto.toFeature(): Feature? {
    val lat = latitude ?: return null
    val lng = longitude ?: return null
    return Feature.fromGeometry(Point.fromLngLat(lng, lat)).apply {
        addStringProperty(ID_PROP, id)
        addStringProperty(KIND_PROP, markerKind.name)
    }
}

data class SelectedKecamatanInfo(
    val nama: String,
    val total: Int,
    val score: Double,
    val berat: Int,
    val sedang: Int,
    val ringan: Int,
    val severityLabel: String,
    val colorHex: String,
)

/**
 * @param reports marker yang ditampilkan.
 * @param loading true saat memuat & data kosong.
 * @param error pesan error (null = tidak ada).
 * @param totalLabel teks jumlah yang ditampilkan di bilah atas.
 * @param onRetry tombol "Coba Lagi".
 * @param onOpenDetail dipanggil saat kartu ringkasan diketuk.
 */
@Composable
fun ReportMapScreen(
    reports: List<MapReportDto>,
    loading: Boolean,
    error: String?,
    totalLabel: String,
    sourceId: String,
    onRetry: () -> Unit,
    onOpenDetail: (String) -> Unit,
    modifier: Modifier = Modifier,
    miniMap: Boolean = false,
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    var selected by remember { mutableStateOf<MapReportDto?>(null) }
    var selectedKecamatan by remember { mutableStateOf<SelectedKecamatanInfo?>(null) }
    // Lookup terbaru untuk listener klik (dipasang sekali).
    val latestReports by rememberUpdatedState(reports)
    // Koleksi fitur dihitung ulang hanya saat reports berubah.
    val features = remember(reports) {
        FeatureCollection.fromFeatures(reports.mapNotNull { it.toFeature() })
    }
    // Gunakan array holder biasa (bukan State) agar assignment TIDAK memicu recompose/DisposableEffect restart.
    // MapView dibuat sekali di AndroidView factory; lifecycle di-forward oleh DisposableEffect.
    val mapViewHolder = remember { arrayOfNulls<MapView>(1) }
    var maplibreMap by remember { mutableStateOf<MapLibreMap?>(null) }
    // Error load style/tile (null = tidak ada). Dipakai overlay "Coba Lagi" di bawah.
    var mapError by remember { mutableStateOf<String?>(null) }

    // Fitur poligon batas kecamatan (dengan statistik tingkat kerusakan)
    var kecamatanFeatures by remember { mutableStateOf<FeatureCollection?>(null) }

    val kecSourceId = "src-kecamatan-$sourceId"
    val kecFillLayerId = "lyr-kecamatan-fill-$sourceId"
    val kecLineLayerId = "lyr-kecamatan-line-$sourceId"

    // Muat & hitung skor kerusakan per kecamatan dari assets di thread IO
    LaunchedEffect(reports) {
        val collection = withContext(Dispatchers.IO) {
            try {
                val json = context.assets.open("sidoarjo-kecamatan.geojson").bufferedReader().use { it.readText() }
                val rawCollection = FeatureCollection.fromJson(json)
                val rawFeatures = rawCollection.features().orEmpty()

                // Hitung laporan aktif (bukan Selesai / Ditolak)
                val activeReports = reports.filter {
                    val st = it.status?.lowercase().orEmpty()
                    !st.contains("selesai") && !st.contains("ditolak")
                }
                val reportsByKec = activeReports.groupBy { it.district?.trim()?.lowercase().orEmpty() }

                val modified = rawFeatures.map { feat ->
                    val kecName = feat.getStringProperty("kecamatan") ?: ""
                    val kecKey = kecName.trim().lowercase()
                    val kecReports = reportsByKec[kecKey].orEmpty()

                    val total = kecReports.size
                    var berat = 0
                    var sedang = 0
                    var ringan = 0

                    kecReports.forEach { r ->
                        when (r.markerKind) {
                            MarkerKind.BERAT -> berat++
                            MarkerKind.SEDANG -> sedang++
                            MarkerKind.RINGAN -> ringan++
                            else -> {}
                        }
                    }

                    val score = if (total > 0) {
                        (berat * 3.0 + sedang * 2.0 + ringan * 1.0) / total
                    } else {
                        0.0
                    }

                    // Palet warna Frontend-stable:
                    // >= 2.5: Berat (#E11D48)
                    // >= 1.5: Sedang (#F97316)
                    // >= 0.5: Ringan (#F59E0B)
                    // < 0.5: Baik (#22C55E)
                    val (fillColor, strokeColor, label) = when {
                        total == 0 -> Triple("#22C55E", "#16A34A", "Baik (0 Laporan)")
                        score >= 2.5 -> Triple("#E11D48", "#BE123C", "Rusak Berat")
                        score >= 1.5 -> Triple("#F97316", "#C2410C", "Rusak Sedang")
                        score >= 0.5 -> Triple("#F59E0B", "#B45309", "Rusak Ringan")
                        else -> Triple("#22C55E", "#16A34A", "Kondisi Baik")
                    }

                    Feature.fromGeometry(feat.geometry()).apply {
                        addStringProperty("kecamatan", kecName)
                        addStringProperty("nama", feat.getStringProperty("nama") ?: "Kecamatan $kecName")
                        addStringProperty("fillColor", fillColor)
                        addStringProperty("strokeColor", strokeColor)
                        addStringProperty("severityLabel", label)
                        addNumberProperty("score", score)
                        addNumberProperty("totalReports", total)
                        addNumberProperty("berat", berat)
                        addNumberProperty("sedang", sedang)
                        addNumberProperty("ringan", ringan)
                    }
                }
                FeatureCollection.fromFeatures(modified)
            } catch (e: Exception) {
                Log.e(TAG, "Gagal memuat poligon batas kecamatan", e)
                null
            }
        }
        kecamatanFeatures = collection
    }

    // Helper untuk memastikan layer poligon kecamatan terpasang di bawah marker
    fun ensureKecamatanLayer(style: Style, fc: FeatureCollection) {
        val src = style.getSource(kecSourceId) as? GeoJsonSource
        if (src != null) {
            src.setGeoJson(fc)
        } else {
            style.addSource(GeoJsonSource(kecSourceId, fc))
            val fillLayer = FillLayer(kecFillLayerId, kecSourceId).withProperties(
                PropertyFactory.fillColor(Expression.toColor(Expression.get("fillColor"))),
                PropertyFactory.fillOpacity(0.28f),
            )
            val lineLayer = LineLayer(kecLineLayerId, kecSourceId).withProperties(
                PropertyFactory.lineColor(Expression.toColor(Expression.get("strokeColor"))),
                PropertyFactory.lineWidth(1.8f),
                PropertyFactory.lineOpacity(0.9f),
            )
            val markerLayerId = "lyr-${sourceId}-BERAT"
            if (style.getLayer(markerLayerId) != null) {
                style.addLayerBelow(fillLayer, markerLayerId)
                style.addLayerBelow(lineLayer, markerLayerId)
            } else {
                style.addLayer(fillLayer)
                style.addLayer(lineLayer)
            }
        }
    }

    // Terapkan style + source/layer + listener + kamera: SEKALI per view.
    fun applyStyle(map: MapLibreMap) {
        if (mapViewHolder[0]?.isDestroyed == true) {
            Log.w(TAG, "applyStyle dibatalkan: view destroyed ($sourceId)")
            return
        }
        maplibreMap = map
        Log.d(TAG, "setStyle mulai: ${BuildConfig.MAP_STYLE_URL} ($sourceId)")
        map.setStyle(Style.Builder().fromUri(BuildConfig.MAP_STYLE_URL)) { style ->
            if (mapViewHolder[0]?.isDestroyed == true) return@setStyle
            mapError = null
            Log.i(TAG, "Style ter-load: ${BuildConfig.MAP_STYLE_URL}")
            map.cameraPosition = CameraPosition.Builder()
                .target(SIDOARJO_CENTER)
                .zoom(if (miniMap) 11.5 else SIDOARJO_ZOOM)
                .build()

            // Pasang poligon batas kecamatan jika sudah siap
            kecamatanFeatures?.let { fc ->
                ensureKecamatanLayer(style, fc)
            }

            MarkerKind.entries.forEach { kind ->
                val imgId = "dot-${sourceId}-${kind.name}"
                if (style.getImage(imgId) == null) {
                    style.addImage(imgId, makeDot(kind.color))
                }
            }
            if (style.getSource(sourceId) == null) {
                style.addSource(GeoJsonSource(sourceId, features))
                MarkerKind.entries.forEach { kind ->
                    style.addLayer(
                        SymbolLayer("lyr-${sourceId}-${kind.name}", sourceId)
                            .withProperties(
                                PropertyFactory.iconImage("dot-${sourceId}-${kind.name}"),
                                PropertyFactory.iconSize(if (miniMap) 0.75f else 0.85f),
                                PropertyFactory.iconAllowOverlap(true),
                                PropertyFactory.iconIgnorePlacement(true),
                            )
                            .withFilter(
                                Expression.eq(
                                    Expression.get(KIND_PROP),
                                    Expression.literal(kind.name),
                                ),
                            ),
                    )
                }

                // Listener klik peta: memprioritaskan marker laporan, lalu poligon kecamatan
                map.addOnMapClickListener(
                    object : MapLibreMap.OnMapClickListener {
                        override fun onMapClick(point: LatLng): Boolean {
                            val screen = map.projection.toScreenLocation(point)
                            // 1. Cek marker laporan
                            val hits = map.queryRenderedFeatures(
                                screen,
                                "lyr-${sourceId}-BERAT",
                                "lyr-${sourceId}-SEDANG",
                                "lyr-${sourceId}-RINGAN",
                                "lyr-${sourceId}-LAIN",
                            )
                            val hitId = hits.firstOrNull()?.getStringProperty(ID_PROP)
                            if (hitId != null) {
                                selectedKecamatan = null
                                selected = latestReports.firstOrNull { it.id == hitId }
                                return true
                            }

                            // 2. Cek poligon kecamatan
                            val kecHits = map.queryRenderedFeatures(screen, kecFillLayerId)
                            val kecFeat = kecHits.firstOrNull()
                            if (kecFeat != null) {
                                selected = null
                                val kecName = kecFeat.getStringProperty("kecamatan").orEmpty()
                                val total = kecFeat.getNumberProperty("totalReports")?.toInt() ?: 0
                                val score = kecFeat.getNumberProperty("score")?.toDouble() ?: 0.0
                                val berat = kecFeat.getNumberProperty("berat")?.toInt() ?: 0
                                val sedang = kecFeat.getNumberProperty("sedang")?.toInt() ?: 0
                                val ringan = kecFeat.getNumberProperty("ringan")?.toInt() ?: 0
                                val sevLabel = kecFeat.getStringProperty("severityLabel") ?: "Baik"
                                val colHex = kecFeat.getStringProperty("fillColor") ?: "#22C55E"

                                selectedKecamatan = SelectedKecamatanInfo(
                                    nama = kecName,
                                    total = total,
                                    score = score,
                                    berat = berat,
                                    sedang = sedang,
                                    ringan = ringan,
                                    severityLabel = sevLabel,
                                    colorHex = colHex,
                                )
                                return true
                            }

                            // 3. Klik di area kosong -> tutup info
                            selected = null
                            selectedKecamatan = null
                            return false
                        }
                    },
                )
            } else {
                (style.getSource(sourceId) as? GeoJsonSource)?.setGeoJson(features)
            }
        }
    }

    // Update poligon kecamatan saat data GeoJSON/laporan selesai dimuat
    LaunchedEffect(maplibreMap, kecamatanFeatures) {
        val map = maplibreMap ?: return@LaunchedEffect
        val fc = kecamatanFeatures ?: return@LaunchedEffect
        map.style?.let { style ->
            ensureKecamatanLayer(style, fc)
        }
    }

    // DisposableEffect HANYA keyed oleh lifecycleOwner — tidak pernah restart
    // akibat mapViewHolder berubah (Ref bukan State, assignment tidak memicu recompose).
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            Log.d(TAG, "lifecycle event=$event ($sourceId)")
            val view = mapViewHolder[0] ?: return@LifecycleEventObserver
            when (event) {
                Lifecycle.Event.ON_START -> view.onStart()
                Lifecycle.Event.ON_RESUME -> view.onResume()
                Lifecycle.Event.ON_PAUSE -> view.onPause()
                Lifecycle.Event.ON_STOP -> view.onStop()
                // ON_DESTROY disengaja tanpa aksi — destroy hanya di onDispose
                // (ganda = native double-destroy).
                else -> Unit
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
            val view = mapViewHolder[0] ?: return@onDispose
            view.onStop()
            if (!view.isDestroyed) view.onDestroy()
        }
    }

    // Dorong data ke source yang sudah ada (JANGAN setStyle ulang di sini —
    // add ganda melempar CannotAddSource/LayerException).
    LaunchedEffect(maplibreMap, features) {
        val map = maplibreMap ?: return@LaunchedEffect
        (map.style?.getSource(sourceId) as? GeoJsonSource)?.setGeoJson(features)
    }

    Box(modifier = modifier.fillMaxSize()) {
        AndroidView(
            factory = { ctx ->
                // textureMode(true) → TextureView, bukan GLSurfaceView default.
                // SurfaceView di-host Compose di dalam Scaffold tidak muncul
                // (blank/black hole, sisa sync frame pertama — isu upstream
                // maplibre-native #3836 / maplibre-compose #1125); TextureView
                // ikut hierarki render Compose sehingga peta tampil.
                val options = MapLibreMapOptions.createFromAttributes(ctx, null)
                    .textureMode(true)
                MapView(ctx, options).also { mv ->
                    mapViewHolder[0] = mv
                    mv.onCreate(Bundle())
                    // Tab di-mount saat Activity SUDAH resumed → kejar event yang terlewat.
                    // Lifecycle observer baru saja didaftarkan via DisposableEffect;
                    // karena factory berjalan setelah composition, observer sudah aktif.
                    if (lifecycleOwner.lifecycle.currentState.isAtLeast(Lifecycle.State.STARTED)) {
                        mv.onStart()
                    }
                    if (lifecycleOwner.lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED)) {
                        mv.onResume()
                    }
                    // Kegagalan load style JANGAN senyap: tampilkan di overlay
                    // error + catat Log agar bisa didiagnosis via logcat.
                    mv.addOnDidFailLoadingMapListener { err ->
                        Log.e(TAG, "Style gagal ter-load ($sourceId): $err")
                        mapError = err
                    }
                    Log.d(TAG, "MapView factory: view dibuat ($sourceId)")
                    // getMapAsync dipanggil SETELAH onStart/onResume di-forward
                    // secara manual di atas. MapLibre GL thread sudah aktif.
                    mv.getMapAsync { map ->
                        Log.d(TAG, "getMapAsync fire (isDestroyed=${mv.isDestroyed}, $sourceId)")
                        if (mv.isDestroyed) return@getMapAsync
                        applyStyle(map)
                    }
                }
            },
            modifier = Modifier.fillMaxSize(),
        )

        Column(
            modifier = Modifier
                .align(Alignment.TopCenter)
                .fillMaxWidth()
                .padding(12.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(Color.White.copy(alpha = 0.95f))
                .padding(horizontal = 14.dp, vertical = 10.dp),
        ) {
            Text(
                text = if (loading && reports.isEmpty()) "Memuat peta…" else totalLabel,
                fontSize = 14.sp, fontWeight = FontWeight.Bold, color = TextDark,
            )
            Spacer(Modifier.height(6.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
                LegendDot(MarkerKind.BERAT, "Berat")
                LegendDot(MarkerKind.SEDANG, "Sedang")
                LegendDot(MarkerKind.RINGAN, "Ringan")
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(10.dp)
                            .clip(CircleShape)
                            .background(Color(0xFF22C55E)),
                    )
                    Spacer(Modifier.width(4.dp))
                    Text("Baik", fontSize = 12.sp, color = TextMuted)
                }
            }
            Text(
                text = "Warna wilayah & marker: tingkat keparahan jalan • Ketuk wilayah untuk rekap",
                fontSize = 10.5.sp,
                color = TextMuted,
                modifier = Modifier.padding(top = 4.dp),
            )
        }

        if (loading && reports.isEmpty()) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
        }

        // Error data (dari VM) atau error load style/tile (internal).
        // Retry style hanya bila style memang belum ter-load — setStyle ulang
        // setelah sukses parsial dilarang (CannotAddSource/LayerException).
        val styleErr = mapError
        (error ?: styleErr?.let { "Peta gagal dimuat: $it" })?.let { err ->
            Box(
                modifier = Modifier
                    .align(Alignment.TopCenter)
                    .padding(top = 110.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(Color.White)
                    .padding(14.dp),
                contentAlignment = Alignment.Center,
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(err, fontSize = 13.sp, color = TextMuted)
                    Spacer(Modifier.height(8.dp))
                    Button(onClick = {
                        mapError = null
                        onRetry()
                        maplibreMap?.let { if (it.style == null) applyStyle(it) }
                    }) { Text("Coba Lagi") }
                }
            }
        }

        // Atribusi sumber basemap — wajib kebijakan OSM/CARTO.
        Text(
            text = "© OpenStreetMap · © CARTO",
            fontSize = 10.sp,
            color = TextMuted,
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(end = 12.dp, bottom = 12.dp)
                .clip(RoundedCornerShape(6.dp))
                .background(Color.White.copy(alpha = 0.8f))
                .padding(horizontal = 6.dp, vertical = 2.dp),
        )

        // Kartu Detail Laporan Kerusakan
        selected?.let { report ->
            val lat = report.latitude
            val lng = report.longitude
            Column(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .padding(12.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(Color.White)
                    .clickable { if (lat != null && lng != null) onOpenDetail(report.id) }
                    .padding(14.dp),
            ) {
                Text(
                    text = report.roadName ?: "Nama jalan belum diisi",
                    fontSize = 15.sp, fontWeight = FontWeight.Bold, color = TextDark,
                )
                report.district?.let { Text("Kec. $it", fontSize = 13.sp, color = TextMuted) }
                Spacer(Modifier.height(4.dp))
                Text("Lihat Detail →", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = BrandBlue)
            }
        }

        // Kartu Ringkasan Wilayah Kecamatan (ketika poligon kecamatan diketuk)
        if (selected == null) {
            selectedKecamatan?.let { kec ->
                Column(
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .fillMaxWidth()
                        .padding(12.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color.White)
                        .padding(14.dp),
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "Kecamatan ${kec.nama}",
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Bold,
                                color = TextDark,
                            )
                            Text(
                                text = if (kec.total > 0) "${kec.total} laporan aktif • Skor: ${"%.2f".format(kec.score)}" else "Kondisi baik (0 laporan aktif)",
                                fontSize = 12.sp,
                                color = TextMuted,
                            )
                        }
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(6.dp))
                                .background(
                                    try {
                                        Color(android.graphics.Color.parseColor(kec.colorHex))
                                    } catch (_: Exception) {
                                        BrandBlue
                                    }
                                )
                                .padding(horizontal = 8.dp, vertical = 4.dp),
                        ) {
                            Text(
                                text = kec.severityLabel,
                                color = Color.White,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.SemiBold,
                            )
                        }
                    }
                    if (kec.total > 0) {
                        Spacer(Modifier.height(8.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            if (kec.berat > 0) Text("${kec.berat} Rusak Berat", fontSize = 11.sp, color = Color(0xFFE11D48), fontWeight = FontWeight.SemiBold)
                            if (kec.sedang > 0) Text("${kec.sedang} Rusak Sedang", fontSize = 11.sp, color = Color(0xFFF97316), fontWeight = FontWeight.SemiBold)
                            if (kec.ringan > 0) Text("${kec.ringan} Rusak Ringan", fontSize = 11.sp, color = Color(0xFFF59E0B), fontWeight = FontWeight.SemiBold)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun LegendDot(kind: MarkerKind, label: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(
            modifier = Modifier
                .size(10.dp)
                .clip(CircleShape)
                .background(Color(kind.color)),
        )
        Spacer(Modifier.width(4.dp))
        Text(label, fontSize = 12.sp, color = TextMuted)
    }
}
