// Har 2 daqiqada pending_operator buyurtmalarni tekshiradi va operatorga eslatma yuboradi
// Max 5 eslatma, keyin to'xtatiladi

const Order = require('../models/Order');
const Branch = require('../models/Branch');
const telegramService = require('../services/telegram.service');

const INTERVAL_MS = 2 * 60 * 1000;   // har 2 daqiqada
const MIN_AGE_MS  = 2 * 60 * 1000;   // kamida 2 daqiqa o'tgan bo'lsin
const MAX_REMINDERS = 5;              // maksimal eslatma soni

async function checkPendingOrders() {
    try {
        const cutoff = new Date(Date.now() - MIN_AGE_MS);

        const orders = await Order.find({
            status: 'pending_operator',
            notifyCount: { $lt: MAX_REMINDERS },
            createdAt: { $lt: cutoff },
        }).lean();

        for (const order of orders) {
            const branch = await Branch.findById(order.branch).lean();
            if (!branch?.operatorChatId) continue;

            await telegramService.remindOperator(order, branch, order.notifyCount);

            await Order.updateOne({ _id: order._id }, { $inc: { notifyCount: 1 } });

            console.log(`[reminder] #${order.orderNumber} — ${order.notifyCount + 1}-eslatma yuborildi`);
        }
    } catch (err) {
        console.error('[reminder] xato:', err.message);
    }
}

setInterval(checkPendingOrders, INTERVAL_MS);
console.log('🔔 Pending orders reminder job ishga tushdi (har 2 daqiqada)');
