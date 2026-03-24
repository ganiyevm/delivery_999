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

// Text index qidiruv uchun
productSchema.index({ name: 'text', ingredient: 'text', manufacturer: 'text' });

module.exports = mongoose.model('Product', productSchema);
