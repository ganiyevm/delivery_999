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
        const webAppUrl = process.env.WEBAPP_URL || 'https://your-miniapp.com';
        const langCode  = await getUserLang(ctx);
        const loc       = getLang(langCode);

        let branchCount = 20;
        try {
            branchCount = await Branch.countDocuments();
        } catch (_) {}

        const keyboard = new InlineKeyboard().webApp(loc.openApp, webAppUrl);

        try {
            await ctx.reply(loc.welcome(branchCount), { parse_mode: 'HTML', reply_markup: keyboard });
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
