require('dotenv').config({ path: '../backend/.env' });
const { Bot, session } = require('grammy');
const mongoose = require('../backend/node_modules/mongoose');

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

        await bot.start({
            onStart: () => console.log('🤖 Apteka999 Bot ishga tushdi!'),
        });
    } catch (error) {
        console.error('❌ Bot ishga tushishda xato:', error);
        process.exit(1);
    }
}

main();
