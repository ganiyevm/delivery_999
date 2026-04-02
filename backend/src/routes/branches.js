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

// ─── Savat mahsulotlari bor filiallarni tekshirish ───
// POST /api/branches/check-stock
// Body: { items: [{ productId, qty }] }
// Qaytaradi: { availableBranchIds: [...] }
router.post('/check-stock', async (req, res, next) => {
    try {
        const { items } = req.body;
        if (!items?.length) return res.json({ availableBranchIds: [] });

        // Barcha ochiq filiallar
        const branches = await Branch.find({ isActive: true }).select('_id').lean();
        const branchIds = branches.map(b => b._id);

        // Har bir mahsulot uchun stock ni topish
        const productIds = items.map(i => i.productId);
        const stocks = await Stock.find({
            product: { $in: productIds },
            branch:  { $in: branchIds },
        }).select('product branch qty').lean();

        // branch → product → qty mapping
        const map = {}; // map[branchId][productId] = qty
        stocks.forEach(s => {
            const bid = s.branch.toString();
            const pid = s.product.toString();
            if (!map[bid]) map[bid] = {};
            map[bid][pid] = s.qty;
        });

        // Har bir filialda hamma mahsulot yetarlimi?
        const availableBranchIds = branchIds.filter(bid => {
            const branchStock = map[bid.toString()] || {};
            return items.every(item =>
                (branchStock[item.productId] || 0) >= item.qty
            );
        });

        res.json({ availableBranchIds: availableBranchIds.map(id => id.toString()) });
    } catch (error) { next(error); }
});

module.exports = router;
