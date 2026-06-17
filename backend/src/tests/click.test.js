require('../tests/setup');
const request = require('supertest');
const crypto = require('crypto');
const app = require('../../server');
const Order = require('../models/Order');
const {
    connectTestDB, clearTestDB, disconnectTestDB,
    createTestUser, createTestBranch, createTestProduct,
    createTestStock, createTestOrder,
} = require('./helpers');

function makeSign({ click_trans_id, service_id, secret, merchant_trans_id, merchant_prepare_id = '', amount, action, sign_time }) {
    const str = `${click_trans_id}${service_id}${secret}${merchant_trans_id}${merchant_prepare_id}${amount}${action}${sign_time}`;
    return crypto.createHash('md5').update(str).digest('hex');
}

const SERVICE_ID = process.env.CLICK_SERVICE_ID;
const SECRET = process.env.CLICK_SECRET_KEY;

let order, orderNumber;

beforeAll(async () => {
    await connectTestDB();
    await clearTestDB();
    const { user } = await createTestUser();
    const branch = await createTestBranch();
    const product = await createTestProduct();
    await createTestStock(branch._id, product._id);
    order = await createTestOrder(user._id, branch._id, product._id, {
        status: 'awaiting_payment',
        paymentMethod: 'click',
        total: 10000,
    });
    orderNumber = order.orderNumber;
});

afterAll(async () => {
    await clearTestDB();
    await disconnectTestDB();
});

describe('Click Prepare (action=0)', () => {
    const click_trans_id = '111222333';
    const sign_time = '2026-01-01 12:00:00';
    const amount = '10000';

    test('To\'g\'ri sign bilan prepare muvaffaqiyatli o\'tishi kerak', async () => {
        const sign_string = makeSign({
            click_trans_id, service_id: SERVICE_ID, secret: SECRET,
            merchant_trans_id: orderNumber, amount, action: '0', sign_time,
        });

        const res = await request(app)
            .post('/click/prepare')
            .send({ click_trans_id, service_id: SERVICE_ID, merchant_trans_id: orderNumber, amount, action: '0', sign_time, sign_string });

        expect(res.status).toBe(200);
        expect(res.body.error).toBe(0);
        expect(res.body.merchant_prepare_id).toBeDefined();
    });

    test('Noto\'g\'ri sign bilan -1 xatosi qaytarishi kerak', async () => {
        const res = await request(app)
            .post('/click/prepare')
            .send({ click_trans_id, service_id: SERVICE_ID, merchant_trans_id: orderNumber, amount, action: '0', sign_time, sign_string: 'yalg_on_sign' });

        expect(res.body.error).toBe(-1);
    });

    test('Mavjud bo\'lmagan order uchun -5 xatosi qaytarishi kerak', async () => {
        const sign_string = makeSign({
            click_trans_id, service_id: SERVICE_ID, secret: SECRET,
            merchant_trans_id: 'APT-9999', amount, action: '0', sign_time,
        });

        const res = await request(app)
            .post('/click/prepare')
            .send({ click_trans_id, service_id: SERVICE_ID, merchant_trans_id: 'APT-9999', amount, action: '0', sign_time, sign_string });

        expect(res.body.error).toBe(-5);
    });

    test('Noto\'g\'ri summa bilan -2 xatosi qaytarishi kerak', async () => {
        const wrongAmount = '99999';
        const sign_string = makeSign({
            click_trans_id, service_id: SERVICE_ID, secret: SECRET,
            merchant_trans_id: orderNumber, amount: wrongAmount, action: '0', sign_time,
        });

        const res = await request(app)
            .post('/click/prepare')
            .send({ click_trans_id, service_id: SERVICE_ID, merchant_trans_id: orderNumber, amount: wrongAmount, action: '0', sign_time, sign_string });

        expect(res.body.error).toBe(-2);
    });
});

describe('Click Complete (action=1)', () => {
    const click_trans_id = '111222333';
    const sign_time = '2026-01-01 12:00:00';
    const amount = '10000';
    let merchant_prepare_id;

    beforeAll(async () => {
        // prepare dan prepareId olish
        const updated = await Order.findById(order._id);
        merchant_prepare_id = updated.clickPrepareId || String(Date.now());
    });

    test('To\'g\'ri sign bilan to\'lov tasdiqlanishi kerak', async () => {
        const sign_string = makeSign({
            click_trans_id, service_id: SERVICE_ID, secret: SECRET,
            merchant_trans_id: orderNumber, merchant_prepare_id,
            amount, action: '1', sign_time,
        });

        const res = await request(app)
            .post('/click/complete')
            .send({ click_trans_id, service_id: SERVICE_ID, merchant_trans_id: orderNumber, merchant_prepare_id, amount, action: '1', sign_time, sign_string, error: '0' });

        expect(res.status).toBe(200);
        expect(res.body.error).toBe(0);

        // DB tekshirish
        const updated = await Order.findById(order._id);
        expect(updated.paymentStatus).toBe('paid');
        // Operator allaqachon tasdiqlagan (awaiting_payment edi) → confirmed bo'lishi kerak
        expect(updated.status).toBe('confirmed');
    });

    test('Allaqachon to\'langan order uchun -4 xatosi', async () => {
        const sign_string = makeSign({
            click_trans_id, service_id: SERVICE_ID, secret: SECRET,
            merchant_trans_id: orderNumber, merchant_prepare_id,
            amount, action: '1', sign_time,
        });

        const res = await request(app)
            .post('/click/complete')
            .send({ click_trans_id, service_id: SERVICE_ID, merchant_trans_id: orderNumber, merchant_prepare_id, amount, action: '1', sign_time, sign_string, error: '0' });

        expect(res.body.error).toBe(-4);
    });
});
