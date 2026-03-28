const router = require('express').Router();
const bcrypt = require('bcryptjs');
const adminAuth = require('../middleware/adminAuth');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Stock = require('../models/Stock');
const Branch = require('../models/Branch');
const User = require('../models/User');
const AdminAccount = require('../models/AdminAccount');
const ImportLog = require('../models/ImportLog');
const BonusService = require('../services/bonus.service');
const telegramService = require('../services/telegram.service');
const { STATUS_TRANSITIONS } = require('../config/constants');
const { buildSearchRegex } = require('../utils/translit');
const XLSX = require('xlsx');

router.use(adminAuth);

// ================== BUYURTMALAR ==================

router.get('/orders', async (req, res, next) => {
    try {
        const { status, branch, date, search, page = 1, limit = 20 } = req.query;
        const filter = {};
        if (status) filter.status = status;
        if (branch) filter.branch = branch;
        if (date) {
            const d = new Date(date);
            const next = new Date(d);
            next.setDate(next.getDate() + 1);
            filter.createdAt = { $gte: d, $lt: next };
        }
        if (search) {
            filter.$or = [
                { orderNumber: new RegExp(search, 'i') },
                { phone: new RegExp(search, 'i') },
                { customerName: new RegExp(search, 'i') },
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [orders, total] = await Promise.all([
            Order.find(filter)
                .populate('branch', 'number name')
                .sort({ createdAt: -1 })
                .skip(skip).limit(parseInt(limit)).lean(),
            Order.countDocuments(filter),
        ]);

        res.json({
            orders,
            pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
        });
    } catch (error) { next(error); }
});

// To'lovni qo'lda tasdiqlash (Click webhook localhost ga yetib bormasa)
router.patch('/orders/:id/confirm-payment', async (req, res, next) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ error: 'Buyurtma topilmadi' });
        if (order.paymentStatus === 'paid') return res.json({ message: 'Allaqachon to\'langan' });

        const ClickService = require('../services/click.service');
        await ClickService.confirmPayment(order);
        res.json({ message: 'To\'lov tasdiqlandi', order });
    } catch (error) { next(error); }
});

router.get('/orders/:id', async (req, res, next) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('branch', 'number name address phone')
            .populate('user', 'firstName lastName username phone bonusPoints')
            .lean();
        if (!order) return res.status(404).json({ error: 'Buyurtma topilmadi' });
        res.json(order);
    } catch (error) { next(error); }
});

router.patch('/orders/:id/status', async (req, res, next) => {
    try {
        const { status, note } = req.body;
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ error: 'Buyurtma topilmadi' });

        // Transition tekshirish
        const allowed = STATUS_TRANSITIONS[order.status] || [];
        if (!allowed.includes(status)) {
            return res.status(400).json({
                error: `${order.status} → ${status} o'tish mumkin emas`,
            });
        }

        order.status = status;
        order.statusHistory.push({
            status,
            changedBy: 'operator',
            changedAt: new Date(),
            note: note || '',
        });

        if (status === 'confirmed') {
            order.confirmedAt = new Date();
            // Stock dan ayirish
            for (const item of order.items) {
                await Stock.findOneAndUpdate(
                    { product: item.product, branch: order.branch },
                    { $inc: { qty: -item.qty } }
                );
            }
        }

        if (status === 'on_the_way') {
            order.dispatchedAt = new Date();
        }

        if (status === 'delivered') {
            order.deliveredAt = new Date();
            await BonusService.earnBonus(order);
        }

        if (status === 'rejected') {
            order.paymentStatus = 'refunded';
            await BonusService.refundBonus(order);
        }

        await order.save();

        // Mijozga bildirishnoma
        await telegramService.notifyUser(order.telegramId, status, order);

        res.json({ message: `Status ${status} ga o'zgartirildi`, order });
    } catch (error) { next(error); }
});

