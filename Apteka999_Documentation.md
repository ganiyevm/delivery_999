---
pdf_options:
  format: A4
  margin: 25mm 20mm
  printBackground: true
  displayHeaderFooter: true
  headerTemplate: '<div style="font-size:8px;width:100%;text-align:center;color:#999;">Apteka 999 — Project Documentation</div>'
  footerTemplate: '<div style="font-size:8px;width:100%;text-align:center;color:#999;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>'
stylesheet: []
body_class: apteka-doc
css: |-
  body {
    font-family: 'Segoe UI', Roboto, -apple-system, sans-serif;
    color: #1a1a2e;
    line-height: 1.7;
  }
  h1 { color: #0f3460; border-bottom: 3px solid #0f3460; padding-bottom: 10px; font-size: 28px; }
  h2 { color: #16213e; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-top: 30px; font-size: 22px; }
  h3 { color: #1a1a2e; font-size: 18px; margin-top: 20px; }
  h4 { color: #533483; font-size: 15px; }
  table { border-collapse: collapse; width: 100%; margin: 15px 0; font-size: 13px; }
  th { background: #0f3460; color: white; padding: 10px 12px; text-align: left; }
  td { border: 1px solid #e2e8f0; padding: 8px 12px; }
  tr:nth-child(even) { background: #f8fafc; }
  code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 12px; color: #e94560; }
  pre { background: #1a1a2e; color: #e2e8f0; padding: 15px; border-radius: 8px; font-size: 12px; }
  blockquote { border-left: 4px solid #e94560; background: #fff5f5; padding: 10px 15px; margin: 15px 0; }
  .page-break { page-break-after: always; }
  hr { border: none; border-top: 1px solid #e2e8f0; margin: 20px 0; }
  ul, ol { padding-left: 20px; }
  li { margin-bottom: 4px; }
---

# 🏥 Apteka 999 — Dorixona Yetkazib Berish Platformasi

**Loyiha hujjati · Aprel 2026**

---

## 📋 Mundarija

1. [Loyiha haqida](#loyiha-haqida)
2. [Tizim arxitekturasi](#tizim-arxitekturasi)
3. [Texnologiyalar](#texnologiyalar)
4. [Modul va funksiyalar](#modul-va-funksiyalar)
5. [Ma'lumotlar bazasi](#malumotlar-bazasi)
6. [API hujjati](#api-hujjati)
7. [Xavfsizlik](#xavfsizlik)
8. [Deploy va infratuzilma](#deploy-va-infratuzilma)
9. [Loyiha narxi](#loyiha-narxi)

---

## 1. Loyiha haqida

**Apteka 999** — Toshkent shahridagi 20 ta dorixona filialini birlashtirgan to'liq raqamli yetkazib berish platformasi. Platforma mijozlarga dori-darmonlarni qulay tarzda qidirish, buyurtma berish va to'lov qilish imkonini beradi.

### Asosiy maqsadlar:
- 20 ta dorixona filialini yagona raqamli platformaga birlashtirish
- Telegram Mini App orqali foydalanuvchilarga qulay interfeys taqdim etish
- Buyurtma → To'lov → Yetkazib berish jarayonini to'liq avtomatlashtirish
- Real-time analitika va boshqaruv paneli orqali operatsion samaradorlikni oshirish
- Bonus tizimi orqali mijoz sadoqatini shakllantirish

### Maqsadli auditoriya:
- **Mijozlar**: Toshkent aholisi, dorixona xizmatlari foydalanuvchilari
- **Operatorlar**: Filial xodimlari, buyurtma boshqaruvchilari
- **Kurierlar**: Yetkazib berish xodimlari
- **Administratorlar**: Tizim boshqaruvchilari

---

<div class="page-break"></div>

## 2. Tizim Arxitekturasi

### 2.1 Umumiy arxitektura

```
┌─────────────────────────────────────────────────────────┐
│                    FOYDALANUVCHILAR                      │
│                                                         │
│   📱 Telegram Mini App      🖥 Admin Panel               │
│   (React + Vite)            (React + Vite + Recharts)   │
│   Port: 5173                Port: 5174                  │
└──────────┬──────────────────────┬───────────────────────┘
           │         HTTPS        │
           ▼                      ▼
┌─────────────────────────────────────────────────────────┐
│                 🔧 BACKEND API SERVER                    │
│                 Node.js + Express                       │
│                 Port: 3000                              │
│                                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │   Auth   │ │  Orders  │ │ Products │ │  Payment  │  │
│  │  Routes  │ │  Routes  │ │  Routes  │ │  Routes   │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │ Branches │ │ Analytics│ │  Import  │ │  Admin    │  │
│  │  Routes  │ │  Routes  │ │  Routes  │ │  Routes   │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────┘  │
│                                                         │
│  ┌─────────────── SERVICES ───────────────────────────┐ │
│  │ Click · Payme · Bonus · Telegram · Analytics       │ │
│  │ Import · Aslbelgisi (Verification)                 │ │
│  └────────────────────────────────────────────────────┘ │
└──────────┬──────────────────────┬───────────────────────┘
           │                      │
           ▼                      ▼
┌──────────────────┐    ┌──────────────────────┐
│  🍃 MongoDB 7     │    │  🤖 Telegram Bot      │
│  Port: 27017     │    │  Grammy Framework    │
│                  │    │  Port: 3001          │
│  Collections:    │    │                      │
│  - users         │    │  Handlers:           │
│  - products      │    │  - start             │
│  - orders        │    │  - operator          │
│  - branches      │    │  - courier           │
│  - stocks        │    │  - customer          │
│  - analytics     │    │                      │
│  - bonustx       │    │  Keyboards:          │
│  - settings      │    │  - inline menus      │
│  - adminaccount  │    │                      │
│  - importlogs    │    │  Locales:            │
└──────────────────┘    │  - uz, ru, en        │
                        └──────────────────────┘
```

### 2.2 Microservice Kommunikatsiya

```
┌──────────────┐     Webhook      ┌──────────────┐
│   Telegram   │ ◄──────────────► │   Bot Server  │
│   Server     │                  │   (port 3001) │
└──────────────┘                  └───────┬───────┘
                                          │
                                    HTTP Proxy
                                          │
┌──────────────┐     REST API     ┌───────▼───────┐
│    Click     │ ◄──────────────► │   Backend     │
│    Server    │   /click/*       │   (port 3000) │
└──────────────┘                  │               │
                                  │               │
┌──────────────┐    JSON-RPC      │               │
│    Payme     │ ◄──────────────► │               │
│    Server    │  /api/payment    │               │
└──────────────┘    /payme        └───────────────┘
```

### 2.3 Buyurtma Hayot Tsikli (Order Lifecycle)

```
              ┌─────────────────┐
              │ awaiting_payment │◄── Buyurtma yaratildi
              └────────┬────────┘
                       │ To'lov muvaffaqiyatli
                       ▼
              ┌─────────────────┐
              │ pending_operator │◄── Operator kutmoqda
              └────────┬────────┘
                      ╱ ╲
            Tasdiqladi   Rad etdi
                  ╱         ╲
                 ▼            ▼
        ┌───────────┐  ┌──────────┐
        │ confirmed │  │ rejected │
        └─────┬─────┘  └──────────┘
              │ Kurier yo'lga chiqdi
              ▼
        ┌───────────┐
        │ on_the_way│
        └─────┬─────┘
              │ Yetkazildi
              ▼
        ┌───────────┐
        │ delivered │
        └───────────┘

    * Har qanday bosqichda → cancelled (bekor qilingan)
```

---

<div class="page-break"></div>

## 3. Texnologiyalar

### 3.1 Texnologiya Steki

| Qatlam | Texnologiya | Versiya | Maqsad |
|--------|-------------|---------|--------|
| **Frontend (Mini App)** | React | 18.x | Telegram Mini App UI |
| **Frontend (Admin)** | React | 18.x | Boshqaruv paneli |
| **Build Tool** | Vite | 5.x | Tez build va HMR |
| **Grafik** | Recharts | 2.x | Dashboard analitika |
| **Backend** | Node.js | 20+ | Server runtime |
| **Framework** | Express.js | 4.x | REST API framework |
| **Database** | MongoDB | 7.x | NoSQL ma'lumotlar bazasi |
| **ODM** | Mongoose | 8.x | MongoDB obyekt modeli |
| **Bot** | Grammy | 1.x | Telegram Bot API |
| **Auth** | JWT | — | JSON Web Token autentifikatsiya |
| **Security** | Helmet | — | HTTP xavfsizlik headerlari |
| **Rate Limit** | express-rate-limit | — | So'rovlarni cheklash |
| **Container** | Docker + Compose | — | Deployment |
| **Hosting** | Railway | — | Cloud PaaS |

### 3.2 Tashqi integratsiyalar

| Xizmat | Maqsad | Protokol |
|--------|--------|----------|
| **Click** | Onlayn to'lov | REST (Prepare/Complete) |
| **Payme** | Onlayn to'lov | JSON-RPC 2.0 |
| **Telegram Bot API** | Xabarnomalar, bot interaksiya | Webhook |
| **Telegram WebApp API** | Mini App autentifikatsiya | initData validation |
| **Yandex Navigator** | Kurier navigatsiya | Deep linking |

---

<div class="page-break"></div>

## 4. Modul va Funksiyalar

### 4.1 📱 Telegram Mini App (Mijoz interfeysi)

| Sahifa | Funksiya |
|--------|----------|
| **Home** | Asosiy sahifa, kategoriyalar, mashhur mahsulotlar |
| **Catalog** | Mahsulotlar katalogi, qidiruv, filtr |
| **Product Detail** | Mahsulot haqida batafsil ma'lumot, analog dorilar |
| **Branches** | 20 ta filial ro'yxati, xarita, masofa bo'yicha saralash |
| **Cart** | Savatcha, miqdor boshqaruvi, bonus qo'llash |
| **Payment** | Click yoki Payme orqali to'lov |
| **Scanner** | Barkod skaneri orqali dori qidirish |
| **Profile** | Profil, buyurtmalar tarixi, manzillar, bonus |

**Maxsus xususiyatlar:**
- 🔍 Latin → Kirill transliteratsiya qidiruvi (lotinchada yozib kirill natija topish)
- 📍 GPS orqali eng yaqin filial aniqlash
- 🎯 Telegram WebApp API to'liq integratsiya (haptic feedback, theme sync)
- 🌐 3 tilda interfeys (O'zbekcha, Ruscha, Inglizcha)

---

### 4.2 🖥 Admin Panel (Boshqaruv paneli)

| Sahifa | Funksiya |
|--------|----------|
| **Dashboard** | Real-time KPI, grafik, analitika, buyurtma funnel |
| **Orders** | Buyurtmalar ro'yxati, filtrlash, status boshqarish |
| **Products** | Mahsulot CRUD, kategoriya boshqarish |
| **Branches** | Filiallar boshqaruvi, operator tayinlash |
| **Users** | Foydalanuvchilar ro'yxati, bonus boshqarish |
| **Import** | Excel orqali ommaviy mahsulot yuklash |
| **Accounts** | Admin hisoblar boshqaruvi |
| **Settings** | Tizim sozlamalari (yetkazib berish narxi, bonus qoidalari) |

**Dashboard xususiyatlari:**
- 📊 Animatsiyali KPI hisoblagichlar
- 📈 Gradient AreaChart grafiklar (Recharts)
- 🔮 Glassmorphism dizayn elementlari
- 💀 Skeleton loading holatlari
- 🔄 Buyurtma funnel vizualizatsiya
- ⏱ So'nggi buyurtmalar real-time ro'yxati

---

### 4.3 🤖 Telegram Bot

| Handler | Funksiya |
|---------|----------|
| **Start** | Foydalanuvchi ro'yxatdan o'tishi, til tanlash |
| **Operator** | Yangi buyurtma xabarnomasi, tasdiqlash/rad etish |
| **Courier** | Buyurtma olish, yetkazib berish tasdiqlash |
| **Customer** | Buyurtma holati xabarlari, bonus xabarlari |

**Bot xususiyatlari:**
- 📨 Avtomatik buyurtma xabarnomasi operatorlarga
- ✅ Inline tasdiqlash/rad etish tugmalari
- 🚗 Kurierga buyurtma tayinlash
- 📍 Yandex Navigator orqali manzilga yo'naltirish
- 🌐 Ko'p tilli (uz, ru, en)
- 🛡 Blocked bot graceful error handling

---

### 4.4 💳 To'lov Tizimi

#### Click integratsiyasi
| Bosqich | Tavsif |
|---------|--------|
| **Prepare** | Buyurtma tekshiriladi, `merchant_prepare_id` qaytariladi |
| **Complete** | To'lov tasdiqlanadi, buyurtma statusi yangilanadi |

#### Payme integratsiyasi (JSON-RPC 2.0)
| Metod | Tavsif |
|-------|--------|
| `CheckPerformTransaction` | Buyurtma to'lov qilsa bo'ladimi tekshirish |
| `CreateTransaction` | Yangi tranzaksiya yaratish |
| `PerformTransaction` | To'lovni amalga oshirish |
| `CancelTransaction` | Tranzaksiyani bekor qilish |
| `CheckTransaction` | Tranzaksiya holatini tekshirish |
| `GetStatement` | Tranzaksiyalar hisoboti |

**To'lov xavfsizligi:**
- ✅ Idempotent webhook qayta ishlash
- ✅ Timeout boshqaruvi (12 soat)
- ✅ State machine (5 holat: new → created → performed → cancelled)
- ✅ Frontend polling orqali status tekshirish

---

### 4.5 ⭐ Bonus Tizimi

| Daraja | Ball oralig'i | Belgisi |
|--------|--------------|---------|
| **Kumush** | 0 — 1,999 ball | 🥈 |
| **Oltin** | 2,000 — 4,999 ball | 🥇 |
| **Platina** | 5,000+ ball | 💎 |

**Qoidalar:**
- Har 10,000 so'm xaridga → 100 bonus ball
- 1 ball = 1 so'm chegirma
- Maksimal chegirma: buyurtma summasining 30%

---

<div class="page-break"></div>

## 5. Ma'lumotlar Bazasi

### 5.1 Kolleksiyalar

| Kolleksiya | Maydonlar soni | Tavsif |
|------------|---------------|--------|
| **users** | 15+ | Telegram foydalanuvchilar, bonus, manzillar |
| **products** | 12+ | Dorilar katalogi, barcode, analog, tavsif (uz/ru) |
| **orders** | 30+ | Buyurtmalar, to'lov ma'lumoti, status tarixi |
| **branches** | 10+ | Filiallar, lokatsiya, operator/kurier ID |
| **stocks** | 4+ | Mahsulot zaxirasi (filial → mahsulot → narx → miqdor) |
| **analyticsdailies** | 10+ | Kunlik statistika agregatsiya |
| **bonustransactions** | 6+ | Bonus ball tarixi |
| **settings** | 5+ | Tizim sozlamalari |
| **adminaccounts** | 4+ | Admin hisoblar |
| **importlogs** | 5+ | Excel import tarixi |

### 5.2 Asosiy Indekslar

```
orders   → { telegramId: 1 }, { createdAt: -1 }, { branch: 1, status: 1 }
products → { name: 'text', ingredient: 'text', manufacturer: 'text' }
users    → { telegramId: 1 } (unique)
branches → { number: 1 }
```

---

<div class="page-break"></div>

## 6. API Hujjati

### 6.1 Autentifikatsiya

| Metod | Endpoint | Tavsif |
|-------|----------|--------|
| `POST` | `/api/auth/telegram` | Telegram WebApp initData orqali auth |
| `POST` | `/api/auth/admin/login` | Admin panel login (JWT) |

### 6.2 Mahsulotlar

| Metod | Endpoint | Tavsif |
|-------|----------|--------|
| `GET` | `/api/products` | Barcha mahsulotlar (pagination, search, filter) |
| `GET` | `/api/products/:id` | Bitta mahsulot |
| `POST` | `/api/products` | Yangi mahsulot (Admin) |
| `PUT` | `/api/products/:id` | Mahsulot tahrirlash (Admin) |
| `DELETE` | `/api/products/:id` | Mahsulot o'chirish (Admin) |

### 6.3 Filiallar

| Metod | Endpoint | Tavsif |
|-------|----------|--------|
| `GET` | `/api/branches` | Barcha filiallar |
| `GET` | `/api/branches/:id` | Bitta filial |
| `GET` | `/api/branches/:id/stock` | Filial zahirasi |
| `POST` | `/api/branches` | Yangi filial (Admin) |
| `PUT` | `/api/branches/:id` | Filial tahrirlash (Admin) |

### 6.4 Buyurtmalar

| Metod | Endpoint | Tavsif |
|-------|----------|--------|
| `POST` | `/api/orders` | Yangi buyurtma |
| `GET` | `/api/orders` | Foydalanuvchi buyurtmalari |
| `GET` | `/api/orders/:id` | Buyurtma tafsiloti |
| `PATCH` | `/api/orders/:id/status` | Status o'zgartirish (Admin) |

### 6.5 To'lov

| Metod | Endpoint | Tavsif |
|-------|----------|--------|
| `POST` | `/api/payment/click/prepare` | Click prepare webhook |
| `POST` | `/api/payment/click/complete` | Click complete webhook |
| `POST` | `/api/payment/payme` | Payme JSON-RPC endpoint |
| `GET` | `/api/payment/status/:orderId` | To'lov holati tekshirish |

### 6.6 Analitika

| Metod | Endpoint | Tavsif |
|-------|----------|--------|
| `GET` | `/api/analytics/dashboard` | Dashboard statistika |
| `GET` | `/api/analytics/daily` | Kunlik grafiklar ma'lumoti |

### 6.7 Import

| Metod | Endpoint | Tavsif |
|-------|----------|--------|
| `POST` | `/api/import/excel` | Excel fayldan mahsulot import |

### 6.8 Health Check

| Metod | Endpoint | Tavsif |
|-------|----------|--------|
| `GET` | `/api/health` | Tizim salomatligi |

---

<div class="page-break"></div>

## 7. Xavfsizlik

### 7.1 Autentifikatsiya va Avtorizatsiya

| Qatlam | Mexanizm |
|--------|----------|
| **Mini App** | Telegram WebApp `initData` HMAC-SHA256 tekshiruv |
| **Admin Panel** | JWT token (alohida `ADMIN_JWT_SECRET`) |
| **Bot** | `secret_token` webhook tekshiruv |
| **API** | Role-based access control (user/admin/operator/courier) |

### 7.2 Tarmoq xavfsizligi

| Himoya | Vosita |
|--------|--------|
| **HTTP Headers** | Helmet.js (XSS, CSRF, Clickjacking) |
| **Rate Limiting** | 200 so'rov / 15 daqiqa |
| **CORS** | Credentialed cross-origin ruxsat |
| **CSP** | Telegram domenlariga frame-ancestors ruxsat |
| **Input Validation** | Request body tekshiruv |

### 7.3 To'lov xavfsizligi

- Click: `sign_string` MD5 hash tekshiruv
- Payme: Basic Auth + merchant key tekshiruv
- Idempotent webhook qayta ishlash
- Transaction timeout monitoring (12 soat)

---

<div class="page-break"></div>

## 8. Deploy va Infratuzilma

### 8.1 Docker Compose Arxitekturasi

| Servis | Image | Port | Tavsif |
|--------|-------|------|--------|
| `mongodb` | mongo:7 | 27017 | Ma'lumotlar bazasi |
| `backend` | Custom | 3000 | API server |
| `frontend` | Custom | 5173 → 80 | Telegram Mini App |
| `admin` | Custom | 5174 → 80 | Admin Panel |
| `bot` | Custom | 3001 | Telegram Bot |

### 8.2 Deploy jarayoni

```bash
# 1. Repository klonlash
git clone <repository-url>

# 2. Environment sozlash
cp .env.example backend/.env
# BOT_TOKEN, MONGODB_URI, JWT_SECRET, ADMIN_JWT_SECRET → tahrirlang

# 3. Docker bilan ishga tushirish
docker-compose up -d

# 4. Yoki alohida ishga tushirish
cd backend && npm install && npm start
cd admin && npm install && npm run dev
cd frontend && npm install && npm run dev
cd bot && npm install && npm start
```

### 8.3 Cloud Deploy (Railway)

Loyiha Railway PaaS platformasida hosting qilinadi:
- Avtomatik CI/CD (git push → deploy)
- MongoDB Atlas ulash
- SSL sertifikat (avtomatik)
- Custom domain sozlash

---

<div class="page-break"></div>

## 9. 💰 Loyiha Narxi

### 9.1 Ishlanma Tarkibi va Baholash

| # | Modul | Murakkablik | Soat | Narx (so'm) |
|---|-------|-------------|------|-------------|
| 1 | **Backend API Server** | Yuqori | 120 | 18,000,000 |
| | — Express.js arxitektura, middleware | | | |
| | — 11 ta route moduli | | | |
| | — 7 ta servis (to'lov, analitika, bonus) | | | |
| | — 10 ta MongoDB model | | | |
| 2 | **Telegram Mini App** | Yuqori | 100 | 15,000,000 |
| | — 8 ta sahifa (Home, Catalog, Cart, Payment...) | | | |
| | — Telegram WebApp API integratsiya | | | |
| | — 3 tilda interfeys (uz, ru, en) | | | |
| | — Responsive dizayn | | | |
| 3 | **Admin Panel** | Yuqori | 90 | 13,500,000 |
| | — Dashboard (Recharts, KPI, analitika) | | | |
| | — 7 ta boshqaruv sahifasi | | | |
| | — Enterprise-grade UI/UX | | | |
| 4 | **Telegram Bot** | O'rta | 50 | 7,500,000 |
| | — Grammy framework | | | |
| | — Operator/Courier/Customer handlers | | | |
| | — Ko'p tilli (3 til) | | | |
| 5 | **Click to'lov integratsiya** | Yuqori | 40 | 6,000,000 |
| | — Prepare/Complete webhook | | | |
| | — Xavfsizlik, idempotent qayta ishlash | | | |
| 6 | **Payme to'lov integratsiya** | Yuqori | 45 | 6,750,000 |
| | — JSON-RPC 2.0 to'liq integratsiya | | | |
| | — 6 ta metod, state machine | | | |
| 7 | **Bonus tizimi** | O'rta | 25 | 3,750,000 |
| | — 3 darajali tizim | | | |
| | — Avtomatik hisoblash | | | |
| 8 | **Excel Import moduli** | O'rta | 20 | 3,000,000 |
| | — Bulk mahsulot yuklash | | | |
| | — Import loglari | | | |
| 9 | **Docker + Deploy** | O'rta | 20 | 3,000,000 |
| | — Docker Compose (5 servis) | | | |
| | — Railway CI/CD | | | |
| 10 | **Dizayn va UX** | O'rta | 30 | 4,500,000 |
| | — Modern glassmorphism dizayn | | | |
| | — Responsive, animatsiyalar | | | |

---

### 9.2 Umumiy narx xulosasi

| | |
|---|---|
| **Jami ish soatlari** | **540 soat** |
| **Modullar soni** | **10 ta** |
| **Kodlar bazasi** | **~50 ta fayl, 15,000+ qator** |

---

| Taqdimot | Narx |
|----------|------|
| 💡 **Umumiy loyiha narxi** | **81,000,000 so'm** |
| 🔧 Texnik qo'llab-quvvatlash (6 oy) | 5,000,000 so'm |
| 📚 Hujjatlashtirish | Bepul |
| **📦 TO'LIQ PAKET NARXI** | **86,000,000 so'm** |

---

> **Eslatma**: Narxlar ishlab chiquvchining tajribasi, loyihaning murakkabligi va bozor narxlariga asosan belgilanadi. Narxlar kelishuv asosida o'zgarishi mumkin.

---

### 9.3 Qo'shimcha xizmatlar (ixtiyoriy)

| Xizmat | Narx |
|--------|------|
| Yangi to'lov tizimi integratsiya | 5,000,000 so'm |
| Mobil ilova (React Native) | 30,000,000 so'm |
| SMS xabar integratsiya | 3,000,000 so'm |
| Qo'shimcha analitika moduli | 5,000,000 so'm |
| Server monitoring (Grafana) | 4,000,000 so'm |

---

<div class="page-break"></div>

## 📞 Aloqa

| | |
|---|---|
| **Ishlab chiquvchi** | Xusniddin Ganiyev |
| **LinkedIn** | linkedin.com/in/xusniddinganiyev |
| **Telegram** | @ganniyev |
| **Telefon** | +998 98 177 09 19 |

---

*Ushbu hujjat Apteka 999 loyihasi uchun tayyorlangan. Barcha huquqlar himoyalangan. © 2026*
