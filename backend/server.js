require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const connectDB = require('./src/config/db');
const errorHandler = require('./src/middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

// ngrok / reverse proxy orqali ishlayotganda IP ni to'g'ri olish uchun
app.set('trust proxy', 1);

// ─── Security ───
// Telegram Mini App iframe uchun maxsus headerlar
app.use((req, res, next) => {
    // Telegram WebView iframe da ochilishi uchun X-Frame-Options o'chiriladi
    res.removeHeader('X-Frame-Options');
    // CSP: Telegram domenlariga ruxsat
    res.setHeader('Content-Security-Policy',
        "frame-ancestors 'self' https://web.telegram.org https://*.telegram.org https://telegram.org"
    );
    next();
});

app.use(cors({
    origin: true,  // barcha originlarga ruxsat
    credentials: true,
}));

// ─── Rate Limiting ───
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 daqiqa
    max: 200,
    message: { error: 'Juda ko\'p so\'rov. 15 daqiqadan keyin qayta urinib ko\'ring.' },
});
app.use('/api/', limiter);

// ─── Body Parser ───
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Request logger (Click validation uchun) ───
app.use((req, res, next) => {
    if (req.path.includes('click') || req.path.includes('payme')) {
        console.log(`[REQ] ${req.method} ${req.path} | IP: ${req.ip} | Body: ${JSON.stringify(req.body)}`);
    }
    next();
});

// ─── Routes ───
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/products', require('./src/routes/products'));
app.use('/api/branches', require('./src/routes/branches'));
app.use('/api/orders', require('./src/routes/orders'));
app.use('/api/user', require('./src/routes/user'));
app.use('/api/payment', require('./src/routes/payment'));
app.use('/api/import', require('./src/routes/import'));
app.use('/api/analytics', require('./src/routes/analytics'));
app.use('/api/admin', require('./src/routes/admin'));
app.use('/api/delivery', require('./src/routes/delivery'));
app.use('/api', require('./src/routes/verify'));

// ─── Telegram Bot Webhook (bot port 3001 ga proxy) ───
const http = require('http');
app.post('/bot-webhook', (req, res) => {
    const data = JSON.stringify(req.body);
    const proxyReq = http.request({
        hostname: 'localhost',
        port: 3001,
        path: '/bot-webhook',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data),
            'x-telegram-bot-api-secret-token': req.headers['x-telegram-bot-api-secret-token'] || '',
        },
    }, () => res.json({ ok: true }));
    proxyReq.on('error', () => res.json({ ok: true }));
    proxyReq.write(data);
    proxyReq.end();
});

// ─── Click webhook short aliases (Click merchant panel uchun) ───
const ClickService = require('./src/services/click.service');
app.get('/click/prepare', (req, res) => res.json({ error: 0, error_note: 'OK' }));
app.get('/click/complete', (req, res) => res.json({ error: 0, error_note: 'OK' }));
app.post('/click/prepare', async (req, res) => {
    console.log('[CLICK SHORT] prepare keldi:', JSON.stringify(req.body));
    const result = await ClickService.prepare(req.body);
    res.json(result);
});
app.post('/click/complete', async (req, res) => {
    console.log('[CLICK SHORT] complete keldi:', JSON.stringify(req.body));
    const result = await ClickService.complete(req.body);
    res.json(result);
});

// ─── Health Check ───
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// ─── Admin panel static ───
const adminDist = path.join(__dirname, '../admin/dist');
app.use('/admin', express.static(adminDist));
app.get('/admin/*', (req, res) => {
    res.sendFile(path.join(adminDist, 'index.html'));
});

// ─── Frontend static (Mini App) ───
const frontendDist = path.join(__dirname, '../frontend/dist');
app.use(express.static(frontendDist, {
    setHeaders: (res, filePath) => {
        // Telegram Mini App uchun frame ruxsati
        res.removeHeader('X-Frame-Options');
        // index.html ni cache qilmaslik — Telegram WebApp cache muammosini hal qiladi
        if (filePath.endsWith('index.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        }
    },
}));
// SPA fallback — barcha noma'lum yo'llar index.html ga
app.get('*', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(frontendDist, 'index.html'));
});

// ─── Error Handler ───
app.use(errorHandler);

// ─── Start ───
const start = async () => {
    await connectDB();

    // Cron job — kunlik analytics
    require('./src/jobs/dailyAnalytics');

    app.listen(PORT, () => {
        console.log(`🚀 Apteka999 API ishga tushdi: http://localhost:${PORT}`);
    });
};

start().catch(console.error);

module.exports = app;
