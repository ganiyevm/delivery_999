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
    expiryDate: { type: Date, default: null }, // Eng yaqin tugaydigan partiya sanasi
    // Partiyalar — bir dori har xil seriya/narx/muddatда kelishi mumkin (mijozга hammasi ko'rinadi)
    batches: [{
        _id: false,
        seria: { type: String, default: '' },
        price: { type: Number, default: 0 },
        qty: { type: Number, default: 0 },
        expiryDate: { type: Date, default: null },
    }],
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
