const Product = require('../models/Product');
const Stock = require('../models/Stock');
const Branch = require('../models/Branch');
const { autoCategory, BRANCHES_SEED } = require('../config/constants');
const cache = require('../utils/cache');

function normalizeBarcode(value) {
    const barcode = String(value || '').trim();
    return barcode || '';
}

function normalizeStringArray(value) {
    const arr = Array.isArray(value) ? value : [value];
    return [...new Set(arr.map(item => String(item || '').trim()).filter(Boolean))];
}

function normalizeNumberArray(value) {
    const arr = Array.isArray(value) ? value : [value];
    return [...new Set(arr
        .map(item => Number(item))
        .filter(item => Number.isFinite(item) && item > 0))];
}

const BRANCH_COORDS = new Map([
    [1,  { lat: 41.3135, lng: 69.3537 }],
    [2,  { lat: 41.3399, lng: 69.3126 }],
    [3,  { lat: 41.2782, lng: 69.2104 }],
    [4,  { lat: 41.2741, lng: 69.2012 }],
    [5,  { lat: 41.3092, lng: 69.2771 }],
    [6,  { lat: 41.3486, lng: 69.3091 }],
    [7,  { lat: 41.2952, lng: 69.2720 }],
    [8,  { lat: 41.3065, lng: 69.2793 }],
    [9,  { lat: 41.3261, lng: 69.3326 }],
    [10, { lat: 41.3282, lng: 69.3421 }],
    [11, { lat: 41.3643, lng: 69.2933 }],
    [12, { lat: 41.3195, lng: 69.3612 }],
    [14, { lat: 41.3017, lng: 69.2647 }],
    [15, { lat: 41.3512, lng: 69.3154 }],
    [16, { lat: 41.3567, lng: 69.3230 }],
    [17, { lat: 41.2157, lng: 69.2832 }],
    [18, { lat: 41.3318, lng: 69.3598 }],
    [19, { lat: 41.3201, lng: 69.3702 }],
    [20, { lat: 41.3658, lng: 69.3045 }],
]);

/**
 * Filial sync agent'dan kelgan chunk'ni qabul qilib MongoDB'ga yozish.
 *
 * Sync semantikasi: "snapshot" — agent yuborgan ro'yxat o'sha vaqtdagi to'liq qoldiq.
 * Oxirgi chunk (isLast=true) qabul qilinganda, syncStartedAt dan oldin yangilanmagan
 * stock yozuvlari qty=0 qilib qo'yiladi (ya'ni qoldiqdan tushib qolgan tovarlar).
 */
async function applyChunk({ branchNumber, syncStartedAt, chunkIndex, totalChunks, isLast, items }) {
    let branch = await Branch.findOne({ number: branchNumber });
    if (!branch) {
        const seed = BRANCHES_SEED.find(b => b.number === branchNumber);
        const displayName = seed
            ? `Аптека №${String(branchNumber).padStart(3, '0')} (${seed.name})`
            : `Аптека №${String(branchNumber).padStart(3, '0')}`;
        branch = await Branch.create({
            number: branchNumber,
            name: displayName,
            location: BRANCH_COORDS.get(branchNumber) || { lat: 0, lng: 0 },
            isOpen: true,
            isActive: true,
            isSynced: true,
        });
        console.log(`[sync] Filial #${branchNumber} bazada yo'q edi — avtomatik yaratildi`);
    } else if (!branch.isSynced) {
        branch.isSynced = true;
        await branch.save();
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
                    requiresRx: Boolean(item.requiresRx),
                    externalIds: normalizeStringArray([item.externalId]),
                    fomGoodIds: normalizeNumberArray([...(Array.isArray(item.fomGoodIds) ? item.fomGoodIds : [item.fomGoodIds]), item.fomGoodId]),
                    classCodes: normalizeStringArray([...(Array.isArray(item.classCodes) ? item.classCodes : [item.classCodes]), item.classCode]),
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
            const barcode = normalizeBarcode(item.barcode || item.goodBarcode);
            const externalIds = normalizeStringArray([item.externalId]);
            const fomGoodIds = normalizeNumberArray([...(Array.isArray(item.fomGoodIds) ? item.fomGoodIds : [item.fomGoodIds]), item.fomGoodId]);
            const classCodes = normalizeStringArray([...(Array.isArray(item.classCodes) ? item.classCodes : [item.classCodes]), item.classCode]);
            const set = {};
            const addToSet = {};
            if (mfg && !product.manufacturer) set.manufacturer = mfg;
            if (country && !product.country) set.country = country;
            if (item.requiresRx && !product.requiresRx) set.requiresRx = true;
            if (barcode && !product.barcode) set.barcode = barcode;
            if (externalIds.length > 0) addToSet.externalIds = { $each: externalIds };
            if (fomGoodIds.length > 0) addToSet.fomGoodIds = { $each: fomGoodIds };
            if (classCodes.length > 0) addToSet.classCodes = { $each: classCodes };
            const update = {};
            if (Object.keys(set).length > 0) update.$set = set;
            if (Object.keys(addToSet).length > 0) update.$addToSet = addToSet;
            if (Object.keys(update).length > 0) {
                productUpdates.push({
                    updateOne: { filter: { _id: product._id }, update },
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

    // Yangi mahsulot qo'shilgan bo'lishi mumkin — count cache ni tozalaymiz
    cache.delByPrefix('count:');

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
