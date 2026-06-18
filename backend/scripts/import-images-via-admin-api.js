/**
 * Admin API orqali TSV fayldagi rasm URL larini mahsulotlarga qo'yadi.
 *
 * Ishlatish:
 *   cd backend
 *   API_URL=https://apteka999-production.up.railway.app \
 *   ADMIN_USERNAME=admin ADMIN_PASSWORD=admin999 \
 *   TSV=../topilgan-rasmlar.tsv DRY_RUN=1 node scripts/import-images-via-admin-api.js
 *
 * Mavjud imageUrl saqlanadi. Ustidan yozish uchun OVERWRITE=1 bering.
 */
const fs = require('fs');
const path = require('path');

const API_URL = (process.env.API_URL || 'http://localhost:3000').replace(/\/+$/, '');
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin999';
const TSV_PATH = path.resolve(process.cwd(), process.env.TSV || '../topilgan-rasmlar.tsv');
const DRY_RUN = process.env.DRY_RUN === '1';
const OVERWRITE = process.env.OVERWRITE === '1';
const PAGE_LIMIT = parseInt(process.env.PAGE_LIMIT || '500', 10);
const RETRIES = parseInt(process.env.RETRIES || '5', 10);
const RETRY_DELAY_MS = parseInt(process.env.RETRY_DELAY_MS || '1000', 10);

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

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
    return raw.split(/\r?\n/)
        .slice(1)
        .map(line => {
            const [name, url] = line.split('\t');
            return { name: normalizeName(name), url: String(url || '').trim() };
        })
        .filter(row => row.name && row.url);
}

function parseBody(text) {
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
}

function bodyMessage(body) {
    if (!body) return '';
    if (typeof body === 'string') return body;
    return body.error || body.message || JSON.stringify(body);
}

async function request(pathname, options = {}) {
    let lastError;

    for (let attempt = 1; attempt <= RETRIES + 1; attempt++) {
        try {
            const response = await fetch(`${API_URL}${pathname}`, {
                ...options,
                headers: {
                    'content-type': 'application/json',
                    ...(options.headers || {}),
                },
            });
            const text = await response.text();
            const body = parseBody(text);

            if (!response.ok) {
                const error = new Error(`${options.method || 'GET'} ${pathname} -> ${response.status}: ${bodyMessage(body)}`);
                error.status = response.status;
                throw error;
            }
            return body;
        } catch (err) {
            lastError = err;
            const retryable = !err.status || err.status === 429 || err.status >= 500;
            if (!retryable || attempt > RETRIES) break;
            await sleep(RETRY_DELAY_MS * attempt);
        }
    }

    throw lastError;
}

async function login() {
    const body = await request('/api/auth/admin/login', {
        method: 'POST',
        body: JSON.stringify({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD }),
    });
    if (!body?.token) throw new Error('Admin token olinmadi');
    return body.token;
}

async function fetchProducts(token) {
    const products = [];
    let page = 1;
    let pages = 1;

    do {
        const data = await request(`/api/admin/products?page=${page}&limit=${PAGE_LIMIT}`, {
            headers: { authorization: `Bearer ${token}` },
        });
        products.push(...(data.products || []));
        pages = data.pagination?.pages || 1;
        page++;
    } while (page <= pages);

    return products;
}

async function main() {
    if (!fs.existsSync(TSV_PATH)) {
        throw new Error(`TSV topilmadi: ${TSV_PATH}`);
    }

    const tsvRows = parseTsv(TSV_PATH);
    const imageByName = new Map();
    let duplicateRows = 0;

    for (const row of tsvRows) {
        if (imageByName.has(row.name) && imageByName.get(row.name) !== row.url) duplicateRows++;
        imageByName.set(row.name, row.url);
    }

    const token = await login();
    const products = await fetchProducts(token);
    const unmatchedTsv = new Set(imageByName.keys());
    const updates = [];
    const skippedSamples = [];

    let matched = 0;
    let skippedExisting = 0;

    for (const product of products) {
        const key = normalizeName(product.name);
        const imageUrl = imageByName.get(key);
        if (!imageUrl) continue;

        matched++;
        unmatchedTsv.delete(key);

        if (product.imageUrl && !OVERWRITE) {
            skippedExisting++;
            if (skippedSamples.length < 10) skippedSamples.push(product.name);
            continue;
        }

        updates.push({ id: product._id, name: product.name, imageUrl });
    }

    let updated = 0;
    if (!DRY_RUN) {
        for (const item of updates) {
            await request(`/api/admin/products/${item.id}`, {
                method: 'PUT',
                headers: { authorization: `Bearer ${token}` },
                body: JSON.stringify({ imageUrl: item.imageUrl }),
            });
            updated++;
            if (updated % 50 === 0) console.log(`Updated ${updated}/${updates.length}`);
        }
    }

    console.log('API:', API_URL);
    console.log('TSV:', TSV_PATH);
    console.log('TSV rows:', tsvRows.length);
    console.log('TSV unique names:', imageByName.size);
    console.log('TSV duplicate name conflicts:', duplicateRows);
    console.log('Products:', products.length);
    console.log('Matched products:', matched);
    console.log('Skipped existing imageUrl:', skippedExisting);
    console.log(DRY_RUN ? 'Would update:' : 'Updated:', DRY_RUN ? updates.length : updated);
    console.log('Unmatched TSV names:', unmatchedTsv.size);

    if (updates.length) {
        console.log('\nSample updates:');
        updates.slice(0, 10).forEach(item => console.log('-', `${item.name} -> ${item.imageUrl}`));
    }

    if (skippedSamples.length) {
        console.log('\nSample skipped existing imageUrl:');
        skippedSamples.forEach(item => console.log('-', item));
    }
}

main().catch(err => {
    console.error('Xato:', err.message);
    process.exit(1);
});
