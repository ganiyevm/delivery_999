const axios = require('axios');

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

    // Operatorga yangi buyurtma haqida xabar
    async notifyOperator(order, branch) {
        if (!branch?.operatorChatId) return;

        const itemsList = order.items.map(i =>
            `├ ${i.productName} ×${i.qty} — ${i.price.toLocaleString()} сўм`
        ).join('\n');

        const text = `━━━━━━━━━━━━━━━━━━━━━━━
🆕 YANGI BUYURTMA <b>#${order.orderNumber}</b>
━━━━━━━━━━━━━━━━━━━━━━━
👤 ${order.customerName}
📞 ${order.phone}
📍 ${order.address}

💊 ДORILAR:
${itemsList}
└─────────────────────────

🚚 Dostavka: ${order.deliveryCost.toLocaleString()} сўм
💵 ЖAMI: <b>${order.total.toLocaleString()} сўм</b>
💳 ${order.paymentMethod === 'click' ? 'Click' : 'Payme'} ✅ TO'LANGAN
🕐 ${new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })} | Аптека №${String(branch.number).padStart(3, '0')}
━━━━━━━━━━━━━━━━━━━━━━━`;

        const keyboard = {
            inline_keyboard: [[
                { text: '✅ Tasdiqlash', callback_data: `confirm_${order._id}` },
                { text: '❌ Rad etish', callback_data: `reject_${order._id}` },
            ]],
        };

        return this.sendMessage(branch.operatorChatId, text, { reply_markup: keyboard });
    }

    // Mijozga bildirishnoma
    async notifyUser(telegramId, status, order) {
        const messages = {
            pending_operator: `⏳ Buyurtma <b>#${order.orderNumber}</b> qabul qilindi!\nApteka tekshirmoqda, biroz kuting...`,

            confirmed: `✅ Buyurtma <b>#${order.orderNumber}</b> tasdiqlandi!\nKuryer tez orada yo'lga chiqadi 🚗`,

            rejected: `😔 Kechirasiz, <b>#${order.orderNumber}</b> rad etildi.\nSabab: dori hozir mavjud emas.\nTo'lovingiz 1-3 ish kuni ichida qaytariladi 💰`,

            on_the_way: `🚗 Buyurtmangiz yo'lda!\nKuryer yaqin orada yetkazadi.\nTaxminiy vaqt: 30-60 daqiqa ⏰`,

            delivered: `🎉 Buyurtma <b>#${order.orderNumber}</b> yetkazildi!\nXarid uchun rahmat! 🙏\n+${order.bonusEarned || 0} bonus ball hisobingizga yozildi ⭐`,

            cancelled: `❌ Buyurtma <b>#${order.orderNumber}</b> bekor qilindi.\nSavollar bo'lsa: +998 71 XXX-XX-XX`,
        };

        const text = messages[status];
        if (text) {
            return this.sendMessage(telegramId, text);
        }
    }
}

module.exports = new TelegramService();
