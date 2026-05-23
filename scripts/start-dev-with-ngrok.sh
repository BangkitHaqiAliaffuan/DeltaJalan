#!/bin/bash

# Script untuk menjalankan development environment dengan ngrok tunnel
# Gunakan: bash scripts/start-dev-with-ngrok.sh

set -e

echo "🚀 JalanKita Development Setup dengan ngrok"
echo "==========================================="
echo ""

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo "❌ ngrok tidak ditemukan. Install dari: https://ngrok.com/download"
    exit 1
fi

# Check if bun is installed
if ! command -v bun &> /dev/null; then
    echo "❌ bun tidak ditemukan. Install dari: https://bun.sh"
    exit 1
fi

echo "✅ ngrok dan bun terdeteksi"
echo ""

# Start FastAPI server
echo "🔧 Menjalankan FastAPI AI Server..."
cd ../backend_AI
python -m uvicorn server:app --host 0.0.0.0 --port 8000 &
FASTAPI_PID=$!
echo "   PID: $FASTAPI_PID"
sleep 2
echo ""

# Start Laravel server
echo "🔧 Menjalankan Laravel Backend..."
cd ../backend_POSTGRESQL
php artisan serve --port=8080 &
LARAVEL_PID=$!
echo "   PID: $LARAVEL_PID"
sleep 2
echo ""

# Start Frontend dev server
echo "🔧 Menjalankan Frontend (Vite)..."
cd ../Frontend
bun run dev &
FRONTEND_PID=$!
sleep 3
echo ""

# Start ngrok tunnel
echo "🌐 Membuat ngrok tunnel ke http://localhost:5173..."
echo ""
ngrok http 5173 --log=stdout

# Cleanup on exit
trap "kill $FASTAPI_PID $LARAVEL_PID $FRONTEND_PID 2>/dev/null" EXIT
