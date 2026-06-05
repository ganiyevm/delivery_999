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

        // Stock upsert (price + qty + expiryDate).
        // MUHIM: bitta product+branch uchun faqat bitta Stock yozuvi bo'ladi
        // (unique index: product+branch). Agar bir chunk ichida bir xil product'ga
        // tushadigan bir necha item kelsa (turli ID, bir xil nom), ularning qty'sini
        // YIG'AMIZ — aks holda oxirgisi avvalgisining ustiga yozilib qoldiq kamayadi.
        const updatedAt = new Date();
        const byProduct = new Map(); // productId -> { productId, qty, price, expiryDate, batchMap }
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

            // MUHIM: qty va narx — T_RESEDUE_V'дан (to'g'ri, faqat bu filial).
            // RESIDUE.batches — barcha OTDEL (filiallar)ni o'z ichiga oladi, shuning uchun
            // batch.qty ISHONCHSIZ (jami oshib chiqadi). Batches faqat SERIA+NARX ko'rsatish uchun.
            const itemQty = Number(item.qty) || 0;
            const itemPrice = Number(item.price) || 0;
            if (itemQty <= 0 || itemPrice <= 0) { skipped++; continue; }
            const itemExp = item.expiryDate ? new Date(item.expiryDate) : null;
            const validItemExp = itemExp && !Number.isNaN(itemExp.getTime()) ? itemExp : null;

            const key = product._id.toString();
            let agg = byProduct.get(key);
            if (!agg) {
                agg = { productId: product._id, qty: 0, price: 0, expiryDate: null, batchMap: new Map() };
                byProduct.set(key, agg);
            }

            // Qty + narx: T_RESEDUE_V (authoritative, to'g'ri filial qoldig'i)
            agg.qty += itemQty;
            if (agg.price === 0 || itemPrice < agg.price) agg.price = itemPrice;
            if (validItemExp && (!agg.expiryDate || validItemExp < agg.expiryDate)) agg.expiryDate = validItemExp;

            // Batches: SERIA, NARX va QTY (agent OTDEL bo'yicha filtrlaydi — qty to'g'ri)
            if (Array.isArray(item.batches)) {
                for (const b of item.batches) {
                    const bp = Number(b.price) || 0;
                    const bqty = Number(b.qty) || 0;
                    if (bp <= 0 || bqty <= 0) continue;
                    const seria = (b.seria || '').toString().trim();
                    const exp = b.expiryDate ? new Date(b.expiryDate) : null;
                    const validExp = exp && !Number.isNaN(exp.getTime()) ? exp : null;
                    const bk = seria + '|' + bp + '|' + (validExp ? validExp.getTime() : '');
                    if (!agg.batchMap.has(bk)) {
                        agg.batchMap.set(bk, { seria, price: bp, qty: bqty, expiryDate: validExp });
                    } else {
                        agg.batchMap.get(bk).qty += bqty;
                    }
                }
            }
        }

        const stockOps = [];
        for (const agg of byProduct.values()) {
            if (agg.qty <= 0 || agg.price <= 0) { skipped++; continue; }
            const batches = [...agg.batchMap.values()].sort((a, b) => {
                const ea = a.expiryDate ? a.expiryDate.getTime() : Infinity;
                const eb = b.expiryDate ? b.expiryDate.getTime() : Infinity;
                if (ea !== eb) return ea - eb;
                return a.price - b.price;
            });
            stockOps.push({
                updateOne: {
                    filter: { product: agg.productId, branch: branch._id },
                    update: {
                        $set: {
                            price: agg.price,
                            qty: agg.qty,
                            expiryDate: agg.expiryDate,
                            batches,
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
            { $set: { qty: 0, batches: [], updatedAt: new Date() } }
        );
        zeroed = result.modifiedCount || 0;
    }

    console.log(
        `[sync] Filial #${branchNumber} chunk ${chunkIndex + 1}/${totalChunks} — ` +
        `upserted=${upserted}, skipped=${skipped}, zeroed=${zeroed}, finalized=${!!isLast}`
    );

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
