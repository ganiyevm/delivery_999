const router = require('express').Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const AdminAccount = require('../models/AdminAccount');

// ─── Telegram WebApp auth ───
router.post('/telegram', async (req, res, next) => {
    try {
        const { initData } = req.body;
        if (!initData) {
            return res.status(400).json({ error: 'initData taqdim etilmagan' });
        }

        // initData ni tekshirish
        const urlParams = new URLSearchParams(initData);
        const hash = urlParams.get('hash');
        urlParams.delete('hash');

        const dataCheckString = [...urlParams.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, val]) => `${key}=${val}`)
            .join('\n');

        const secretKey = crypto
            .createHmac('sha256', 'WebAppData')
            .update(process.env.BOT_TOKEN)
            .digest();

        const calculatedHash = crypto
            .createHmac('sha256', secretKey)
            .update(dataCheckString)
            .digest('hex');

        if (calculatedHash !== hash) {
            return res.status(401).json({ error: 'initData tekshiruvdan o\'tmadi' });
        }

        // User ma'lumotlarini olish
        const userData = JSON.parse(urlParams.get('user') || '{}');
        if (!userData.id) {
            return res.status(400).json({ error: 'Telegram user ma\'lumoti topilmadi' });
        }

        // Upsert — yaratish yoki yangilash
        let user = await User.findOne({ telegramId: userData.id });
        if (!user) {
            user = new User({
                telegramId: userData.id,
                firstName: userData.first_name || '',
                lastName: userData.last_name || '',
                username: userData.username || '',
                language: userData.language_code === 'ru' ? 'ru' : 'uz',
                registeredAt: new Date(),
            });
        } else {
            user.firstName = userData.first_name || user.firstName;
            user.lastName = userData.last_name || user.lastName;
            user.username = userData.username || user.username;
        }
        user.lastActiveAt = new Date();
        await user.save();

        // JWT yaratish
        const token = jwt.sign(
            { userId: user._id, telegramId: user.telegramId },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            token,
            user: {
                id: user._id,
                telegramId: user.telegramId,
                firstName: user.firstName,
                lastName: user.lastName,
                username: user.username,
                phone: user.phone,
                language: user.language,
                bonusPoints: user.bonusPoints,
                bonusTier: user.bonusTier,
                totalOrders: user.totalOrders,
            },
        });
    } catch (error) {
        next(error);
    }
});

// ─── Dev login (faqat development rejimda ishlaydi) ───
router.post('/dev-login', async (req, res, next) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(404).json({ error: 'Not found' });
    }
    try {
        const telegramId = parseInt(process.env.ADMIN_TELEGRAM_IDS) || 999999999;

        const user = await User.findOneAndUpdate(
            { telegramId },
            { $setOnInsert: { telegramId, firstName: 'Ganniyev', lastName: '', username: 'ganniyev', phone: '' } },
            { upsert: true, new: true }
        );

        const token = jwt.sign(
            { userId: user._id, telegramId: user.telegramId },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            token,
            user: {
                id: user._id,
                telegramId: user.telegramId,
                firstName: user.firstName,
                lastName: user.lastName,
                username: user.username,
                phone: user.phone,
                language: user.language,
                bonusPoints: user.bonusPoints,
                bonusTier: user.bonusTier,
            },
        });
    } catch (error) {
        next(error);
    }
});

// ─── Admin login ───
router.post('/admin/login', async (req, res, next) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Login va parol kiritilmagan' });
        }

        // DB dan qidirish
        let account = await AdminAccount.findOne({ username, isActive: true });

        if (!account) {
            // Legacy env var fallback — birinchi marta kirish yoki super_admin uchun
            const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
            const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin999';
            if (username !== ADMIN_USERNAME) {
                return res.status(401).json({ error: 'Login yoki parol noto\'g\'ri' });
            }
            const isMatch = password === ADMIN_PASSWORD ||
                await bcrypt.compare(password, process.env.ADMIN_PASSWORD_HASH || '');
            if (!isMatch) {
                return res.status(401).json({ error: 'Login yoki parol noto\'g\'ri' });
            }
            // DB ga seed qilish — birinchi kirish
            const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
            account = await AdminAccount.findOneAndUpdate(
                { username },
                { $setOnInsert: { username, passwordHash: hash, role: 'super_admin', fullName: 'Super Admin' } },
                { upsert: true, new: true }
            );
        } else {
            const isMatch = await bcrypt.compare(password, account.passwordHash);
            if (!isMatch) {
                return res.status(401).json({ error: 'Login yoki parol noto\'g\'ri' });
            }
        }

        account.lastLoginAt = new Date();
        await account.save();

        const isSuperAdmin = account.role === 'super_admin';
        const token = jwt.sign(
            { adminId: account._id, username: account.username, isAdmin: true, isSuperAdmin, role: account.role },
            process.env.ADMIN_JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.json({ token, admin: { username: account.username, role: account.role, isSuperAdmin, fullName: account.fullName } });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
