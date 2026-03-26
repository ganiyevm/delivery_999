const Order = require('../models/Order');
const Branch = require('../models/Branch');
const BonusService = require('./bonus.service');
const telegramService = require('./telegram.service');

// Payme transaction timeout — 12 soat (ms)
const TRANSACTION_TIMEOUT = 12 * 60 * 60 * 1000;

class PaymeService {
    // ─── Auth tekshirish (Basic Auth) ───
    static checkAuth(req) {
        const authHeader = req.headers.authorization || '';
        if (!authHeader.startsWith('Basic ')) return false;
        const encoded = authHeader.replace('Basic ', '');
        const decoded = Buffer.from(encoded, 'base64').toString();
        const [, key] = decoded.split(':');
        return key === process.env.PAYME_SECRET_KEY;
    }

    // ─── JSON-RPC handler ───
    static async handleRequest(req) {
        const { method, params, id } = req.body;
        console.log(`[PAYME] method=${method} | params=${JSON.stringify(params)}`);

        if (!PaymeService.checkAuth(req)) {
            console.error('[PAYME] AUTH FAILED');
            return {
                error: { code: -32504, message: { uz: 'Avtorizatsiya xatosi' } },
                id,
            };
        }

        try {
            switch (method) {
                case 'CheckPerformTransaction':
                    return await PaymeService.checkPerform(params, id);
                case 'CreateTransaction':
                    return await PaymeService.createTransaction(params, id);
                case 'PerformTransaction':
                    return await PaymeService.performTransaction(params, id);
                case 'CancelTransaction':
                    return await PaymeService.cancelTransaction(params, id);
                case 'CheckTransaction':
                    return await PaymeService.checkTransaction(params, id);
                case 'GetStatement':
                    return await PaymeService.getStatement(params, id);
                default:
                    return { error: { code: -32601, message: 'Method not found' }, id };
            }
        } catch (err) {
            console.error(`[PAYME] ${method} exception:`, err.message);
            return { error: { code: -31008, message: 'Internal error' }, id };
        }
    }

    // ─── CheckPerformTransaction ───
    static async checkPerform(params, id) {
        const orderId = params.account?.order_id;
        const order = await Order.findOne({ orderNumber: orderId });

        if (!order) {
            return {
                error: { code: -31050, message: { uz: 'Buyurtma topilmadi' } },
                id,
            };
        }

        if (order.paymentStatus === 'paid') {
            return {
                error: { code: -31051, message: { uz: "Buyurtma allaqachon to'langan" } },
                id,
            };
        }

        if (order.status === 'cancelled') {
            return {
                error: { code: -31099, message: { uz: 'Buyurtma bekor qilingan' } },
                id,
            };
        }

        const amount = params.amount;
        if (amount !== order.total * 100) {
            return {
                error: { code: -31001, message: { uz: "Noto'g'ri summa" } },
                id,
            };
        }

        return { result: { allow: true }, id };
    }

