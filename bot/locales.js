// Bot xabarlari 3 tilda: uz (O'zbek), ru (Русский), en (English)

const t = {
    uz: {
        welcome: (count) =>
            `🏥 <b>999 dorixonalar tarmog'iga</b> xush kelibsiz!\n\n` +
            `💊 4 mingdan ortiq turdagi dori\n` +
            `🏥 Toshkent bo'ylab ${count} ta filial\n` +
            `🚚 1–2 soat ichida yetkazib berish\n` +
            `💳 Click va Payme orqali to'lov\n\n` +
            `Quyidagi tugmani bosib xarid qiling 👇`,
        openApp: '🏥 Dorixonani ochish',
        paymentReceived: "✅ To'lov qabul qilindi. Buyurtmani davom ettirish uchun ilovani oching.",
        noAccess: '⛔ Sizda bu buyruqqa ruxsat yo\'q',

        notify: {
            pending_operator: (num) => `⏳ Buyurtma <b>#${num}</b> qabul qilindi!\nDorixona buyurtmani tekshirmoqda. Iltimos, biroz kuting...`,
            confirmed:        (num) => `✅ Buyurtma <b>#${num}</b> tasdiqlandi!\nKuryer tez orada yo'lga chiqadi 🚗`,
            rejected:         (num) => `😔 Afsuski, buyurtma <b>#${num}</b> rad etildi.\nBuyurtmani bajarishning imkoni bo'lmadi.\nAgar to'lov amalga oshirilgan bo'lsa, mablag' 1–3 ish kuni ichida qaytariladi 💰`,
            on_the_way:       ()    => `🚗 Buyurtmangiz yo'lda!\nKuryer yaqin orada yetkazadi.\nTaxminiy vaqt: 30–60 daqiqa ⏰`,
            delivered:        (num, bonus) => `🎉 Buyurtma <b>#${num}</b> yetkazildi!\nXaridingiz uchun rahmat! 🙏\nHisobingizga +${bonus} bonus ball yozildi ⭐`,
            cancelled:        (num) => `❌ Buyurtma <b>#${num}</b> bekor qilindi.\nSavollaringiz bo'lsa, dorixonaga murojaat qiling.`,
        },

        stats: (d, o, done, cancel, rev, users, top) =>
            `📊 <b>${d} sanasi uchun statistika</b>\n` +
            `─────────────────────────\n` +
            `📦 Buyurtmalar: <b>${o}</b> ta\n` +
            `✅ Yetkazildi: <b>${done}</b> ta\n` +
            `❌ Bekor qilindi: <b>${cancel}</b> ta\n` +
            `💰 Tushum: <b>${rev.toLocaleString()}</b> so'm\n` +
            `👥 Yangi foydalanuvchilar: <b>${users}</b>\n` +
            (top ? `🏆 Eng ko'p sotilgan dori: ${top[0]} (${top[1]} ta)\n` : ''),

        branches: '🏥 <b>Filiallar holati</b>\n─────────────────────────\n',
    },

    ru: {
        welcome: (count) =>
            `🏥 Добро пожаловать в <b>Сеть Аптек 999</b>!\n\n` +
            `💊 4000+ видов лекарств\n` +
            `🏥 ${count} аптек по Ташкенту\n` +
            `🚚 Доставка за 1–2 часа\n` +
            `💳 Оплата через Click и Payme\n\n` +
            `Нажмите кнопку ниже для покупки 👇`,
        openApp: '🏥 Открыть аптеку',
        paymentReceived: '✅ Платёж принят. Откройте приложение, чтобы продолжить оформление заказа.',
        noAccess: '⛔ У вас нет доступа к этой команде',

        notify: {
            pending_operator: (num) => `⏳ Заказ <b>#${num}</b> принят!\nАптека проверяет, подождите немного...`,
            confirmed:        (num) => `✅ Заказ <b>#${num}</b> подтверждён!\nКурьер скоро выедет 🚗`,
            rejected:         (num) => `😔 К сожалению, заказ <b>#${num}</b> отклонён.\nВыполнить заказ не удалось.\nЕсли оплата была произведена, средства вернутся в течение 1–3 рабочих дней 💰`,
            on_the_way:       ()    => `🚗 Ваш заказ в пути!\nКурьер скоро доставит.\nПримерное время: 30–60 минут ⏰`,
            delivered:        (num, bonus) => `🎉 Заказ <b>#${num}</b> доставлен!\nСпасибо за покупку! 🙏\n+${bonus} бонусных баллов начислено ⭐`,
            cancelled:        (num) => `❌ Заказ <b>#${num}</b> отменён.\nПо вопросам обращайтесь в аптеку.`,
        },

        stats: (d, o, done, cancel, rev, users, top) =>
            `📊 <b>Статистика за ${d}</b>\n` +
            `─────────────────────────\n` +
            `📦 Заказов: <b>${o}</b>\n` +
            `✅ Доставлено: <b>${done}</b>\n` +
            `❌ Отменено: <b>${cancel}</b>\n` +
            `💰 Выручка: <b>${rev.toLocaleString()}</b> сум\n` +
            `👥 Новых пользователей: <b>${users}</b>\n` +
            (top ? `🏆 Самый популярный товар: ${top[0]} (${top[1]} шт.)\n` : ''),

        branches: '🏥 <b>Статус аптек</b>\n─────────────────────────\n',
    },

    en: {
        welcome: (count) =>
            `🏥 Welcome to <b>Сеть Аптек 999</b>!\n\n` +
            `💊 4000+ medicines available\n` +
            `🏥 ${count} pharmacies across Tashkent\n` +
            `🚚 Delivery within 1–2 hours\n` +
            `💳 Pay via Click or Payme\n\n` +
            `Tap the button below to start shopping 👇`,
        openApp: '🏥 Open pharmacy app',
        paymentReceived: '✅ Payment received. Open the app to continue your order.',
        noAccess: '⛔ You do not have access to this command',

        notify: {
            pending_operator: (num) => `⏳ Order <b>#${num}</b> received!\nThe pharmacy is reviewing it, please wait...`,
            confirmed:        (num) => `✅ Order <b>#${num}</b> confirmed!\nThe courier will head out soon 🚗`,
            rejected:         (num) => `😔 Sorry, order <b>#${num}</b> was declined.\nWe were unable to fulfil the order.\nIf payment was made, the refund will be processed within 1–3 business days 💰`,
            on_the_way:       ()    => `🚗 Your order is on its way!\nEstimated time: 30–60 minutes ⏰`,
            delivered:        (num, bonus) => `🎉 Order <b>#${num}</b> delivered!\nThank you for your purchase! 🙏\n+${bonus} bonus points have been added to your account ⭐`,
            cancelled:        (num) => `❌ Order <b>#${num}</b> cancelled.\nContact the pharmacy if you have any questions.`,
        },

        stats: (d, o, done, cancel, rev, users, top) =>
            `📊 <b>Statistics for ${d}</b>\n` +
            `─────────────────────────\n` +
            `📦 Orders: <b>${o}</b>\n` +
            `✅ Delivered: <b>${done}</b>\n` +
            `❌ Cancelled: <b>${cancel}</b>\n` +
            `💰 Revenue: <b>${rev.toLocaleString()}</b> UZS\n` +
            `👥 New users: <b>${users}</b>\n` +
            (top ? `🏆 Top medicine: ${top[0]} (${top[1]} pcs)\n` : ''),

        branches: '🏥 <b>Pharmacy status</b>\n─────────────────────────\n',
    },
};

function getLang(code) {
    return t[code] || t.uz;
}

module.exports = { t, getLang };
