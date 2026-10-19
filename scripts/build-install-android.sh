#!/bin/bash
#
# build-install-android.sh — DeltaJalan android-native (Kotlin) build + install
#
# Build APK android-native, VERIFIKASI (signature/metadata), lalu install otomatis
# ke HP Android yang terdeteksi via adb. Fail-fast: build gagal → tidak install.
#
# Usage:
#   bash scripts/build-install-android.sh                # build + verifikasi + install
#   bash scripts/build-install-android.sh --build-only   # build + verifikasi saja
#   bash scripts/build-install-android.sh --install-only # install APK terakhir
#   bash scripts/build-install-android.sh --launch       # buka app setelah install
#   bash scripts/build-install-android.sh --serial ABC123  # pilih HP tertentu
#   bash scripts/build-install-android.sh --clean        # gradlew clean dulu
#   bash scripts/build-install-android.sh --help
#
# Catatan AGENTS.md: agen DIIZINKAN menjalankan gradlew di android-native + adb install.
#

set -euo pipefail

# ── Konfigurasi ─────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ANDROID_NATIVE="$PROJECT_ROOT/android-native"
LOG_FILE="$SCRIPT_DIR/build-install-android.log"

APP_ID="com.jalankita.app"
MAIN_ACTIVITY="$APP_ID/.MainActivity"

# ── Flag ────────────────────────────────────────────────────────────────────
BUILD_ONLY=false
INSTALL_ONLY=false
DO_LAUNCH=false
DO_CLEAN=false
SERIAL=""
VARIANT="Debug"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --build-only)   BUILD_ONLY=true ;;
    --install-only) INSTALL_ONLY=true ;;
    --launch)       DO_LAUNCH=true ;;
    --clean)        DO_CLEAN=true ;;
    --serial)       SERIAL="${2:-}"; shift ;;
    -h|--help)
      sed -n '2,21p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *) echo "Flag tidak dikenal: $1"; exit 2 ;;
  esac
  shift
done

# ── Output berwarna (bila TTY) ──────────────────────────────────────────────
if [[ -t 1 ]]; then
  C_G=$'\033[32m'; C_R=$'\033[31m'; C_Y=$'\033[33m'; C_B=$'\033[36m'; C_0=$'\033[0m'
else
  C_G=""; C_R=""; C_Y=""; C_B=""; C_0=""
fi
ok()   { echo "${C_G}  OK  ${C_0}$1"; log "  OK  $1"; }
fail() { echo "${C_R} FAIL ${C_0}$1"; log " FAIL $1"; }
warn() { echo "${C_Y}  !   ${C_0}$1"; log "  !   $1"; }
info() { echo "${C_B}  →   ${C_0}$1"; log "  →   $1"; }
step() { echo; echo "${C_B}== $1 ==${C_0}"; log ""; log "== $1 =="; }

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"; }

# ── Init log ────────────────────────────────────────────────────────────────
{
  echo "========================================"
  echo "build-install-android.sh — $(date)"
  echo "========================================"
} > "$LOG_FILE"

START_TS=$(date +%s)

# ── 1. Setup environment ────────────────────────────────────────────────────
step "1/6 Menyiapkan environment"

ANDROID_HOME="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Android}}"
export ANDROID_HOME
export ANDROID_SDK_ROOT="$ANDROID_HOME"

# JDK 17 wajib (Java 21 di sistem hanya JRE — tanpa javac).
if [[ -n "${JAVA_HOME:-}" && -x "$JAVA_HOME/bin/javac" ]]; then
  : # pakai JAVA_HOME yang ada bila valid
else
  JAVA_HOME=""
  for cand in /usr/lib/jvm/java-17-openjdk-amd64 /usr/lib/jvm/java-1.17.0-openjdk-amd64 /usr/lib/jvm/openjdk-17; do
    if [[ -x "$cand/bin/javac" ]]; then JAVA_HOME="$cand"; break; fi
  done
fi
if [[ -z "$JAVA_HOME" ]]; then
  fail "JDK 17 tidak ditemukan (butuh javac). Install: sudo apt install openjdk-17-jdk"
  exit 1
