const router = require('express').Router();
const Product = require('../models/Product');
const Stock = require('../models/Stock');
const { buildSearchRegex } = require('../utils/translit');

// ─── Mahsulotlar royxati (search, filter, pagination) ───
router.get('/', async (req, res, next) => {
    try {
        const { search, category, branchId, page = 1, limit = 20, sort = 'name' } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const filter = { isActive: true };

        if (category) filter.category = category;

        // Qidiruv — nom, tarkib, analog (Latin va Kirill)
        if (search) {
            const regex = buildSearchRegex(search);
            filter.$or = [
                { name: regex },
                { ingredient: regex },
                { manufacturer: regex },
                { analogs: regex },
            ];
        }

        let query = Product.find(filter);

        // Sortlash
        if (sort === 'popular') {
            query = query.sort({ updatedAt: -1 });
        } else if (sort === 'price_asc' || sort === 'price_desc') {
            // Narx bo'yicha sort qilish uchun stock bilan aggregate kerak
            query = query.sort({ name: 1 });
        } else {
            query = query.sort({ name: 1 });
        }

        const [products, total] = await Promise.all([
            query.skip(skip).limit(parseInt(limit)).lean(),
            Product.countDocuments(filter),
        ]);

        // Agar branchId berilgan bo'lsa, stock ma'lumotini qo'shish
        if (branchId) {
            const productIds = products.map(p => p._id);
            const stocks = await Stock.find({
                product: { $in: productIds },
                branch: branchId,
            }).lean();

            const stockMap = {};
            stocks.forEach(s => {
                stockMap[s.product.toString()] = { price: s.price, qty: s.qty };
            });

            products.forEach(p => {
                const stock = stockMap[p._id.toString()];
                p.price = stock?.price || 0;
                p.qty = stock?.qty || 0;
                p.inStock = (stock?.qty || 0) > 0;
            });
        } else {
            // Barcha filiallardan eng arzon narx va jami qoldiq
            const productIds = products.map(p => p._id);
            const stockAgg = await Stock.aggregate([
                { $match: { product: { $in: productIds } } },
                {
                    $group: {
                        _id: '$product',
                        minPrice: { $min: '$price' },
                        totalQty: { $sum: '$qty' },
                        branchCount: { $sum: 1 },
                    },
                },
            ]);

            const stockMap = {};
            stockAgg.forEach(s => {
                stockMap[s._id.toString()] = s;
            });

            products.forEach(p => {
                const stock = stockMap[p._id.toString()];
                p.price = stock?.minPrice || 0;
                p.qty = stock?.totalQty || 0;
                p.inStock = (stock?.totalQty || 0) > 0;
                p.branchCount = stock?.branchCount || 0;
            });
        }

        res.json({
            products,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit)),
            },
        });
    } catch (error) {
        next(error);
    }
});

// ─── Mahsulot detail — barcha filial qoldiqlari bilan ───
router.get('/:id', async (req, res, next) => {
    try {
        const product = await Product.findById(req.params.id).lean();
        if (!product) {
            return res.status(404).json({ error: 'Mahsulot topilmadi' });
        }

        // Barcha filiallardagi qoldiq va narx
        const stocks = await Stock.find({ product: product._id })
            .populate('branch', 'number name address isOpen hours')
            .lean();

        product.stocks = stocks.map(s => ({
            branch: s.branch,
            price: s.price,
            qty: s.qty,
            inStock: s.qty > 0,
        }));

        product.minPrice = stocks.length > 0 ? Math.min(...stocks.map(s => s.price)) : 0;
        product.totalQty = stocks.reduce((sum, s) => sum + s.qty, 0);

        res.json(product);
    } catch (error) {
        next(error);
    }
});

// ─── Barcode bo'yicha qidiruv ───
router.get('/barcode/:barcode', async (req, res, next) => {
    try {
        const product = await Product.findOne({ barcode: req.params.barcode }).lean();
        if (!product) {
            return res.status(404).json({ error: 'Mahsulot topilmadi' });
        }

        const stocks = await Stock.find({ product: product._id })
            .populate('branch', 'number name isOpen')
            .lean();

        product.stocks = stocks;
        product.minPrice = stocks.length > 0 ? Math.min(...stocks.map(s => s.price)) : 0;

        res.json(product);
    } catch (error) {
        next(error);
    }
});

module.exports = router;
