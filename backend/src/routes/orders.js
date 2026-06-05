const router = require('express').Router();
const auth = require('../middleware/auth');
const Order = require('../models/Order');
const Stock = require('../models/Stock');
const Branch = require('../models/Branch');
const { BUSINESS, STATUS_TRANSITIONS } = require('../config/constants');
const telegramService = require('../services/telegram.service');

// ─── Yangi buyurtma yaratish ───
router.post('/', auth, async (req, res, next) => {
    try {
        const {
            items, deliveryType, address, apartment, entrance, floor, yandexDropType,
            deliveryDate, deliverySlot, phone,
            customerName, branchId, paymentMethod,
            useBonusPoints, notes,
        } = req.body;

        if (!items || items.length === 0) {
            return res.status(400).json({ error: 'Savat bo\'sh' });
        }

        // Branch tekshirish
        const branch = await Branch.findById(branchId);
        if (!branch || !branch.isOpen) {
            return res.status(400).json({ error: 'Filial topilmadi yoki yopiq' });
        }

        // Stock va narxlarni server da tekshirish
        let subtotal = 0;
        const orderItems = [];

        for (const item of items) {
            const stock = await Stock.findOne({
                product: item.productId,
                branch: branchId,
            }).populate('product', 'name');

            if (!stock || stock.qty < item.qty) {
                return res.status(400).json({
                    error: `${stock?.product?.name || 'Mahsulot'} yetarli emas (qoldiq: ${stock?.qty || 0})`,
                });
            }

            // Arzonidan boshlab batch taqsimlash
            const sortedBatches = [...(stock.batches || [])].sort((a, b) => (a.price || 0) - (b.price || 0));
            const breakdown = [];
            let remaining = item.qty;
            for (const b of sortedBatches) {
                if (remaining <= 0) break;
                const take = Math.min(remaining, b.qty || 0);
                if (take > 0) {
                    breakdown.push({ seria: b.seria || '', price: b.price, qty: take });
                    remaining -= take;
                }
            }
            const itemTotal = breakdown.length > 0
                ? breakdown.reduce((s, b) => s + b.price * b.qty, 0)
                : stock.price * item.qty;

            orderItems.push({
                product: item.productId,
                productName: stock.product.name,
                price: stock.price,
                qty: item.qty,
                branchId,
                batches: breakdown,
            });

            subtotal += itemTotal;
        }

        // Minimal buyurtma tekshirish
        if (subtotal < BUSINESS.MIN_ORDER_AMOUNT) {
            return res.status(400).json({
                error: `Minimal buyurtma: ${BUSINESS.MIN_ORDER_AMOUNT.toLocaleString()} so'm`,
            });
        }

        // Yetkazib berish narxi
        // yandex: narx Yandex tomonidan alohida olinadi — bizda 0
        // delivery: hozircha o'chirilgan (keyinchalik)
        let deliveryCost = 0;

        // Bonus chegirma
        let bonusDiscount = 0;
        if (useBonusPoints && req.user.bonusPoints > 0) {
            const maxBonusDiscount = Math.floor(subtotal * BUSINESS.MAX_BONUS_PERCENT / 100);
            bonusDiscount = Math.min(req.user.bonusPoints * BUSINESS.BONUS_PER_SUM, maxBonusDiscount);
        }

        const total = subtotal + deliveryCost - bonusDiscount;

        // Bonus ball hisoblash (delivered da yoziladi)
        const bonusEarned = Math.floor(total / 10000) * BUSINESS.BONUS_RATE;

        // Barcha buyurtmalar avval operator tasdiqlashini kutadi, keyin klient to'laydi
        const initialStatus = 'pending_operator';

        // Order yaratish
        const order = new Order({
            user: req.user._id,
            telegramId: req.user.telegramId,
            customerName: customerName || `${req.user.firstName} ${req.user.lastName}`.trim(),
            phone: phone || req.user.phone,
            items: orderItems,
            branch: branchId,
            deliveryType,
            address: deliveryType !== 'pickup' ? address : branch.address,
            apartment: apartment || '',
            entrance: entrance || '',
            floor: floor || '',
            yandexDropType: yandexDropType || 'door',
            deliveryDate: deliveryDate || '',
            deliverySlot: deliverySlot || '',
            subtotal,
            deliveryCost,
            bonusDiscount,
            total,
            bonusEarned,
            paymentMethod,
            status: initialStatus,
            statusHistory: [{
                status: 'pending_operator',
                changedBy: 'system',
                note: paymentMethod === 'cash' ? 'Aptekada to\'lov — naqd' : 'Buyurtma yaratildi',
            }],
            notes,
        });

        await order.save();

        // Operatorga bot orqali xabar yuborish
        telegramService.notifyOperator(order, branch).catch(e =>
            console.error('[order] notifyOperator xato:', e.message)
        );

        // To'lov URL operator tasdiqlagandan keyin klientga bot orqali yuboriladi
        const paymentUrl = '';

        res.status(201).json({
            order: {
                id: order._id,
                orderNumber: order.orderNumber,
                total: order.total,
                status: order.status,
            },
            paymentUrl,
        });
    } catch (error) {
        next(error);
    }
});

// ─── Mening buyurtmalarim ───
router.get('/my', auth, async (req, res, next) => {
    try {
        const orders = await Order.find({ user: req.user._id })
            .populate('branch', 'number name address phone')
            .populate('items.product', 'name')
            .sort({ createdAt: -1 })
            .lean();

        res.json(orders);
    } catch (error) {
        next(error);
    }
});

// ─── Buyurtma detail ───
router.get('/:id', auth, async (req, res, next) => {
    try {
        const order = await Order.findOne({ _id: req.params.id, user: req.user._id })
            .populate('branch', 'number name address phone')
            .populate('items.product', 'name imageType category')
            .lean();

        if (!order) {
            return res.status(404).json({ error: 'Buyurtma topilmadi' });
        }

        res.json(order);
    } catch (error) {
        next(error);
    }
});

// ─── Buyurtmani bekor qilish (faqat awaiting_payment da) ───
router.post('/:id/cancel', auth, async (req, res, next) => {
    try {
        const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
        if (!order) {
            return res.status(404).json({ error: 'Buyurtma topilmadi' });
        }

        if (order.status !== 'awaiting_payment') {
            return res.status(400).json({ error: 'Bu buyurtmani bekor qilib bo\'lmaydi' });
        }

        order.status = 'cancelled';
        order.statusHistory.push({
            status: 'cancelled',
            changedBy: 'user',
            note: 'Mijoz tomonidan bekor qilindi',
        });
        await order.save();

        res.json({ message: 'Buyurtma bekor qilindi', order });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