fi
export JAVA_HOME
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$JAVA_HOME/bin:$PATH"

# Validasi komponen kunci
[[ -x "$ANDROID_HOME/platform-tools/adb" ]] || { fail "adb tidak ada di $ANDROID_HOME/platform-tools"; exit 1; }
[[ -x "$ANDROID_NATIVE/gradlew" ]]          || { fail "gradlew tidak ada di $ANDROID_NATIVE"; exit 1; }
[[ -x "$JAVA_HOME/bin/javac" ]]             || { fail "javac tidak ada di $JAVA_HOME"; exit 1; }

ok "ANDROID_HOME=$ANDROID_HOME"
ok "JAVA_HOME=$JAVA_HOME ($("$JAVA_HOME/bin/java" -version 2>&1 | head -1))"
ok "adb: $(adb version | head -1)"

APK="$ANDROID_NATIVE/app/build/outputs/apk/$(echo "$VARIANT" | tr '[:upper:]' '[:lower:]')/app-$(echo "$VARIANT" | tr '[:upper:]' '[:lower:]').apk"

# ── 2/3. Build + verifikasi (kecuali --install-only) ────────────────────────
if [[ "$INSTALL_ONLY" == false ]]; then
  step "2/6 Build APK ($VARIANT)"
  cd "$ANDROID_NATIVE"
  if [[ "$DO_CLEAN" == true ]]; then info "gradlew clean…"; ./gradlew clean --no-daemon >>"$LOG_FILE" 2>&1 || true; fi
  info "gradlew assemble$VARIANT --no-daemon (bisa 25-60 dtk)…"
  if ./gradlew "assemble$VARIANT" --no-daemon >>"$LOG_FILE" 2>&1; then
    ok "Build sukses"
  else
    fail "Build gagal — lihat baris terakhir:"
    grep -E "^e: |error:|FAILURE|What went wrong" "$LOG_FILE" | tail -15 | sed 's/^/      /'
    echo; echo "Log lengkap: $LOG_FILE"
    exit 1
  fi

  step "3/6 Verifikasi APK (sebelum install)"
  [[ -f "$APK" ]] || { fail "APK tidak dihasilkan: $APK"; exit 1; }
  ok "APK ada ($(du -h "$APK" | cut -f1)): ${APK#"$PROJECT_ROOT"/}"

  APKSIGNER="$(ls "$ANDROID_HOME"/build-tools/*/apksigner 2>/dev/null | sort -V | tail -1 || true)"
  if [[ -n "$APKSIGNER" ]]; then
    if "$APKSIGNER" verify "$APK" >/dev/null 2>&1; then ok "Signature valid"; else fail "Signature APK tidak valid"; exit 1; fi
  else
    warn "apksigner tidak ditemukan — lewati cek signature"
  fi

  AAPT2="$(ls "$ANDROID_HOME"/build-tools/*/aapt2 2>/dev/null | sort -V | tail -1 || true)"
  if [[ -n "$AAPT2" ]]; then
    BADGING="$("$AAPT2" dump badging "$APK" 2>/dev/null | head -1 || true)"
    if echo "$BADGING" | grep -q "package: name='$APP_ID'"; then
      ok "Package benar: $APP_ID ($(echo "$BADGING" | grep -oE "versionName='[^']+'" | head -1))"
    else
      fail "Package APK bukan $APP_ID"; exit 1
    fi
  fi
else
  step "2-3/6 --install-only: lewati build"
  [[ -f "$APK" ]] || { fail "APK belum ada: $APK (jalankan tanpa --install-only dulu)"; exit 1; }
  ok "Pakai APK yang ada ($(du -h "$APK" | cut -f1))"
fi

if [[ "$BUILD_ONLY" == true ]]; then
  step "Selesai (--build-only)"
  ok "APK siap: ${APK#"$PROJECT_ROOT"/}"
  exit 0
fi

# ── 4. Deteksi device ───────────────────────────────────────────────────────
step "4/6 Mendeteksi HP via adb"
adb start-server >/dev/null 2>&1 || true

