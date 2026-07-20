#!/bin/bash
#
# start-android.sh — DeltaJalan Android APK build
#
# Builds Capacitor APK using VITE_API_BASE_URL dari .env.
# Tidak perlu Laravel lokal / ngrok — API langsung ke production.
#
# Usage:
#   bash scripts/start-android.sh               # build + deploy ke device
#   bash scripts/start-android.sh --build-only   # build APK saja
#   bash scripts/start-android.sh --rebuild      # (sama seperti tanpa flag)
#

set -e

# ── Configuration ──────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FRONTEND_DIR="$(cd "$SCRIPT_DIR/../Frontend-stable" && pwd)"
FRONTEND_ENV="$FRONTEND_DIR/.env"
LOG_FILE="$SCRIPT_DIR/start-android.log"

BUILD_ONLY=false
for arg in "$@"; do
  [[ "$arg" == "--build-only" ]] && BUILD_ONLY=true
done

# ── Helpers ─────────────────────────────────────────────────────────────────

log_to_file() {
  local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
  echo "$msg" >> "$LOG_FILE"
}

write_step() {
  local timestamp="$(date +%H:%M:%S)"
  local msg="$timestamp $1 $2"
  printf "%s\n" "$msg"
  log_to_file "$msg"
}

wait_for_enter() {
  printf "Press Enter to continue..."
  read -r
}

# ── Init log ────────────────────────────────────────────────────────────────
echo "========================================" > "$LOG_FILE"
echo "Start Android Script Log" >> "$LOG_FILE"
echo "Started at: $(date)" >> "$LOG_FILE"
echo "========================================" >> "$LOG_FILE"

# ── Prerequisites ────────────────────────────────────────────────────────────
write_step "---" "Memeriksa prerequisites..."
OK=true

command -v py &>/dev/null || command -v python &>/dev/null || { write_step "X" "py/python tidak ditemukan"; OK=false; }
[ -f "$FRONTEND_ENV" ] || { write_step "X" ".env tidak ditemukan di $FRONTEND_DIR"; OK=false; }

if grep -qi "ngrok" "$FRONTEND_ENV" 2>/dev/null; then
  write_step "!" "PERINGATAN: VITE_API_BASE_URL masih pakai ngrok di .env"
  write_step "!" "Android akan gagal konek. Set ke https://api.deltajalan.web.id/api"
fi

if [ "$OK" != true ]; then
  wait_for_enter; exit 1
fi
write_step "OK" "Semua prerequisite OK"
echo ""

# ── Build SPA ────────────────────────────────────────────────────────────────
write_step "---" "Build SPA + patch..."
cd "$FRONTEND_DIR"

if command -v py &>/dev/null; then
  if ! py build.py --build-only; then
    write_step "X" "build.py gagal"; wait_for_enter; exit 1
  fi
elif command -v python &>/dev/null; then
  if ! python build.py --build-only; then
    write_step "X" "build.py gagal"; wait_for_enter; exit 1
  fi
fi
write_step "OK" "Build + patch selesai"

if [ ! -f "$FRONTEND_DIR/dist/client/index.html" ]; then
  write_step "X" "dist/client/index.html tidak ditemukan!"
  write_step "X" "Build SPA gagal. Jalankan: python build.py --build-only"
  wait_for_enter; exit 1
fi

# ── Sync web assets ──────────────────────────────────────────────────────────
write_step "..." "npx cap copy..."
npx cap copy || write_step "W" "cap copy gagal — lanjut..."
write_step "OK" "Web assets tersalur"

# ── Build APK ────────────────────────────────────────────────────────────────
write_step "..." "Build APK (gradlew assembleDebug)..."
cd "$FRONTEND_DIR/android"
if [ -f "gradlew.bat" ]; then
  ./gradlew.bat assembleDebug
elif [ -f "gradlew" ]; then
  ./gradlew assembleDebug
else
  write_step "X" "gradlew / gradlew.bat tidak ditemukan di android/"
  wait_for_enter; exit 1
fi
cd "$FRONTEND_DIR"

# ── Copy APK ke root project ────────────────────────────────────────────────
APK_SRC=$(find "$FRONTEND_DIR/android/app/build" -name "*.apk" -type f 2>/dev/null | head -1)
APK_DST="$SCRIPT_DIR/../DeltaJalan.apk"
if [ -n "$APK_SRC" ]; then
  cp "$APK_SRC" "$APK_DST"
  write_step "OK" "APK dicopy ke $(cd "$SCRIPT_DIR/.." && pwd)/DeltaJalan.apk"
else
  write_step "W" "APK tidak ditemukan — lewati copy ke root"
fi

# ── Deploy ke device (skip jika --build-only) ────────────────────────────────
if [ "$BUILD_ONLY" != true ]; then
  DEVICE=$(adb devices 2>/dev/null | grep -v "List" | grep "device$" | head -1 | awk '{print $1}')
  if [ -n "$DEVICE" ]; then
    APK=$(find "$FRONTEND_DIR/android/app/build" -name "*.apk" -type f 2>/dev/null | head -1)
    if [ -n "$APK" ]; then
      write_step "..." "Install APK ke $DEVICE..."
      adb -s "$DEVICE" install -r "$APK" 2>&1 || write_step "W" "adb install gagal"
      write_step "OK" "APK terinstall ke $DEVICE"
    else
      write_step "W" "APK tidak ditemukan. Install manual: npx cap run android"
    fi
  else
    write_step "W" "Tidak ada device Android. Install manual: npx cap run android"
  fi
fi

# ── Selesai ──────────────────────────────────────────────────────────────────
write_step "OK" "Selesai! APK siap di DeltaJalan.apk"
echo ""
echo "  VITE_API_BASE_URL:"
grep "^VITE_API_BASE_URL=" "$FRONTEND_ENV" | sed 's/^/  /'
echo ""

if [ "$BUILD_ONLY" = true ]; then
  echo "  Gunakan tanpa --build-only untuk auto-install ke device."
fi
