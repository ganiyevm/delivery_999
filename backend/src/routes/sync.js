const router = require('express').Router();
const crypto = require('crypto');
const SyncService = require('../services/sync.service');
const OrderDecisionService = require('../services/orderDecision.service');
const Order = require('../models/Order');
const Branch = require('../models/Branch');

function timingSafeEqual(a, b) {
    if (!a || !b) return false;
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ab.length !== bb.length) return false;
    return crypto.timingSafeEqual(ab, bb);
}

function authMiddleware(req, res, next) {
    const expected = process.env.SYNC_API_KEY;
    if (!expected) {
        return res.status(500).json({ error: 'SYNC_API_KEY o\'rnatilmagan' });
    }
    const provided = req.header('x-sync-key') || '';
    if (!timingSafeEqual(provided, expected)) {
        return res.status(401).json({ error: 'Noto\'g\'ri sync key' });
    }
    next();
}

function operatorAuthMiddleware(req, res, next) {
    const expected = process.env.OPERATOR_API_KEY || process.env.SYNC_API_KEY;
    if (!expected) return res.status(500).json({ error: 'OPERATOR_API_KEY o\'rnatilmagan' });
    const provided = req.header('x-operator-key') || req.header('x-sync-key') || '';
    if (!timingSafeEqual(provided, expected)) {
        return res.status(401).json({ error: 'Noto\'g\'ri operator kaliti' });
    }
    next();
}

router.post('/inbound', authMiddleware, (req, res, next) => {
    // Katta chunk upload uchun timeout uzaytiriladi (jprq tunnel sekin bo'lishi mumkin)
    req.setTimeout(120_000);
    res.setTimeout(120_000);
    next();
}, async (req, res, next) => {
    try {
        const { branchNumber, syncStartedAt, chunkIndex, totalChunks, isLast, items } = req.body || {};

        if (typeof branchNumber !== 'number') {
            return res.status(400).json({ error: 'branchNumber kerak (number)' });
        }
        if (!syncStartedAt) {
            return res.status(400).json({ error: 'syncStartedAt kerak (ISO date)' });
        }
        if (!Array.isArray(items)) {
            return res.status(400).json({ error: 'items array bo\'lishi kerak' });
        }
        if (items.length > 2000) {
            return res.status(400).json({ error: 'Chunk juda katta (max 2000)' });
        }

        const result = await SyncService.applyChunk({
            branchNumber,
            syncStartedAt,
            chunkIndex: chunkIndex || 0,
            totalChunks: totalChunks || 1,
            isLast: !!isLast,
            items,
        });

        res.json({ ok: true, ...result });
    } catch (error) {
        next(error);
    }
});

router.get('/health', authMiddleware, (req, res) => {
    res.json({ ok: true, ts: new Date().toISOString() });
});

async function getBranchByNumber(rawNumber) {
    const branchNumber = Number.parseInt(rawNumber, 10);
    if (!Number.isInteger(branchNumber)) throw Object.assign(new Error('Filial raqami noto\'g\'ri'), { statusCode: 400 });
    const branch = await Branch.findOne({ number: branchNumber, isActive: true }).lean();
    if (!branch) throw Object.assign(new Error('Filial topilmadi'), { statusCode: 404 });
    return branch;
}

// Apteka kompyuteridagi desktop operator oynasi uchun yangi buyurtmalar.
router.get('/operator/orders', operatorAuthMiddleware, async (req, res, next) => {
    try {
        const branch = await getBranchByNumber(req.query.branchNumber);
        const orders = await Order.find({ branch: branch._id, status: 'pending_operator' })
            .sort({ createdAt: 1 })
            .limit(30)
            .select('orderNumber customerName phone items deliveryType address apartment entrance floor deliveryDate deliverySlot paymentMethod subtotal deliveryCost bonusDiscount total notes createdAt')
            .lean();
        res.json({
            branch: { number: branch.number, name: branch.name },
            orders,
            serverTime: new Date().toISOString(),
        });
    } catch (error) { next(error); }
});

router.post('/operator/orders/:id/accept', operatorAuthMiddleware, async (req, res, next) => {
    try {
        const branch = await getBranchByNumber(req.body?.branchNumber);
        const order = await OrderDecisionService.acceptOrder({
            orderId: req.params.id,
            branchId: branch._id,
            actor: req.body?.operatorName || `Filial №${branch.number} xodimi`,
            source: 'desktop',
        });
        res.json({ ok: true, status: order.status, orderNumber: order.orderNumber });
    } catch (error) { next(error); }
});

router.post('/operator/orders/:id/reject', operatorAuthMiddleware, async (req, res, next) => {
    try {
        const branch = await getBranchByNumber(req.body?.branchNumber);
        const order = await OrderDecisionService.rejectOrder({
            orderId: req.params.id,
            branchId: branch._id,
            reason: req.body?.reason,
            comment: req.body?.comment,
            actor: req.body?.operatorName || `Filial №${branch.number} xodimi`,
            source: 'desktop',
        });
        res.json({ ok: true, status: order.status, orderNumber: order.orderNumber, phone: order.phone });
    } catch (error) { next(error); }
});

module.exports = router;
