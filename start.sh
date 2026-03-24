#!/bin/sh
set -e

# Uploads papkasi
mkdir -p /app/uploads

# Frontend build (agar dist yo'q bo'lsa)
if [ ! -f /app/frontend/dist/index.html ]; then
  echo "Frontend build qilinmoqda..."
  cd /app/frontend && npm ci && npm run build
  cd /app
fi

# Bot ni background da ishga tushirish
echo "Bot ishga tushirilmoqda..."
cd /app/bot && node index.js &

# Backend ishga tushirish
echo "Backend ishga tushirilmoqda..."
cd /app/backend && node server.js
