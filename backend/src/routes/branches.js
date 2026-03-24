const router = require('express').Router();
const Branch = require('../models/Branch');
const Product = require('../models/Product');
const Stock = require('../models/Stock');
const { buildSearchRegex } = require('../utils/translit');

// ─── Barcha filiallar ───
router.get('/', async (req, res, next) => {
    try {
        const branches = await Branch.find({
            isActive: true,
            name: { $not: /офис|склад/i },
        })
            .sort({ number: 1 })
            .lean();
        res.json(branches);
    } catch (error) {
        next(error);
    }
});

// ─── Filial detail ───
router.get('/:id', async (req, res, next) => {
    try {
        const branch = await Branch.findById(req.params.id).lean();
        if (!branch) {
            return res.status(404).json({ error: 'Filial topilmadi' });
        }
        res.json(branch);
    } catch (error) {
        next(error);
    }
});

// ─── Filial mahsulotlari ───
router.get('/:id/products', async (req, res, next) => {
    try {
        const { page = 1, limit = 20, search, category } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Birinchi stock dan product ID larni topish
        const stockFilter = { branch: req.params.id, qty: { $gt: 0 } };
        const stocks = await Stock.find(stockFilter).lean();
        const productIds = stocks.map(s => s.product);

        // Product filter
        const productFilter = { _id: { $in: productIds }, isActive: true };
        if (category) productFilter.category = category;
        if (search) {
            productFilter.name = buildSearchRegex(search);
        }

        const [products, total] = await Promise.all([
            Product.find(productFilter).skip(skip).limit(parseInt(limit)).sort({ name: 1 }).lean(),
            Product.countDocuments(productFilter),
        ]);

        // Stock ma'lumotini qo'shish
        const stockMap = {};
        stocks.forEach(s => { stockMap[s.product.toString()] = s; });

        products.forEach(p => {
            const st = stockMap[p._id.toString()];
            p.price = st?.price || 0;
            p.qty = st?.qty || 0;
        });

        res.json({
            products,
            pagination: {
                page: parseInt(page), limit: parseInt(limit),
                total, pages: Math.ceil(total / parseInt(limit)),
            },
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
