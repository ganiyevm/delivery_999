const mongoose = require('mongoose');

const analyticsDailySchema = new mongoose.Schema({
    date: {
        type: Date,
        unique: true,
        required: true,
        index: true,
    },
    totalOrders: { type: Number, default: 0 },
    completedOrders: { type: Number, default: 0 },
    cancelledOrders: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    totalDeliveries: { type: Number, default: 0 },
    newUsers: { type: Number, default: 0 },
    activeUsers: { type: Number, default: 0 },
    topProducts: [{
        productId: mongoose.Schema.Types.ObjectId,
        name: String,
        qty: Number,
    }],
    topBranches: [{
        branchId: mongoose.Schema.Types.ObjectId,
        name: String,
        orders: Number,
    }],
    paymentStats: {
        click: { type: Number, default: 0 },
        payme: { type: Number, default: 0 },
    },
    avgOrderValue: { type: Number, default: 0 },
    avgDeliveryTime: { type: Number, default: 0 }, // daqiqalarda
});

module.exports = mongoose.model('AnalyticsDaily', analyticsDailySchema);