    // ─── CreateTransaction ───
    static async createTransaction(params, id) {
        const orderId = params.account?.order_id;
        const order = await Order.findOne({ orderNumber: orderId });

        if (!order) {
            return {
                error: { code: -31050, message: { uz: 'Buyurtma topilmadi' } },
                id,
            };
        }

        // Summa tekshirish
        if (params.amount !== order.total * 100) {
            return {
                error: { code: -31001, message: { uz: "Noto'g'ri summa" } },
                id,
            };
        }

        // ─── Idempotency: shu Payme trans ID allaqachon yaratilganmi? ───
        if (order.paymeTransId === params.id) {
            // Bir xil tranzaksiya — mavjud ma'lumotni qaytarish
            if (order.paymeState === 1) {
                // Timeout tekshirish
                if (Date.now() - order.paymeCreateTime > TRANSACTION_TIMEOUT) {
                    // Timeout — bekor qilish
                    order.paymeState = -1;
                    order.paymeCancelTime = Date.now();
                    order.paymeReason = 4; // timeout
                    order.paymentStatus = 'failed';
                    await order.save();
                    return {
                        error: { code: -31008, message: { uz: 'Tranzaksiya vaqti o\'tgan' } },
                        id,
                    };
                }
                return {
                    result: {
                        create_time: order.paymeCreateTime,
                        transaction: order._id.toString(),
                        state: order.paymeState,
                    },
                    id,
                };
            }
            // State 2 yoki boshqa — xatolik
            return {
                error: { code: -31008, message: { uz: 'Tranzaksiya yaratib bo\'lmaydi' } },
                id,
            };
        }

        // ─── Boshqa Payme trans allaqachon bormi? ───
        if (order.paymeTransId && order.paymeTransId !== params.id) {
            // Oldingi tranzaksiya timeout bo'lganmi?
            if (order.paymeState === 1 && Date.now() - order.paymeCreateTime > TRANSACTION_TIMEOUT) {
                // Eski tranzaksiyani bekor qilish
                order.paymeState = -1;
                order.paymeCancelTime = Date.now();
                order.paymeReason = 4;
                await order.save();
                // Yangi tranzaksiya yaratishga ruxsat
            } else if (order.paymeState === 1) {
                // Aktiv boshqa tranzaksiya bor
                return {
                    error: { code: -31050, message: { uz: 'Buyurtmada boshqa aktiv tranzaksiya mavjud' } },
                    id,
                };
            }
        }

        if (order.paymentStatus === 'paid') {
            return {
                error: { code: -31051, message: { uz: "Buyurtma allaqachon to'langan" } },
                id,
            };
        }

        if (order.status === 'cancelled') {
            return {
                error: { code: -31099, message: { uz: 'Buyurtma bekor qilingan' } },
                id,
            };
        }

        // Yangi tranzaksiya yaratish
        const createTime = Date.now();
        order.paymeTransId = params.id;
        order.paymeState = 1;
        order.paymeCreateTime = createTime;
        order.paymePerformTime = 0;
        order.paymeCancelTime = 0;
        order.paymentId = params.id;
        await order.save();

        console.log('[PAYME] CreateTransaction OK:', order.orderNumber, 'trans:', params.id);

        return {
            result: {
                create_time: createTime,
                transaction: order._id.toString(),
                state: 1,
            },
            id,
        };
    }

    // ─── PerformTransaction ───
    static async performTransaction(params, id) {
        const order = await Order.findOne({ paymeTransId: params.id });

        if (!order) {
            return {
                error: { code: -31003, message: { uz: 'Tranzaksiya topilmadi' } },
                id,
            };
        }

        // Allaqachon performed
        if (order.paymeState === 2) {
            return {
                result: {
                    perform_time: order.paymePerformTime,
                    transaction: order._id.toString(),
                    state: 2,
                },
                id,
            };
        }

        // Faqat state=1 (created) da perform qilish mumkin
        if (order.paymeState !== 1) {
            return {
                error: { code: -31008, message: { uz: 'Tranzaksiya holatida xato' } },
                id,
            };
        }

        // Timeout tekshirish
        if (Date.now() - order.paymeCreateTime > TRANSACTION_TIMEOUT) {
            order.paymeState = -1;
            order.paymeCancelTime = Date.now();
            order.paymeReason = 4;
            order.paymentStatus = 'failed';
            await order.save();
            return {
                error: { code: -31008, message: { uz: 'Tranzaksiya vaqti o\'tgan' } },
                id,
            };
        }

        // To'lovni tasdiqlash
        const performTime = Date.now();
        order.paymeState = 2;
        order.paymePerformTime = performTime;
        order.paymentStatus = 'paid';
        order.status = 'pending_operator';
        order.statusHistory.push({
            status: 'pending_operator',
            changedBy: 'system',
            note: "Payme orqali to'lov tasdiqlandi",
        });
        await order.save();

        // Bonus ishlatish
        if (order.bonusDiscount > 0) {
            await BonusService.useBonus(order.user, order._id, order.bonusDiscount);
        }

        // Operator va foydalanuvchiga xabar
        const branch = await Branch.findById(order.branch);
        await telegramService.notifyOperator(order, branch);
        await telegramService.notifyUser(order.telegramId, 'pending_operator', order);

        console.log('[PAYME] PerformTransaction OK:', order.orderNumber);

        return {
            result: {
                perform_time: performTime,
                transaction: order._id.toString(),
                state: 2,
            },
            id,
        };
    }

