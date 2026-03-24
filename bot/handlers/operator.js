const { InlineKeyboard } = require('grammy');
const Order = require('../../backend/src/models/Order');
const Stock = require('../../backend/src/models/Stock');
const Branch = require('../../backend/src/models/Branch');
const BonusService = require('../../backend/src/services/bonus.service');
const telegramService = require('../../backend/src/services/telegram.service');

module.exports = (bot) => {
    // ═══ TASDIQLASH ═══
    bot.callbackQuery(/^confirm_(.+)$/, async (ctx) => {
        try {
            const orderId = ctx.match[1];
            const order = await Order.findById(orderId);

            if (!order) return ctx.answerCallbackQuery('Buyurtma topilmadi');
            if (order.status !== 'pending_operator') {
                return ctx.answerCallbackQuery('Bu buyurtma allaqachon jarayonda');
            }

            // Status → confirmed
            order.status = 'confirmed';
            order.operatorId = ctx.from.id;
            order.confirmedAt = new Date();
            order.statusHistory.push({
                status: 'confirmed',
                changedBy: 'operator',
                changedAt: new Date(),
                note: `Operator: ${ctx.from.first_name}`,
            });

            // Stock dan ayirish
            for (const item of order.items) {
                await Stock.findOneAndUpdate(
                    { product: item.product, branch: order.branch },
                    { $inc: { qty: -item.qty } }
                );
            }

            await order.save();

            // Xabarni yangilash
            const keyboard = new InlineKeyboard()
                .text('🚗 Kuryer yo\'lga chiqdi', `dispatch_${order._id}`);

            await ctx.editMessageText(
                `✅ <b>Tasdiqlandi</b> — ${order.customerName}\n` +
                `📦 #${order.orderNumber}\n` +
                `💵 ${order.total.toLocaleString()} сўм\n` +
                `👤 Operator: ${ctx.from.first_name}\n` +
                `🕐 ${new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}`,
                { parse_mode: 'HTML', reply_markup: keyboard }
            );

            // Mijozga bildirishnoma
            await telegramService.notifyUser(order.telegramId, 'confirmed', order);

            await ctx.answerCallbackQuery('✅ Tasdiqlandi!');
        } catch (error) {
            console.error('Confirm error:', error);
            await ctx.answerCallbackQuery('Xato yuz berdi');
        }
    });

    // ═══ RAD ETISH ═══
    bot.callbackQuery(/^reject_(.+)$/, async (ctx) => {
        try {
            const orderId = ctx.match[1];

            const keyboard = new InlineKeyboard()
                .text('💊 Dori mavjud emas', `reject_reason_${orderId}_nodrug`)
                .text('📦 Boshqa sabab', `reject_reason_${orderId}_other`);

            await ctx.editMessageReplyMarkup({ reply_markup: keyboard });
            await ctx.answerCallbackQuery('Sababni tanlang');
        } catch (error) {
            console.error('Reject error:', error);
            await ctx.answerCallbackQuery('Xato');
        }
    });

    bot.callbackQuery(/^reject_reason_(.+)_(nodrug|other)$/, async (ctx) => {
        try {
            const orderId = ctx.match[1];
            const reason = ctx.match[2];
            const order = await Order.findById(orderId);

            if (!order) return ctx.answerCallbackQuery('Topilmadi');
            if (order.status !== 'pending_operator') {
                return ctx.answerCallbackQuery('Allaqachon jarayonda');
            }

            const reasonText = reason === 'nodrug' ? 'Dori mavjud emas' : 'Boshqa sabab';

            order.status = 'rejected';
            order.paymentStatus = 'refunded';
            order.statusHistory.push({
                status: 'rejected',
                changedBy: 'operator',
                changedAt: new Date(),
                note: reasonText,
            });
            await order.save();

            // Bonus qaytarish
            await BonusService.refundBonus(order);

            // Xabarni yangilash
            await ctx.editMessageText(
                `❌ <b>Rad etildi</b> — ${order.customerName}\n` +
                `📦 #${order.orderNumber}\n` +
                `💵 ${order.total.toLocaleString()} сўм\n` +
                `📝 Sabab: ${reasonText}\n` +
                `🕐 ${new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}`,
                { parse_mode: 'HTML' }
            );

            // Mijozga bildirishnoma
            await telegramService.notifyUser(order.telegramId, 'rejected', order);

            await ctx.answerCallbackQuery('❌ Rad etildi');
        } catch (error) {
            console.error('Reject reason error:', error);
            await ctx.answerCallbackQuery('Xato');
        }
    });

    // ═══ YO'LGA CHIQDI ═══
    bot.callbackQuery(/^dispatch_(.+)$/, async (ctx) => {
        try {
            const orderId = ctx.match[1];
            const order = await Order.findById(orderId);

            if (!order) return ctx.answerCallbackQuery('Topilmadi');
            if (order.status !== 'confirmed') {
                return ctx.answerCallbackQuery('Status to\'g\'ri emas');
            }

            order.status = 'on_the_way';
            order.dispatchedAt = new Date();
            order.statusHistory.push({
                status: 'on_the_way',
                changedBy: 'operator',
                changedAt: new Date(),
                note: `Yo'lga chiqdi — ${ctx.from.first_name}`,
            });
            await order.save();

            // Xabarni yangilash
            const keyboard = new InlineKeyboard()
                .text('✅ Yetkazildi', `delivered_${order._id}`);

            await ctx.editMessageText(
                `🚗 <b>Yo'lda</b> — ${order.customerName}\n` +
                `📦 #${order.orderNumber}\n` +
                `💵 ${order.total.toLocaleString()} сўм\n` +
                `🕐 ${new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}`,
                { parse_mode: 'HTML', reply_markup: keyboard }
            );

            // Mijozga DARHOL bildirishnoma
            await telegramService.notifyUser(order.telegramId, 'on_the_way', order);

            await ctx.answerCallbackQuery('🚗 Yo\'lga chiqdi!');
        } catch (error) {
            console.error('Dispatch error:', error);
            await ctx.answerCallbackQuery('Xato');
        }
    });
};
