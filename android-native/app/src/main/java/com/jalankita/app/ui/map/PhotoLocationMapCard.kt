package com.jalankita.app.ui.map

import android.os.Bundle
import android.util.Log
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import com.jalankita.app.BuildConfig
import com.jalankita.app.ui.theme.TextMuted
import org.maplibre.android.camera.CameraPosition
import org.maplibre.android.geometry.LatLng
import org.maplibre.android.maps.MapLibreMap
import org.maplibre.android.maps.MapLibreMapOptions
import org.maplibre.android.maps.MapView
import org.maplibre.android.maps.Style
import org.maplibre.android.style.layers.CircleLayer
import org.maplibre.android.style.layers.PropertyFactory
import org.maplibre.android.style.sources.GeoJsonSource
import org.maplibre.geojson.Feature
import org.maplibre.geojson.FeatureCollection
import org.maplibre.geojson.Point

private const val TAG = "PhotoLocationMap"
private const val SOURCE_ID = "photo-location-src"
private const val LAYER_ID = "photo-location-layer"

/** Titik tunggal untuk [lat]/[lng] (MapLibre memakai urutan lng, lat). */
private fun pointCollection(lat: Double, lng: Double): FeatureCollection =
    FeatureCollection.fromFeatures(listOf(Feature.fromGeometry(Point.fromLngLat(lng, lat))))

/**
 * Kartu peta kecil (MapLibre) yang menampilkan lokasi kerusakan dari koordinat
 * EXIF foto utama. Non-interaktif: kamera & marker mengikuti foto utama, tanpa
 * gesture agar tidak mencuri scroll form.
 *
 * Teknis: `textureMode(true)` wajib (SurfaceView blank bila di-host Compose),
 * lifecycle di-forward manual seperti [ReportMapScreen].
 */
@Composable
fun PhotoLocationMapCard(
    latitude: Double,
    longitude: Double,
    modifier: Modifier = Modifier,
    label: String = "Lokasi kerusakan (dari EXIF foto)",
    height: Dp = 160.dp,
) {
    val lifecycleOwner = LocalLifecycleOwner.current
    // Holder biasa (bukan State) agar assignment tidak memicu recompose/restart.
    val mapViewHolder = remember { arrayOfNulls<MapView>(1) }
    var maplibreMap by remember { mutableStateOf<MapLibreMap?>(null) }
    var styleReady by remember { mutableStateOf(false) }
    var failed by remember { mutableStateOf(false) }

    // Foto utama diganti → marker & kamera ikut pindah (tanpa setStyle ulang).
    LaunchedEffect(styleReady, latitude, longitude) {
        if (!styleReady) return@LaunchedEffect
        val map = maplibreMap ?: return@LaunchedEffect
        val style = map.style ?: return@LaunchedEffect
        (style.getSource(SOURCE_ID) as? GeoJsonSource)
            ?.setGeoJson(pointCollection(latitude, longitude))
        map.cameraPosition = CameraPosition.Builder()
            .target(LatLng(latitude, longitude))
            .zoom(16.0)
            .build()
    }

    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            val view = mapViewHolder[0] ?: return@LifecycleEventObserver
            when (event) {
                Lifecycle.Event.ON_START -> view.onStart()
                Lifecycle.Event.ON_RESUME -> view.onResume()
                Lifecycle.Event.ON_PAUSE -> view.onPause()
                Lifecycle.Event.ON_STOP -> view.onStop()
                // ON_DESTROY sengaja tanpa aksi — destroy hanya di onDispose.
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

    Box(
        modifier
            .fillMaxWidth()
            .height(height)
            .clip(RoundedCornerShape(12.dp))
            .background(Color(0xFFE8EEF7)),
    ) {
        AndroidView(
            factory = { ctx ->
                val options = MapLibreMapOptions.createFromAttributes(ctx, null)
                    .textureMode(true)
                MapView(ctx, options).also { mv ->
                    mapViewHolder[0] = mv
                    mv.onCreate(Bundle())
                    // Layar upload sudah RESUMED saat kartu di-mount → kejar event.
                    if (lifecycleOwner.lifecycle.currentState.isAtLeast(Lifecycle.State.STARTED)) {
                        mv.onStart()
                    }
                    if (lifecycleOwner.lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED)) {
                        mv.onResume()
                    }
                    mv.addOnDidFailLoadingMapListener { err ->
                        Log.e(TAG, "Style kartu lokasi gagal dimuat: $err")
                        failed = true
                    }
                    mv.getMapAsync { map ->
                        if (mv.isDestroyed) return@getMapAsync
                        maplibreMap = map
                        // Kartu ini presentasional: jangan rebut gesture scroll form.
                        map.uiSettings.setAllGesturesEnabled(false)
                        map.setStyle(Style.Builder().fromUri(BuildConfig.MAP_STYLE_URL)) { style ->
                            if (mv.isDestroyed) return@setStyle
                            style.addSource(
                                GeoJsonSource(SOURCE_ID, pointCollection(latitude, longitude)),
                            )
                            style.addLayer(
                                CircleLayer(LAYER_ID, SOURCE_ID).withProperties(
                                    PropertyFactory.circleRadius(7f),
                                    // BrandBlue #1E40AF — MapLibre butuh warna String.
                                    PropertyFactory.circleColor("#1E40AF"),
                                    PropertyFactory.circleStrokeColor("#FFFFFF"),
                                    PropertyFactory.circleStrokeWidth(2.5f),
                                ),
                            )
                            map.cameraPosition = CameraPosition.Builder()
                                .target(LatLng(latitude, longitude))
                                .zoom(16.0)
                                .build()
                            failed = false
                            styleReady = true
                        }
                    }
                }
            },
            modifier = Modifier.fillMaxSize(),
        )

        Text(
            text = label,
            color = Color(0xFF0F172A),
            fontSize = 10.5.sp,
            modifier = Modifier
                .align(Alignment.TopStart)
                .padding(8.dp)
                .clip(RoundedCornerShape(6.dp))
                .background(Color.White.copy(alpha = 0.92f))
                .padding(horizontal = 8.dp, vertical = 4.dp),
        )

        Text(
            text = "%.5f, %.5f".format(latitude, longitude),
            color = TextMuted,
            fontSize = 10.sp,
            modifier = Modifier
                .align(Alignment.BottomStart)
                .padding(8.dp)
                .clip(RoundedCornerShape(6.dp))
                .background(Color.White.copy(alpha = 0.92f))
                .padding(horizontal = 6.dp, vertical = 2.dp),
        )

        if (failed) {
            Box(
                Modifier
                    .fillMaxSize()
                    .background(Color(0xFFE8EEF7)),
                contentAlignment = Alignment.Center,
            ) {
                Text("Peta tidak dapat dimuat", color = TextMuted, fontSize = 11.sp)
            }
        }
    }
}
