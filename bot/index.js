require('dotenv').config({ path: '../backend/.env' });
const { Bot, session, webhookCallback } = require('grammy');
const mongoose = require('../backend/node_modules/mongoose');
const express = require('express');

// Models (backend bilan ulashiladi)
require('../backend/src/models/User');
require('../backend/src/models/Product');
require('../backend/src/models/Stock');
require('../backend/src/models/Branch');
require('../backend/src/models/Order');
require('../backend/src/models/BonusTransaction');
require('../backend/src/models/ImportLog');

const startHandler = require('./handlers/start');
const importHandler = require('./handlers/import');
const operatorHandler = require('./handlers/operator');
const courierHandler = require('./handlers/courier');
const roleCheck = require('./middleware/roleCheck');

const bot = new Bot(process.env.BOT_TOKEN);

// Session
bot.use(session({ initial: () => ({}) }));

// Middleware — role check
bot.use(roleCheck);

// Handlers
startHandler(bot);
importHandler(bot);
operatorHandler(bot);
courierHandler(bot);

// Error handler
bot.catch((err) => {
    console.error('❌ Bot xatosi:', err);
});

// Start
async function main() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ MongoDB ulandi (bot)');

        const webhookUrl = process.env.WEBAPP_URL;

        if (webhookUrl && process.env.NODE_ENV === 'production') {
            // Production: webhook rejimi (409 conflict yo'q)
            const secret = process.env.BOT_TOKEN.replace(':', '_');
            await bot.api.setWebhook(`${webhookUrl}/bot-webhook`, {
                secret_token: secret,
                drop_pending_updates: true,
            });
            console.log('🤖 Bot webhook o\'rnatildi:', `${webhookUrl}/bot-webhook`);

            // Webhook so'rovlarni qabul qilish uchun kichik server
            const app = express();
            app.use(express.json());
            app.post('/bot-webhook', webhookCallback(bot, 'express'));
            app.listen(3001, () => console.log('🔗 Bot webhook server: 3001'));
        } else {
            // Development: polling rejimi
            await bot.start({
                drop_pending_updates: true,
                onStart: () => console.log('🤖 Bot polling rejimida ishga tushdi!'),
            });
        }
    } catch (error) {
        console.error('❌ Bot ishga tushishda xato:', error);
        process.exit(1);
    }
}

main();
