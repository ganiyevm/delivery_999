jest.mock('../models/Order', () => ({
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    updateOne: jest.fn(),
}));
jest.mock('../models/Stock', () => ({
    findOneAndUpdate: jest.fn(),
    updateOne: jest.fn(),
}));
jest.mock('../services/bonus.service', () => ({ refundBonus: jest.fn() }));
jest.mock('../services/telegram.service', () => ({ notifyUser: jest.fn(() => Promise.resolve()) }));

const Order = require('../models/Order');
const Stock = require('../models/Stock');
const BonusService = require('../services/bonus.service');
const telegramService = require('../services/telegram.service');
const { acceptOrder, rejectOrder } = require('../services/orderDecision.service');

const baseOrder = {
    _id: 'order-1',
    branch: 'branch-1',
    status: 'pending_operator',
    paymentMethod: 'cash',
    paymentStatus: 'pending',
    telegramId: 123,
    orderNumber: 'APT-0001',
    notes: '',
    items: [{ product: 'product-1', productName: 'Kreon', qty: 2 }],
};

beforeEach(() => jest.clearAllMocks());

test('qabul qilish qoldiqni bir marta ayiradi', async () => {
    Order.findOne.mockResolvedValue({ ...baseOrder });
    Order.findOneAndUpdate.mockResolvedValue({ ...baseOrder, status: 'confirmed', stockReservedAt: new Date() });
    Stock.findOneAndUpdate.mockResolvedValue({ qty: 8 });

    const result = await acceptOrder({
        orderId: 'order-1', branchId: 'branch-1', actor: 'Ali', source: 'desktop',
    });

    expect(result.status).toBe('confirmed');
    expect(Stock.findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(Stock.findOneAndUpdate).toHaveBeenCalledWith(
        { product: 'product-1', branch: 'branch-1', qty: { $gte: 2 } },
        { $inc: { qty: -2 } },
        { new: true }
    );
    expect(telegramService.notifyUser).toHaveBeenCalledWith(123, 'confirmed', expect.any(Object));
});

test('allaqachon qabul qilingan buyurtma ikkinchi marta o‘tmaydi', async () => {
    Order.findOne.mockResolvedValue({ ...baseOrder, stockReservedAt: new Date() });
    await expect(acceptOrder({ orderId: 'order-1', branchId: 'branch-1' }))
        .rejects.toMatchObject({ statusCode: 409 });
    expect(Stock.findOneAndUpdate).not.toHaveBeenCalled();
});

test('rad etishda sabab va izoh saqlanadi', async () => {
    Order.findOne.mockResolvedValue({ ...baseOrder });
    Order.findOneAndUpdate.mockResolvedValue({
        ...baseOrder,
        status: 'rejected',
        rejectionReason: 'Dori mavjud emas',
        rejectionComment: 'O‘rniga boshqa doza mavjud',
    });

    const result = await rejectOrder({
        orderId: 'order-1',
        branchId: 'branch-1',
        reason: 'Dori mavjud emas',
        comment: 'O‘rniga boshqa doza mavjud',
        actor: 'Ali',
        source: 'desktop',
    });

    expect(result.status).toBe('rejected');
    expect(BonusService.refundBonus).toHaveBeenCalled();
    expect(telegramService.notifyUser).toHaveBeenCalledWith(123, 'rejected', expect.any(Object));
    expect(Order.findOneAndUpdate).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
            $set: expect.objectContaining({
                rejectionReason: 'Dori mavjud emas',
                rejectionComment: 'O‘rniga boshqa doza mavjud',
            }),
        }),
        { new: true }
    );
});

test('izoh juda qisqa bo‘lsa rad etilmaydi', async () => {
    await expect(rejectOrder({
        orderId: 'order-1', branchId: 'branch-1', reason: 'Boshqa', comment: 'yo‘q',
    })).rejects.toMatchObject({ statusCode: 400 });
    expect(Order.findOne).not.toHaveBeenCalled();
});
