const cron = require('node-cron');
const AnalyticsService = require('../services/analytics.service');

// Har kuni 23:59 da kunlik analytics yozish
cron.schedule('59 23 * * *', async () => {
    try {
        console.log('⏰ Kunlik analytics cron job boshlandi...');
        await AnalyticsService.writeDailyAnalytics();
        console.log('✅ Kunlik analytics muvaffaqiyatli yozildi');
    } catch (error) {
        console.error('❌ Kunlik analytics xatosi:', error);
    }
}, {
    timezone: 'Asia/Tashkent',
});

console.log('📊 Kunlik analytics cron job rejalashtildi (har kuni 23:59 TSH)');
