const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Branch = require('../models/Branch');
const Product = require('../models/Product');
const Stock = require('../models/Stock');
const Order = require('../models/Order');

async function connectTestDB() {
    if (mongoose.connection.readyState === 0) {
        await mongoose.connect(process.env.MONGODB_URI);
    }
}

async function clearTestDB() {
    await Order.deleteMany({});
    await Stock.deleteMany({});
    await Product.deleteMany({});
    await Branch.deleteMany({});
    await User.deleteMany({});
}

async function disconnectTestDB() {
    await mongoose.disconnect();
}

async function createTestUser(overrides = {}) {
    const user = await User.create({
        telegramId: 9000000001,
        name: 'Test Mijoz',
        phone: '+998901234567',
        language: 'uz',
        ...overrides,
    });
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET);
    return { user, token };
}

async function createTestBranch(overrides = {}) {
    return Branch.create({
        number: 2,
        name: 'Аптека №002 (Test)',
        address: 'Test manzil',
        isActive: true,
        isSynced: true,
        operatorChatId: null,
        ...overrides,
    });
}

async function createTestProduct(overrides = {}) {
    return Product.create({
        name: 'АНАЛЬГИН таблетки 0.5г N10',
        isActive: true,
        ...overrides,
    });
}

async function createTestStock(branchId, productId, overrides = {}) {
    return Stock.create({
        branch: branchId,
        product: productId,
        qty: 100,
        price: 5000,
        isSynced: true,
        ...overrides,
    });
}

async function createTestOrder(userId, branchId, productId, overrides = {}) {
    return Order.create({
        user: userId,
        telegramId: 9000000001,
        customerName: 'Test Mijoz',
        phone: '+998901234567',
        branch: branchId,
        items: [{
            product: productId,
            productName: 'АНАЛЬГИН таблетки 0.5г N10',
            qty: 2,
            price: 5000,
            branchId,
        }],
        deliveryType: 'pickup',
        paymentMethod: 'click',
        subtotal: 10000,
        total: 10000,
        status: 'pending_operator',
        ...overrides,
    });
}

module.exports = {
    connectTestDB,
    clearTestDB,
    disconnectTestDB,
    createTestUser,
    createTestBranch,
    createTestProduct,
    createTestStock,
    createTestOrder,
};
