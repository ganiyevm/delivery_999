#!/bin/bash
# Apteka999 Sync Agent — Linux uchun avtomatik installer
# Foydalanish: sudo bash install.sh

set -e

echo "=========================================================="
echo "  Apteka999 Sync Agent - Linux uchun avtomatik installer"
echo "=========================================================="
echo ""

# Root tekshirish
if [ "$EUID" -ne 0 ]; then
    echo "XATO: sudo bilan ishga tushiring: sudo bash install.sh"
    exit 1
fi

# Node.js tekshirish
echo "[1/5] Node.js mavjudligini tekshirish..."
if ! command -v node &> /dev/null; then
    echo ""
    echo "Node.js o'rnatish..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
fi
echo "    Node.js: $(node --version)"
echo ""

# .env tekshirish
echo "[2/5] .env faylni tekshirish..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo ""
    echo "MUHIM: .env faylni tahrirlang:"
    echo "  - BACKEND_URL"
    echo "  - SYNC_API_KEY"
    echo "  - BRANCH_NUMBER (bu filial raqami)"
    echo "  - MSSQL_PASSWORD (agar sa/1 emas bo'lsa)"
    echo ""
    read -p "nano bilan ochish uchun Enter bosing..."
    nano .env
fi
echo "    .env mavjud"
echo ""

# npm install
echo "[3/5] Dependency'larni o'rnatish..."
npm install --production --no-fund --no-audit
echo ""

# Test connection
echo "[4/5] SQL Server'ga sinov ulanish..."
if ! npm run test-connection; then
    echo ""
    echo "OGOHLANTIRISH: Test ulanish muvaffaqiyatsiz."
    read -p "Davom etish? (y/n) " continue
    [ "$continue" != "y" ] && exit 1
fi
echo ""

# PM2 daemon
echo "[5/5] PM2 daemon sifatida ishga tushirish..."
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
fi

pm2 delete apteka-sync 2>/dev/null || true
pm2 start src/index.js --name apteka-sync
pm2 save
pm2 startup systemd -u "$SUDO_USER" --hp "/home/$SUDO_USER"

echo ""
echo "=========================================================="
echo "  TAYYOR! Apteka999 Sync Agent o'rnatildi"
echo "=========================================================="
echo ""
echo "Status:    pm2 status"
echo "Log:       pm2 logs apteka-sync"
echo "Restart:   pm2 restart apteka-sync"
echo "Stop:      pm2 stop apteka-sync"
echo ""
