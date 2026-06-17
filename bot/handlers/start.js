const { InlineKeyboard } = require('grammy');
const { getLang } = require('../locales');
const User = require('../../backend/src/models/User');
const Branch = require('../../backend/src/models/Branch');

// Foydalanuvchi tilini DB dan olish (topilmasa Telegram language_code ishlatiladi)
async function getUserLang(ctx) {
    try {
        const user = await User.findOne({ telegramId: ctx.from.id }).select('language').lean();
        if (user?.language) return user.language;
    } catch (_) {}
    const tgLang = ctx.from?.language_code || 'uz';
    if (tgLang.startsWith('ru')) return 'ru';
    if (tgLang.startsWith('en')) return 'en';
    return 'uz';
}

module.exports = (bot) => {
    bot.command('start', async (ctx) => {
        const baseWebAppUrl = (process.env.WEBAPP_URL || 'https://your-miniapp.com').replace(/\/$/, '');
        const payload = String(ctx.match || '').trim();
        const payMatch = /^pay_([a-f\d]{24})(?:_(.+))?$/i.exec(payload);
        const webAppUrl = payMatch
            ? `${baseWebAppUrl}/?pay=${encodeURIComponent(payMatch[1])}${payMatch[2] ? `&id=${encodeURIComponent(payMatch[2])}` : ''}`
            : baseWebAppUrl;
        const langCode  = await getUserLang(ctx);
        const loc       = getLang(langCode);

        let branchCount = 20;
        try {
            branchCount = await Branch.countDocuments();
        } catch (_) {}

        const keyboard = new InlineKeyboard().webApp(loc.openApp, webAppUrl);

        try {
            const text = payMatch
                ? "✅ To'lov qabul qilindi. Buyurtmani davom ettirish uchun ilovani oching."
                : loc.welcome(branchCount);
            await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
        } catch (err) {
            if (err.error_code === 403) {
                console.log(`⚠️ Foydalanuvchi botni bloklagan: ${ctx.from?.id}`);
            } else {
                throw err;
            }
        }
    });

    // /stats — admin uchun bugungi statistika
    bot.command('stats', async (ctx) => {
        if (!ctx.isAdmin) return ctx.reply(getLang('uz').noAccess);

        const Order = require('../../backend/src/models/Order');

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const [orders, newUsers] = await Promise.all([
            Order.find({ createdAt: { $gte: today, $lt: tomorrow } }).lean(),
            User.countDocuments({ registeredAt: { $gte: today, $lt: tomorrow } }),
        ]);

        const delivered = orders.filter(o => o.status === 'delivered');
        const cancelled = orders.filter(o => ['cancelled', 'rejected'].includes(o.status));
        const revenue   = delivered.reduce((s, o) => s + o.total, 0);

        const itemCounts = {};
        delivered.forEach(o => o.items.forEach(i => {
            itemCounts[i.productName] = (itemCounts[i.productName] || 0) + i.qty;
        }));
        const topDrug = Object.entries(itemCounts).sort((a, b) => b[1] - a[1])[0];

        // Admin tiliga qarab statistika (default uz)
        const langCode = await getUserLang(ctx);
        const loc      = getLang(langCode);
        const dateStr  = new Date().toLocaleDateString('uz-UZ');

        await ctx.reply(
            loc.stats(dateStr, orders.length, delivered.length, cancelled.length, revenue, newUsers, topDrug),
            { parse_mode: 'HTML' }
        );
    });

    // /register — operator o'zini fililiga biriktiradi
    bot.command('register', async (ctx) => {
        const userId = ctx.from?.id;
        if (!userId) return ctx.reply('❌ Telegram ID aniqlanmadi.');

        // operatorIds ichida bu foydalanuvchi bormi?
        const branch = await Branch.findOne({ operatorIds: userId }).lean();
        if (!branch) {
            return ctx.reply(
                '❌ Siz hech qaysi filialga operator sifatida qo\'shilmagansiz.\n\n' +
                'Admin paneldan filial → Operator IDlar ga Telegram ID ingizni qo\'shtiring:\n' +
                `<code>${userId}</code>`,
                { parse_mode: 'HTML' }
            );
        }

        // operatorChatId ni yangilash
        await Branch.findByIdAndUpdate(branch._id, { operatorChatId: ctx.chat.id });

        await ctx.reply(
            `✅ Muvaffaqiyatli ro'yxatdan o'tdingiz!\n\n` +
            `🏪 Filial: <b>${branch.name}</b>\n` +
            `📬 Chat ID: <code>${ctx.chat.id}</code>\n\n` +
            `Endi yangi zakazlar shu chatga keladi.`,
            { parse_mode: 'HTML' }
        );
        console.log(`[operator] Register: userId=${userId} → branch #${branch.number} (${branch.name}), chatId=${ctx.chat.id}`);
    });

    // /my_id — Telegram ID ni ko'rish (admin panel uchun)
    bot.command('my_id', async (ctx) => {
        await ctx.reply(
            `Telegram ID ingiz: <code>${ctx.from?.id}</code>\n` +
            `Chat ID: <code>${ctx.chat?.id}</code>`,
            { parse_mode: 'HTML' }
        );
    });

    // /branches — filiallar holati
    bot.command('branches', async (ctx) => {
        if (!ctx.isAdmin) return ctx.reply(getLang('uz').noAccess);

        const branches   = await Branch.find().sort({ number: 1 }).lean();
        const langCode   = await getUserLang(ctx);
        const loc        = getLang(langCode);

        let text = loc.branches;
        branches.forEach(b => {
            text += `${b.isOpen ? '🟢' : '🔴'} №${String(b.number).padStart(3, '0')} ${b.name}\n`;
        });

        await ctx.reply(text, { parse_mode: 'HTML' });
    });
};
