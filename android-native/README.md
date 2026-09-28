# android-native — DeltaJalan Native (Kotlin, MVP Petugas)

Rencana penuh: `docs/rencana-native-android.md`.

## Buka & build (user yang menjalankan — agen dilarang `gradlew`)

1. Buka folder `android-native/` di Android Studio (Hedgehog+).
2. Copy `google-services.json` proyek Firebase ke `app/` (file sama dengan `Frontend-stable/android/app/`).
3. Sync Gradle, pilih build variant `debug`, Run.

## Konvensi

- `applicationId` = `com.jalankita.app` (sama dengan versi Capacitor agar menimpa mulus).
- `BuildConfig.API_BASE_URL` = base API; `MAP_STYLE_URL` = style MapLibre (configurable per build).
- Kontrak endpoint: `backend_POSTGRESQL/routes/api.php`. Aturan validasi hidup di server.
- User-Agent request tile: `BuildConfig.MAP_USER_AGENT` (kebijakan OSM).