// Excel export
router.get('/orders/export', async (req, res, next) => {
    try {
        const orders = await Order.find()
            .populate('branch', 'number name')
            .sort({ createdAt: -1 })
            .limit(1000)
            .lean();

        const data = orders.map(o => ({
            'Order #': o.orderNumber,
            'Mijoz': o.customerName,
            'Telefon': o.phone,
            'Filial': o.branch?.name || '',
            'Summa': o.total,
            'Status': o.status,
            "To'lov": o.paymentMethod,
            'Sana': o.createdAt?.toISOString().split('T')[0],
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Buyurtmalar');
        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=orders.xlsx');
        res.send(buf);
    } catch (error) { next(error); }
});

// ================== MAHSULOTLAR ==================

router.get('/products', async (req, res, next) => {
    try {
        const { search, category, page = 1, limit = 20 } = req.query;
        const filter = {};
        if (category) filter.category = category;
        if (search) filter.name = buildSearchRegex(search);
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [products, total] = await Promise.all([
            Product.find(filter).sort({ name: 1 }).skip(skip).limit(parseInt(limit)).lean(),
            Product.countDocuments(filter),
        ]);

        // Stock count qo'shish
        const productIds = products.map(p => p._id);
        const stockCounts = await Stock.aggregate([
            { $match: { product: { $in: productIds } } },
            { $group: { _id: '$product', branchCount: { $sum: 1 }, totalQty: { $sum: '$qty' } } },
        ]);
        const stockMap = {};
        stockCounts.forEach(s => { stockMap[s._id.toString()] = s; });
        products.forEach(p => {
            p.branchCount = stockMap[p._id.toString()]?.branchCount || 0;
            p.totalQty = stockMap[p._id.toString()]?.totalQty || 0;
        });

        res.json({ products, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) } });
    } catch (error) { next(error); }
});

router.post('/products', async (req, res, next) => {
    try {
        const product = await Product.create(req.body);
        res.status(201).json(product);
    } catch (error) { next(error); }
});

router.put('/products/:id', async (req, res, next) => {
    try {
        const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!product) return res.status(404).json({ error: 'Mahsulot topilmadi' });
        res.json(product);
    } catch (error) { next(error); }
});

router.delete('/products/:id', async (req, res, next) => {
    try {
        await Product.findByIdAndDelete(req.params.id);
        await Stock.deleteMany({ product: req.params.id });
        res.json({ message: "O'chirildi" });
    } catch (error) { next(error); }
});

// ─── Narxlarni ko'rish (filiallar bo'yicha) ───
router.get('/products/:id/prices', async (req, res, next) => {
    try {
        const stocks = await Stock.find({ product: req.params.id })
            .populate('branch', 'number name')
            .lean();
        res.json(stocks);
    } catch (error) { next(error); }
});

// ─── Narxni yangilash — faqat super admin ───
router.put('/products/:id/prices', async (req, res, next) => {
    try {
        if (!req.isSuperAdmin) {
            return res.status(403).json({ error: 'Faqat super admin narxni o\'zgartira oladi' });
        }
        const { prices } = req.body; // [{ stockId, price }]
        if (!Array.isArray(prices)) return res.status(400).json({ error: 'prices array kerak' });

        await Promise.all(prices.map(({ stockId, price }) =>
            Stock.findByIdAndUpdate(stockId, { price: parseFloat(price) })
        ));
        res.json({ message: 'Narxlar yangilandi' });
    } catch (error) { next(error); }
});

router.patch('/products/:id/toggle', async (req, res, next) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ error: 'Topilmadi' });
        product.isActive = !product.isActive;
        await product.save();
        res.json({ isActive: product.isActive });
    } catch (error) { next(error); }
});

// ================== FILIALLAR ==================

router.get('/branches', async (req, res, next) => {
    try {
        const branches = await Branch.find().sort({ number: 1 }).lean();
        res.json(branches);
    } catch (error) { next(error); }
});

// Yangi filial qo'shish (admin yoki super_admin)
router.post('/branches', async (req, res, next) => {
    try {
        if (!req.isSuperAdmin && req.adminRole !== 'admin') {
            return res.status(403).json({ error: 'Ruxsat yo\'q' });
        }
        const { number, name, address, phone, hours, location } = req.body;
        if (!number || !name) return res.status(400).json({ error: 'Raqam va nomi majburiy' });
        const exists = await Branch.findOne({ number });
        if (exists) return res.status(400).json({ error: `№${number} raqamli filial mavjud` });
        const branch = await Branch.create({ number, name, address, phone, hours, location, isOpen: true });
        res.status(201).json(branch);
    } catch (error) { next(error); }
});

router.put('/branches/:id', async (req, res, next) => {
    try {
        const { location, ...rest } = req.body;
        const update = { ...rest };
        if (location) update.location = location;
        const branch = await Branch.findByIdAndUpdate(req.params.id, update, { new: true });
        if (!branch) return res.status(404).json({ error: 'Topilmadi' });
        res.json(branch);
    } catch (error) { next(error); }
});

router.patch('/branches/:id/toggle', async (req, res, next) => {
    try {
        const branch = await Branch.findById(req.params.id);
        if (!branch) return res.status(404).json({ error: 'Topilmadi' });
        branch.isOpen = !branch.isOpen;
        await branch.save();
        res.json({ isOpen: branch.isOpen });
    } catch (error) { next(error); }
});

