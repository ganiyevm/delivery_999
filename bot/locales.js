// Bot xabarlari 3 tilda: uz (O'zbek), ru (Русский), en (English)

const t = {
    uz: {
        welcome: (count) =>
            `🏥 <b>Сеть Аптек 999</b>ga xush kelibsiz!\n\n` +
            `💊 4000+ turdagi dorilar\n` +
            `🏥 ${count} ta filial Toshkent bo'ylab\n` +
            `🚚 1-2 soat ichida yetkazib berish\n` +
            `💳 Click va Payme orqali to'lov\n\n` +
            `Quyidagi tugmani bosib xarid qiling 👇`,
        openApp: '🏥 Aptekani ochish',
        noAccess: '⛔ Sizda bu buyruqqa ruxsat yo\'q',

        notify: {
            pending_operator: (num) => `⏳ Buyurtma <b>#${num}</b> qabul qilindi!\nApteka tekshirmoqda, biroz kuting...`,
            confirmed:        (num) => `✅ Buyurtma <b>#${num}</b> tasdiqlandi!\nKuryer tez orada yo'lga chiqadi 🚗`,
            rejected:         (num) => `😔 Kechirasiz, <b>#${num}</b> rad etildi.\nDori hozir mavjud emas.\nTo'lovingiz 1-3 ish kuni ichida qaytariladi 💰`,
            on_the_way:       ()    => `🚗 Buyurtmangiz yo'lda!\nKuryer yaqin orada yetkazadi.\nTaxminiy vaqt: 30-60 daqiqa ⏰`,
            delivered:        (num, bonus) => `🎉 Buyurtma <b>#${num}</b> yetkazildi!\nXarid uchun rahmat! 🙏\n+${bonus} bonus ball hisobingizga yozildi ⭐`,
            cancelled:        (num) => `❌ Buyurtma <b>#${num}</b> bekor qilindi.\nSavollar bo'lsa aptekaga murojaat qiling.`,
        },

        stats: (d, o, done, cancel, rev, users, top) =>
            `📊 <b>${d} statistika</b>\n` +
            `─────────────────────────\n` +
            `📦 Buyurtmalar: <b>${o}</b> ta\n` +
            `✅ Yetkazildi: <b>${done}</b> ta\n` +
            `❌ Bekor: <b>${cancel}</b> ta\n` +
            `💰 Tushum: <b>${rev.toLocaleString()}</b> so'm\n` +
            `👥 Yangi foydalanuvchilar: <b>${users}</b>\n` +
            (top ? `🏆 Top dori: ${top[0]} (${top[1]} ta)\n` : ''),

        branches: '🏥 <b>Filiallar holati</b>\n─────────────────────────\n',
    },

    ru: {
        welcome: (count) =>
            `🏥 Добро пожаловать в <b>Сеть Аптек 999</b>!\n\n` +
            `💊 4000+ видов лекарств\n` +
            `🏥 ${count} аптек по Ташкенту\n` +
            `🚚 Доставка за 1-2 часа\n` +
            `💳 Оплата через Click и Payme\n\n` +
            `Нажмите кнопку ниже для покупки 👇`,
        openApp: '🏥 Открыть аптеку',
        noAccess: '⛔ У вас нет доступа к этой команде',

        notify: {
            pending_operator: (num) => `⏳ Заказ <b>#${num}</b> принят!\nАптека проверяет, подождите немного...`,
            confirmed:        (num) => `✅ Заказ <b>#${num}</b> подтверждён!\nКурьер скоро выедет 🚗`,
            rejected:         (num) => `😔 К сожалению, заказ <b>#${num}</b> отклонён.\nЛекарство сейчас недоступно.\nВозврат средств — 1-3 рабочих дня 💰`,
            on_the_way:       ()    => `🚗 Ваш заказ в пути!\nКурьер скоро доставит.\nПримерное время: 30-60 минут ⏰`,
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
            (top ? `🏆 Топ товар: ${top[0]} (${top[1]} шт)\n` : ''),

        branches: '🏥 <b>Статус аптек</b>\n─────────────────────────\n',
    },

    en: {
        welcome: (count) =>
            `🏥 Welcome to <b>Сеть Аптек 999</b>!\n\n` +
            `💊 4000+ medicines available\n` +
            `🏥 ${count} pharmacies across Tashkent\n` +
            `🚚 Delivery within 1-2 hours\n` +
            `💳 Pay via Click or Payme\n\n` +
            `Tap the button below to start shopping 👇`,
        openApp: '🏥 Open pharmacy',
        noAccess: '⛔ You do not have access to this command',

        notify: {
            pending_operator: (num) => `⏳ Order <b>#${num}</b> received!\nThe pharmacy is reviewing it, please wait...`,
            confirmed:        (num) => `✅ Order <b>#${num}</b> confirmed!\nThe courier will head out soon 🚗`,
            rejected:         (num) => `😔 Sorry, order <b>#${num}</b> was declined.\nThe medicine is currently unavailable.\nRefund will be processed in 1-3 business days 💰`,
            on_the_way:       ()    => `🚗 Your order is on its way!\nEstimated time: 30-60 minutes ⏰`,
            delivered:        (num, bonus) => `🎉 Order <b>#${num}</b> delivered!\nThank you for your purchase! 🙏\n+${bonus} bonus points added ⭐`,
            cancelled:        (num) => `❌ Order <b>#${num}</b> cancelled.\nContact the pharmacy for questions.`,
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
