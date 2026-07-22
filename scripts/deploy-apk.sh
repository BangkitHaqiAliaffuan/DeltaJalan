#!/bin/bash
# Deploy APK Android ke production server
# Usage: bash scripts/deploy-apk.sh [path-to-apk]
#
# Default APK path: Frontend-stable/android/app/build/outputs/apk/debug/app-debug.apk
# Target: /var/www/deltajalan/backend_POSTGRESQL/storage/app/public/apk/DeltaJalan.apk
#
# Prerequisites:
#   1. Build APK dulu via: bash scripts/start-android.sh --build-only
#   2. SSH key production: LightsailDefaultKey-ap-southeast-1.pem

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

APK_SRC="${1:-$PROJECT_ROOT/Frontend-stable/android/app/build/outputs/apk/debug/app-debug.apk}"
REMOTE_HOST="ubuntu@47.131.39.245"
REMOTE_DIR="/var/www/deltajalan/backend_POSTGRESQL/storage/app/public/apk"
SSH_KEY="$PROJECT_ROOT/LightsailDefaultKey-ap-southeast-1.pem"

if [ ! -f "$APK_SRC" ]; then
    echo "[FAIL] APK tidak ditemukan: $APK_SRC"
    echo "Build APK dulu: bash scripts/start-android.sh --build-only"
    exit 1
fi

APK_SIZE=$(ls -lh "$APK_SRC" | awk '{print $5}')

echo "=== Deploy APK ==="
echo "Source: $APK_SRC ($APK_SIZE)"
echo "Target: $REMOTE_HOST:$REMOTE_DIR/DeltaJalan.apk"
echo ""

# Buat direktori tujuan jika belum ada
ssh -i "$SSH_KEY" "$REMOTE_HOST" "mkdir -p $REMOTE_DIR"

# Upload APK
scp -i "$SSH_KEY" "$APK_SRC" "$REMOTE_HOST:$REMOTE_DIR/DeltaJalan.apk"

# Set permission
ssh -i "$SSH_KEY" "$REMOTE_HOST" "chmod 644 $REMOTE_DIR/DeltaJalan.apk"

echo ""
echo "=== Berhasil ==="
echo "APK tersedia di: https://api.deltajalan.web.id/api/public/download-apk"
