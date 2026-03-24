const mongoose = require('mongoose');

const bonusTransactionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
    },
    type: {
        type: String,
        enum: ['earn', 'use', 'promo', 'refund'],
        required: true,
    },
    points: { type: Number, required: true },
    balance: { type: Number, required: true },
    description: {
        uz: { type: String, default: '' },
        ru: { type: String, default: '' },
    },
    createdAt: { type: Date, default: Date.now },
});

bonusTransactionSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('BonusTransaction', bonusTransactionSchema);
