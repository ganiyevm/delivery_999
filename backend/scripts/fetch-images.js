/**
 * Dorilarga eapteka.ru'dan nomга mos rasm topib imageUrl ga yozadi.
 *
 * Ishlatish:
 *   MONGODB_URI=... LIMIT=60 node scripts/fetch-images.js
 *   LIMIT bo'lmasa — hamma rasm yo'q mahsulotlar (qoldiqni davom ettiradi).
 *
 * Faqat imageUrl bo'sh mahsulotlarni oladi → qayta ishga tushirilsa, davom etadi.
 */
const { MongoClient } = require('mongodb');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const DELAY_MS = parseInt(process.env.DELAY || '300', 10); // Google: tez; DDG zaxira: DELAY=1500 bering
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Nomdan qidiruv so'rovini tozalash
function cleanQuery(name) {
    return String(name)
        .replace(/^\*+/, ' ')
        .replace(/\\/g, ' ')
        .replace(/[№N]\s*\d+/gi, ' ')   // N24, №6 — qadoq soni
        .replace(/[.,;()]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

// Moslikни tekshirish uchun: birinchi "ma'noli" so'z (>=4 harf, raqam emas)
function keyWord(name) {
    const cleaned = cleanQuery(name).toLowerCase();
    const tokens = cleaned.split(/[\s/]+/);
    for (const t of tokens) {
        const letters = t.replace(/[^a-zа-яё-]/gi, '');
        if (letters.replace(/-/g, '').length >= 4) return letters;
    }
    return tokens[0] || '';
}

async function getText(url) {
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'ru' }, redirect: 'follow' });
    if (!res.ok) return null;
    return res.text();
}

// Google Custom Search (JSON API) — ishonchli, bloklanmaydi.
// Kerak: GOOGLE_API_KEY va GOOGLE_CSE_ID (eapteka.ru ga sozlangan yoki butun web).
async function searchGoogle(query) {
    const key = process.env.GOOGLE_API_KEY;
    const cx = process.env.GOOGLE_CSE_ID;
    const url = `https://www.googleapis.com/customsearch/v1?key=${key}&cx=${cx}&num=5&q=${encodeURIComponent('eapteka ' + query)}`;
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
            if (res.status === 429) { await sleep(5000 * attempt); continue; } // limit — kut
            const data = await res.json();
            if (data.error) { console.log(`   Google xato: ${data.error.message}`); return null; }
            const items = data.items || [];
            for (const it of items) {
                const m = (it.link || '').match(/https:\/\/www\.eapteka\.ru\/goods\/id\d+\//);
                if (m) return m[0];
            }
            return null;
        } catch { await sleep(3000 * attempt); }
    }
    return null;
}

// DuckDuckGo (lite) — zaxira variant (bloklanishi mumkin).
// "anomaly" (202) blok bo'lsa — uzoq kutib qayta urinadi.
async function searchDDG(query) {
    for (let attempt = 1; attempt <= 4; attempt++) {
        try {
            const res = await fetch('https://lite.duckduckgo.com/lite/', {
                method: 'POST',
                headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded', 'Accept-Language': 'ru,en' },
                body: 'q=' + encodeURIComponent('eapteka ' + query),
            });
            const html = await res.text();
            if (res.status === 202 || /anomaly|unusual traffic/i.test(html)) {
                const wait = 30000 * attempt;
                console.log(`   …DDG blok (202), ${wait / 1000}s kutyapman`);
                await sleep(wait);
                continue;
            }
            const m = html.match(/href="(https:\/\/www\.eapteka\.ru\/goods\/id\d+\/)"/);
            if (m) return m[1];
            // eapteka chiqmasa — boshqa apteka bo'lishi mumkin; null
            return null;
        } catch {
            await sleep(3000 * attempt);
        }
    }
    return null;
}

// Dispatcher: kalit bo'lsa Google, bo'lmasa DDG
async function searchFirstGoods(query) {
    if (process.env.GOOGLE_API_KEY && process.env.GOOGLE_CSE_ID) return searchGoogle(query);
    return searchDDG(query);
}

