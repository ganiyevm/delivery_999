const router = require('express').Router();
const Product = require('../models/Product');
const Stock = require('../models/Stock');
const Branch = require('../models/Branch');
const { buildSearchRegex } = require('../utils/translit');
const cache = require('../utils/cache');

const SYNCED_BRANCHES_TTL = 30_000;  // 30 soniya — branch isSynced kam o'zgaradi
const COUNT_TTL = 60_000;             // 1 daqiqa — total count
const PRODUCT_LIST_TTL = 10_000;      // narx/qoldiq tez yangilanadi, qisqa cache yetarli
const PRODUCT_LIST_FIELDS = [
    'name', 'category', 'manufacturer', 'country',
    'requiresRx', 'imageType', 'imageUrl',
].join(' ');

async function getSyncedBranchIds() {
    const cached = cache.get('synced_branches');
    if (cached) return cached;
    const branches = await Branch.find({ isSynced: true }, '_id').lean();
    const ids = branches.map(b => b._id);
    cache.set('synced_branches', ids, SYNCED_BRANCHES_TTL);
    return ids;
}

// ─── Mahsulotlar royxati (search, filter, pagination) ───
router.get('/', async (req, res, next) => {
    try {
        const { search, category, branchId, page = 1, limit = 20, sort = 'name' } = req.query;
        const parsedPage = Math.max(1, parseInt(page, 10) || 1);
        const parsedLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
        const skip = (parsedPage - 1) * parsedLimit;
        const listCacheKey = `products:${JSON.stringify({
            search: String(search || '').trim().toLowerCase(),
            category: category || '',
            branchId: branchId || '',
            page: parsedPage,
            limit: parsedLimit,
            sort,
        })}`;
        const cachedResponse = cache.get(listCacheKey);
        if (cachedResponse) {
            res.set('X-Cache', 'HIT');
            res.set('Cache-Control', 'public, max-age=5, stale-while-revalidate=15');
            return res.json(cachedResponse);
        }
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

        const listFields = search
            ? `${PRODUCT_LIST_FIELDS} ingredient description`
            : PRODUCT_LIST_FIELDS;
        let query = Product.find(filter).select(listFields);

        // Sortlash
        if (sort === 'popular') {
            query = query.sort({ updatedAt: -1 });
        } else if (sort === 'price_asc' || sort === 'price_desc') {
            // Narx bo'yicha sort qilish uchun stock bilan aggregate kerak
            query = query.sort({ name: 1 });
        } else {
            query = query.sort({ name: 1 });
        }

        const countKey = `count:${JSON.stringify({
            search: String(search || '').trim().toLowerCase(),
            category: category || '',
        })}`;
        let total = cache.get(countKey);
        const [products] = await Promise.all([
            query.skip(skip).limit(parsedLimit).lean(),
            total === null ? Product.countDocuments(filter).then(n => { total = n; cache.set(countKey, n, COUNT_TTL); }) : Promise.resolve(),
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
            const syncedIds = await getSyncedBranchIds();
            const productIds = products.map(p => p._id);
            const stockAgg = await Stock.aggregate([
                { $match: { product: { $in: productIds }, branch: { $in: syncedIds }, qty: { $gt: 0 } } },
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

        const response = {
            products,
            pagination: {
                page: parsedPage,
                limit: parsedLimit,
                total,
                pages: Math.ceil(total / parsedLimit),
            },
        };
        cache.set(listCacheKey, response, PRODUCT_LIST_TTL);
        res.set('X-Cache', 'MISS');
        res.set('Cache-Control', 'public, max-age=5, stale-while-revalidate=15');
        res.json(response);
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
