const crypto = require('crypto');
const https = require('https');
const Order = require('../models/Order');
const Branch = require('../models/Branch');
const BonusService = require('./bonus.service');
const telegramService = require('./telegram.service');

// ─── Click Merchant API auth + so'rov (GET/POST) ───
// Auth: merchant_user_id:sha1(timestamp+secret):timestamp
function clickApiRequest(method, path, body = null) {
    return new Promise((resolve) => {
        const merchantUserId = process.env.CLICK_MERCHANT_USER_ID;
        const secretKey = process.env.CLICK_SECRET_KEY;
        const ts = Math.floor(Date.now() / 1000).toString();
        const digest = crypto.createHash('sha1').update(ts + secretKey).digest('hex');

        const payload = body ? JSON.stringify(body) : null;
        const options = {
            hostname: 'api.click.uz',
            path,
            method,
            headers: {
                'Auth': `${merchantUserId}:${digest}:${ts}`,
                'Accept': 'application/json',
                ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
            },
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (c) => { data += c; });
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch { resolve(null); }
            });
        });
        req.on('error', (e) => { console.error('[CLICK API]', method, path, 'error:', e.message); resolve(null); });
        req.setTimeout(12000, () => { req.destroy(); console.error('[CLICK API] TIMEOUT', path); resolve(null); });
        if (payload) req.write(payload);
        req.end();
    });
}

// Telefonni Click formatiga keltirish: faqat raqamlar, 998XXXXXXXXX (12 raqam)
function normalizePhone(raw) {
    let d = String(raw || '').replace(/\D/g, '');
    if (d.length === 9) d = '998' + d;            // 901234567 → 998901234567
    if (d.length === 12 && d.startsWith('998')) return d;
    if (d.length === 13 && d.startsWith('998')) return d.slice(0, 12); // ehtiyot
    return d; // boshqa holatlar — Click o'zi rad etadi
}

/**
 * Click sign formula:
 * prepare:  md5(click_trans_id + service_id + SECRET + merchant_trans_id + ""               + amount + action + sign_time)
 * complete: md5(click_trans_id + service_id + SECRET + merchant_trans_id + merchant_prepare_id + amount + action + sign_time)
 */
function generateSign({ click_trans_id, service_id, merchant_trans_id, merchant_prepare_id = '', amount, action, sign_time }) {
    const str = `${click_trans_id}${service_id}${process.env.CLICK_SECRET_KEY}${merchant_trans_id}${merchant_prepare_id}${amount}${action}${sign_time}`;
    return crypto.createHash('md5').update(str).digest('hex');
}

// Constant-time comparison for hex md5 signatures to avoid timing attacks and
// accidental issues when sign_string is malformed.
function safeCompareHex(a, b) {
    try {
        if (!a || !b) return false;
        const bufA = Buffer.from(String(a), 'hex');
        const bufB = Buffer.from(String(b), 'hex');
        if (bufA.length !== bufB.length) return false;
        return crypto.timingSafeEqual(bufA, bufB);
    } catch (err) {
        return false;
    }
}

class ClickService {
    // ─── Invoice yaratish — foydalanuvchi telefoniga Click ilovasiga push so'rov ───
    // Web-checkout (services/pay) spinner muammosini chetlab o'tadi.
    static async createInvoice(order) {
        if (order.paymentStatus === 'paid') {
            return { ok: true, alreadyPaid: true };
        }

        const phone = normalizePhone(order.phone);
        if (!phone || phone.length !== 12) {
            return { ok: false, error: 'invalid_phone', message: "Telefon raqami noto'g'ri" };
        }

        if (order.clickInvoiceId) {
            const status = await ClickService.getInvoiceStatus(order);
            if (status && status.error_code === 0) {
                const invoiceStatus = Number(status.status ?? status.invoice_status);
                if (invoiceStatus > 0) {
                    if (status.payment_id && !order.paymentId) order.paymentId = String(status.payment_id);
                    await ClickService.confirmPayment(order);
                    return { ok: true, alreadyPaid: true, invoiceId: order.clickInvoiceId };
                }
                if (invoiceStatus === 0) {
                    return { ok: true, existing: true, invoiceId: order.clickInvoiceId };
                }
            }
        }

        const res = await clickApiRequest('POST', '/v2/merchant/invoice/create', {
            service_id: Number(process.env.CLICK_SERVICE_ID),
            amount: order.total,
            phone_number: phone,
            merchant_trans_id: order.orderNumber, // webhook shu orqali Order'ni topadi
        });

        console.log('[CLICK INVOICE CREATE]', order.orderNumber, '→', JSON.stringify(res));

        if (!res) {
            return { ok: false, error: 'unreachable', message: "Click serveriga ulanib bo'lmadi" };
        }
        if (res.error_code === 0 && res.invoice_id) {
            order.clickInvoiceId = String(res.invoice_id);
            await order.save();
            return { ok: true, invoiceId: String(res.invoice_id) };
        }
        // -514: telefon Click foydalanuvchisi emas, va boshqalar
        return {
            ok: false,
            error: 'click_error',
            code: res.error_code,
            message: res.error_note || "Click invoice yaratilmadi",
        };
    }

