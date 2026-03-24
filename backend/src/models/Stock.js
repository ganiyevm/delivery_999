const mongoose = require('mongoose');

const stockSchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
    },
    branch: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Branch',
        required: true,
    },
    price: {
        type: Number,
        required: true,
        min: 0,
    },
    qty: {
        type: Number,
        default: 0,
        min: 0,
    },
    updatedAt: { type: Date, default: Date.now },
});

// Unique compound index — bitta filialda bitta dori faqat bir marta
stockSchema.index({ product: 1, branch: 1 }, { unique: true });
stockSchema.index({ branch: 1 });
stockSchema.index({ product: 1 });

stockSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model('Stock', stockSchema);
