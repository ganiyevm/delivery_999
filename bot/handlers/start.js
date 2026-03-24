const { InlineKeyboard } = require('grammy');

module.exports = (bot) => {
    bot.command('start', async (ctx) => {
        const webAppUrl = process.env.WEBAPP_URL || 'https://your-miniapp.com';

        const keyboard = new InlineKeyboard()
            .webApp('🏥 Aptekani ochish', webAppUrl);

        try {
            await ctx.reply(
                `🏥 <b>Сеть Аптек 999</b> ga xush kelibsiz!\n\n` +
                `💊 4000+ turdagi dorilar\n` +
                `🏥 20 ta filial Тoshkent bo'ylab\n` +
                `🚚 1-2 soat ichida yetkazib berish\n` +
                `💳 Click va Payme orqali to'lov\n\n` +
                `Quyidagi tugmani bosib xarid qiling 👇`,
                {
                    parse_mode: 'HTML',
                    reply_markup: keyboard,
                }
            );
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
        if (!ctx.isAdmin) {
            return ctx.reply('⛔ Sizda bu buyruqqa ruxsat yo\'q');
        }

        const Order = require('../../backend/src/models/Order');
        const User = require('../../backend/src/models/User');

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
        const revenue = delivered.reduce((s, o) => s + o.total, 0);

        // Top dori
        const itemCounts = {};
        delivered.forEach(o => {
            o.items.forEach(i => {
                itemCounts[i.productName] = (itemCounts[i.productName] || 0) + i.qty;
            });
        });
        const topDrug = Object.entries(itemCounts).sort((a, b) => b[1] - a[1])[0];

        const dateStr = new Date().toLocaleDateString('uz-UZ');

        await ctx.reply(
            `📊 <b>${dateStr} statistika</b>\n` +
            `─────────────────────────\n` +
            `📦 Buyurtmalar: <b>${orders.length}</b> ta\n` +
            `✅ Yetkazildi: <b>${delivered.length}</b> ta\n` +
            `❌ Bekor: <b>${cancelled.length}</b> ta\n` +
            `💰 Tushum: <b>${revenue.toLocaleString()}</b> сўм\n` +
            `👥 Yangi foydalanuvchilar: <b>${newUsers}</b>\n` +
            (topDrug ? `🏆 Top dori: ${topDrug[0]} (${topDrug[1]} ta)\n` : ''),
            { parse_mode: 'HTML' }
        );
    });

    // /branches — filiallar holati
    bot.command('branches', async (ctx) => {
        if (!ctx.isAdmin) {
            return ctx.reply('⛔ Sizda bu buyruqqa ruxsat yo\'q');
        }

        const Branch = require('../../backend/src/models/Branch');
        const branches = await Branch.find().sort({ number: 1 }).lean();

        let text = '🏥 <b>Filiallar holati</b>\n─────────────────────────\n';
        branches.forEach(b => {
            const status = b.isOpen ? '🟢' : '🔴';
            text += `${status} №${String(b.number).padStart(3, '0')} ${b.name}\n`;
        });

        await ctx.reply(text, { parse_mode: 'HTML' });
    });
};
