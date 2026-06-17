const router = require('express').Router();
const axios = require('axios');
const ClickService = require('../services/click.service');
const PaymeService = require('../services/payme.service');
const Order = require('../models/Order');
const Branch = require('../models/Branch');

// ─── EFES gateway forwarding ───
// Bitta merchant (apteka999) test sifatida ikkala loyiha uchun ishlatiladi.
// merchant_trans_id/order_id prefix orqali EFES backend'ga yo'naltiriladi.
const EFES_BACKEND_URL = process.env.EFES_BACKEND_URL || '';

function getAppBaseUrl() {
    return (process.env.WEBAPP_URL || `https://t.me/${process.env.BOT_USERNAME || ''}`).replace(/\/$/, '');
}

function getBackendBaseUrl() {
    return (process.env.BACKEND_URL || process.env.WEBAPP_URL || '').replace(/\/$/, '');
}

function getPaymentReturnUrl(order, transId = '') {
    const base = getAppBaseUrl();
    const params = new URLSearchParams({ pay: String(order._id) });
    if (transId) params.set('id', transId);
    return `${base}?${params.toString()}`;
}

function getTelegramMiniAppUrl(orderId, transId = '') {
    const username = (process.env.BOT_USERNAME || '').replace(/^@/, '');
    if (!username) return '';

    const payload = ['pay', orderId, transId].filter(Boolean).join('_');
    const shortName = process.env.TELEGRAM_WEBAPP_SHORT_NAME || process.env.TELEGRAM_MINIAPP_SHORT_NAME || '';
    if (shortName) {
        return `https://t.me/${username}/${shortName}?startapp=${encodeURIComponent(payload)}`;
    }
    return `https://t.me/${username}?start=${encodeURIComponent(payload)}`;
}

function getGatewayReturnUrl(order, target = 'webapp') {
    const backendBase = getBackendBaseUrl();
    if (backendBase && !backendBase.startsWith('https://t.me/')) {
        const params = new URLSearchParams({ target });
        return `${backendBase}/api/payment/return/${order._id}?${params.toString()}`;
    }
    return getPaymentReturnUrl(order);
}

async function buildPaymentUrl(order) {
    const returnUrl = getGatewayReturnUrl(order);

    if (order.paymentMethod === 'click') {
        const params = new URLSearchParams({
            service_id: process.env.CLICK_SERVICE_ID,
            merchant_id: process.env.CLICK_MERCHANT_ID,
            amount: String(order.total),
            transaction_param: order.orderNumber,
            merchant_trans_id: order.orderNumber,
            return_url: returnUrl,
        });
        return `https://my.click.uz/services/pay?${params.toString()}`;
    }

    if (order.paymentMethod === 'payme') {
        const branch = await Branch.findById(order.branch).select('paymeMerchantId').lean();
        const merchantId = branch?.paymeMerchantId || process.env.PAYME_MERCHANT_ID;
        const d = Buffer.from(`m=${merchantId};ac.order_id=${order.orderNumber};a=${order.total * 100};l=uz;c=${returnUrl}`).toString('base64');
        return `https://checkout.paycom.uz/${d}`;
    }

    return '';
}

async function forwardToEfes(path, body, originalReq = null) {
    if (!EFES_BACKEND_URL) return null;
    try {
        // Authorization header'ini ham uzatish — Payme webhook auth EFES tomonida tekshiriladi
        const headers = { 'content-type': 'application/json' };
        if (originalReq?.headers?.authorization) {
            headers.authorization = originalReq.headers.authorization;
        }
        const { data } = await axios.post(`${EFES_BACKEND_URL}${path}`, body, {
            headers,
            timeout: 8000,
        });
        return data;
    } catch (err) {
        console.error('[EFES FORWARD]', path, 'error:', err.response?.status, err.message);
        return null;
    }
}

// ─── Click ───
// Click URL validatsiyasi uchun GET handler
router.get('/click/prepare', (req, res) => res.json({ error: 0, error_note: 'OK' }));
router.get('/click/complete', (req, res) => res.json({ error: 0, error_note: 'OK' }));

// Click web checkoutdan qaytish. Avval serverda tekshirib ko'ramiz, keyin Telegram Mini App'ga qaytaramiz.
router.get('/return/:orderId', async (req, res, next) => {
    try {
        const order = await Order.findById(req.params.orderId);
        if (!order) return res.redirect(getAppBaseUrl());

        const transId = req.query.click_trans_id
            || req.query.payment_id
            || req.query.paymentId
            || req.query.transaction_id
            || req.query.id
            || '';

        if (order.paymentMethod === 'click' && transId && order.paymentStatus !== 'paid') {
            try {
                await ClickService.verifyAndConfirmPayment(order, { transId });
            } catch (err) {
                console.error('[CLICK RETURN] verify error:', err.message);
            }
        }

        const fallbackUrl = getPaymentReturnUrl(order, transId ? String(transId) : '');
        if (req.query.target === 'webapp') return res.redirect(fallbackUrl);

        const telegramUrl = getTelegramMiniAppUrl(String(order._id), transId ? String(transId) : '');
        res.redirect(telegramUrl || fallbackUrl);
    } catch (error) {
        next(error);
    }
});