    // ─── Invoice holatini tekshirish ───
    // invoice_status: <0 xatolik/bekor, 0 yaratilgan/kutilmoqda, >0 to'langan turlari
    static async getInvoiceStatus(order) {
        if (!order.clickInvoiceId) return null;
        const serviceId = process.env.CLICK_SERVICE_ID;
        const res = await clickApiRequest(
            'GET',
            `/v2/merchant/invoice/status/${serviceId}/${order.clickInvoiceId}`
        );
        console.log('[CLICK INVOICE STATUS]', order.clickInvoiceId, '→', JSON.stringify(res));
        return res;
    }

    static async verifyAndConfirmPayment(order, { transId } = {}) {
        if (order.paymentStatus === 'paid') {
            return { paid: true, source: 'db' };
        }

        const serviceId = process.env.CLICK_SERVICE_ID;

        if (order.clickInvoiceId) {
            const inv = await ClickService.getInvoiceStatus(order);
            const invoiceStatus = Number(inv?.status ?? inv?.invoice_status);
            if (inv && inv.error_code === 0 && invoiceStatus > 0) {
                if (inv.payment_id && !order.paymentId) order.paymentId = String(inv.payment_id);
                await ClickService.confirmPayment(order);
                return { paid: true, source: 'click_invoice' };
            }
            if (inv && inv.error_code === 0 && invoiceStatus < 0) {
                return {
                    paid: false,
                    reason: 'cancelled',
                    message: "Click invoice bekor qilingan",
                };
            }
        }

        const knownTransId = order.paymentId || transId;
        if (knownTransId) {
            const byTransId = await clickApiRequest(
                'GET',
                `/v2/merchant/payment/status/${serviceId}/${knownTransId}`
            );
            console.log('[CLICK CHECK] click_trans_id:', knownTransId, '→', JSON.stringify(byTransId));

            if (byTransId && byTransId.error_code === 0 && byTransId.payment_status === 2) {
                if (!order.paymentId) order.paymentId = String(knownTransId);
                await ClickService.confirmPayment(order);
                return { paid: true, source: 'click_api' };
            }

            if (byTransId && byTransId.payment_status !== undefined && byTransId.payment_status !== 2) {
                return {
                    paid: false,
                    reason: 'not_paid',
                    message: "To'lov Click tizimida tasdiqlanmagan",
                };
            }
        }

        const orderDate = new Date(order.createdAt);
        const datesToTry = new Set([
            orderDate.toISOString().slice(0, 10),
            new Date(Date.now() - 86400000).toISOString().slice(0, 10),
            new Date().toISOString().slice(0, 10),
        ]);

        for (const date of datesToTry) {
            const byMti = await clickApiRequest(
                'GET',
                `/v2/merchant/payment/status_by_mti/${serviceId}/${encodeURIComponent(order.orderNumber)}/${date}`
            );
            console.log('[CLICK CHECK] status_by_mti', order.orderNumber, date, '→', JSON.stringify(byMti));

            if (byMti && byMti.error_code === 0 && byMti.payment_status === 2) {
                if (byMti.payment_id) order.paymentId = String(byMti.payment_id);
                await ClickService.confirmPayment(order);
                return { paid: true, source: 'click_mti' };
            }
        }

        return {
            paid: false,
            reason: order.paymentId ? 'not_paid' : 'webhook_pending',
            message: order.paymentId
                ? "To'lov Click tizimida topilmadi"
                : "Click to'lovi hali tasdiqlanmagan",
        };
    }

