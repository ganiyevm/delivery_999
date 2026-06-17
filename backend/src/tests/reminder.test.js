require('../tests/setup');
const Order = require('../models/Order');
const Branch = require('../models/Branch');
const {
    connectTestDB, clearTestDB, disconnectTestDB,
    createTestUser, createTestBranch, createTestProduct,
    createTestStock, createTestOrder,
} = require('./helpers');

jest.mock('../services/telegram.service', () => ({
    remindOperator: jest.fn().mockResolvedValue({ ok: true }),
    notifyOperator: jest.fn().mockResolvedValue({ ok: true }),
    notifyUser: jest.fn().mockResolvedValue({ ok: true }),
    sendMessage: jest.fn().mockResolvedValue({ ok: true }),
}));

const telegramService = require('../services/telegram.service');

// createdAt ni mongoose timestamps chetlab o'tib yangilash
async function setCreatedAt(orderId, date) {
    await Order.collection.updateOne({ _id: orderId }, { $set: { createdAt: date } });
}

beforeAll(async () => {
    await connectTestDB();
    await clearTestDB();
});

afterEach(async () => {
    const Order = require('../models/Order');
    await Order.deleteMany({});
});

afterAll(async () => {
    await clearTestDB();
    await disconnectTestDB();
});

describe('Pending orders reminder logikasi', () => {
    test('notifyCount 0 dan boshlanishi kerak', async () => {
        const { user } = await createTestUser();
        const branch = await createTestBranch();
        const product = await createTestProduct();
        await createTestStock(branch._id, product._id);
        const order = await createTestOrder(user._id, branch._id, product._id);

        expect(order.notifyCount).toBe(0);
    });

    test('remindOperator chaqirilganda notifyCount oshishi kerak', async () => {
        const { user } = await createTestUser({ telegramId: 9000000002 });
        const branch = await createTestBranch({ number: 99, operatorChatId: 123456 });
        const product = await createTestProduct({ name: 'TEST DORI 2' });
        await createTestStock(branch._id, product._id);

        const order = await createTestOrder(user._id, branch._id, product._id);
        // 3 daqiqa oldin yaratilgan deb belgilaymiz
        await setCreatedAt(order._id, new Date(Date.now() - 3 * 60 * 1000));

        const cutoff = new Date(Date.now() - 2 * 60 * 1000);
        const pendingOrders = await Order.find({
            status: 'pending_operator',
            notifyCount: { $lt: 5 },
            createdAt: { $lt: cutoff },
        });

        expect(pendingOrders.length).toBeGreaterThan(0);

        for (const o of pendingOrders) {
            const b = await Branch.findById(o.branch);
            if (b?.operatorChatId) {
                await telegramService.remindOperator(o, b, o.notifyCount);
                await Order.updateOne({ _id: o._id }, { $inc: { notifyCount: 1 } });
            }
        }

        const updated = await Order.findById(order._id);
        expect(updated.notifyCount).toBe(1);
        expect(telegramService.remindOperator).toHaveBeenCalled();
    });

    test('operatorChatId yo\'q bo\'lsa reminder yuborilmasligi kerak', async () => {
        telegramService.remindOperator.mockClear();

        const { user } = await createTestUser({ telegramId: 9000000003 });
        const branch = await createTestBranch({ number: 98, operatorChatId: null });
        const product = await createTestProduct({ name: 'TEST DORI 3' });
        await createTestStock(branch._id, product._id);

        const order = await createTestOrder(user._id, branch._id, product._id);
        await setCreatedAt(order._id, new Date(Date.now() - 3 * 60 * 1000));

        const b = await Branch.findById(order.branch);
        if (b?.operatorChatId) {
            await telegramService.remindOperator(order, b, 0);
        }

        expect(telegramService.remindOperator).not.toHaveBeenCalled();
    });

    test('notifyCount 5 ga yetganda reminder tanlanmasligi kerak', async () => {
        const { user } = await createTestUser({ telegramId: 9000000004 });
        const branch = await createTestBranch({ number: 97, operatorChatId: 123456 });
        const product = await createTestProduct({ name: 'TEST DORI 4' });
        await createTestStock(branch._id, product._id);

        const order = await createTestOrder(user._id, branch._id, product._id, { notifyCount: 5 });
        await setCreatedAt(order._id, new Date(Date.now() - 20 * 60 * 1000));

        const cutoff = new Date(Date.now() - 2 * 60 * 1000);
        const found = await Order.findOne({
            _id: order._id,
            status: 'pending_operator',
            notifyCount: { $lt: 5 },
            createdAt: { $lt: cutoff },
        });

        expect(found).toBeNull();
    });
});
