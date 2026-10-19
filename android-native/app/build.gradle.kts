import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.hilt)
    alias(libs.plugins.ksp)
    alias(libs.plugins.google.services)
}

android {
    // applicationId SAMA dengan versi Capacitor agar instalasi menimpa mulus
    // di HP petugas. versionCode dilanjutkan dari versi Capacitor terakhir.
    namespace = "com.jalankita.app"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.jalankita.app"
        minSdk = 24
        targetSdk = 36
        versionCode = 2
        versionName = "1.1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        // URL style peta MapLibre — configurable per build, JANGAN hardcode
        // tile.openstreetmap.org di kode (lihat docs/rencana-native-android.md §7).
        // Default: CARTO Positron (gratis, tanpa key, ada jalan + label kota;
        // demotiles.maplibre.org hanya berisi negara level dunia → Sidoarjo kosong).
        // Atribusi © OpenStreetMap + © CARTO wajib tampil (lihat ReportMapScreen).
        buildConfigField("String", "MAP_STYLE_URL", "\"https://basemaps.cartocdn.com/gl/positron-gl-style/style.json\"")
        buildConfigField("String", "MAP_USER_AGENT", "\"DeltaJalan-Android/${versionName}\"")
        buildConfigField("String", "API_BASE_URL", "\"https://api.deltajalan.web.id/api\"")

        // Key LocationIQ (tier 2 reverse geocoding) — OPSIONAL, JANGAN hardcode.
        // Isi di local.properties: LOCATIONIQ_KEY=pk.xxxx
        // Kosong → tier 2 dilewati; rantai Nominatim→OSRM→Overpass tetap jalan.
        buildConfigField("String", "LOCATIONIQ_KEY", "\"${localProperty("LOCATIONIQ_KEY")}\"")
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
        // Core library desugaring — menyediakan java.time.* (OffsetDateTime dll.)
        // untuk minSdk 24 (java.time asli baru ada di API 26). Tanpa ini,
        // formatDateShort() crash di Android 7–8. Lihat lint [NewApi].
        isCoreLibraryDesugaringEnabled = true
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {
    // Core library desugaring — pasangan wajib isCoreLibraryDesugaringEnabled.
    coreLibraryDesugaring(libs.desugar.jdk.libs)

    val composeBom = platform("androidx.compose:compose-bom:${libs.versions.composeBom.get()}")
    implementation(composeBom)
    androidTestImplementation(composeBom)
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.compose.ui:ui-tooling-preview")
    debugImplementation("androidx.compose.ui:ui-tooling")

    implementation(libs.core.ktx)
    implementation(libs.activity.compose)
    implementation(libs.lifecycle.runtime)
    implementation(libs.lifecycle.viewmodel)

    // Jaringan — kontrak: backend_POSTGRESQL/routes/api.php
    implementation(libs.retrofit)
    implementation(libs.retrofit.moshi)
    implementation(libs.moshi.kotlin)
    implementation(libs.okhttp.logging)
    implementation(libs.coil.compose)

    // DI + penyimpanan
    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)
    implementation(libs.datastore.prefs)
    // Room: DISIAPKAN untuk Fase 3 (antrian offline). Belum ada @Entity/@Dao —
    // jangan hapus hanya karena belum dipakai; lihat docs/rencana-native-android.md §8.
    implementation(libs.room.runtime)
    implementation(libs.room.ktx)
    ksp(libs.room.compiler)

    // Kamera + EXIF (port PhotoExifGpsPlugin.java: rantai 4-attempt)
    // CameraX: DISIAPKAN untuk Fase 5 (capture langsung agar EXIF GPS asli,
    // ganti galeri — lihat TODO di LaporScreen.kt / WargaLaporScreen.kt).
    implementation(libs.camerax.core)
    implementation(libs.camerax.camera2)
    implementation(libs.camerax.lifecycle)
    implementation(libs.camerax.view)
    implementation(libs.exifinterface)

    // Background: DISIAPKAN untuk Fase 3 (tracking GPS 15 mnt via WorkManager +
    // sinkronisasi antrian offline). Belum ada CoroutineWorker — jangan hapus.
    implementation(libs.workmanager)

    // Peta — MapLibre Native (bukan osmdroid, sudah diarsipkan)
    implementation(libs.maplibre.sdk)

    // Push — proyek Firebase sama dengan versi Capacitor
    implementation(platform(libs.firebase.bom))
    implementation(libs.firebase.messaging)

    // Uji instrumentasi (probe diagnostik GPS EXIF)
    androidTestImplementation(libs.androidx.test.ext.junit)
    androidTestImplementation(libs.androidx.test.runner)
    androidTestImplementation(libs.androidx.test.rules)
}

/**
 * Baca properti opsional dari local.properties (gitignored).
 * local.properties memakai format `KEY=VALUE`; kembalikan "" bila tidak ada.
 * Dipakai agar API key LocationIQ tidak pernah masuk repo.
 */
fun localProperty(key: String): String {
    val props = rootProject.file("local.properties")
    if (!props.exists()) return ""
    return Properties().apply {
        props.inputStream().use { load(it) }
    }.getProperty(key)?.trim().orEmpty()
}