    // ─── Prepare — Click birinchi so'rov (action=0) ───
    static async prepare(body) {
    // Redact sensitive fields before logging
    const redactedPrepare = { ...body, sign_string: body.sign_string ? '***' : undefined };
    console.log('[CLICK PREPARE] keldi:', JSON.stringify(redactedPrepare));
        try {
            const {
                click_trans_id, service_id,
                merchant_trans_id, amount, action, sign_time, sign_string,
            } = body;

            const expectedSign = generateSign({
                click_trans_id, service_id,
                merchant_trans_id,
                merchant_prepare_id: '',
                amount, action, sign_time,
            });

            const signMatch = safeCompareHex(expectedSign, sign_string);
            console.log('[CLICK PREPARE] expected sign:', expectedSign.slice(0, 6) + '...', '| got:', sign_string ? '***' : 'null', '| match:', signMatch);

            if (!signMatch) {
                console.error('[CLICK PREPARE] SIGN FAILED');
                return { error: -1, error_note: 'SIGN CHECK FAILED', click_trans_id, merchant_trans_id };
            }

            if (parseInt(action) !== 0) {
                return { error: -3, error_note: 'Action not found', click_trans_id, merchant_trans_id };
            }

            const order = await Order.findOne({ orderNumber: merchant_trans_id });
            if (!order) {
                console.error('[CLICK PREPARE] Order topilmadi:', merchant_trans_id);
                return { error: -5, error_note: 'Order not found', click_trans_id, merchant_trans_id };
            }

            if (order.paymentStatus === 'paid') {
                return { error: -4, error_note: 'Already paid', click_trans_id, merchant_trans_id };
            }

            if (parseFloat(amount) !== order.total) {
                console.error('[CLICK PREPARE] Summa mos emas:', amount, '!==', order.total);
                return { error: -2, error_note: 'Incorrect amount', click_trans_id, merchant_trans_id };
            }

            const prepareId = String(Date.now());
            order.paymentId = String(click_trans_id);
            order.clickPrepareId = prepareId;
            await order.save();

            console.log('[CLICK PREPARE] OK. prepareId:', prepareId);

            return {
                error: 0, error_note: 'Success',
                click_trans_id,
                merchant_trans_id,
                merchant_prepare_id: prepareId,
            };
        } catch (err) {
            console.error('[CLICK PREPARE] Exception:', err.message);
            return { error: -9, error_note: 'Internal error' };
        }
    }

