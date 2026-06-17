require('../tests/setup');
const request = require('supertest');
const app = require('../../server');
const Order = require('../models/Order');
const {
    connectTestDB, clearTestDB, disconnectTestDB,
    createTestUser, createTestBranch, createTestProduct, createTestStock,
} = require('./helpers');

let token, branchId, productId;

beforeAll(async () => {
    await connectTestDB();
    await clearTestDB();
    const { user, token: t } = await createTestUser();
    token = t;
    const branch = await createTestBranch();
    branchId = branch._id;
    const product = await createTestProduct();
    productId = product._id;
    await createTestStock(branchId, productId);
});

afterAll(async () => {
    await clearTestDB();
    await disconnectTestDB();
});

describe('Order yaratish', () => {
    test('Yangi order pending_operator statusida yaratilishi kerak', async () => {
        const res = await request(app)
            .post('/api/orders')
            .set('Authorization', `Bearer ${token}`)
            .send({
                items: [{ productId, productName: 'АНАЛЬГИН', qty: 2, price: 5000, branchId }],
                branchId,
                deliveryType: 'pickup',
                paymentMethod: 'click',
                customerName: 'Test Mijoz',
                phone: '+998901234567',
                subtotal: 10000,
                total: 10000,
            });

        expect(res.status).toBe(201);
        expect(res.body.order).toBeDefined();
        expect(res.body.order.status).toBe('pending_operator');
        expect(res.body.paymentUrl).toBe('');
    });

    test('Token bo\'lmasa 401 qaytarishi kerak', async () => {
        const res = await request(app)
            .post('/api/orders')
            .send({ items: [], branchId, total: 0 });

        expect(res.status).toBe(401);
    });

    test('Bo\'sh savat bilan order yaratib bo\'lmaydi', async () => {
        const res = await request(app)
            .post('/api/orders')
            .set('Authorization', `Bearer ${token}`)
            .send({
                items: [],
                branchId,
                deliveryType: 'pickup',
                paymentMethod: 'click',
                customerName: 'Test',
                phone: '+998901234567',
                subtotal: 0,
                total: 0,
            });

        expect(res.status).toBe(400);
    });

    test('Order orderNumber APT- bilan boshlanishi kerak', async () => {
        const order = await Order.findOne({ status: 'pending_operator' });
        expect(order.orderNumber).toMatch(/^APT-\d+$/);
    });
});

describe('Order bekor qilish', () => {
    let orderId;

    beforeEach(async () => {
        const res = await request(app)
            .post('/api/orders')
            .set('Authorization', `Bearer ${token}`)
            .send({
                items: [{ productId, productName: 'TEST', qty: 1, price: 5000, branchId }],
                branchId,
                deliveryType: 'pickup',
                paymentMethod: 'click',
                customerName: 'Test',
                phone: '+998901234567',
                subtotal: 5000,
                total: 5000,
            });
        orderId = res.body.order?.id || res.body.order?._id;
    });

    test('pending_operator orderini bekor qilib bo\'lmaydi', async () => {
        const res = await request(app)
            .post(`/api/orders/${orderId}/cancel`)
            .set('Authorization', `Bearer ${token}`);

        // pending_operator → bekor qilib bo'lmaydi (faqat awaiting_payment bekor qilinadi)
        expect(res.status).toBe(400);
    });
});
