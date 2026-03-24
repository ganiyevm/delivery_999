const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log(`✅ MongoDB ulandi: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB xatosi: ${error.message}`);
    process.exit(1);
  }
};

let lastDisconnectLog = 0;
mongoose.connection.on('disconnected', () => {
  const now = Date.now();
  if (now - lastDisconnectLog > 30000) { // 30 sekundda 1 marta
    console.warn('⚠️ MongoDB uzildi. Qayta ulanmoqda...');
    lastDisconnectLog = now;
  }
});

mongoose.connection.on('reconnected', () => {
  console.log('✅ MongoDB qayta ulandi');
});

mongoose.connection.on('error', (err) => {
  console.error(`❌ MongoDB xatosi: ${err.message}`);
});

module.exports = connectDB;
