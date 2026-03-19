# 🏥 Сеть Аптек 999

Toshkent bo'ylab 20 ta filialda dori-darmon yetkazib berish tizimi.

## Tizim tarkibi

| Qism | Texnologiya | Port |
|------|-------------|------|
| **Backend API** | Node.js + Express + MongoDB | 3000 |
| **Mini App** | React (Vite) — Telegram WebApp | 5173 |
| **Admin Panel** | React (Vite) + Recharts | 5174 |
| **Telegram Bot** | grammy | — |
| **Database** | MongoDB | 27017 |

## 🚀 Ishga tushirish

### 1. Talablar
- Node.js 20+
- MongoDB 7+
- Telegram Bot Token

### 2. Sozlash

```bash
# .env faylini yarating
cp .env.example backend/.env

# backend/.env ni tahrirlang:
# - BOT_TOKEN, MONGODB_URI, JWT_SECRET, ADMIN_JWT_SECRET
```

### 3. Backend

```bash
cd backend
npm install
npm start
```

### 4. Frontend (Telegram Mini App)

```bash
cd frontend
npm install
npm run dev
```

### 5. Admin Panel

```bash
cd admin
npm install
npm run dev
```

### 6. Bot

```bash
cd bot
npm install
npm start
```

### 7. Docker bilan (barchasi)

```bash
docker-compose up -d
```

## 📡 API Endpoints

| Yo'l | Tavsif |
|------|--------|
| `POST /api/auth/telegram` | Telegram WebApp auth |
| `POST /api/auth/admin/login` | Admin login |
| `GET /api/products` | Mahsulotlar (search, filter) |
| `GET /api/branches` | Filiallar |
| `POST /api/orders` | Buyurtma yaratish |
| `POST /api/payment/click/*` | Click webhook |
| `POST /api/payment/payme` | Payme JSON-RPC |
| `POST /api/import/excel` | Excel import |
| `GET /api/analytics/*` | Dashboard statistika |

## Admin kirish

```
Login: admin
Parol: admin999
```

## 🔄 Buyurtma oqimi

```
awaiting_payment → pending_operator → confirmed → on_the_way → delivered
                 → cancelled        → rejected
```

## ⭐ Bonus tizimi

- Har 10,000 сўмga → 100 ball
- 1 ball = 1 сўм, max 30% chegirma
- 🥈 Kumush (0–1,999) → 🥇 Oltin (2,000–4,999) → 💎 Platina (5,000+)
# delivery_999
