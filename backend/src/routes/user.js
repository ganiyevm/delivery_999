const router = require('express').Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Product = require('../models/Product');
const BonusTransaction = require('../models/BonusTransaction');

// ─── Profil ───
router.get('/profile', auth, async (req, res) => {
    res.json({
        id: req.user._id,
        telegramId: req.user.telegramId,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        username: req.user.username,
        phone: req.user.phone,
        language: req.user.language,
        bonusPoints: req.user.bonusPoints,
        bonusTier: req.user.bonusTier,
        totalOrders: req.user.totalOrders,
        totalSpent: req.user.totalSpent,
        addresses: req.user.addresses,
        favoritesCount: req.user.favorites.length,
    });
});

router.put('/profile', auth, async (req, res, next) => {
    try {
        const { phone, language, firstName, lastName } = req.body;
        if (phone) req.user.phone = phone;
        if (language) req.user.language = language;
        if (firstName) req.user.firstName = firstName;
        if (lastName) req.user.lastName = lastName;
        await req.user.save();
        res.json({ message: 'Profil yangilandi' });
    } catch (error) {
        next(error);
    }
});

// ─── Sevimlilar ───
router.get('/favorites', auth, async (req, res, next) => {
    try {
        await req.user.populate('favorites');
        res.json(req.user.favorites);
    } catch (error) {
        next(error);
    }
});

router.post('/favorites/:productId', auth, async (req, res, next) => {
    try {
        const productId = req.params.productId;
        if (!req.user.favorites.includes(productId)) {
            req.user.favorites.push(productId);
            await req.user.save();
        }
        res.json({ message: 'Sevimlilarga qo\'shildi' });
    } catch (error) {
        next(error);
    }
});

router.delete('/favorites/:productId', auth, async (req, res, next) => {
    try {
        req.user.favorites = req.user.favorites.filter(
            f => f.toString() !== req.params.productId
        );
        await req.user.save();
        res.json({ message: 'Sevimlilardan o\'chirildi' });
    } catch (error) {
        next(error);
    }
});

// ─── Manzillar ───
router.get('/addresses', auth, async (req, res) => {
    res.json(req.user.addresses);
});

router.post('/addresses', auth, async (req, res, next) => {
    try {
        const { title, address, lat, lng } = req.body;
        req.user.addresses.push({ title, address, lat, lng });
        await req.user.save();
        res.json({ message: 'Manzil qo\'shildi', addresses: req.user.addresses });
    } catch (error) {
        next(error);
    }
});

router.delete('/addresses/:id', auth, async (req, res, next) => {
    try {
        req.user.addresses = req.user.addresses.filter(
            a => a._id.toString() !== req.params.id
        );
        await req.user.save();
        res.json({ message: 'Manzil o\'chirildi' });
    } catch (error) {
        next(error);
    }
});

// ─── Bonus ───
router.get('/bonus', auth, async (req, res, next) => {
    try {
        const transactions = await BonusTransaction.find({ user: req.user._id })
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();

        res.json({
            points: req.user.bonusPoints,
            tier: req.user.bonusTier,
            transactions,
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
