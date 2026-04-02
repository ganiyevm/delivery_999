const router = require('express').Router();
const auth = require('../middleware/auth');
const Order = require('../models/Order');
const Stock = require('../models/Stock');
const Branch = require('../models/Branch');
const { BUSINESS, STATUS_TRANSITIONS } = require('../config/constants');

// ─── Yangi buyurtma yaratish ───
router.post('/', auth, async (req, res, next) => {
    try {
        const {
            items, deliveryType, address, phone,
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

            orderItems.push({
                product: item.productId,
                productName: stock.product.name,
                price: stock.price,
                qty: item.qty,
                branchId,
            });

            subtotal += stock.price * item.qty;
        }

        // Minimal buyurtma tekshirish
        if (subtotal < BUSINESS.MIN_ORDER_AMOUNT) {
            return res.status(400).json({
                error: `Minimal buyurtma: ${BUSINESS.MIN_ORDER_AMOUNT.toLocaleString()} so'm`,
            });
        }

        // Yetkazib berish narxi
        let deliveryCost = 0;
        if (deliveryType === 'delivery') {
            deliveryCost = subtotal >= BUSINESS.FREE_DELIVERY_THRESHOLD
                ? 0
                : BUSINESS.DELIVERY_COST;
        }

        // Bonus chegirma
        let bonusDiscount = 0;
        if (useBonusPoints && req.user.bonusPoints > 0) {
            const maxBonusDiscount = Math.floor(subtotal * BUSINESS.MAX_BONUS_PERCENT / 100);
            bonusDiscount = Math.min(req.user.bonusPoints * BUSINESS.BONUS_PER_SUM, maxBonusDiscount);
        }

        const total = subtotal + deliveryCost - bonusDiscount;

        // Bonus ball hisoblash (delivered da yoziladi)
        const bonusEarned = Math.floor(total / 10000) * BUSINESS.BONUS_RATE;

        // Order yaratish
        const order = new Order({
            user: req.user._id,
            telegramId: req.user.telegramId,
            customerName: customerName || `${req.user.firstName} ${req.user.lastName}`.trim(),
            phone: phone || req.user.phone,
            items: orderItems,
            branch: branchId,
            deliveryType,
            address: deliveryType === 'delivery' ? address : branch.address,
            subtotal,
            deliveryCost,
            bonusDiscount,
            total,
            bonusEarned,
            paymentMethod,
            status: 'awaiting_payment',
            statusHistory: [{
                status: 'awaiting_payment',
                changedBy: 'system',
                note: 'Buyurtma yaratildi',
            }],
            notes,
        });

        await order.save();

        // To'lov URL yaratish
        let paymentUrl = '';
        if (paymentMethod === 'click') {
            paymentUrl = `https://my.click.uz/services/pay?service_id=${process.env.CLICK_SERVICE_ID}&merchant_id=${process.env.CLICK_MERCHANT_ID}&amount=${total}&transaction_param=${order.orderNumber}&merchant_user_id=${process.env.CLICK_MERCHANT_USER_ID}&return_url=${encodeURIComponent(process.env.WEBAPP_URL || process.env.FRONTEND_URL || 'https://t.me/' + process.env.BOT_USERNAME)}`;
        } else if (paymentMethod === 'payme') {
            const paymeData = Buffer.from(
                `m=${process.env.PAYME_MERCHANT_ID};ac.order_id=${order.orderNumber};a=${total * 100};l=uz`
            ).toString('base64');
            paymentUrl = `https://checkout.paycom.uz/${paymeData}`;
        }

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