// Tashqi brauzerdan qaytilganda Telegram initData/token bo'lmasligi mumkin.
// Shuning uchun faqat to'lov kutayotgan buyurtma uchun public payment URL.
router.get('/url/:orderId', async (req, res, next) => {
    try {
        const order = await Order.findById(req.params.orderId).lean();
        if (!order) return res.status(404).json({ error: 'Buyurtma topilmadi' });
        if (order.status !== 'awaiting_payment') return res.status(400).json({ error: 'To\'lov kerak emas' });
        if (order.paymentStatus === 'paid') return res.status(400).json({ error: 'Allaqachon to\'langan' });
        if (order.paymentId) return res.status(400).json({ error: 'To\'lov allaqachon boshlangan' });
        if (order.paymentMethod === 'cash') return res.status(400).json({ error: 'Naqd to\'lov' });

        const paymentUrl = await buildPaymentUrl(order);
        res.json({ paymentUrl });
    } catch (error) {
        next(error);
    }
});

router.post('/click/prepare', async (req, res) => {
    if (req.body?.merchant_trans_id?.startsWith('EFES-')) {
        const data = await forwardToEfes('/api/payment/click/prepare', req.body);
        return res.json(data || {
            error: -9,
            error_note: 'EFES backend unreachable',
            click_trans_id: req.body.click_trans_id,
            merchant_trans_id: req.body.merchant_trans_id,
        });
    }
    const result = await ClickService.prepare(req.body);
    res.json(result);
});

router.post('/click/complete', async (req, res) => {
    if (req.body?.merchant_trans_id?.startsWith('EFES-')) {
        const data = await forwardToEfes('/api/payment/click/complete', req.body);
        return res.json(data || {
            error: -9,
            error_note: 'EFES backend unreachable',
            click_trans_id: req.body.click_trans_id,
            merchant_trans_id: req.body.merchant_trans_id,
        });
    }
    const result = await ClickService.complete(req.body);
    res.json(result);
});

// ─── Payme (JSON-RPC) ───
// order_id — CheckPerformTransaction / CreateTransaction'da bo'ladi
// params.id — boshqa metodlarda (transaction ID); apteka999 DB'da topilmasa EFES'ga forward
router.post('/payme', async (req, res) => {
    const orderId = req.body?.params?.account?.order_id;
    const transId = req.body?.params?.id;

    if (orderId && typeof orderId === 'string' && orderId.startsWith('EFES-')) {
        const data = await forwardToEfes('/api/payment/payme', req.body, req);
        if (data) return res.json(data);
    } else if (!orderId && transId && EFES_BACKEND_URL) {
        const existsHere = await Order.exists({ paymeTransId: transId });
        if (!existsHere) {
            const data = await forwardToEfes('/api/payment/payme', req.body, req);
            if (data) return res.json(data);
        }
    }

    const result = await PaymeService.handleRequest(req);
    res.json(result);
});

// ─── Payme (filialga xos kassa) ───
// Har filial Payme kabinetida webhook URL: /api/payment/payme/<branchId>
// Auth shu filial paymeKey'i bilan, buyurtmalar shu filial bilan cheklanadi.
router.post('/payme/:branchId', async (req, res) => {
    const { id } = req.body || {};
    let branch;
    try {
        branch = await Branch.findById(req.params.branchId);
    } catch {
        branch = null;
    }
    if (!branch || !branch.paymeKey) {
        console.error('[PAYME] branch endpoint topilmadi yoki kalit yo\'q:', req.params.branchId);
        return res.json({
            error: { code: -32504, message: { uz: 'Kassa sozlanmagan' } },
            id,
        });
    }
    const result = await PaymeService.handleRequest(req, branch);
    res.json(result);
});

// ─── Click to'lov tekshirish ───
router.get('/click/check/:orderId', async (req, res, next) => {
    try {
        const order = await Order.findById(req.params.orderId);
        if (!order) return res.status(404).json({ error: 'Buyurtma topilmadi' });

        // 1. Bazada allaqachon paid
        if (order.paymentStatus === 'paid') {
            return res.json({ paid: true, source: 'db' });
        }

        const result = await ClickService.verifyAndConfirmPayment(order, { transId: req.query.trans_id });
        res.json(result);

    } catch (error) {
        next(error);
    }
});

// ─── Payme to'lov tekshirish ───
router.get('/payme/check/:orderId', async (req, res, next) => {
    try {
        const order = await Order.findById(req.params.orderId);
        if (!order) return res.status(404).json({ error: 'Buyurtma topilmadi' });

        // 1. Bazada allaqachon paid
        if (order.paymentStatus === 'paid') {
            return res.json({ paid: true, source: 'db' });
        }

        // 2. paymeState = 2 (performed) — lekin paymentStatus yangilanmagan
        if (order.paymeState === 2) {
            return res.json({ paid: true, source: 'payme_state' });
        }

        // 3. Bekor qilingan
        if (order.paymeState === -1 || order.paymeState === -2) {
            return res.json({
                paid: false,
                reason: 'cancelled',
                message: "To'lov bekor qilingan",
            });
        }

        // 4. Tranzaksiya yaratilgan, lekin hali perform qilinmagan
        if (order.paymeState === 1) {
            return res.json({
                paid: false,
                reason: 'pending',
                message: "To'lov kutilmoqda",
            });
        }

        // 5. Hali boshlanmagan
        res.json({
            paid: false,
            reason: 'not_started',
            message: "Payme to'lov boshlanmagan",
        });
    } catch (error) {
        next(error);
    }
});

// ─── To'lov holati (polling uchun) ───
router.get('/status/:orderId', async (req, res, next) => {
    try {
        const order = await Order.findById(req.params.orderId)
            .select('orderNumber status paymentStatus paymentMethod total bonusEarned')
            .lean();

        if (!order) return res.status(404).json({ error: 'Buyurtma topilmadi' });

        res.json({
            orderNumber: order.orderNumber,
            status: order.status,
            paymentStatus: order.paymentStatus,
            paymentMethod: order.paymentMethod,
            total: order.total,
            bonusEarned: order.bonusEarned,
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
