const mongoose = require('mongoose');

const branchSchema = new mongoose.Schema({
    number: {
        type: Number,
        required: true,
    },
    name: { type: String, required: true },
    address: { type: String, default: '' },
    phone: { type: String, default: '' },
    hours: { type: String, default: '09:00 — 22:00' },
    isOpen: { type: Boolean, default: true },
    operatorChatId: { type: Number, default: null },
    operatorIds: [{ type: Number }],
    courierIds: [{ type: Number }],
    location: {
        lat: { type: Number, default: 0 },
        lng: { type: Number, default: 0 },
    },
    isActive: { type: Boolean, default: true },
}, {
    timestamps: true,
});

branchSchema.index({ number: 1 });

module.exports = mongoose.model('Branch', branchSchema);
