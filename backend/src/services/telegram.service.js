const axios = require('axios');

// Locales (bot bilan ulashilgan, lekin backend ham ishlatadi)
const notify = {
    uz: {
        pending_operator: (num) => `⏳ Buyurtma <b>#${num}</b> qabul qilindi!\nApteka tekshirmoqda, biroz kuting...`,
        confirmed:        (num) => `✅ Buyurtma <b>#${num}</b> tasdiqlandi!\nKuryer tez orada yo'lga chiqadi 🚗`,
        rejected:         (num) => `😔 Kechirasiz, <b>#${num}</b> rad etildi.\nDori hozir mavjud emas.\nTo'lovingiz 1-3 ish kuni ichida qaytariladi 💰`,
        on_the_way:       ()    => `🚗 Buyurtmangiz yo'lda!\nKuryer yaqin orada yetkazadi.\nTaxminiy vaqt: 30-60 daqiqa ⏰`,
        delivered:        (num, bonus) => `🎉 Buyurtma <b>#${num}</b> yetkazildi!\nXarid uchun rahmat! 🙏\n+${bonus} bonus ball hisobingizga yozildi ⭐`,
        cancelled:        (num) => `❌ Buyurtma <b>#${num}</b> bekor qilindi.\nSavollar bo'lsa aptekaga murojaat qiling.`,
    },
    ru: {
        pending_operator: (num) => `⏳ Заказ <b>#${num}</b> принят!\nАптека проверяет, подождите немного...`,
        confirmed:        (num) => `✅ Заказ <b>#${num}</b> подтверждён!\nКурьер скоро выедет 🚗`,
        rejected:         (num) => `😔 К сожалению, заказ <b>#${num}</b> отклонён.\nЛекарство недоступно.\nВозврат — 1-3 рабочих дня 💰`,
        on_the_way:       ()    => `🚗 Ваш заказ в пути!\nПримерное время доставки: 30-60 минут ⏰`,
        delivered:        (num, bonus) => `🎉 Заказ <b>#${num}</b> доставлен!\nСпасибо за покупку! 🙏\n+${bonus} бонусных баллов начислено ⭐`,
        cancelled:        (num) => `❌ Заказ <b>#${num}</b> отменён.\nПо вопросам обращайтесь в аптеку.`,
    },
    en: {
        pending_operator: (num) => `⏳ Order <b>#${num}</b> received!\nThe pharmacy is reviewing it, please wait...`,
        confirmed:        (num) => `✅ Order <b>#${num}</b> confirmed!\nThe courier will head out soon 🚗`,
        rejected:         (num) => `😔 Sorry, order <b>#${num}</b> was declined.\nMedicine currently unavailable.\nRefund in 1-3 business days 💰`,
        on_the_way:       ()    => `🚗 Your order is on its way!\nEstimated delivery: 30-60 minutes ⏰`,
        delivered:        (num, bonus) => `🎉 Order <b>#${num}</b> delivered!\nThank you for your purchase! 🙏\n+${bonus} bonus points added ⭐`,
        cancelled:        (num) => `❌ Order <b>#${num}</b> cancelled.\nContact the pharmacy for questions.`,
    },
};

class TelegramService {
    constructor() {
        this.botToken = process.env.BOT_TOKEN;
        this.apiUrl = `https://api.telegram.org/bot${this.botToken}`;
    }

    async sendMessage(chatId, text, options = {}) {
        try {
            const res = await axios.post(`${this.apiUrl}/sendMessage`, {
                chat_id: chatId,
                text,
                parse_mode: 'HTML',
                ...options,
            });
            return res.data;
        } catch (err) {
            console.error('Telegram xabar yuborishda xato:', err.response?.data || err.message);
            return null;
        }
    }

    async editMessage(chatId, messageId, text, options = {}) {
        try {
            const res = await axios.post(`${this.apiUrl}/editMessageText`, {
                chat_id: chatId,
                message_id: messageId,
                text,
                parse_mode: 'HTML',
                ...options,
            });
            return res.data;
        } catch (err) {
            console.error('Telegram xabarni tahrirlashda xato:', err.response?.data || err.message);
            return null;
        }
    }

    // Operatorga yangi buyurtma haqida xabar (har doim uz tilda)
    async notifyOperator(order, branch) {
        if (!branch?.operatorChatId) return;

        const itemsList = order.items.map(i =>
            `├ ${i.productName} ×${i.qty} — ${i.price.toLocaleString()} so'm`
        ).join('\n');

        const text =
`━━━━━━━━━━━━━━━━━━━━━━━
🆕 YANGI BUYURTMA <b>#${order.orderNumber}</b>
━━━━━━━━━━━━━━━━━━━━━━━
👤 ${order.customerName}
📞 ${order.phone}
📍 ${order.address}

💊 DORILAR:
${itemsList}
└─────────────────────────

🚚 Yetkazib berish: ${order.deliveryCost.toLocaleString()} so'm
💵 JAMI: <b>${order.total.toLocaleString()} so'm</b>
💳 ${order.paymentMethod === 'click' ? 'Click' : 'Payme'} ✅ TO'LANGAN
🕐 ${new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })} | Apteka №${String(branch.number).padStart(3, '0')}
━━━━━━━━━━━━━━━━━━━━━━━`;

        const keyboard = {
            inline_keyboard: [[
                { text: '✅ Tasdiqlash', callback_data: `confirm_${order._id}` },
                { text: '❌ Rad etish', callback_data: `reject_${order._id}` },
            ]],
        };

        return this.sendMessage(branch.operatorChatId, text, { reply_markup: keyboard });
    }

    // Mijozga bildirishnoma — foydalanuvchi tiliga qarab
    async notifyUser(telegramId, status, order) {
        // Foydalanuvchi tilini DB dan olish
        let lang = 'uz';
        try {
            const User = require('../models/User');
            const user = await User.findOne({ telegramId }).select('language').lean();
            if (user?.language) lang = user.language;
        } catch (_) {}

        const loc = notify[lang] || notify.uz;
        const fn = loc[status];
        if (!fn) return;

        const text = fn(order.orderNumber, order.bonusEarned || 0);
        return this.sendMessage(telegramId, text);
    }
}

module.exports = new TelegramService();
