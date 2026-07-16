#!/bin/bash
# update-lambda.sh — Build, push, update & test Lambda AI function
#
# Usage:
#   bash scripts/update-lambda.sh            # normal run
#   bash scripts/update-lambda.sh --skip-test  # build + push + update only
#
# Prerequisites:
#   - AWS CLI configured (aws configure)
#   - Docker Desktop running
#   - Git Bash (Windows) or bash (Linux/macOS)

set -euo pipefail

AWS_ACCOUNT="334298574138"
REGION="ap-southeast-1"
REPO_NAME="jalankita-ai"
LAMBDA_NAME="jalankita-ai"
IMAGE_URI="$AWS_ACCOUNT.dkr.ecr.$REGION.amazonaws.com/$REPO_NAME:latest"

SKIP_TEST=false
[[ "${1:-}" == "--skip-test" ]] && SKIP_TEST=true

# ── Paths ──────────────────────────────────────────────────────────────────
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LAMBDA_DIR="$PROJECT_ROOT/backend_AI/lambda"
TEST_IMG="$PROJECT_ROOT/Photos EXIF/output/20260525_115831.jpg"

echo "═══════════════════════════════════════════════════════════════════"
echo "  Update Lambda — $LAMBDA_NAME"
echo "═══════════════════════════════════════════════════════════════════"
echo "  Region : $REGION"
echo "  Image  : $IMAGE_URI"
echo ""

# ── 0. Convert MobileCLIP to ONNX (jika belum ada) ───────────────────────
echo "───────────────────────────────────────────────────────────────────"
echo "  [0/6] Cek MobileCLIP ONNX..."
echo "───────────────────────────────────────────────────────────────────"
if [ ! -f "$LAMBDA_DIR/models/mobileclip/vision_model.onnx" ]; then
    echo "  ⚠️  vision_model.onnx tidak ditemukan — menjalankan konversi..."
    echo "  (membutuhkan torch + open_clip + timm — skip jika gagal)"
    cd "$LAMBDA_DIR"
    python convert_mobileclip_onnx.py || {
        echo "  ⚠️  Konversi gagal — relevance guard akan fallback ke pass-through"
    }
else
    echo "  ✅ vision_model.onnx sudah ada"
fi
echo ""

# ── 1. Build Docker image ─────────────────────────────────────────────────
echo "───────────────────────────────────────────────────────────────────"
echo "  [1/6] Build image..."
echo "───────────────────────────────────────────────────────────────────"
cd "$LAMBDA_DIR"
DOCKER_BUILDKIT=0 docker build --platform linux/amd64 -t jalankita-ai .
echo "  ✅ Build selesai"
echo ""

# ── 2. Login ECR ──────────────────────────────────────────────────────────
echo "───────────────────────────────────────────────────────────────────"
echo "  [2/6] Login ECR..."
echo "───────────────────────────────────────────────────────────────────"
aws ecr get-login-password --region "$REGION" \
  | docker login --username AWS --password-stdin "$AWS_ACCOUNT.dkr.ecr.$REGION.amazonaws.com"
echo "  ✅ Login sukses"
echo ""

# ── 3. Tag & Push ─────────────────────────────────────────────────────────
echo "───────────────────────────────────────────────────────────────────"
echo "  [3/6] Push image to ECR..."
echo "───────────────────────────────────────────────────────────────────"
docker tag jalankita-ai:latest "$IMAGE_URI"
docker push "$IMAGE_URI"
echo "  ✅ Push selesai"
echo ""

# ── 4. Update Lambda function code ────────────────────────────────────────
echo "───────────────────────────────────────────────────────────────────"
echo "  [4/6] Update Lambda function code..."
echo "───────────────────────────────────────────────────────────────────"
aws lambda update-function-code \
  --function-name "$LAMBDA_NAME" \
  --image-uri "$IMAGE_URI" \
  --region "$REGION" \
  --no-cli-pager

echo "  Menunggu Lambda menjadi Active..."
aws lambda wait function-updated --function-name "$LAMBDA_NAME" --region "$REGION"
echo "  ✅ Lambda active"
echo ""

# ── 5. Test ───────────────────────────────────────────────────────────────
if [ "$SKIP_TEST" = true ]; then
    echo "───────────────────────────────────────────────────────────────────"
    echo "  ⏭️  Test dilewati (--skip-test)"
    echo "───────────────────────────────────────────────────────────────────"
    exit 0
fi

URL=$(aws lambda get-function-url-config \
  --function-name "$LAMBDA_NAME" \
  --region "$REGION" \
  --query 'FunctionUrl' --output text)
URL="${URL%/}"  # Hapus trailing slash biar path ganda tidak terjadi

echo "───────────────────────────────────────────────────────────────────"
echo "  [5/6] Test — URL: $URL"
echo "───────────────────────────────────────────────────────────────────"

if [ ! -f "$TEST_IMG" ]; then
    echo "  ⚠️  Test image tidak ditemukan di:"
    echo "     $TEST_IMG"
    echo "  Gunakan --skip-test jika tidak ingin test."
    echo ""
    echo "  Untuk test manual, jalankan:"
    echo "    curl -X POST \"$URL/analyze\" -F \"file=@path/to/image.jpg\""
    exit 1
fi

echo ""
echo "  ── 5a. GET / ──"
curl -s --max-time 10 "$URL/"
echo -e "\n"

echo "  ── 5b. /analyze-quality ──"
curl -s --max-time 30 -X POST "$URL/analyze-quality" -F "file=@$TEST_IMG"
echo -e "\n"

echo "  ── 5c. /analyze-relevance ──"
curl -s --max-time 30 -X POST "$URL/analyze-relevance" -F "file=@$TEST_IMG"
echo -e "\n"

echo "  ── 5d. /analyze ──"
curl -s --max-time 60 -X POST "$URL/analyze" -F "file=@$TEST_IMG" \
  | python -c "
import sys, json
d = json.load(sys.stdin)
print(f'  Deteksi: {d[\"total\"]} items')
print(f'  Severity: {d[\"overall_severity\"]}')
print(f'  Score: {d[\"severity_score\"]}')
for det in d.get('detections', []):
    print(f'    - {det[\"class\"]}: {det[\"confidence_pct\"]} ({det[\"severity\"]})')
"
echo ""

echo "═══════════════════════════════════════════════════════════════════"
echo "  ✅ DONE — Lambda $LAMBDA_NAME updated & tested"
echo "═══════════════════════════════════════════════════════════════════"
