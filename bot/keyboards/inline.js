const { InlineKeyboard } = require('grammy');

const keyboards = {
    // Operator buyurtma tugmalari
    orderActions: (orderId) => {
        return new InlineKeyboard()
            .text('✅ Tasdiqlash', `confirm_${orderId}`)
            .text('❌ Rad etish', `reject_${orderId}`);
    },

    // Dispatch
    dispatchButton: (orderId) => {
        return new InlineKeyboard()
            .text('🚗 Kuryer yo\'lga chiqdi', `dispatch_${orderId}`);
    },

    // Delivered
    deliveredButton: (orderId) => {
        return new InlineKeyboard()
            .text('✅ Yetkazildi', `delivered_${orderId}`);
    },

    // Reject reasons
    rejectReasons: (orderId) => {
        return new InlineKeyboard()
            .text('💊 Dori mavjud emas', `reject_reason_${orderId}_nodrug`)
            .text('📦 Boshqa sabab', `reject_reason_${orderId}_other`);
    },

    // WebApp
    webApp: (url) => {
        return new InlineKeyboard()
            .webApp('🏥 Aptekani ochish', url);
    },
};

module.exports = keyboards;