async function imageFromGoods(goodsUrl) {
    const html = await getText(goodsUrl);
    if (!html) return null;
    // Mahsulot nomi (moslik tekshiruvi uchun)
    const titleM = html.match(/<title>([^<]+)<\/title>/i);
    const title = titleM ? titleM[1].toLowerCase() : '';
    // To'liq o'lchamli birinchi rasm
    const imgM = html.match(/offer_photo\/(\d+)\/(\d+)\/1_[a-f0-9]+\.(png|jpe?g)/i);
    if (!imgM) return null;
    const full = `https://cdn.eapteka.ru/upload/${imgM[0]}`;
    const resized = `https://cdn.eapteka.ru/upload/offer_photo/${imgM[1]}/${imgM[2]}/resized/450_450_1_${imgM[0].split('1_')[1]}`;
    return { title, full, resized };
}

async function isImage(url) {
    try {
        const res = await fetch(url, { headers: { 'User-Agent': UA }, method: 'GET' });
        return res.ok && /image/.test(res.headers.get('content-type') || '');
    } catch { return false; }
}

async function main() {
    const uri = process.env.MONGODB_URI;
    const limit = parseInt(process.env.LIMIT || '0', 10);
    const client = new MongoClient(uri);
    await client.connect();
    const P = client.db('apteka999').collection('products');

    const filter = { $or: [{ imageUrl: '' }, { imageUrl: null }, { imageUrl: { $exists: false } }] };
    let items;
    if (process.env.SAMPLE === '1') {
        // Tasodifiy namuna — real moslik foizini o'lchash uchun
        items = await P.aggregate([
            { $match: filter },
            { $sample: { size: limit > 0 ? limit : 60 } },
            { $project: { name: 1 } },
        ]).toArray();
    } else {
        const cursor = P.find(filter, { projection: { name: 1 } });
        if (limit > 0) cursor.limit(limit);
        items = await cursor.toArray();
    }

    console.log(`Ishlov beriladi: ${items.length} ta mahsulot\n`);
    let matched = 0, skipped = 0, n = 0;

    for (const prod of items) {
        n++;
        const label = prod.name.slice(0, 42).padEnd(42);
        try {
            const q = cleanQuery(prod.name);
            const goods = await searchFirstGoods(q);
            if (!goods) { skipped++; console.log(`✗ ${label} | topilmadi`); await sleep(DELAY_MS); continue; }

            const img = await imageFromGoods(goods);
            if (!img) { skipped++; console.log(`✗ ${label} | rasm yo'q`); await sleep(DELAY_MS); continue; }

            // Moslik: mahsulot sarlavhasida kalit so'z bo'lsin (noto'g'ri rasmni oldini olish)
            const kw = keyWord(prod.name);
            if (kw && img.title && !img.title.includes(kw)) {
                skipped++;
                console.log(`✗ ${label} | mos kelmadi (kw="${kw}")`);
                await sleep(DELAY_MS); continue;
            }

            // 450 resized ishlasa o'shani, bo'lmasa to'liq o'lchamni
            let finalUrl = await isImage(img.resized) ? img.resized : (await isImage(img.full) ? img.full : null);
            if (!finalUrl) { skipped++; console.log(`✗ ${label} | rasm ochilmadi`); await sleep(DELAY_MS); continue; }

            await P.updateOne({ _id: prod._id }, { $set: { imageUrl: finalUrl } });
            matched++;
            if (n % 10 === 0 || matched <= 15) console.log(`✓ ${label} | ${finalUrl.slice(-30)}`);
        } catch (e) {
            skipped++;
            console.log(`✗ ${label} | xato: ${e.message}`);
        }
        await sleep(DELAY_MS);
    }

    console.log(`\n=== TUGADI ===`);
    console.log(`Topildi va yozildi: ${matched}`);
    console.log(`Topilmadi/skip:     ${skipped}`);
    console.log(`Jami:               ${items.length}`);
    await client.close();
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
