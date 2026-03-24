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
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
}));
app.use(cors({
    origin: [
        process.env.FRONTEND_URL,
        process.env.ADMIN_URL,
        'http://localhost:5173',
        'http://localhost:5174',
    ].filter(Boolean),
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
    setHeaders: (res) => {
        // Telegram Mini App uchun frame ruxsati
        res.removeHeader('X-Frame-Options');
    },
}));
// SPA fallback — barcha noma'lum yo'llar index.html ga
app.get('*', (req, res) => {
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
