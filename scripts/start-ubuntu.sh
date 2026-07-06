#!/bin/bash
#
# start-ubuntu.sh — DeltaJalan Docker workflow (Ubuntu)
#
# Uses Docker Compose for PHP 8.3 + PostgreSQL, starts ngrok tunnel,
# auto-updates .env with ngrok URL, optionally rebuilds Capacitor APK.
#
# Usage:
#   bash scripts/start-ubuntu.sh              # start services
#   bash scripts/start-ubuntu.sh --rebuild     # + rebuild Capacitor APK
#
# Prerequisites: Docker 24+, ngrok, curl
# Initial setup (once):
#   docker compose run --rm php composer install
#   docker compose exec php php artisan key:generate
#   docker compose exec php php artisan storage:link
#   docker compose exec php php artisan migrate --seed
#
# Press Ctrl+C to stop all services and restore .env values.
#

set -e

# ── Configuration ──────────────────────────────────────────────────────────
LARAVEL_PORT=8080
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend_POSTGRESQL"
FRONTEND_DIR="$PROJECT_ROOT/Frontend-stable"
BACKEND_ENV="$BACKEND_DIR/.env"
FRONTEND_ENV="$FRONTEND_DIR/.env"
LOG_FILE="$SCRIPT_DIR/start-ubuntu.log"

REBUILD=false
BUILD_ONLY=false
for arg in "$@"; do
  [[ "$arg" == "--rebuild" ]] && REBUILD=true
  [[ "$arg" == "--build-only" ]] && BUILD_ONLY=true
done

NGROK_PID=""
NGROK_URL=""
OLD_BACKEND_NGROK=""
OLD_FRONTEND_URL=""
ADDED_FRONTEND_URL=false
NGROK_RESTART_COUNT=0
DOCKER_RESTART_COUNT=0

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

check_docker_running() {
  local running
  running=$(docker container inspect -f '{{.State.Running}}' jalankita-php 2>/dev/null)
  if [ "$running" = "true" ]; then
    return 0
  fi
  return 1
}