    // ─── Complete — Click to'lov tasdiqlandi (action=1) ───
    static async complete(body) {
    const redactedComplete = { ...body, sign_string: body.sign_string ? '***' : undefined };
    console.log('[CLICK COMPLETE] keldi:', JSON.stringify(redactedComplete));
        try {
            const {
                click_trans_id, service_id,
                merchant_trans_id, merchant_prepare_id,
                amount, action, sign_time, sign_string, error,
            } = body;

            const expectedSign = generateSign({
                click_trans_id, service_id,
                merchant_trans_id,
                merchant_prepare_id: merchant_prepare_id || '',
                amount, action, sign_time,
            });

            const signMatch = safeCompareHex(expectedSign, sign_string);
            console.log('[CLICK COMPLETE] expected sign:', expectedSign.slice(0, 6) + '...', '| got:', sign_string ? '***' : 'null', '| match:', signMatch);

            if (!signMatch) {
                console.error('[CLICK COMPLETE] SIGN FAILED');
                return { error: -1, error_note: 'SIGN CHECK FAILED', click_trans_id, merchant_trans_id };
            }

            if (parseInt(action) !== 1) {
                return { error: -3, error_note: 'Action not found', click_trans_id, merchant_trans_id };
            }

            const order = await Order.findOne({ orderNumber: merchant_trans_id });
            if (!order) {
                console.error('[CLICK COMPLETE] Order topilmadi:', merchant_trans_id);
                return { error: -5, error_note: 'Order not found', click_trans_id, merchant_trans_id };
            }

            if (order.paymentStatus === 'paid') {
                return { error: -4, error_note: 'Already paid', click_trans_id, merchant_trans_id };
            }

            // clickPrepareId tekshirish — agar prepare to'g'ri o'tgan bo'lsa
            // Agar order.clickPrepareId bo'sh bo'lsa (prepare log yo'q), sign to'g'ri bo'lsa davom etamiz
            if (order.clickPrepareId && order.clickPrepareId !== String(merchant_prepare_id)) {
                console.error('[CLICK COMPLETE] prepareId mos emas:', order.clickPrepareId, '!==', merchant_prepare_id);
                return { error: -6, error_note: 'Transaction not found (prepare_id mismatch)', click_trans_id, merchant_trans_id };
            }

            if (parseFloat(amount) !== order.total) {
                console.error('[CLICK COMPLETE] Summa mos emas:', amount, '!==', order.total);
                return { error: -2, error_note: 'Incorrect amount', click_trans_id, merchant_trans_id };
            }

            // Click xatolik kodi (foydalanuvchi bekor qildi va h.k.)
            if (parseInt(error) < 0) {
                order.paymentStatus = 'failed';
                await order.save();
                console.log('[CLICK COMPLETE] To\'lov bekor qilindi, error:', error);
                return { error: -9, error_note: 'Payment failed', click_trans_id, merchant_trans_id };
            }

            await ClickService.confirmPayment(order);
            console.log('[CLICK COMPLETE] To\'lov tasdiqlandi:', order.orderNumber);

            return {
                error: 0, error_note: 'Success',
                click_trans_id,
                merchant_trans_id,
                merchant_confirm_id: order._id.toString(),
            };
        } catch (err) {
            console.error('[CLICK COMPLETE] Exception:', err.message);
            return { error: -9, error_note: 'Internal error' };
        }
    }

    // ─── To'lov tasdiqlash ───
    static async confirmPayment(order) {
        const current = await Order.findById(order._id);
        if (!current) return null;

        if (current.paymentStatus === 'paid') {
            if (order.paymentId && !current.paymentId) {
                current.paymentId = order.paymentId;
                await current.save();
            }
            return current;
        }

        // Operator allaqachon tasdiqlagan (awaiting_payment) -> confirmed ga o'tish.
        // Operator hali ko'rmagan (pending_operator) -> pending_operator da qoladi.
        const alreadyApproved = current.status === 'awaiting_payment';
        const status = alreadyApproved ? 'confirmed' : 'pending_operator';
        const now = new Date();
        const setFields = {
            paymentStatus: 'paid',
            status,
            ...(order.paymentId ? { paymentId: order.paymentId } : {}),
        };
        if (alreadyApproved) setFields.confirmedAt = now;

        const updated = await Order.findOneAndUpdate(
            { _id: current._id, paymentStatus: { $ne: 'paid' } },
            {
                $set: setFields,
                $push: {
                    statusHistory: {
                        status,
                        changedBy: 'system',
                        changedAt: now,
                        note: "Click orqali to'lov tasdiqlandi",
                    },
                },
            },
            { new: true }
        );

        if (!updated) return Order.findById(current._id);

        if (updated.bonusDiscount > 0) {
            await BonusService.useBonus(updated.user, updated._id, updated.bonusDiscount);
        }

        const branch = await Branch.findById(updated.branch);

        if (alreadyApproved) {
            // Klientga "tasdiqlandi, kuryer yo'lga chiqadi" xabari
            await telegramService.notifyUser(updated.telegramId, 'confirmed', updated);
            // Operatorga ham xabar — to'lov keldi, yetkazish kerak
            await telegramService.notifyOperator(updated, branch);
        } else {
            // Eski oqim: to'lov avval keldi, operator hali ko'rmagan
            await telegramService.notifyOperator(updated, branch);
            await telegramService.notifyUser(updated.telegramId, 'pending_operator', updated);
        }

        return updated;
    }
}

module.exports = ClickService;
