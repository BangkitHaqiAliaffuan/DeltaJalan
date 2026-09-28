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

        // URL style peta MapLibre — configurable per build, JANGAN hardcode
        // tile.openstreetmap.org di kode (lihat docs/rencana-native-android.md §7).
        buildConfigField("String", "MAP_STYLE_URL", "\"https://demotiles.maplibre.org/style.json\"")
        buildConfigField("String", "MAP_USER_AGENT", "\"DeltaJalan-Android/${versionName}\"")
        buildConfigField("String", "API_BASE_URL", "\"https://api.deltajalan.web.id/api\"")
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
    val composeBom = platform("androidx.compose:compose-bom:${libs.versions.composeBom.get()}")
    implementation(composeBom)
    androidTestImplementation(composeBom)
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui-tooling-preview")
    debugImplementation("androidx.compose.ui:ui-tooling")

    implementation(libs.core.ktx)
    implementation(libs.lifecycle.runtime)
    implementation(libs.lifecycle.viewmodel)

    // Jaringan — kontrak: backend_POSTGRESQL/routes/api.php
    implementation(libs.retrofit)
    implementation(libs.retrofit.moshi)
    implementation(libs.okhttp.logging)
    implementation(libs.coil.compose)
    implementation(libs.coil.network)

    // DI + penyimpanan
    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)
    implementation(libs.datastore.prefs)
    implementation(libs.room.runtime)
    implementation(libs.room.ktx)
    ksp(libs.room.compiler)

    // Kamera + EXIF (port PhotoExifGpsPlugin.java: rantai 4-attempt)
    implementation(libs.camerax.core)
    implementation(libs.camerax.camera2)
    implementation(libs.camerax.lifecycle)
    implementation(libs.camerax.view)
    implementation(libs.exifinterface)

    // Background: tracking GPS + sinkronisasi antrian
    implementation(libs.workmanager)

    // Peta — MapLibre Native (bukan osmdroid, sudah diarsipkan)
    implementation(libs.maplibre.sdk)

    // Push — proyek Firebase sama dengan versi Capacitor
    implementation(platform(libs.firebase.bom))
    implementation(libs.firebase.messaging)
}
