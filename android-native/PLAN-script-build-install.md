# PLAN — Script `build-install-android.sh` (Fase 2)

**Tujuan:** satu perintah untuk (1) build APK `android-native`, (2) verifikasi APK,
(3) deteksi HP via adb, (4) install otomatis ke HP yang terdeteksi.

**Lokasi:** `scripts/build-install-android.sh` (sejajar script lain di `scripts/`).

---

## 0. Konteks & Batasan

- **AGENTS.md** sudah diubah: agen **boleh** `gradlew` di `android-native/` + `adb install`.
  Script ini = otomasi dari yang sudah diizinkan.
- Environment terverifikasi: JDK 17 di `/usr/lib/jvm/java-17-openjdk-amd64`,
  SDK di `~/Android` (platform-36, build-tools 36.0.0 + 35.0.0, platform-tools/adb).
- `android-native/local.properties` → `sdk.dir=/home/marcille/Android`.
- HP terdeteksi: Samsung `RR8N903YRNE` (SM-A217F) — **bukan hardcode**, script
  harus auto-deteksi device apa pun.

---

## 1. Alur Script (step-by-step)

```
1. Deteksi & set environment
   - ANDROID_HOME=$HOME/Android (fallback: ANDROID_SDK_ROOT env)
   - JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 (fallback: java-17 lainnya)
   - PATH += platform-tools
   - Validasi: adb, java, gradlew, SDK ada → kalau tidak, error jelas & exit 1

2. BUILD
   - cd android-native
   - ./gradlew assembleDebug --no-daemon
   - Tangkap exit code; kalau gagal → tampilkan error, EXIT 1 (JANGAN install)

3. VERIFIKASI APK (sebelum install — "cek sebelum install")
   - APK ada di app/build/outputs/apk/debug/app-debug.apk
   - apksigner verify  → tanda tangan valid
   - aapt2 dump badging → package = com.jalankita.app, versi terbaca
   - Kalau salah satu gagal → EXIT 1

4. DETEKSI DEVICE
   - adb devices → ambil device berstatus "device" (authorized)
   - 0 device → pesan "tidak ada HP terdeteksi" + hint USB debugging, EXIT 1
   - >1 device  → pilih: --serial <id> bila diberi, else device pertama + beri tahu
   - device "unauthorized" → pesan khusus "approve dialog di HP", EXIT 1

5. INSTALL
   - adb -s <serial> install -r <apk>
   - Gagal (mis. INSTALL_FAILED_VERSION_DOWNGRADE) → tampilkan pesan + EXIT 1

6. (opsional) LAUNCH
   - adb -s <serial> shell am start -n com.jalankita.app/.MainActivity
   - Tampilkan PID → user lihat app langsung terbuka

7. Ringkasan: paket, versi, device, APK size, waktu build
```

---

## 2. Opsi CLI (flags)

| Flag | Fungsi |
|------|--------|
| `--build-only` | Build + verifikasi saja, tanpa install |
| `--install-only` | Lewati build, langsung install APK terakhir |
| `--launch` | Setelah install, buka app otomatis |
| `--serial <id>` | Pilih HP tertentu bila >1 terhubung |
| `--release` | Build `assembleRelease` (default debug) |
| `--clean` | `gradlew clean` sebelum build |
| `-h`/`--help` | Tampilkan bantuan |
| (tanpa flag) | Build + verifikasi + install |

---

## 3. Perilaku Error (fail-fast, pesan Indonesia)

| Kondisi | Pesan | Exit |
|---|---|---|
| SDK/JDK tidak ditemukan | "Android SDK/JDK tidak ditemukan di ~/Android" | 1 |
| Build gagal | tampilkan baris `e:` Gradle | 1 |
| APK tidak ada | "APK tidak dihasilkan" | 1 |
| Signature invalid | "APK tidak valid (signature)" | 1 |
| 0 device | "Tidak ada HP terdeteksi. Aktifkan USB debugging." | 1 |
| device unauthorized | "HP terdeteksi tapi belum diotorisasi — approve dialog di layar HP." | 1 |
| install gagal | tampilkan output adb | 1 |

---

## 4. Detail Implementasi (keputusan)

- **Bash**, `set -euo pipefail` (gaya repo: `deploy-apk.sh` pakai `set -euo pipefail`).
- **Warna output** (hijau OK, merah FAIL) bila TTY — membantu tanpa mengganggu log.
- **Log ke `scripts/build-install-android.log`** (gaya `start-android.sh`).
- **Tidak hardcode serial HP** — auto-detect; `--serial` untuk override.
- **Verifikasi APK wajib** sebelum install (permintaan user: "cek sebelum install").
- **Idempoten**: bisa dijalankan berulang; `install -r` menimpa versi lama.
- **chmod +x** agar bisa `./scripts/build-install-android.sh`.

---

## 5. Yang TIDAK dilakukan

- Tidak menyentuh Capacitor (`Frontend-stable`) — khusus `android-native`.
- Tidak deploy ke server (itu `deploy-apk.sh`).
- Tidak commit/push (aturan AGENTS.md).
- Tidak `migrate`/database.

---

## 6. Verifikasi Script (setelah dibuat)

1. `bash -n scripts/build-install-android.sh` → syntax OK.
2. `--help` → tampilkan bantuan, exit 0.
3. Jalankan tanpa HP → harus berhenti dengan pesan "tidak ada HP" (bukan crash).
4. Dengan HP terhubung → build + verifikasi + install + launch sukses.
5. Cek `adb shell pm list packages | grep jalankita` → terpasang.

---

## 7. Risiko

| Risiko | Mitigasi |
|---|---|
| `--no-daemon` lambat tiap build | Beri info durasi; opsi daemon menyusul bila perlu |
| JDK 21 (JRE) terpakai → gagal | Script paksa JAVA_HOME=JDK 17 (sudah terbukti jadi akar masalah) |
| >1 HP terhubung | `--serial` + default device pertama + beri tahu |
| APK besar (69MB) install lambat | Info progres streamed install (adb bawaan) |
| HP sleep/lock saat install | Install tetap jalan (adb tak butuh layar) |
| **Reinstall saat app berjalan → crash transien framework** (`ConfigurationController` NPE di `handleBindApplication`) | **`am force-stop` app sebelum install** (sudah diimplementasi) |

## 8. Temuan saat Uji (2026-09-29)

- Script berhasil build + verifikasi + install + launch (PID terdeteksi).
- **Ditemukan crash transien** saat `--install-only` dijalankan sementara app
  sedang berjalan: `FATAL EXCEPTION ... NullPointerException` di
  `android.app.ConfigurationController.updateLocaleListFromAppContext`
  (stack di `ActivityThread.handleBindApplication` — **bukan kode app**).
  Setelah buffer crash dibersihkan + launch fresh → **0 FATAL, app jalan normal**.
  → **Perbaikan:** `am force-stop` sebelum install + cek crash setelah `--launch`.
