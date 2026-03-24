const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    telegramId: {
        type: Number,
        unique: true,
        required: true,
        index: true,
    },
    firstName: { type: String, default: '' },
    lastName: { type: String, default: '' },
    username: { type: String, default: '' },
    phone: { type: String, default: '' },
    language: {
        type: String,
        enum: ['uz', 'ru'],
        default: 'uz',
    },
    bonusPoints: { type: Number, default: 0 },
    bonusTier: {
        type: String,
        enum: ['silver', 'gold', 'platinum'],
        default: 'silver',
    },
    addresses: [{
        title: { type: String, default: '' },
        address: { type: String, default: '' },
        lat: Number,
        lng: Number,
    }],
    favorites: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
    }],
    totalOrders: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
    isBlocked: { type: Boolean, default: false },
    registeredAt: { type: Date, default: Date.now },
    lastActiveAt: { type: Date, default: Date.now },
});

// Bonus darajasini avtomatik hisoblash
userSchema.methods.updateBonusTier = function () {
    if (this.bonusPoints >= 5000) this.bonusTier = 'platinum';
    else if (this.bonusPoints >= 2000) this.bonusTier = 'gold';
    else this.bonusTier = 'silver';
};

userSchema.pre('save', function (next) {
    this.updateBonusTier();
    next();
});

module.exports = mongoose.model('User', userSchema);
