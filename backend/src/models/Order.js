const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    productName: { type: String, default: '' },
    price: { type: Number, default: 0 },
    qty: { type: Number, default: 1 },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
}, { _id: false });

const statusHistorySchema = new mongoose.Schema({
    status: String,
    changedAt: { type: Date, default: Date.now },
    changedBy: { type: String, default: 'system' }, // system|operator|courier|user
    note: { type: String, default: '' },
}, { _id: false });

const orderSchema = new mongoose.Schema({
    orderNumber: {
        type: String,
        unique: true,
    },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    telegramId: Number,
    customerName: { type: String, default: '' },
    phone: { type: String, default: '' },

    items: [orderItemSchema],

    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },

    deliveryType: {
        type: String,
        enum: ['delivery', 'pickup'],
        default: 'delivery',
    },
    address: { type: String, default: '' },

    subtotal: { type: Number, default: 0 },
    deliveryCost: { type: Number, default: 0 },
    bonusDiscount: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    bonusEarned: { type: Number, default: 0 },

    paymentMethod: {
        type: String,
        enum: ['click', 'payme'],
        default: 'click',
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'failed', 'refunded'],
        default: 'pending',
    },
    paymentId: { type: String, default: '' },
    clickPrepareId: { type: String, default: '' }, // Click prepare bosqichidan kelgan merchant_prepare_id

    // 6 bosqich
    status: {
        type: String,
        enum: [
            'awaiting_payment',
            'pending_operator',
            'confirmed',
            'rejected',
            'on_the_way',
            'delivered',
            'cancelled',
        ],
        default: 'awaiting_payment',
        index: true,
    },

    statusHistory: [statusHistorySchema],

    operatorId: Number,
    courierId: Number,
    confirmedAt: Date,
    dispatchedAt: Date,
    deliveredAt: Date,
    notes: { type: String, default: '' },
}, {
    timestamps: true,
});

// Auto-generate orderNumber
orderSchema.pre('save', function (next) {
    if (!this.orderNumber) {
        this.orderNumber = 'APT' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 5).toUpperCase();
    }
    next();
});

orderSchema.index({ telegramId: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ branch: 1, status: 1 });

module.exports = mongoose.model('Order', orderSchema);
