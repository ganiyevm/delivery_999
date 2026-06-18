/**
 * TSV fayldagi aniq rasm URL larini mahsulotlarga qo'yadi.
 *
 * Ishlatish:
 *   cd backend
 *   TSV=../topilgan-rasmlar.tsv DRY_RUN=1 node scripts/import-images-from-tsv.js
 *   TSV=../topilgan-rasmlar.tsv node scripts/import-images-from-tsv.js
 *
 * Mavjud imageUrl saqlanadi. Ustidan yozish uchun OVERWRITE=1 bering.
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Product = require('../src/models/Product');

const TSV_PATH = path.resolve(process.cwd(), process.env.TSV || '../topilgan-rasmlar.tsv');
const DRY_RUN = process.env.DRY_RUN === '1';
const OVERWRITE = process.env.OVERWRITE === '1';

function normalizeName(value) {
    return String(value || '')
        .trim()
        .replace(/^\uFEFF/, '')
        .replace(/ё/g, 'е')
        .replace(/Ё/g, 'Е')
        .replace(/[«»"']/g, '')
        .replace(/\s+/g, ' ')
        .toUpperCase();
}

function parseTsv(filePath) {
    const raw = fs.readFileSync(filePath, 'utf8');
    const lines = raw.split(/\r?\n/).filter(line => line.trim());
    const rows = [];

    for (const line of lines.slice(1)) {
        const [name, url] = line.split('\t');
        const cleanName = normalizeName(name);
        const cleanUrl = String(url || '').trim();

        if (!cleanName || !cleanUrl) continue;
        rows.push({ name: cleanName, url: cleanUrl });
    }

    return rows;
}

async function main() {
    if (!process.env.MONGODB_URI) {
        throw new Error('MONGODB_URI topilmadi. backend/.env ni tekshiring.');
    }
    if (!fs.existsSync(TSV_PATH)) {
        throw new Error(`TSV topilmadi: ${TSV_PATH}`);
    }

    const tsvRows = parseTsv(TSV_PATH);
    const imageByName = new Map();
    let duplicateRows = 0;

    for (const row of tsvRows) {
        if (imageByName.has(row.name) && imageByName.get(row.name) !== row.url) {
            duplicateRows++;
        }
        imageByName.set(row.name, row.url);
    }

    await mongoose.connect(process.env.MONGODB_URI);

    const products = await Product.find({}, 'name imageUrl').lean();
    const ops = [];
    const unmatchedTsv = new Set(imageByName.keys());
    const matchedSamples = [];
    const skippedSamples = [];
    let matched = 0;
    let skippedExisting = 0;

    for (const product of products) {
        const key = normalizeName(product.name);
        const url = imageByName.get(key);
        if (!url) continue;

        matched++;
        unmatchedTsv.delete(key);

        if (product.imageUrl && !OVERWRITE) {
            skippedExisting++;
            if (skippedSamples.length < 10) {
                skippedSamples.push(product.name);
            }
            continue;
        }

        ops.push({
            updateOne: {
                filter: { _id: product._id },
                update: { $set: { imageUrl: url } },
            },
        });

        if (matchedSamples.length < 10) {
            matchedSamples.push(`${product.name} -> ${url}`);
        }
    }

    let modified = 0;
    if (!DRY_RUN && ops.length > 0) {
        const result = await Product.bulkWrite(ops, { ordered: false });
        modified = result.modifiedCount || 0;
    }

    console.log('TSV:', TSV_PATH);
    console.log('TSV rows:', tsvRows.length);
    console.log('TSV unique names:', imageByName.size);
    console.log('TSV duplicate name conflicts:', duplicateRows);
    console.log('Products:', products.length);
    console.log('Matched products:', matched);
    console.log('Skipped existing imageUrl:', skippedExisting);
    console.log(DRY_RUN ? 'Would update:' : 'Updated:', DRY_RUN ? ops.length : modified);
    console.log('Unmatched TSV names:', unmatchedTsv.size);

    if (matchedSamples.length) {
        console.log('\nSample updates:');
        matchedSamples.forEach(item => console.log('-', item));
    }

    if (skippedSamples.length) {
        console.log('\nSample skipped existing imageUrl:');
        skippedSamples.forEach(item => console.log('-', item));
    }

    await mongoose.disconnect();
}

main().catch(async err => {
    console.error('Xato:', err.message);
    try { await mongoose.disconnect(); } catch {}
    process.exit(1);
});
