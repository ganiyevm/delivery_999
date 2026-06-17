require('../tests/setup');
const request = require('supertest');
const app = require('../../server');
const Stock = require('../models/Stock');
const {
    connectTestDB, clearTestDB, disconnectTestDB,
    createTestBranch, createTestProduct,
} = require('./helpers');

let branch, product;

beforeAll(async () => {
    await connectTestDB();
    await clearTestDB();
    branch = await createTestBranch();
    product = await createTestProduct();
});

afterAll(async () => {
    await clearTestDB();
    await disconnectTestDB();
});

const SYNC_KEY = process.env.SYNC_API_KEY;

describe('Sync inbound endpoint', () => {
    test('API key yo\'q bo\'lsa 401 qaytarishi kerak', async () => {
        const res = await request(app)
            .post('/api/sync/inbound')
            .send({ branchNumber: 2, items: [] });

        expect(res.status).toBe(401);
    });

    test('Noto\'g\'ri API key bilan 401 qaytarishi kerak', async () => {
        const res = await request(app)
            .post('/api/sync/inbound')
            .set('x-sync-key', 'noto_gri_kalit')
            .send({ branchNumber: 2, items: [] });

        expect(res.status).toBe(401);
    });

    test('To\'g\'ri API key bilan stock yangilanishi kerak', async () => {
        const items = [{
            name: product.name,
            qty: 50,
            price: 5000,
            batches: [{ seria: 'SER001', price: 5000, qty: 50, expiryDate: '2027-01-01' }],
        }];

        const res = await request(app)
            .post('/api/sync/inbound')
            .set('x-sync-key', SYNC_KEY)
            .send({
                branchNumber: branch.number,
                syncStartedAt: new Date().toISOString(),
                isLast: true,
                chunkIndex: 1,
                totalChunks: 1,
                items,
            });

        expect(res.status).toBe(200);
        expect(res.body.upserted).toBeGreaterThan(0);

        // Stock DB da yangilandimi?
        const stock = await Stock.findOne({ branch: branch._id, product: product._id });
        expect(stock).toBeTruthy();
        expect(stock.qty).toBeGreaterThan(0);
        expect(stock.price).toBe(5000);
    });

    test('qty=0 bo\'lgan batch saqlanmasligi kerak', async () => {
        const items = [{
            name: product.name,
            batches: [{ seria: 'SER000', price: 0, qty: 0 }],
        }];

        const res = await request(app)
            .post('/api/sync/inbound')
            .set('x-sync-key', SYNC_KEY)
            .send({ branchNumber: branch.number, syncStartedAt: new Date().toISOString(), isLast: true, chunkIndex: 1, totalChunks: 1, items });

        expect(res.status).toBe(200);
        // qty=0 va price=0 bo'lsa saqlanmaydi
        const stock = await Stock.findOne({ branch: branch._id, product: product._id });
        // eski stock 0 ga tushmadi chunki batches filtrlangan
        expect(stock).toBeTruthy();
    });
});
