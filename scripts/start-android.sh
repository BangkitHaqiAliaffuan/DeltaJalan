#!/bin/bash
#
# start-android.sh — DeltaJalan tunnel + Android deploy
#
# Starts Laravel dev server + ngrok tunnel, auto-updates .env files
# with the ngrok URL so both backend CORS and frontend API base work.
# Delegates SPA build & patching to Frontend-stable/build.py.
#
# Usage:
#   bash scripts/start-android.sh              # start services
#   bash scripts/start-android.sh --rebuild     # + rebuild Capacitor APK
#
# Press Ctrl+C to stop all services and restore .env values.
#

set -e

# ── Configuration ──────────────────────────────────────────────────────────
LARAVEL_PORT=8080
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/../backend_POSTGRESQL" && pwd)"
FRONTEND_DIR="$(cd "$SCRIPT_DIR/../Frontend-stable" && pwd)"
BACKEND_ENV="$BACKEND_DIR/.env"
FRONTEND_ENV="$FRONTEND_DIR/.env"

REBUILD=false
BUILD_ONLY=false
for arg in "$@"; do
  [[ "$arg" == "--rebuild" ]] && REBUILD=true
  [[ "$arg" == "--build-only" ]] && BUILD_ONLY=true
done

NGROK_PID=""
LARAVEL_PID=""
NGROK_URL=""
OLD_BACKEND_NGROK=""
OLD_FRONTEND_URL=""
ADDED_FRONTEND_URL=false

# ── Helpers ─────────────────────────────────────────────────────────────────

write_step() {
  printf "%s %s %s\n" "$(date +%H:%M:%S)" "$1" "$2"
}

