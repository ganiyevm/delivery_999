const crypto = require('crypto');
const Order = require('../models/Order');
const Branch = require('../models/Branch');
const BonusService = require('./bonus.service');
const telegramService = require('./telegram.service');

/**
 * Click sign formula:
 * prepare:  md5(click_trans_id + service_id + SECRET + merchant_trans_id + ""               + amount + action + sign_time)
 * complete: md5(click_trans_id + service_id + SECRET + merchant_trans_id + merchant_prepare_id + amount + action + sign_time)
 */
function generateSign({ click_trans_id, service_id, merchant_trans_id, merchant_prepare_id = '', amount, action, sign_time }) {
    const str = `${click_trans_id}${service_id}${process.env.CLICK_SECRET_KEY}${merchant_trans_id}${merchant_prepare_id}${amount}${action}${sign_time}`;
    return crypto.createHash('md5').update(str).digest('hex');
}

class ClickService {
    // ─── Prepare — Click birinchi so'rov (action=0) ───
    static async prepare(body) {
        console.log('[CLICK PREPARE] keldi:', JSON.stringify(body));
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

            console.log('[CLICK PREPARE] expected sign:', expectedSign, '| got:', sign_string, '| match:', expectedSign === sign_string);

            if (expectedSign !== sign_string) {
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
        console.log('[CLICK COMPLETE] keldi:', JSON.stringify(body));
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

            console.log('[CLICK COMPLETE] expected sign:', expectedSign, '| got:', sign_string, '| match:', expectedSign === sign_string);

            if (expectedSign !== sign_string) {
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
        order.paymentStatus = 'paid';
        order.status = 'pending_operator';
        order.statusHistory.push({
            status: 'pending_operator',
            changedBy: 'system',
            note: "Click orqali to'lov tasdiqlandi",
        });
        await order.save();

        if (order.bonusDiscount > 0) {
            await BonusService.useBonus(order.user, order._id, order.bonusDiscount);
        }

        const branch = await Branch.findById(order.branch);
        await telegramService.notifyOperator(order, branch);
        await telegramService.notifyUser(order.telegramId, 'pending_operator', order);
    }
}

module.exports = ClickService;
