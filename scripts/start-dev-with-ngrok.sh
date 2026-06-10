#!/bin/bash
#
# start-dev-with-ngrok.sh — DeltaJalan desktop development launcher
#
# Starts only the services needed for desktop development (FastAPI + Vite frontend).
# DETECTS if Laravel/ngrok are already running (e.g. from start-android.sh) and
# skips them — no port conflicts, no duplicate .env writes.
#
# Usage:
#   bash scripts/start-dev-with-ngrok.sh            # local dev (localhost:5173)
#   bash scripts/start-dev-with-ngrok.sh --ngrok    # + ngrok tunnel ke Vite
#
# Prerequisites: Laravel backend must be running (start-android.sh or manual).
#

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_AI_DIR="$PROJECT_ROOT/backend_AI"
FRONTEND_DIR="$PROJECT_ROOT/Frontend-stable"
VITE_CONFIG="$FRONTEND_DIR/vite.config.ts"

LARAVEL_PORT=8080
FASTAPI_PORT=8000
VITE_PORT=5173

USE_NGROK=false
[[ "$1" == "--ngrok" || "$1" == "-n" ]] && USE_NGROK=true

# Track what WE started (so cleanup only kills ours)
STARTED_FASTAPI=false
STARTED_VITE=false
STARTED_NGROK=false
VITE_CONFIG_BACKUP=""

# ── Helpers ─────────────────────────────────────────────────────────────────

write_step() {
  printf "%s %s %s\n" "$(date +%H:%M:%S)" "$1" "$2"
}

poll_port() {
  local port=$1 host=${2:-127.0.0.1}
  if command -v nc &>/dev/null; then
    nc -z "$host" "$port" 2>/dev/null && return 0
  fi
  if command -v curl &>/dev/null; then
    curl -s -o /dev/null --connect-timeout 2 --max-time 3 "http://$host:$port" 2>/dev/null && return 0
  fi
  php -r "exit(@fsockopen('$host',$port)?0:1);" 2>/dev/null && return 0
  return 1
}