kill_ngrok() {
  local pids
  pids=$(pgrep -f "ngrok" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    for pid in $pids; do
      write_step "~" "Menghentikan ngrok PID $pid..."
      kill "$pid" 2>/dev/null || true
    done
    sleep 2
  fi
}

get_ngrok_url() {
  for i in $(seq 1 30); do
    local data
    data=$(curl -s http://127.0.0.1:4040/api/tunnels 2>/dev/null || true)
    if [ -n "$data" ]; then
      local url
      url=$(echo "$data" | grep -o '"public_url":"https://[^"]*"' | head -1 | cut -d'"' -f4)
      if [ -n "$url" ]; then
        echo "$url"
        return 0
      fi
    fi
    sleep 1
  done
  return 1
}

set_env_value() {
  local file="$1" key="$2" value="$3"
  local old=""
  if [ -f "$file" ]; then
    old=$(grep "^$key=" "$file" 2>/dev/null | head -1 | sed 's/^[^=]*=//' || true)
    if grep -q "^$key=" "$file" 2>/dev/null; then
      sed -i "s|^$key=.*|$key=$value|" "$file"
    else
      echo "$key=$value" >> "$file"
    fi
  fi
  echo "$old"
}

remove_env_key() {
  local file="$1" key="$2"
  [ -f "$file" ] && sed -i "/^$key=/d" "$file"
}

poll_port() {
  local port=$1 host=${2:-127.0.0.1}
  for i in $(seq 1 30); do
    if command -v nc &>/dev/null; then
      nc -z "$host" "$port" 2>/dev/null && return 0
    fi
    if command -v curl &>/dev/null; then
      curl -s -o /dev/null --connect-timeout 2 --max-time 3 "http://$host:$port" 2>/dev/null && return 0
    fi
    # Fallback: try PHP's built-in socket test
    php -r "exit(@fsockopen('$host',$port)?0:1);" 2>/dev/null && return 0
    sleep 1
  done
  return 1
}

wait_for_enter() {
  printf "Press Enter to continue..."
  read -r
}

# ── Cleanup on exit ─────────────────────────────────────────────────────────
cleanup() {
  set +e
  echo ""
  write_step "---" "Menghentikan semua service..."

  if [ -n "$NGROK_PID" ]; then
    kill "$NGROK_PID" 2>/dev/null || true
    write_step "OK" "ngrok dihentikan"
  fi

  if [ -n "$LARAVEL_PID" ]; then
    kill "$LARAVEL_PID" 2>/dev/null || true
    wait "$LARAVEL_PID" 2>/dev/null || true
    write_step "OK" "Laravel dihentikan"
  fi

  if [ -n "$OLD_BACKEND_NGROK" ]; then
    set_env_value "$BACKEND_ENV" "NGROK_URL" "$OLD_BACKEND_NGROK" >/dev/null 2>&1
    write_step "OK" "NGROK_URL dikembalikan ke $OLD_BACKEND_NGROK"
  fi

  if [ "$ADDED_FRONTEND_URL" = true ]; then
    remove_env_key "$FRONTEND_ENV" "VITE_API_BASE_URL"
    write_step "OK" "VITE_API_BASE_URL dihapus (tidak ada sebelumnya)"
  elif [ -n "$OLD_FRONTEND_URL" ]; then
    set_env_value "$FRONTEND_ENV" "VITE_API_BASE_URL" "$OLD_FRONTEND_URL" >/dev/null 2>&1
    write_step "OK" "VITE_API_BASE_URL dikembalikan"
  fi

  write_step "OK" "Selesai"
}
trap cleanup EXIT

# === MAIN ===

write_step "---" "Membersihkan proses ngrok lama..."
kill_ngrok
echo ""

write_step "---" "Memeriksa prerequisites..."
OK=true

if [ "$BUILD_ONLY" != true ]; then
  command -v php &>/dev/null || { write_step "X" "php tidak ditemukan di PATH"; OK=false; }
  command -v ngrok &>/dev/null || { write_step "X" "ngrok tidak ditemukan"; OK=false; }
  command -v nc &>/dev/null || command -v curl &>/dev/null || { write_step "X" "nc atau curl tidak ditemukan"; OK=false; }
fi
if [ "$REBUILD" = true ]; then
  command -v py &>/dev/null || command -v python &>/dev/null || { write_step "X" "py/python tidak ditemukan (dibutuhkan untuk --rebuild)"; OK=false; }
fi
if [ "$BUILD_ONLY" != true ]; then
  [ -f "$BACKEND_DIR/artisan" ]   || { write_step "X" "artisan tidak ditemukan di $BACKEND_DIR"; OK=false; }
  [ -f "$BACKEND_ENV" ]           || { write_step "X" ".env tidak ditemukan di $BACKEND_DIR"; OK=false; }
fi
[ -f "$FRONTEND_ENV" ]          || { write_step "X" ".env tidak ditemukan di $FRONTEND_DIR"; OK=false; }

if [ "$OK" != true ]; then
  wait_for_enter; exit 1
fi
write_step "OK" "Semua prerequisite OK"
echo ""

# ── Start Laravel ──────────────────────────────────────────────────────────
if [ "$BUILD_ONLY" != true ]; then
  write_step "---" "Menjalankan Laravel di port $LARAVEL_PORT..."
  cd "$BACKEND_DIR"
  php artisan serve --host=0.0.0.0 --port=$LARAVEL_PORT > /dev/null 2>&1 &
  LARAVEL_PID=$!

  if poll_port $LARAVEL_PORT; then
    write_step "OK" "Laravel berjalan di http://localhost:$LARAVEL_PORT"
  else
    write_step "X" "Laravel gagal (port $LARAVEL_PORT tidak terbuka setelah 30 detik)"
    wait_for_enter; exit 1
  fi
  echo ""

  # ── Start ngrok ────────────────────────────────────────────────────────────
  write_step "---" "Menjalankan ngrok tunnel ke port $LARAVEL_PORT..."
  ngrok http $LARAVEL_PORT --log=stdout > /dev/null 2>&1 &
  NGROK_PID=$!

  write_step "..." "Menunggu ngrok siap (max 30 detik)..."
  if ! NGROK_URL=$(get_ngrok_url); then
    write_step "X" "Gagal mendapatkan ngrok URL"
    wait_for_enter; exit 1
  fi
  write_step "OK" "Ngrok URL: $NGROK_URL"
  echo ""

  # ── Update backend .env ────────────────────────────────────────────────────
  write_step "---" "Update backend .env NGROK_URL..."
  OLD_BACKEND_NGROK=$(set_env_value "$BACKEND_ENV" "NGROK_URL" "$NGROK_URL")
  write_step "OK" "NGROK_URL = $NGROK_URL"
  [ -n "$OLD_BACKEND_NGROK" ] && write_step ".." "Sebelumnya: $OLD_BACKEND_NGROK"
  echo ""

  # ── Update frontend .env ───────────────────────────────────────────────────
  API_URL="$NGROK_URL/api"
  write_step "---" "Update frontend .env VITE_API_BASE_URL..."
  OLD_FRONTEND_URL=$(set_env_value "$FRONTEND_ENV" "VITE_API_BASE_URL" "$API_URL")
  [ -z "$OLD_FRONTEND_URL" ] && ADDED_FRONTEND_URL=true
  write_step "OK" "VITE_API_BASE_URL = $API_URL"
  echo ""
fi

# ── Rebuild (setelah .env diupdate, jadi pakai URL FRESH) ──────────────────
if [ "$REBUILD" = true ] || [ "$BUILD_ONLY" = true ]; then
  write_step "---" "Build ulang Capacitor app..."
  cd "$FRONTEND_DIR"

  write_step "..." "python build.py --build-only..."
  if command -v py &>/dev/null; then
    if ! py build.py --build-only; then
      write_step "X" "build.py gagal"; cd "$SCRIPT_DIR"; wait_for_enter; exit 1
    fi
  elif command -v python &>/dev/null; then
    if ! python build.py --build-only; then
      write_step "X" "build.py gagal"; cd "$SCRIPT_DIR"; wait_for_enter; exit 1
    fi
  else
    write_step "X" "Tidak ada Python interpreter (py/python)"; cd "$SCRIPT_DIR"; wait_for_enter; exit 1
  fi
  write_step "OK" "Build + patch selesai (via build.py)"

  if [ ! -f "$FRONTEND_DIR/dist/client/index.html" ]; then
    write_step "X" "dist/client/index.html tidak ditemukan!"
    write_step "X" "Build SPA gagal atau kamu menjalankan npm run build (SSR) yang menimpa output."
    write_step "X" "Jalankan: python build.py --build-only, lalu ulangi."
    cd "$SCRIPT_DIR"; wait_for_enter; exit 1
  fi
  write_step "..." "npx cap copy..."
  npx cap copy || write_step "W" "cap copy gagal — lanjut..."
  write_step "OK" "Web assets tersalur"

  write_step "..." "Build APK (gradlew assembleDebug)..."
  cd "$FRONTEND_DIR/android"
  if [ -f "gradlew.bat" ]; then
    ./gradlew.bat assembleDebug
  elif [ -f "gradlew" ]; then
    ./gradlew assembleDebug
  else
    write_step "X" "gradlew / gradlew.bat tidak ditemukan di android/"
    cd "$SCRIPT_DIR"; wait_for_enter; exit 1
  fi
  cd "$FRONTEND_DIR"

  # ── Copy APK ke root project ────────────────────────────────────────────
  APK_SRC=$(find "$FRONTEND_DIR/android/app/build" -name "*.apk" -type f 2>/dev/null | head -1)
  APK_DST="$SCRIPT_DIR/../DeltaJalan.apk"
  if [ -n "$APK_SRC" ]; then
    cp "$APK_SRC" "$APK_DST"
    write_step "OK" "APK dicopy ke $(cd "$SCRIPT_DIR/.." && pwd)/DeltaJalan.apk"
  else
    write_step "W" "APK tidak ditemukan — lewati copy ke root"
  fi

  DEVICE=$(adb devices 2>/dev/null | grep -v "List" | grep "device$" | head -1 | awk '{print $1}')
  if [ -n "$DEVICE" ]; then
    APK=$(find android/app/build -name "*.apk" -type f 2>/dev/null | head -1)
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

  write_step "OK" "Build + deploy selesai"
  echo ""
fi

if [ "$BUILD_ONLY" = true ]; then
  write_step "OK" "Build-only selesai. APK siap di $(cd "$SCRIPT_DIR/.." && pwd)/DeltaJalan.apk"
  exit 0
fi

# ── Post-rebuild health check (restart service jika mati selama rebuild) ────
if ! kill -0 $LARAVEL_PID 2>/dev/null; then
  write_step "W" "Laravel mati — restart..."
  cd "$BACKEND_DIR"
  php artisan serve --host=0.0.0.0 --port=$LARAVEL_PORT > /dev/null 2>&1 &
  LARAVEL_PID=$!
  poll_port $LARAVEL_PORT || write_step "X" "Gagal restart Laravel"
fi
if ! kill -0 $NGROK_PID 2>/dev/null; then
  write_step "W" "ngrok mati — restart..."
  ngrok http $LARAVEL_PORT --log=stdout > /dev/null 2>&1 &
  NGROK_PID=$!
  if ! NGROK_URL=$(get_ngrok_url); then
    write_step "X" "Gagal restart ngrok"
  fi
fi

# ── Summary ─────────────────────────────────────────────────────────────────
write_step "OK" "Semua service berjalan!"
echo ""
echo "   Ngrok:      $NGROK_URL"
echo "   Laravel:    http://localhost:$LARAVEL_PORT"
echo "   API:        $API_URL"
echo ""
echo "   Backend CORS auto-update via NGROK_URL di .env"
echo "   Frontend API URL via VITE_API_BASE_URL di .env"
echo ""
echo "   Tekan Ctrl+C untuk menghentikan semua service..."
echo ""

# Keep running — Ctrl+C triggers cleanup trap
while true; do
  if ! kill -0 $LARAVEL_PID 2>/dev/null; then
    write_step "W" "Laravel mati — restart..."
    cd "$BACKEND_DIR"
    php artisan serve --host=0.0.0.0 --port=$LARAVEL_PORT > /dev/null 2>&1 &
    LARAVEL_PID=$!
    poll_port $LARAVEL_PORT || write_step "X" "Gagal restart Laravel"
  fi
  if ! kill -0 $NGROK_PID 2>/dev/null; then
    write_step "W" "ngrok mati — restart..."
    ngrok http $LARAVEL_PORT --log=stdout > /dev/null 2>&1 &
    NGROK_PID=$!
    if NGROK_URL=$(get_ngrok_url); then
      set_env_value "$BACKEND_ENV" "NGROK_URL" "$NGROK_URL" >/dev/null
      set_env_value "$FRONTEND_ENV" "VITE_API_BASE_URL" "$NGROK_URL/api" >/dev/null
    fi
  fi
  sleep 10
done
