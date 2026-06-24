const Order = require('../models/Order');
const Stock = require('../models/Stock');
const BonusService = require('./bonus.service');
const telegramService = require('./telegram.service');

function httpError(statusCode, message) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function actorNote(actor, source) {
    const cleanActor = String(actor || 'Xodim').trim().slice(0, 80);
    const cleanSource = String(source || 'operator').trim().slice(0, 40);
    return `${cleanActor} (${cleanSource})`;
}

async function acceptOrder({ orderId, branchId, actor, source = 'operator' }) {
    const existing = await Order.findOne({ _id: orderId, branch: branchId });
    if (!existing) throw httpError(404, 'Buyurtma topilmadi');
    if (existing.status !== 'pending_operator' || existing.stockReservedAt) {
        throw httpError(409, 'Buyurtma allaqachon ko\'rib chiqilgan');
    }

    const now = new Date();
    const status = existing.paymentMethod === 'cash' ? 'confirmed' : 'awaiting_payment';
    const changedBy = actorNote(actor, source);
    const claimed = await Order.findOneAndUpdate(
        {
            _id: orderId,
            branch: branchId,
            status: 'pending_operator',
            stockReservedAt: null,
        },
        {
            $set: {
                status,
                stockReservedAt: now,
                stockReservedBy: changedBy,
                operatorSource: source,
                ...(status === 'confirmed' ? { confirmedAt: now } : {}),
            },
            $push: {
                statusHistory: {
                    status,
                    changedBy: 'operator',
                    changedAt: now,
                    note: `Qabul qilindi — ${changedBy}`,
                },
            },
        },
        { new: true }
    );
    if (!claimed) throw httpError(409, 'Buyurtma allaqachon ko\'rib chiqilgan');

    const adjusted = [];
    try {
        for (const item of claimed.items) {
            const stock = await Stock.findOneAndUpdate(
                { product: item.product, branch: branchId, qty: { $gte: item.qty } },
                { $inc: { qty: -item.qty } },
                { new: true }
            );
            if (!stock) throw httpError(409, `${item.productName} uchun qoldiq yetarli emas`);
            adjusted.push(item);
        }
    } catch (error) {
        for (const item of adjusted) {
            await Stock.updateOne(
                { product: item.product, branch: branchId },
                { $inc: { qty: item.qty } }
            );
        }
        await Order.updateOne(
            { _id: claimed._id, stockReservedAt: now },
            {
                $set: { status: 'pending_operator', operatorSource: '' },
                $unset: { stockReservedAt: 1, stockReservedBy: 1, confirmedAt: 1 },
                $pop: { statusHistory: 1 },
            }
        );
        throw error;
    }

    if (status === 'confirmed') {
        telegramService.notifyUser(claimed.telegramId, 'confirmed', claimed).catch(() => {});
    }
    return claimed;
}

async function rejectOrder({ orderId, branchId, reason, comment, actor, source = 'operator' }) {
    const cleanReason = String(reason || '').trim().slice(0, 80);
    const cleanComment = String(comment || '').trim().slice(0, 500);
    if (!cleanReason) throw httpError(400, 'Rad etish sababini tanlang');
    if (cleanComment.length < 5) throw httpError(400, 'Izoh kamida 5 ta belgidan iborat bo\'lsin');

    const existing = await Order.findOne({ _id: orderId, branch: branchId });
    if (!existing) throw httpError(404, 'Buyurtma topilmadi');
    if (existing.status !== 'pending_operator') {
        throw httpError(409, 'Buyurtma allaqachon ko\'rib chiqilgan');
    }

    const now = new Date();
    const changedBy = actorNote(actor, source);
    const rejected = await Order.findOneAndUpdate(
        { _id: orderId, branch: branchId, status: 'pending_operator' },
        {
            $set: {
                status: 'rejected',
                operatorSource: source,
                rejectionReason: cleanReason,
                rejectionComment: cleanComment,
                notes: [existing.notes, `Rad etish: ${cleanReason}. ${cleanComment}`].filter(Boolean).join('\n'),
                ...(existing.paymentStatus === 'paid' ? { paymentStatus: 'refunded' } : {}),
            },
            $push: {
                statusHistory: {
                    status: 'rejected',
                    changedBy: 'operator',
                    changedAt: now,
                    note: `${cleanReason}: ${cleanComment} — ${changedBy}`,
                },
            },
        },
        { new: true }
    );
    if (!rejected) throw httpError(409, 'Buyurtma allaqachon ko\'rib chiqilgan');

    await BonusService.refundBonus(rejected);
    telegramService.notifyUser(rejected.telegramId, 'rejected', rejected).catch(() => {});
    return rejected;
}

module.exports = { acceptOrder, rejectOrder };
