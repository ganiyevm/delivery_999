const mongoose = require('mongoose');
const { CATEGORY_KEYS } = require('../config/constants');

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        index: 'text',
    },
    category: {
        type: String,
        enum: CATEGORY_KEYS,
        default: 'other',
        index: true,
    },
    manufacturer: { type: String, default: '' },
    country: { type: String, default: '' },
    barcode: {
        type: String,
        unique: true,
        sparse: true,
    },
    externalIds: [{ type: String }],
    fomGoodIds: [{ type: Number }],
    classCodes: [{ type: String }],
    ingredient: { type: String, default: '' },
    description: {
        uz: { type: String, default: '' },
        ru: { type: String, default: '' },
    },
    analogs: [{ type: String }],
    requiresRx: { type: Boolean, default: false },
    imageType: { type: String, default: 'blister' },
    imageUrl: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
}, {
    timestamps: true,
});

// Text index qidiruv uchun (foydalanuvchining qidiruvi)
productSchema.index({ name: 'text', ingredient: 'text', manufacturer: 'text' });

// Sync uchun: name bo'yicha aniq qidiruv ($in operator) — collection scan'ni oldini olish
productSchema.index({ name: 1 });
productSchema.index({ fomGoodIds: 1 });

module.exports = mongoose.model('Product', productSchema);
