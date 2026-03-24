const router = require('express').Router();
const crypto = require('crypto');
const https = require('https');
const ClickService = require('../services/click.service');
const PaymeService = require('../services/payme.service');
const Order = require('../models/Order');

// Click API ga GET so'rov — har qanday path uchun
function clickApiGet(path) {
    return new Promise((resolve) => {
        const merchantId = process.env.CLICK_MERCHANT_USER_ID;
        const secretKey  = process.env.CLICK_SECRET_KEY;
        const timestamp  = Math.floor(Date.now() / 1000).toString();
        const digest     = crypto.createHash('sha1').update(timestamp + secretKey).digest('hex');

        const options = {
            hostname: 'api.click.uz',
            path,
            method: 'GET',
            headers: {
                'Auth': `${merchantId}:${digest}:${timestamp}`,
                'Accept': 'application/json',
            },
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch { resolve(null); }
            });
        });
        req.on('error', () => resolve(null));
        req.setTimeout(5000, () => { req.destroy(); resolve(null); });
        req.end();
    });
}

// ─── Click ───
// Click URL validatsiyasi uchun GET handler
router.get('/click/prepare', (req, res) => res.json({ error: 0, error_note: 'OK' }));
router.get('/click/complete', (req, res) => res.json({ error: 0, error_note: 'OK' }));

router.post('/click/prepare', async (req, res) => {
    const result = await ClickService.prepare(req.body);
    res.json(result);
});

router.post('/click/complete', async (req, res) => {
    const result = await ClickService.complete(req.body);
    res.json(result);
});

// ─── Payme (JSON-RPC) ───
router.post('/payme', async (req, res) => {
    const result = await PaymeService.handleRequest(req);
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

        const serviceId = process.env.CLICK_SERVICE_ID;

        // 2. click_trans_id bor bo'lsa (prepare webhook kelgan) — u orqali tekshiramiz
        if (order.paymentId) {
            const byTransId = await clickApiGet(
                `/v2/merchant/payment/status/${serviceId}/${order.paymentId}`
            );
            console.log('[CLICK CHECK] click_trans_id:', order.paymentId, '→', JSON.stringify(byTransId));

            if (byTransId && byTransId.error_code === 0 && byTransId.payment_status === 2) {
                await ClickService.confirmPayment(order);
                return res.json({ paid: true, source: 'click_api' });
            }

            if (byTransId && byTransId.payment_status !== undefined && byTransId.payment_status !== 2) {
                return res.json({
                    paid: false,
                    reason: 'not_paid',
                    message: "To'lov Click tizimida tasdiqlanmagan",
                });
            }
        }

        // 3. merchant_trans_id (orderNumber) orqali ham tekshiramiz
        const byOrderNum = await clickApiGet(
            `/v2/merchant/payment/status/${serviceId}/${encodeURIComponent(order.orderNumber)}`
        );
        console.log('[CLICK CHECK] orderNumber:', order.orderNumber, '→', JSON.stringify(byOrderNum));

        if (byOrderNum && byOrderNum.error_code === 0 && byOrderNum.payment_status === 2) {
            await ClickService.confirmPayment(order);
            return res.json({ paid: true, source: 'click_api' });
        }

        // 4. Webhook kelmagan (Click kabineti sozlanmagan)
        if (!order.paymentId) {
            return res.json({
                paid: false,
                reason: 'webhook_pending',
                message: "Click webhook hali sozlanmagan — to'lov avtomatik tasdiqlanmaydi",
            });
        }

        // 5. To'lov topilmadi
        res.json({
            paid: false,
            reason: 'not_paid',
            message: "To'lov Click tizimida topilmadi",
        });

    } catch (error) {
        next(error);
    }
});

// ─── To'lov holati (polling uchun) ───
router.get('/status/:orderId', async (req, res, next) => {
    try {
        const order = await Order.findById(req.params.orderId)
            .select('orderNumber status paymentStatus total bonusEarned')
            .lean();

        if (!order) return res.status(404).json({ error: 'Buyurtma topilmadi' });

        res.json({
            orderNumber: order.orderNumber,
            status: order.status,
            paymentStatus: order.paymentStatus,
            total: order.total,
            bonusEarned: order.bonusEarned,
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
