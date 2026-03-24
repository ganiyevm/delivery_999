const Order = require('../../backend/src/models/Order');
const BonusService = require('../../backend/src/services/bonus.service');
const telegramService = require('../../backend/src/services/telegram.service');

module.exports = (bot) => {
    // ═══ YETKAZILDI ═══
    bot.callbackQuery(/^delivered_(.+)$/, async (ctx) => {
        try {
            const orderId = ctx.match[1];
            const order = await Order.findById(orderId);

            if (!order) return ctx.answerCallbackQuery('Topilmadi');
            if (order.status !== 'on_the_way') {
                return ctx.answerCallbackQuery('Status to\'g\'ri emas');
            }

            order.status = 'delivered';
            order.courierId = ctx.from.id;
            order.deliveredAt = new Date();
            order.statusHistory.push({
                status: 'delivered',
                changedBy: 'courier',
                changedAt: new Date(),
                note: `Kuryer: ${ctx.from.first_name}`,
            });
            await order.save();

            // Bonus ball yozish
            const bonusEarned = await BonusService.earnBonus(order);

            // Vaqtni hisoblash
            const dispatchTime = order.dispatchedAt || order.confirmedAt;
            const deliveryMinutes = dispatchTime
                ? Math.round((order.deliveredAt - dispatchTime) / 60000)
                : 0;

            // Xabarni yangilash
            await ctx.editMessageText(
                `✅ <b>Yetkazildi</b> — ${order.customerName}\n` +
                `📦 #${order.orderNumber}\n` +
                `💵 ${order.total.toLocaleString()} сўм\n` +
                `🚗 Kuryer: ${ctx.from.first_name}\n` +
                `⏱ ${deliveryMinutes} daqiqa\n` +
                `🕐 ${new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}`,
                { parse_mode: 'HTML' }
            );

            // Mijozga bildirishnoma
            order.bonusEarned = bonusEarned;
            await telegramService.notifyUser(order.telegramId, 'delivered', order);

            await ctx.answerCallbackQuery('✅ Yetkazildi!');
        } catch (error) {
            console.error('Delivered error:', error);
            await ctx.answerCallbackQuery('Xato yuz berdi');
        }
    });
};