if [[ -n "$SERIAL" ]]; then
  STATE="$(adb -s "$SERIAL" get-state 2>/dev/null || true)"
  if [[ "$STATE" != "device" ]]; then fail "Device $SERIAL state=$STATE (bukan 'device')"; exit 1; fi
  TARGET="$SERIAL"
else
  # Kumpulkan device berstatus 'device' (authorized)
  mapfile -t READY < <(adb devices | awk 'NR>1 && $2=="device" {print $1}')
  mapfile -t UNAUTH < <(adb devices | awk 'NR>1 && $2=="unauthorized" {print $1}')
  if [[ "${#READY[@]}" -eq 0 ]]; then
    if [[ "${#UNAUTH[@]}" -gt 0 ]]; then
      fail "HP (${UNAUTH[*]}) terdeteksi tapi BELUM diotorisasi."
      info "Buka dialog 'Allow USB debugging?' di layar HP → centang 'Always allow' → Allow."
      info "Lalu jalankan ulang script ini."
    else
      fail "Tidak ada HP terdeteksi."
      info "1) Colok kabel USB  2) Developer options → USB debugging ON"
      info "3) Mode USB: File Transfer (bukan charge-only)"
    fi
    exit 1
  elif [[ "${#READY[@]}" -eq 1 ]]; then
    TARGET="${READY[0]}"
  else
    TARGET="${READY[0]}"
    warn ">1 HP terhubung (${READY[*]}) — pakai ${TARGET}. Override dengan --serial <id>"
  fi
fi
MODEL="$(adb -s "$TARGET" shell getprop ro.product.model 2>/dev/null | tr -d '\r' || echo '?')"
ok "Target: $TARGET ($MODEL)"

# ── 5. Install ──────────────────────────────────────────────────────────────
step "5/6 Install APK ke HP"
# Hentikan app lebih dulu: reinstall saat app berjalan bisa memicu crash
# transien di framework (ConfigurationController NPE saat handleBindApplication).
adb -s "$TARGET" shell am force-stop "$APP_ID" >/dev/null 2>&1 || true
info "adb install -r (bisa 10-60 dtk untuk APK besar)…"
if adb -s "$TARGET" install -r "$APK" 2>&1 | tee -a "$LOG_FILE" | grep -qE "Success|Performing Streamed Install"; then
  # Verifikasi benar-benar terpasang
  if adb -s "$TARGET" shell pm list packages 2>/dev/null | grep -q "$APP_ID"; then
    VER="$(adb -s "$TARGET" shell dumpsys package "$APP_ID" 2>/dev/null | grep -oE "versionName=[^ ]+" | head -1 || true)"
    ok "Terpasang: $APP_ID ($VER)"
  else
    fail "adb melaporkan sukses tapi paket tidak ditemukan"; exit 1
  fi
else
  fail "Install gagal (lihat pesan adb di atas)"; exit 1
fi

# ── 6. Launch (opsional) ────────────────────────────────────────────────────
step "6/6 Selesai"
if [[ "$DO_LAUNCH" == true ]]; then
  adb -s "$TARGET" shell am start -n "$MAIN_ACTIVITY" >/dev/null 2>&1 || true
  sleep 3
  PID="$(adb -s "$TARGET" shell pidof "$APP_ID" 2>/dev/null | tr -d '\r' || true)"
  if [[ -n "$PID" ]]; then
    ok "App berjalan (PID=$PID)"
    # Cek crash yang baru saja terjadi (bila ada).
    if adb -s "$TARGET" logcat -d -b crash 2>/dev/null | grep -q "FATAL"; then
      warn "Ada FATAL di crash buffer — cek: adb logcat -b crash"
    else
      ok "Tidak ada crash saat launch"
    fi
  else
    warn "App diluncurkan tapi PID belum terdeteksi"
  fi
fi

ELAPSED=$(( $(date +%s) - START_TS ))
echo
ok "Selesai dalam ${ELAPSED}s — ${APP_ID} terpasang di ${TARGET} ($MODEL)"
log "Selesai dalam ${ELAPSED}s"
