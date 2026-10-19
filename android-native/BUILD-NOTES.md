# Build & Install android-native — Catatan Progres

Tanggal: (sesi ini)

## Status
- ✅ Android SDK dipasang manual (tanpa sudo) di `~/Android`
  - cmdline-tools v12.0, platform-36, build-tools 36.0.0 & 35.0.0, platform-tools/adb 37.0.1
- ✅ `android-native/local.properties` → `sdk.dir=/home/marcille/Android`
- ✅ `~/.bashrc` → ANDROID_HOME / ANDROID_SDK_ROOT / PATH
- ✅ APK BUILD SUCCESSFUL → `android-native/app/build/outputs/apk/debug/app-debug.apk` (57 MB)
  - package `com.jalankita.app`, versionCode 2, versionName 1.1.0, targetSdk 36
  - signed with Android Debug cert
- ⏳ HP Samsung `RR8N903YRNE` status ADB: **unauthorized** (butuh approve di layar HP)
- ⏳ `adb install` belum dijalankan

## Perbaikan yang diperlukan agar build jalan (semua sudah diterapkan)
1. **JDK**: Java 21 di sistem hanya JRE (tak ada javac). Project butuh JDK 17 yang SUDAH terpasang.
   → ditambah `org.gradle.java.home=/usr/lib/jvm/java-17-openjdk-amd64` di `android-native/gradle.properties`.
2. **Dependency invalid**: `io.coil-kt:coil-network-okhttp:2.6.0` tidak ada di Maven (baru ada di Coil 3.x group `io.coil-kt.coil3`).
   → dihapus dari `libs.versions.toml` + `app/build.gradle.kts` (Coil 2.x sudah termasuk network/OkHttp di `coil-compose`).
3. **google-services.json** hilang (wajib plugin google-services 4.4.4).
   → dibuat **placeholder** `android-native/app/google-services.json` (gitignored). FCM TIDAK berfungsi sampai file asli dari Firebase Console dipasang.
4. **Ikon launcher hilang** (`@mipmap/ic_launcher`).
   → dibuat mipmap mdpi..xxxhdpi dari `Frontend-stable/public/icons/icon-512x512.png`.
5. **Dependency hilang**:
   - `androidx.activity:activity-compose:1.9.3` (setContent, rememberLauncherForActivityResult, enableEdgeToEdge)
   - `com.squareup.moshi:moshi-kotlin:1.15.2` (KotlinJsonAdapterFactory)

## Perintah build (dari `android-native/`)
```bash
export ANDROID_HOME=$HOME/Android
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export PATH=$ANDROID_HOME/platform-tools:$JAVA_HOME/bin:$PATH
./gradlew assembleDebug --no-daemon
```

## Langkah install (setelah HP di-approve)
1. Di HP Samsung: Developer options → USB debugging ON → cabut/colok USB → dialog "Allow USB debugging?" → centang "Always allow" → Allow.
2. Di laptop:
```bash
adb devices            # harus tampil "device" (bukan unauthorized)
adb install -r android-native/app/build/outputs/apk/debug/app-debug.apk
```

## Catatan
- `AGENTS.md` diubah (atas izin user) agar agen boleh menjalankan `gradlew` di `android-native/` + `adb install`.
- Placeholder google-services → fitur push/FCM tidak akan bekerja sampai file Firebase asli dipasang.
- APK build menimpa aplikasi versi Capacitor (applicationId sama: com.jalankita.app).
