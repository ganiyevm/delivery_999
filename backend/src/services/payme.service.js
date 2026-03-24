const crypto = require('crypto');
const Order = require('../models/Order');
const Branch = require('../models/Branch');
const BonusService = require('./bonus.service');
const telegramService = require('./telegram.service');
const ClickService = require('./click.service');

class PaymeService {
    static checkAuth(req) {
        const authHeader = req.headers.authorization || '';
        const encoded = authHeader.replace('Basic ', '');
        const decoded = Buffer.from(encoded, 'base64').toString();
        const [login, key] = decoded.split(':');
        return key === process.env.PAYME_SECRET_KEY;
    }

    static async handleRequest(req) {
        const { method, params, id } = req.body;

        if (!PaymeService.checkAuth(req)) {
            return {
                error: { code: -32504, message: 'Unauthorized' },
                id,
            };
        }

        switch (method) {
            case 'CheckPerformTransaction':
                return PaymeService.checkPerform(params, id);
            case 'CreateTransaction':
                return PaymeService.createTransaction(params, id);
            case 'PerformTransaction':
                return PaymeService.performTransaction(params, id);
            case 'CancelTransaction':
                return PaymeService.cancelTransaction(params, id);
            case 'CheckTransaction':
                return PaymeService.checkTransaction(params, id);
            case 'GetStatement':
                return PaymeService.getStatement(params, id);
            default:
                return { error: { code: -32601, message: 'Method not found' }, id };
        }
    }

    static async checkPerform(params, id) {
        try {
            const orderId = params.account?.order_id;
            const order = await Order.findOne({ orderNumber: orderId });

            if (!order) {
                return { error: { code: -31050, message: 'Order not found' }, id };
            }

            if (order.paymentStatus === 'paid') {
                return { error: { code: -31051, message: 'Already paid' }, id };
            }

            const amount = params.amount;
            if (amount !== order.total * 100) {
                return { error: { code: -31001, message: 'Invalid amount' }, id };
            }

            return { result: { allow: true }, id };
        } catch (err) {
            return { error: { code: -31008, message: 'Internal error' }, id };
        }
    }

    static async createTransaction(params, id) {
        try {
            const orderId = params.account?.order_id;
            const order = await Order.findOne({ orderNumber: orderId });

            if (!order) {
                return { error: { code: -31050, message: 'Order not found' }, id };
            }

            order.paymentId = params.id;
            await order.save();

            return {
                result: {
                    create_time: Date.now(),
                    transaction: order._id.toString(),
                    state: 1,
                },
                id,
            };
        } catch (err) {
            return { error: { code: -31008, message: 'Internal error' }, id };
        }
    }

    static async performTransaction(params, id) {
        try {
            const order = await Order.findOne({ paymentId: params.id });
            if (!order) {
                return { error: { code: -31050, message: 'Transaction not found' }, id };
            }

            if (order.paymentStatus !== 'paid') {
                // To'lov tasdiqlash
                await ClickService.confirmPayment(order);
            }

            return {
                result: {
                    perform_time: Date.now(),
                    transaction: order._id.toString(),
                    state: 2,
                },
                id,
            };
        } catch (err) {
            return { error: { code: -31008, message: 'Internal error' }, id };
        }
    }

    static async cancelTransaction(params, id) {
        try {
            const order = await Order.findOne({ paymentId: params.id });
            if (!order) {
                return { error: { code: -31050, message: 'Transaction not found' }, id };
            }

            order.paymentStatus = 'refunded';
            order.status = 'cancelled';
            order.statusHistory.push({
                status: 'cancelled',
                changedBy: 'system',
                note: `Payme CancelTransaction: ${params.reason || ''}`,
            });
            await order.save();

            // Bonus qaytarish
            await BonusService.refundBonus(order);

            return {
                result: {
                    cancel_time: Date.now(),
                    transaction: order._id.toString(),
                    state: -2,
                },
                id,
            };
        } catch (err) {
            return { error: { code: -31008, message: 'Internal error' }, id };
        }
    }

    static async checkTransaction(params, id) {
        try {
            const order = await Order.findOne({ paymentId: params.id });
            if (!order) {
                return { error: { code: -31050, message: 'Transaction not found' }, id };
            }

            let state = 1;
            if (order.paymentStatus === 'paid') state = 2;
            if (order.paymentStatus === 'refunded') state = -2;
            if (order.paymentStatus === 'failed') state = -1;

            return {
                result: {
                    create_time: order.createdAt?.getTime() || Date.now(),
                    perform_time: order.paymentStatus === 'paid' ? (order.updatedAt?.getTime() || Date.now()) : 0,
                    cancel_time: order.paymentStatus === 'refunded' ? (order.updatedAt?.getTime() || Date.now()) : 0,
                    transaction: order._id.toString(),
                    state,
                },
                id,
            };
        } catch (err) {
            return { error: { code: -31008, message: 'Internal error' }, id };
        }
    }

    static async getStatement(params, id) {
        try {
            const from = new Date(params.from);
            const to = new Date(params.to);

            const orders = await Order.find({
                paymentMethod: 'payme',
                createdAt: { $gte: from, $lte: to },
                paymentId: { $exists: true, $ne: '' },
            }).lean();

            const transactions = orders.map(o => ({
                id: o.paymentId,
                time: o.createdAt?.getTime() || 0,
                amount: o.total * 100,
                account: { order_id: o.orderNumber },
                create_time: o.createdAt?.getTime() || 0,
                perform_time: o.paymentStatus === 'paid' ? (o.updatedAt?.getTime() || 0) : 0,
                cancel_time: o.paymentStatus === 'refunded' ? (o.updatedAt?.getTime() || 0) : 0,
                transaction: o._id.toString(),
                state: o.paymentStatus === 'paid' ? 2 : o.paymentStatus === 'refunded' ? -2 : 1,
            }));

            return { result: { transactions }, id };
        } catch (err) {
            return { error: { code: -31008, message: 'Internal error' }, id };
        }
    }
}

module.exports = PaymeService;
