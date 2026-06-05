const router = require('express').Router();
const Product = require('../models/Product');
const Stock = require('../models/Stock');
const Branch = require('../models/Branch');
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
            // Faqat isSynced=true filiallardan eng arzon narx va jami qoldiq
            const syncedBranches = await Branch.find({ isSynced: true }, '_id').lean();
            const syncedIds = syncedBranches.map(b => b._id);
            const productIds = products.map(p => p._id);
            const stockAgg = await Stock.aggregate([
                { $match: { product: { $in: productIds }, branch: { $in: syncedIds } } },
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
            .populate('branch', 'number name address isOpen hours isSynced')
            .lean();

        product.stocks = stocks.map(s => ({
            branch: s.branch,
            price: s.price,
            qty: s.qty,
            inStock: s.qty > 0,
            batches: (s.batches || []).map(b => ({
                seria: b.seria || '',
                price: b.price,
                qty: b.qty,
                expiryDate: b.expiryDate,
            })),
        }));

        const syncedStocks = stocks.filter(s => s.branch?.isSynced === true && s.qty > 0);
        product.minPrice = syncedStocks.length > 0 ? Math.min(...syncedStocks.map(s => s.price)) : 0;
        product.totalQty = syncedStocks.reduce((sum, s) => sum + s.qty, 0);

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