check_ngrok_health() {
  local url
  url=$(curl -s --connect-timeout 3 --max-time 5 http://127.0.0.1:4040/api/tunnels 2>&1)
  local exit_code=$?

  if [ $exit_code -ne 0 ]; then
    log_to_file "NGROK HEALTH: curl failed with exit code $exit_code"
    return 1
  fi

  if echo "$url" | grep -q '"public_url"'; then
    return 0
  else
    log_to_file "NGROK HEALTH: No public_url in response"
    return 1
  fi
}

check_process_alive() {
  local pid=$1
  local name=$2

  if ps -p "$pid" > /dev/null 2>&1; then
    local state=$(ps -p "$pid" -o stat= 2>/dev/null | tr -d ' ')
    if [[ "$state" == *"Z"* ]]; then
      log_to_file "PROCESS CHECK: $name (PID $pid) is ZOMBIE"
      return 1
    fi
    log_to_file "PROCESS CHECK: $name (PID $pid) is ALIVE"
    return 0
  else
    log_to_file "PROCESS CHECK: $name (PID $pid) is DEAD"
    return 1
  fi
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
  log_to_file "Getting ngrok URL (max 30 attempts)..."
  for i in $(seq 1 30); do
    local data
    data=$(curl -s --connect-timeout 2 --max-time 4 http://127.0.0.1:4040/api/tunnels 2>&1)
    local curl_exit=$?

    if [ $curl_exit -ne 0 ]; then
      log_to_file "Attempt $i/30: curl failed (exit $curl_exit)"
      sleep 1
      continue
    fi

    if [ -n "$data" ]; then
      local url
      url=$(echo "$data" | grep -o '"public_url":"https://[^"]*"' | head -1 | cut -d'"' -f4)
      if [ -n "$url" ]; then
        log_to_file "Attempt $i/30: Got URL: $url"
        echo "$url"
        return 0
      else
        log_to_file "Attempt $i/30: No URL in response"
      fi
    else
      log_to_file "Attempt $i/30: Empty response"
    fi
    sleep 1
  done
  log_to_file "Failed to get ngrok URL after 30 attempts"
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

  rm -f "$SCRIPT_DIR/.ngrok.pid"

  write_step "..." "Menghentikan Docker containers..."
  cd "$PROJECT_ROOT"
  docker compose stop php 2>/dev/null || true
  write_step "OK" "Docker containers dihentikan"

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

echo "========================================" > "$LOG_FILE"
echo "Start Ubuntu (Docker) Script Log" >> "$LOG_FILE"
echo "Started at: $(date)" >> "$LOG_FILE"
echo "========================================" >> "$LOG_FILE"

# ── Prerequisites ──────────────────────────────────────────────────────────
write_step "---" "Membersihkan proses ngrok lama..."
kill_ngrok
echo ""

write_step "---" "Memeriksa prerequisites..."
OK=true

if [ "$BUILD_ONLY" != true ]; then
  command -v docker &>/dev/null || { write_step "X" "docker tidak ditemukan di PATH"; OK=false; }
  command -v ngrok &>/dev/null || { write_step "X" "ngrok tidak ditemukan"; OK=false; }
  command -v curl &>/dev/null || { write_step "X" "curl tidak ditemukan"; OK=false; }
  command -v nc &>/dev/null || { write_step "W" "nc tidak ditemukan — fallback ke curl"; }
fi
if [ "$REBUILD" = true ]; then
  command -v python3 &>/dev/null || command -v python &>/dev/null || { write_step "X" "python3/python tidak ditemukan (dibutuhkan untuk --rebuild)"; OK=false; }
fi
if [ "$BUILD_ONLY" != true ]; then
  [ -f "$BACKEND_DIR/artisan" ]   || { write_step "X" "artisan tidak ditemukan di $BACKEND_DIR"; OK=false; }
  [ -f "$BACKEND_ENV" ]           || { write_step "X" ".env tidak ditemukan di $BACKEND_DIR"; OK=false; }
fi
[ -f "$FRONTEND_ENV" ]          || { write_step "X" ".env tidak ditemukan di $FRONTEND_DIR"; OK=false; }

# ── Pre-flight checks ─────────────────────────────────────────────────────
write_step "..." "Memeriksa vendor/..."
if [ ! -d "$BACKEND_DIR/vendor" ]; then
  write_step "!" "vendor/ tidak ditemukan!"
  echo ""
  echo "   Jalankan setup awal dulu:"
  echo "   docker compose run --rm php composer install"
  echo "   docker compose exec php php artisan key:generate"
  echo "   docker compose exec php php artisan storage:link"
  echo "   docker compose exec php php artisan migrate --seed"
  echo ""
  OK=false
fi

if [ "$OK" != true ]; then
  wait_for_enter; exit 1
fi
write_step "OK" "Semua prerequisite OK"
echo ""

# ── Start Docker services ─────────────────────────────────────────────────
if [ "$BUILD_ONLY" != true ]; then
  write_step "---" "Memulai Docker containers (PHP 8.3 + PostgreSQL)..."
  cd "$PROJECT_ROOT"

  if docker compose up -d 2>&1; then
    write_step "OK" "Docker containers berjalan"
  else
    write_step "X" "Gagal start Docker containers"
    log_to_file "docker compose up -d failed"
    wait_for_enter; exit 1
  fi

  write_step "..." "Menunggu Laravel siap di port $LARAVEL_PORT..."
  if poll_port $LARAVEL_PORT; then
    write_step "OK" "Laravel berjalan di http://localhost:$LARAVEL_PORT"
  else
    write_step "X" "Laravel gagal (port $LARAVEL_PORT tidak terbuka setelah 30 detik)"
    docker compose logs php --tail=20 2>/dev/null || true
    wait_for_enter; exit 1
  fi
  echo ""

  # ── Start ngrok ────────────────────────────────────────────────────────────
  write_step "---" "Menjalankan ngrok tunnel ke port $LARAVEL_PORT..."
  log_to_file "Starting ngrok with command: ngrok http $LARAVEL_PORT"

  nohup ngrok http $LARAVEL_PORT --log=stdout >> "$SCRIPT_DIR/ngrok.log" 2>&1 &
  NGROK_PID=$!
  echo "$NGROK_PID" > "$SCRIPT_DIR/.ngrok.pid"
  log_to_file "ngrok started with PID: $NGROK_PID"

  write_step "..." "Menunggu ngrok siap (max 30 detik)..."
  if ! NGROK_URL=$(get_ngrok_url); then
    write_step "X" "Gagal mendapatkan ngrok URL"
    log_to_file "ERROR: Failed to get ngrok URL. Check ngrok.log for details."
    if [ -f "$SCRIPT_DIR/ngrok.log" ]; then
      log_to_file "Last 20 lines of ngrok.log:"
      tail -20 "$SCRIPT_DIR/ngrok.log" >> "$LOG_FILE"
    fi
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

# ── Rebuild APK ────────────────────────────────────────────────────────────
if [ "$REBUILD" = true ] || [ "$BUILD_ONLY" = true ]; then
  write_step "---" "Build ulang Capacitor app..."
  cd "$FRONTEND_DIR"

  write_step "..." "python build.py --build-only..."
  if command -v python3 &>/dev/null; then
    if ! python3 build.py --build-only; then
      write_step "X" "build.py gagal"; cd "$SCRIPT_DIR"; wait_for_enter; exit 1
    fi
  elif command -v python &>/dev/null; then
    if ! python build.py --build-only; then
      write_step "X" "build.py gagal"; cd "$SCRIPT_DIR"; wait_for_enter; exit 1
    fi
  else
    write_step "X" "Tidak ada Python interpreter (python3/python)"; cd "$SCRIPT_DIR"; wait_for_enter; exit 1
  fi
  write_step "OK" "Build + patch selesai (via build.py)"

  if [ ! -f "$FRONTEND_DIR/dist/client/index.html" ]; then
    write_step "X" "dist/client/index.html tidak ditemukan!"
    write_step "X" "Build SPA gagal. Jalankan: python build.py --build-only"
    cd "$SCRIPT_DIR"; wait_for_enter; exit 1
  fi

  write_step "..." "npx cap copy..."
  npx cap copy || write_step "W" "cap copy gagal — lanjut..."
  write_step "OK" "Web assets tersalur"

  write_step "..." "Build APK (gradlew assembleDebug)..."
  cd "$FRONTEND_DIR/android"
  if [ -f "gradlew" ]; then
    ./gradlew assembleDebug
  elif [ -f "gradlew.bat" ]; then
    ./gradlew.bat assembleDebug
  else
    write_step "X" "gradlew tidak ditemukan di android/"
    cd "$SCRIPT_DIR"; wait_for_enter; exit 1
  fi
  cd "$FRONTEND_DIR"

  APK_SRC=$(find "$FRONTEND_DIR/android/app/build" -name "*.apk" -type f 2>/dev/null | head -1)
  APK_DST="$PROJECT_ROOT/DeltaJalan.apk"
  if [ -n "$APK_SRC" ]; then
    cp "$APK_SRC" "$APK_DST"
    write_step "OK" "APK dicopy ke $PROJECT_ROOT/DeltaJalan.apk"
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
  write_step "OK" "Build-only selesai. APK siap di $PROJECT_ROOT/DeltaJalan.apk"
  exit 0
fi

# ── Post-rebuild health check ───────────────────────────────────────────────
if ! check_docker_running; then
  write_step "W" "Docker container mati — restart..."
  cd "$PROJECT_ROOT"
  docker compose restart php
  poll_port $LARAVEL_PORT || write_step "X" "Gagal restart Docker container"
fi

if ! check_process_alive "$NGROK_PID" "ngrok"; then
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
echo "   Laravel:    http://localhost:$LARAVEL_PORT (Docker)"
echo "   PostgreSQL: localhost:5432 (Docker)"
echo "   API:        $API_URL"
echo ""
echo "   Backend CORS auto-update via NGROK_URL di .env"
echo "   Frontend API URL via VITE_API_BASE_URL di .env"
echo "   Log file:   $LOG_FILE"
echo "   Ngrok log:  $SCRIPT_DIR/ngrok.log"
echo ""
echo "   Artisan commands via: docker compose exec php php artisan ..."
echo ""
echo "   Tekan Ctrl+C untuk menghentikan semua service..."
echo ""

# ── Monitoring loop ─────────────────────────────────────────────────────────
write_step "..." "Monitoring services (health check every 15 seconds)..."
log_to_file "Starting monitoring loop..."

HEALTH_CHECK_INTERVAL=15
LAST_CHECK=$(date +%s)

while true; do
  NOW=$(date +%s)

  if [ $((NOW - LAST_CHECK)) -ge $HEALTH_CHECK_INTERVAL ]; then
    LAST_CHECK=$NOW

    # Check Docker container
    if ! check_docker_running; then
      DOCKER_RESTART_COUNT=$((DOCKER_RESTART_COUNT + 1))
      write_step "W" "Docker container mati (restart #$DOCKER_RESTART_COUNT) — restarting..."
      log_to_file "RESTART: Docker container died, attempt #$DOCKER_RESTART_COUNT"
      cd "$PROJECT_ROOT"
      docker compose restart php 2>/dev/null || docker compose up -d
      log_to_file "RESTART: Docker restart command executed"
      if poll_port $LARAVEL_PORT; then
        write_step "OK" "Docker container berhasil restart"
      else
        write_step "X" "Gagal restart Docker container"
      fi
    fi

    # Check ngrok process AND health
    if ! check_process_alive "$NGROK_PID" "ngrok"; then
      NGROK_RESTART_COUNT=$((NGROK_RESTART_COUNT + 1))
      write_step "W" "ngrok process mati (restart #$NGROK_RESTART_COUNT) — restarting..."
      log_to_file "RESTART: ngrok process died, attempt #$NGROK_RESTART_COUNT"

      nohup ngrok http $LARAVEL_PORT --log=stdout >> "$SCRIPT_DIR/ngrok.log" 2>&1 &
      NGROK_PID=$!
      echo "$NGROK_PID" > "$SCRIPT_DIR/.ngrok.pid"
      log_to_file "RESTART: New ngrok PID: $NGROK_PID"

      sleep 3
      if NGROK_URL=$(get_ngrok_url); then
        write_step "OK" "ngrok berhasil restart: $NGROK_URL"
        log_to_file "RESTART: ngrok successfully restarted with URL: $NGROK_URL"
        set_env_value "$BACKEND_ENV" "NGROK_URL" "$NGROK_URL" >/dev/null
        set_env_value "$FRONTEND_ENV" "VITE_API_BASE_URL" "$NGROK_URL/api" >/dev/null
      else
        write_step "X" "Gagal restart ngrok"
        log_to_file "RESTART: Failed to restart ngrok"
      fi
    elif ! check_ngrok_health; then
      NGROK_RESTART_COUNT=$((NGROK_RESTART_COUNT + 1))
      write_step "W" "ngrok API tidak responsif (restart #$NGROK_RESTART_COUNT) — restarting..."
      log_to_file "RESTART: ngrok API unhealthy, attempt #$NGROK_RESTART_COUNT"

      kill "$NGROK_PID" 2>/dev/null || true
      pkill -f "ngrok http $LARAVEL_PORT" 2>/dev/null || true
      sleep 2

      nohup ngrok http $LARAVEL_PORT --log=stdout >> "$SCRIPT_DIR/ngrok.log" 2>&1 &
      NGROK_PID=$!
      echo "$NGROK_PID" > "$SCRIPT_DIR/.ngrok.pid"
      log_to_file "RESTART: New ngrok PID after health check failure: $NGROK_PID"

      sleep 3
      if NGROK_URL=$(get_ngrok_url); then
        write_step "OK" "ngrok berhasil restart: $NGROK_URL"
        log_to_file "RESTART: ngrok successfully restarted with URL: $NGROK_URL"
        set_env_value "$BACKEND_ENV" "NGROK_URL" "$NGROK_URL" >/dev/null
        set_env_value "$FRONTEND_ENV" "VITE_API_BASE_URL" "$NGROK_URL/api" >/dev/null
      else
        write_step "X" "Gagal restart ngrok"
        log_to_file "RESTART: Failed to restart ngrok after health check failure"
      fi
    else
      log_to_file "HEALTH CHECK: ngrok is healthy (PID: $NGROK_PID, URL: $NGROK_URL)"
    fi
  fi

  sleep 5
done