    // ─── CancelTransaction ───
    static async cancelTransaction(params, id) {
        const order = await Order.findOne({ paymeTransId: params.id });

        if (!order) {
            return {
                error: { code: -31003, message: { uz: 'Tranzaksiya topilmadi' } },
                id,
            };
        }

        // Allaqachon cancelled
        if (order.paymeState === -1 || order.paymeState === -2) {
            return {
                result: {
                    cancel_time: order.paymeCancelTime,
                    transaction: order._id.toString(),
                    state: order.paymeState,
                },
                id,
            };
        }

        const cancelTime = Date.now();

        if (order.paymeState === 1) {
            // Created, hali perform qilinmagan — oddiy bekor qilish
            order.paymeState = -1;
            order.paymeCancelTime = cancelTime;
            order.paymeReason = params.reason;
            order.paymentStatus = 'failed';
            order.status = 'cancelled';
            order.statusHistory.push({
                status: 'cancelled',
                changedBy: 'system',
                note: `Payme CancelTransaction (before perform): reason=${params.reason || ''}`,
            });
            await order.save();
        } else if (order.paymeState === 2) {
            // Performed — refund
            order.paymeState = -2;
            order.paymeCancelTime = cancelTime;
            order.paymeReason = params.reason;
            order.paymentStatus = 'refunded';
            order.status = 'cancelled';
            order.statusHistory.push({
                status: 'cancelled',
                changedBy: 'system',
                note: `Payme CancelTransaction (after perform / refund): reason=${params.reason || ''}`,
            });
            await order.save();

            // Bonus qaytarish
            try {
                await BonusService.refundBonus(order);
            } catch (e) {
                console.error('[PAYME] Bonus refund error:', e.message);
            }
        } else {
            return {
                error: { code: -31007, message: { uz: 'Tranzaksiyani bekor qilib bo\'lmaydi' } },
                id,
            };
        }

        console.log('[PAYME] CancelTransaction OK:', order.orderNumber, 'state:', order.paymeState);

        return {
            result: {
                cancel_time: cancelTime,
                transaction: order._id.toString(),
                state: order.paymeState,
            },
            id,
        };
    }

    // ─── CheckTransaction ───
    static async checkTransaction(params, id) {
        const order = await Order.findOne({ paymeTransId: params.id });

        if (!order) {
            return {
                error: { code: -31003, message: { uz: 'Tranzaksiya topilmadi' } },
                id,
            };
        }

        return {
            result: {
                create_time: order.paymeCreateTime,
                perform_time: order.paymePerformTime,
                cancel_time: order.paymeCancelTime,
                transaction: order._id.toString(),
                state: order.paymeState,
                reason: order.paymeReason ?? null,
            },
            id,
        };
    }

    // ─── GetStatement ───
    static async getStatement(params, id) {
        const from = params.from;
        const to = params.to;

        const orders = await Order.find({
            paymentMethod: 'payme',
            paymeCreateTime: { $gte: from, $lte: to },
            paymeTransId: { $exists: true, $ne: '' },
        }).lean();

        const transactions = orders.map(o => ({
            id: o.paymeTransId,
            time: o.paymeCreateTime,
            amount: o.total * 100,
            account: { order_id: o.orderNumber },
            create_time: o.paymeCreateTime,
            perform_time: o.paymePerformTime || 0,
            cancel_time: o.paymeCancelTime || 0,
            transaction: o._id.toString(),
            state: o.paymeState,
            reason: o.paymeReason ?? null,
        }));

        return { result: { transactions }, id };
    }
}

module.exports = PaymeService;
