const Product = require('../models/Product');
const Stock = require('../models/Stock');
const Branch = require('../models/Branch');
const { autoCategory } = require('../config/constants');

/**
 * Filial sync agent'dan kelgan chunk'ni qabul qilib MongoDB'ga yozish.
 *
 * Sync semantikasi: "snapshot" — agent yuborgan ro'yxat o'sha vaqtdagi to'liq qoldiq.
 * Oxirgi chunk (isLast=true) qabul qilinganda, syncStartedAt dan oldin yangilanmagan
 * stock yozuvlari qty=0 qilib qo'yiladi (ya'ni qoldiqdan tushib qolgan tovarlar).
 */
async function applyChunk({ branchNumber, syncStartedAt, chunkIndex, totalChunks, isLast, items }) {
    const branch = await Branch.findOne({ number: branchNumber });
    if (!branch) {
        throw new Error(`Filial #${branchNumber} bazada topilmadi (avval seed-branches.js ishga tushiring)`);
    }

    const startedAt = new Date(syncStartedAt);
    if (Number.isNaN(startedAt.getTime())) {
        throw new Error('syncStartedAt noto\'g\'ri sana');
    }

    let upserted = 0;
    let skipped = 0;

    if (items.length > 0) {
        // Mavjud product'larni name bo'yicha cache qilish — N+1'ni oldini olish
        const names = [...new Set(items.map(i => (i.name || '').trim()).filter(Boolean))];
        const existing = await Product.find({ name: { $in: names } }).lean();
        const productMap = new Map();
        existing.forEach(p => productMap.set(p.name.toLowerCase(), p));

        // Yangi product'larni topib bir martada yaratish
        const toCreate = [];
        for (const item of items) {
            const name = (item.name || '').trim();
            if (!name) continue;
            if (!productMap.has(name.toLowerCase())) {
                toCreate.push({
                    name,
                    manufacturer: (item.manufacturer || '').trim(),
                    country: (item.country || '').trim(),
                    category: autoCategory(name),
                });
            }
        }
        if (toCreate.length > 0) {
            // Duplikatlarni olib tashlash (bir chunk ichida bir xil nom kelishi mumkin)
            const uniqueByName = new Map();
            toCreate.forEach(p => uniqueByName.set(p.name.toLowerCase(), p));
            const created = await Product.insertMany([...uniqueByName.values()], { ordered: false }).catch(err => {
                // Duplicate barcode/unique konflikt bo'lishi mumkin — ignore
                console.warn('[sync] Product insertMany qisman xato:', err.message);
                return [];
            });
            created.forEach(p => productMap.set(p.name.toLowerCase(), p));
        }

        // Mavjud product'lardagi bo'sh manufacturer/country'ni to'ldirish
        const productUpdates = [];
        for (const item of items) {
            const name = (item.name || '').trim();
            if (!name) continue;
            const product = productMap.get(name.toLowerCase());
            if (!product) continue;
            const mfg = (item.manufacturer || '').trim();
            const country = (item.country || '').trim();
            const set = {};
            if (mfg && !product.manufacturer) set.manufacturer = mfg;
            if (country && !product.country) set.country = country;
            if (Object.keys(set).length > 0) {
                productUpdates.push({
                    updateOne: { filter: { _id: product._id }, update: { $set: set } },
                });
            }
        }
        if (productUpdates.length > 0) {
            await Product.bulkWrite(productUpdates, { ordered: false }).catch(err => {
                console.warn('[sync] Product update qisman xato:', err.message);
            });
        }

        // Stock bulk upsert (price + qty + expiryDate)
        const stockOps = [];
        const updatedAt = new Date();
        for (const item of items) {
            const name = (item.name || '').trim();
            if (!name) {
                skipped++;
                continue;
            }
            const product = productMap.get(name.toLowerCase());
            if (!product) {
                skipped++;
                continue;
            }
            const price = Number(item.price) || 0;
            const qty = Number(item.qty) || 0;
            if (price <= 0 || qty <= 0) {
                skipped++;
                continue;
            }
            const expiryDate = item.expiryDate ? new Date(item.expiryDate) : null;
            stockOps.push({
                updateOne: {
                    filter: { product: product._id, branch: branch._id },
                    update: {
                        $set: {
                            price,
                            qty,
                            expiryDate: expiryDate && !Number.isNaN(expiryDate.getTime()) ? expiryDate : null,
                            updatedAt,
                        },
                    },
                    upsert: true,
                },
            });
        }
        if (stockOps.length > 0) {
            await Stock.bulkWrite(stockOps, { ordered: false });
            upserted = stockOps.length;
        }
    }

    // Oxirgi chunk — qolgan tovarlarni qty=0 qilish
    let zeroed = 0;
    if (isLast) {
        const result = await Stock.updateMany(
            { branch: branch._id, updatedAt: { $lt: startedAt }, qty: { $gt: 0 } },
            { $set: { qty: 0, updatedAt: new Date() } }
        );
        zeroed = result.modifiedCount || 0;
    }

    return {
        branchNumber,
        chunkIndex,
        totalChunks,
        upserted,
        skipped,
        zeroed,
        finalized: !!isLast,
    };
}

module.exports = { applyChunk };
