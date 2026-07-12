#!/bin/bash
# deploy-laravel.sh — Deploy Laravel di production (AWS Lightsail)
#
# Usage:
#   bash scripts/deploy-laravel.sh              # normal
#   bash scripts/deploy-laravel.sh --force       # skip konfirmasi migrate
#
# Prerequisites:
#   - Dijalankan dari dalam repo DeltaJalan di server
#   - .env sudah ada di backend_POSTGRESQL/.env
#   - Git remote origin sudah terhubung ke GitHub

set -euo pipefail

FORCE=false
[[ "${1:-}" == "--force" ]] && FORCE=true

# ── Config ──────────────────────────────────────────────────────────────────
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend_POSTGRESQL"
LOG_DIR="$BACKEND_DIR/storage/logs"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="$LOG_DIR/deploy-$TIMESTAMP.log"
COMMIT_BEFORE=""
COMMIT_AFTER=""

# ── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ── Helper functions ─────────────────────────────────────────────────────────
log()  { echo -e "${CYAN}[$(date +%H:%M:%S)]${NC} $*"; }
ok()   { echo -e "  ${GREEN}✓${NC} $*"; }
warn() { echo -e "  ${YELLOW}⚠${NC} $*"; }
fail() { echo -e "  ${RED}✗${NC} $*"; exit 1; }

log_to_file() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG_FILE"
}

confirm() {
  if [ "$FORCE" = true ]; then
    return 0
  fi
  echo -en "  ${YELLOW}?${NC} $* [y/N] "
  read -r resp
  [[ "$resp" =~ ^[Yy] ]]
}

# ── Sanity checks ───────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "  Deploy Laravel — $TIMESTAMP"
echo "═══════════════════════════════════════════════════════════════════"
echo ""

mkdir -p "$LOG_DIR"
log_to_file "=== Deploy started ==="

if [ ! -f "$BACKEND_DIR/artisan" ]; then
  fail "Tidak ditemukan artisan di $BACKEND_DIR — pastikan script dijalankan dari root repo"
fi

if [ ! -f "$BACKEND_DIR/.env" ]; then
  fail ".env tidak ditemukan di $BACKEND_DIR — buat dulu dari .env.production"
fi

APP_URL=$(grep ^APP_URL "$BACKEND_DIR/.env" | cut -d= -f2-)
log "APP_URL: $APP_URL"

# ── Check git status ────────────────────────────────────────────────────────
cd "$PROJECT_ROOT"

if ! git rev-parse --is-inside-work-tree &>/dev/null; then
  fail "Bukan git repo"
fi

COMMIT_BEFORE=$(git rev-parse HEAD)
log "Commit sebelum: $(git log --oneline -1)"

if [ -n "$(git status --porcelain)" ]; then
  warn "Ada perubahan lokal yang belum di-commit"
  if confirm "Stash perubahan lokal?"; then
    git stash --include-untracked
    STASHED=true
    ok "Perubahan di-stash"
  else
    fail "Commit atau stash dulu perubahan lokal sebelum deploy"
  fi
fi

# ── Pull code terbaru ───────────────────────────────────────────────────────
log ""
log "───────────────────────────────────────────────────────────────────"
log "  Pull code terbaru..."
log "───────────────────────────────────────────────────────────────────"

if ! git pull origin main 2>&1 | tee -a "$LOG_FILE"; then
  fail "git pull gagal — mungkin ada merge conflict. Resolve manual dulu"
fi

COMMIT_AFTER=$(git rev-parse HEAD)
log "Commit sesudah: $(git log --oneline -1)"

if [ "$COMMIT_BEFORE" == "$COMMIT_AFTER" ]; then
  ok "Tidak ada perubahan — sudah di commit terbaru"
fi

# ── Composer install ────────────────────────────────────────────────────────
log ""
log "───────────────────────────────────────────────────────────────────"
log "  Composer install..."
log "───────────────────────────────────────────────────────────────────"

if git diff "$COMMIT_BEFORE".."$COMMIT_AFTER" --name-only 2>/dev/null | grep -q "composer.lock"; then
  log "composer.lock berubah — install dependensi baru"
  cd "$BACKEND_DIR"
  COMPOSER_MEMORY_LIMIT=-1 composer install --no-dev --optimize-autoloader --no-interaction 2>&1 | tee -a "$LOG_FILE"
  ok "Composer install selesai"
else
  ok "Tidak ada perubahan di composer.lock — skip"
fi

# ── Generate key jika belum ada ─────────────────────────────────────────────
if grep -q "APP_KEY=$" "$BACKEND_DIR/.env" 2>/dev/null; then
  log "APP_KEY kosong — generate..."
  cd "$BACKEND_DIR"
  php artisan key:generate --force
  ok "APP_KEY generated"
fi

# ── Migration ───────────────────────────────────────────────────────────────
log ""
log "───────────────────────────────────────────────────────────────────"
log "  Migration..."
log "───────────────────────────────────────────────────────────────────"

cd "$BACKEND_DIR"

PENDING=$(php artisan migrate:status --json 2>/dev/null | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    pending = [m for m in data if m.get('Ran?', '').strip() != 'Y']
    print(len(pending))
except:
    print('0')
" 2>/dev/null || echo "0")

log "Migration pending: $PENDING"

if [ "$PENDING" -gt 0 ]; then
  log "Migration yang akan dijalankan:"
  php artisan migrate --pretend --force 2>&1 | head -20

  echo ""
  if confirm "Jalankan $PENDING migration?"; then
    if php artisan migrate --force 2>&1 | tee -a "$LOG_FILE"; then
      ok "Migration selesai"
    else
      warn "Migration gagal! Rollback ke commit sebelumnya..."
      git reset --hard "$COMMIT_BEFORE"
      fail "Rollback ke $COMMIT_BEFORE — perbaiki error lalu coba lagi"
    fi
  else
    warn "Migration ditunda"
  fi
else
  ok "Tidak ada migration baru"
fi

# ── Cache ───────────────────────────────────────────────────────────────────
log ""
log "───────────────────────────────────────────────────────────────────"
log "  Cache..."
log "───────────────────────────────────────────────────────────────────"

cd "$BACKEND_DIR"

php artisan config:cache 2>&1 | tee -a "$LOG_FILE" && ok "config:cache"
php artisan route:cache 2>&1 | tee -a "$LOG_FILE" && ok "route:cache"
php artisan view:cache 2>&1 | tee -a "$LOG_FILE" && ok "view:cache"

# ── Restart supervisor ──────────────────────────────────────────────────────
log ""
log "───────────────────────────────────────────────────────────────────"
log "  Supervisor queue worker..."
log "───────────────────────────────────────────────────────────────────"

if sudo supervisorctl status jalankita-worker:* &>/dev/null; then
  if confirm "Restart queue workers?"; then
    sudo supervisorctl restart jalankita-worker:* 2>&1 | tee -a "$LOG_FILE"
    ok "Queue workers restarted"
    sudo supervisorctl status jalankita-worker:* 2>&1 | head -5
  fi
else
  warn "Supervisor tidak terdeteksi — lewati"
fi

# ── Selesai ─────────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo -e "  ${GREEN}✅ Deploy selesai${NC}"
echo "═══════════════════════════════════════════════════════════════════"
echo ""
echo "  From: $(git rev-parse --short "$COMMIT_BEFORE")"
echo "  To:   $(git rev-parse --short "$COMMIT_AFTER")"
echo "  Log:  $LOG_FILE"
echo ""

log_to_file "=== Deploy completed ==="
