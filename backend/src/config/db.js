const mongoose = require('mongoose');

const RETRY_DELAY = 5000;   // 5 soniya kutib qayta urinish
const MAX_RETRIES = 12;     // 1 daqiqa ichida 12 marta (60 sek)

const connectDB = async (attempt = 1) => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });
        console.log(`✅ MongoDB ulandi: ${conn.connection.host}`);
    } catch (error) {
        console.error(`❌ MongoDB xatosi (${attempt}/${MAX_RETRIES}): ${error.message}`);
        if (attempt >= MAX_RETRIES) {
            console.error('❌ MongoDB ga ulanib bo\'lmadi. Jarayon to\'xtatilmoqda.');
            process.exit(1);
        }
        await new Promise(r => setTimeout(r, RETRY_DELAY));
        return connectDB(attempt + 1);
    }
};

let lastDisconnectLog = 0;
mongoose.connection.on('disconnected', () => {
    const now = Date.now();
    if (now - lastDisconnectLog > 30000) {
        console.warn('⚠️ MongoDB uzildi. Qayta ulanmoqda...');
        lastDisconnectLog = now;
    }
});

mongoose.connection.on('reconnected', () => {
    console.log('✅ MongoDB qayta ulandi');
});

mongoose.connection.on('error', (err) => {
    // Mongoose o'zi qayta ulanadi — bu yerda faqat log
    console.error(`❌ MongoDB xatosi: ${err.message}`);
});

module.exports = connectDB;