// Filialni o'chirish (admin yoki super_admin)
router.delete('/branches/:id', async (req, res, next) => {
    try {
        if (!req.isSuperAdmin && req.adminRole !== 'admin') {
            return res.status(403).json({ error: 'Ruxsat yo\'q' });
        }
        await Branch.findByIdAndDelete(req.params.id);
        res.json({ message: 'O\'chirildi' });
    } catch (error) { next(error); }
});

// ================== FOYDALANUVCHILAR ==================

router.get('/users', async (req, res, next) => {
    try {
        const { search, tier, page = 1, limit = 20 } = req.query;
        const filter = {};
        if (tier) filter.bonusTier = tier;
        if (search) {
            filter.$or = [
                { firstName: new RegExp(search, 'i') },
                { lastName: new RegExp(search, 'i') },
                { phone: new RegExp(search, 'i') },
                { username: new RegExp(search, 'i') },
            ];
        }
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [users, total] = await Promise.all([
            User.find(filter).sort({ registeredAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
            User.countDocuments(filter),
        ]);
        res.json({ users, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) } });
    } catch (error) { next(error); }
});

router.get('/users/:id', async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id).lean();
        if (!user) return res.status(404).json({ error: 'Topilmadi' });
        const orders = await Order.find({ user: user._id }).sort({ createdAt: -1 }).limit(20).lean();
        res.json({ user, orders });
    } catch (error) { next(error); }
});

router.patch('/users/:id/block', async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ error: 'Topilmadi' });
        user.isBlocked = !user.isBlocked;
        await user.save();
        res.json({ isBlocked: user.isBlocked });
    } catch (error) { next(error); }
});

router.post('/users/:id/bonus', async (req, res, next) => {
    try {
        const { points, description } = req.body;
        const balance = await BonusService.addPromoBonus(req.params.id, points, description);
        res.json({ message: `+${points} ball qo'shildi`, balance });
    } catch (error) { next(error); }
});

// ================== ADMIN ACCOUNTLAR (faqat super_admin) ==================

const superOnly = (req, res, next) => {
    if (!req.isSuperAdmin) return res.status(403).json({ error: 'Faqat super admin' });
    next();
};

router.get('/accounts', superOnly, async (req, res, next) => {
    try {
        const accounts = await AdminAccount.find().select('-passwordHash').sort({ createdAt: -1 }).lean();
        res.json(accounts);
    } catch (e) { next(e); }
});

router.post('/accounts', superOnly, async (req, res, next) => {
    try {
        const { username, password, role, fullName } = req.body;
        if (!username || !password || !role) return res.status(400).json({ error: 'username, password, role kerak' });
        const existing = await AdminAccount.findOne({ username });
        if (existing) return res.status(400).json({ error: 'Bu login band' });
        const passwordHash = await bcrypt.hash(password, 10);
        const account = await AdminAccount.create({
            username, passwordHash, role, fullName: fullName || '',
            createdBy: req.adminUsername || 'super_admin',
        });
        res.status(201).json({ _id: account._id, username: account.username, role: account.role, fullName: account.fullName, isActive: account.isActive });
    } catch (e) { next(e); }
});

router.put('/accounts/:id', superOnly, async (req, res, next) => {
    try {
        const { password, role, fullName, isActive } = req.body;
        const update = {};
        if (role) update.role = role;
        if (fullName !== undefined) update.fullName = fullName;
        if (isActive !== undefined) update.isActive = isActive;
        if (password) update.passwordHash = await bcrypt.hash(password, 10);
        const account = await AdminAccount.findByIdAndUpdate(req.params.id, update, { new: true }).select('-passwordHash');
        if (!account) return res.status(404).json({ error: 'Topilmadi' });
        res.json(account);
    } catch (e) { next(e); }
});

router.delete('/accounts/:id', superOnly, async (req, res, next) => {
    try {
        const account = await AdminAccount.findById(req.params.id);
        if (!account) return res.status(404).json({ error: 'Topilmadi' });
        if (account.role === 'super_admin') return res.status(400).json({ error: 'Super adminni o\'chirib bo\'lmaydi' });
        await AdminAccount.findByIdAndDelete(req.params.id);
        res.json({ message: 'O\'chirildi' });
    } catch (e) { next(e); }
});

// ================== IMPORT LOG O'CHIRISH (faqat super_admin) ==================

router.delete('/import-logs/:id', superOnly, async (req, res, next) => {
    try {
        await ImportLog.findByIdAndDelete(req.params.id);
        res.json({ message: 'O\'chirildi' });
    } catch (e) { next(e); }
});

module.exports = router;