wait_for_port() {
  local port=$1 host=${2:-127.0.0.1} max=${3:-15}
  for i in $(seq 1 $max); do
    if poll_port $port $host; then return 0; fi
    printf "." >&2
    sleep 1
  done
  echo "" >&2
  return 1
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

update_vite_allowed_hosts() {
  local ngrok_host="$1"
  VITE_CONFIG_BACKUP="${VITE_CONFIG}.backup"
  cp "$VITE_CONFIG" "$VITE_CONFIG_BACKUP"
  sed -i "s|allowedHosts: \[.*\]|allowedHosts: [\"$ngrok_host\"]|g" "$VITE_CONFIG"
  write_step "OK" "allowedHosts vite.config.ts → $ngrok_host"
}

restore_vite_config() {
  if [ -n "$VITE_CONFIG_BACKUP" ] && [ -f "$VITE_CONFIG_BACKUP" ]; then
    mv "$VITE_CONFIG_BACKUP" "$VITE_CONFIG"
    write_step "OK" "vite.config.ts dikembalikan"
  fi
}

# ── Cleanup ─────────────────────────────────────────────────────────────────

cleanup() {
  set +e
  echo ""
  write_step "---" "Menghentikan service milik script ini..."

  if [ "$STARTED_NGROK" = true ]; then
    pkill -f "ngrok.*$VITE_PORT" 2>/dev/null || true
    write_step "OK" "ngrok dihentikan"
  fi

  if [ "$STARTED_VITE" = true ]; then
    kill "$VITE_PID" 2>/dev/null || true
    wait "$VITE_PID" 2>/dev/null || true
    write_step "OK" "Vite dihentikan"
  fi

  if [ "$STARTED_FASTAPI" = true ]; then
    kill "$FASTAPI_PID" 2>/dev/null || true
    wait "$FASTAPI_PID" 2>/dev/null || true
    write_step "OK" "FastAPI dihentikan"
  fi

  if [ "$USE_NGROK" = true ]; then
    restore_vite_config
  fi

  write_step "OK" "Selesai — service lain (Laravel, ngrok 8080) tetap berjalan"
}
trap cleanup EXIT INT TERM

# === MAIN ===

echo "🚀 DeltaJalan Desktop Development"
echo "=================================="
echo ""

# ── Prerequisites ──────────────────────────────────────────────────────────
write_step "---" "Memeriksa prerequisites..."
OK=true

command -v php &>/dev/null   || { write_step "X" "php tidak ditemukan"; OK=false; }
command -v bun &>/dev/null   || { write_step "X" "bun tidak ditemukan"; OK=false; }
command -v python &>/dev/null || { write_step "X" "python tidak ditemukan"; OK=false; }

if [ "$USE_NGROK" = true ]; then
  command -v ngrok &>/dev/null || { write_step "X" "ngrok tidak ditemukan"; OK=false; }
fi

if [ "$OK" != true ]; then
  echo ""; read -r -p "Press Enter to exit..."; exit 1
fi
write_step "OK" "Semua prerequisite OK"
echo ""

# ── Detect existing services ───────────────────────────────────────────────

# Laravel (from start-android.sh or manual)
write_step "..." "Memeriksa Laravel di port $LARAVEL_PORT"
if poll_port $LARAVEL_PORT; then
  write_step "OK" "Laravel sudah berjalan di port $LARAVEL_PORT (skip)"
else
  write_step "W" "Laravel tidak terdeteksi di port $LARAVEL_PORT"
  write_step ".." "Jalankan 'bash scripts/start-android.sh' di terminal terpisah"
  echo ""
  write_step "X" "Laravel wajib berjalan. Hentikan script ini."
  echo ""; read -r -p "Press Enter to exit..."; exit 1
fi

# FastAPI
if poll_port $FASTAPI_PORT; then
  write_step "OK" "FastAPI sudah berjalan di port $FASTAPI_PORT (skip)"
else
  write_step "---" "Menjalankan FastAPI AI Server..."
  cd "$BACKEND_AI_DIR"
  python -m uvicorn server:app --host 0.0.0.0 --port $FASTAPI_PORT &
  FASTAPI_PID=$!
  STARTED_FASTAPI=true
  printf "   Menunggu" >&2
  if wait_for_port $FASTAPI_PORT; then
    echo "" >&2
    write_step "OK" "FastAPI berjalan di http://localhost:$FASTAPI_PORT"
  else
    write_step "X" "FastAPI gagal start"
    exit 1
  fi
fi
echo ""

# ── Vite Frontend ──────────────────────────────────────────────────────────
if poll_port $VITE_PORT; then
  write_step "OK" "Vite sudah berjalan di port $VITE_PORT (skip)"
else
  write_step "---" "Menjalankan Frontend (Vite)..."
  cd "$FRONTEND_DIR"
  bun run dev &
  VITE_PID=$!
  STARTED_VITE=true
  printf "   Menunggu" >&2
  if wait_for_port $VITE_PORT; then
    echo "" >&2
    write_step "OK" "Vite berjalan di http://localhost:$VITE_PORT"
  else
    write_step "X" "Vite gagal start"
  fi
fi
echo ""

# ── Optional: ngrok (tunnel ke Vite port 5173) ─────────────────────────────
if [ "$USE_NGROK" = true ]; then
  # Cek apakah udah ada ngrok tunnel ke 5173
  if pgrep -f "ngrok.*http.*$VITE_PORT" &>/dev/null; then
    write_step "OK" "ngrok tunnel ke $VITE_PORT sudah berjalan (skip)"
  else
    write_step "---" "Menjalankan ngrok tunnel ke port $VITE_PORT..."
    ngrok http $VITE_PORT --log=stdout > /dev/null 2>&1 &
    NGROK_PID=$!
    STARTED_NGROK=true

    write_step "..." "Menunggu ngrok siap..."
    NGROK_URL=$(get_ngrok_url)

    if [ -z "$NGROK_URL" ]; then
      write_step "X" "Gagal mendapatkan ngrok URL"
      exit 1
    fi

    write_step "OK" "Ngrok URL: $NGROK_URL"

    # Update vite.config.ts allowedHosts
    ngrok_host=$(echo "$NGROK_URL" | sed 's|https://||')
    update_vite_allowed_hosts "$ngrok_host"
  fi
  echo ""
fi

# ── Summary ─────────────────────────────────────────────────────────────────
echo "✅ Semua service berjalan!"
echo ""
echo "📍 Local:     http://localhost:$VITE_PORT"
echo "   API proxy: → http://localhost:$LARAVEL_PORT (via Vite)"
echo "   FastAPI:    http://localhost:$FASTAPI_PORT"
if [ -n "$NGROK_URL" ]; then
  echo "   Public:     $NGROK_URL"
fi
echo ""
echo "   Service dari start-android.sh (tidak disentuh):"
echo "   - Laravel di $LARAVEL_PORT"
echo "   - Ngrok tunnel ke $LARAVEL_PORT"
echo "   - .env NGROK_URL & VITE_API_BASE_URL"
echo ""
echo "⚠️  Tekan Ctrl+C untuk menghentikan FastAPI + Vite + ngrok (5173)"
echo "   Laravel dan ngrok (8080) tetap berjalan"
echo ""

# Keep running
wait
