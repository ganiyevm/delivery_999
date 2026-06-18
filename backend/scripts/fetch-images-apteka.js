/**
 * Dorilarga apteka.uz'dan ANIQ mos rasm (nom + doza + shakl) topib imageUrl ga yozadi.
 * Google/billing kerak emas. apteka.uz qidiruvи SSR; offer sahifасидаги rasmlar
 * KARUSEL bo'lib, har birида aniq ALT matni bor — rasm ALT bo'yicha tanlanadi
 * (pozitsiya emas), shuning uchun "boshqa dori" rasmи tushmaydi.
 *
 * Ishlatish:
 *   MONGODB_URI=... DRY_RUN=1 SAMPLE=1 LIMIT=20 node scripts/fetch-images-apteka.js
 *   MONGODB_URI=... LIMIT=200 DELAY=400 node scripts/fetch-images-apteka.js
 */
const { MongoClient } = require('mongodb');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const DELAY_MS = parseInt(process.env.DELAY || '400', 10);
const DRY_RUN = process.env.DRY_RUN === '1';
const PRODUCT_REGEX = process.env.PRODUCT_REGEX || '';
const START_AFTER = process.env.START_AFTER || '';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const TR = { а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'yo',ж:'j',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'x',ц:'ts',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'i',ь:'',э:'e',ю:'yu',я:'ya' };
const translit = s => s.toLowerCase().split('').map(c => (c in TR ? TR[c] : c)).join('');
const alnum = s => s.replace(/[^a-z0-9]/g, '');
// Kirill matnни solishtirish uchun normallashtirish: kichik harf, bo'shliqsiz, vergul→nuqta
const normRu = s => (s || '').toLowerCase().replace(/\s+/g, '').replace(/,/g, '.');

function cleanQuery(name) {
    return String(name).replace(/^\*+/, ' ').replace(/\\/g, ' ')
        .replace(/[№N]\s*\d+/gi, ' ').replace(/[.,;()]/g, ' ')
        .replace(/\s+/g, ' ').trim();
}
const FORM = /^(таблетки|таблетка|таб|табл|ампулы|ампула|амп|капсулы|капсула|капс|сироп|свеча|свечи|свеч|св|крем|мазь|гель|раствор|р-р|флакон|флаконы|флак|пакетики|пакет|порошок|пор|спрей|капли|драже|суспензия|сусп|шт|n|мл|мг|г|мкг|ме|ед)$/i;
function searchTerm(name) {
    const tokens = cleanQuery(name).split(' ');
    const out = [];
    for (const t of tokens) {
        if (/\d/.test(t)) break;
        if (FORM.test(t)) break;
        out.push(t);
        if (out.length >= 3) break;
    }
    return out.join(' ') || tokens[0] || '';
}
function keyAlnum(name) {
    const cleaned = cleanQuery(name);
    const tokens = cleaned.toLowerCase().split(/[\s/]+/);
    for (const t of tokens) {
        const letters = t.replace(/[^a-zа-яё-]/gi, '');
        if (letters.replace(/-/g, '').length >= 4) return alnum(translit(letters));
    }
    return alnum(translit(tokens[0] || ''));
}

function latinBrandTokens(name) {
    return cleanQuery(name)
        .split(/\s+/)
        .map(token => token.replace(/[^A-Za-z0-9-]/g, '').toLowerCase())
        .filter(token => token.length >= 3)
        .filter(token => !/^(for|men|iii?|iv|vi|u-?100|no|ml|mg|n\d*)$/i.test(token))
        .filter(token => !/^\d+$/.test(token));
}

// ─── Kirill (ALT bilan solishtirish uchun) ─────────────────────────────────
function nameWordRu(name) {
    const toks = name.replace(/^\*+/, '').split(/[\s,./()\\]+/);
    for (const t of toks) {
        const letters = t.replace(/[^А-Яа-яЁё-]/g, '');
        if (letters.replace(/-/g, '').length >= 4) return letters.toLowerCase();
    }
    return (toks.find(Boolean) || '').toLowerCase();
}
function dosesRu(name) {
    const set = new Set();
    const re = /(\d+(?:[.,]\d+)?)\s*(мг|мкг|ме|мл|%|г)/gi;
    let m;
    while ((m = re.exec(name)) !== null) {
        const v = parseFloat(m[1].replace(',', '.')), unit = m[2].toLowerCase();
        set.add(normRu(m[1] + unit));
        if (unit === 'мг') set.add(normRu((v / 1000) + 'г'));   // 500мг → 0.5г
        if (unit === 'г') set.add(normRu((v * 1000) + 'мг'));    // 0.5г → 500мг
    }
    return [...set];
}
const FORM_RU = ['таблет', 'капсул', 'капл', 'спрей', 'аэрозол', 'мазь', 'крем', 'гель', 'сироп', 'суспенз', 'ампул', 'суппозит', 'свеч', 'раствор', 'порош', 'пакет', 'лосьон', 'лосон', 'драже', 'флакон', 'аэроз'];
function formRu(name) { const l = name.toLowerCase(); return FORM_RU.find(f => l.includes(f)) || null; }
function countRu(name) { const m = name.match(/[№N]\s*(\d+)/i); return m ? m[1] : null; }

// ALT matni mahsulotга qanchalik mos — ball. -1 = nom/doza/shakl mos emas (rad).
function scoreAlt(alt, w) {
    const a = normRu(alt);
    if (!w.word || !a.includes(w.word)) return -1;
    if (w.latinBrands.length && !w.latinBrands.every(token => alnum(alt.toLowerCase()).includes(alnum(token)))) return -1;
    if (w.doses.length && !w.doses.some(d => a.includes(d))) return -1;
    if (w.form && !a.includes(w.form)) return -1;
    let s = 2;
    if (w.count && (a.includes('n' + w.count) || a.includes('№' + w.count))) s += 1;
    return s;
}

async function getText(url) {
    try {
        const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'ru,uz' }, redirect: 'follow' });
        if (!res.ok) return null;
        return res.text();
    } catch { return null; }
}

const validImg = u => /main\.apteka\.uz\/uploads\/(?:drugs|iblock)\//i.test(u) && !/logo|\/base\//i.test(u);

// apteka.uz qidiruv sahifасидаги Nuxt JSON'дан natijaларни olish:
// har biri {name (kirill), img (uploads/...webp yoki null)}.
async function searchResults(query) {
    const html = await getText(`https://apteka.uz/search/?q=${encodeURIComponent(query)}`);
    if (!html) return [];
    const m = html.match(/<script[^>]*id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (!m) return [];
    let arr;
    try { arr = JSON.parse(m[1]); } catch { return []; }
    if (!Array.isArray(arr)) return [];
    const rv = x => (Number.isInteger(x) && x >= 0 && x < arr.length) ? arr[x] : x;
    const out = [];
    for (const el of arr) {
        if (el && typeof el === 'object' && !Array.isArray(el) && 'slug' in el && 'image' in el && 'name' in el) {
            const name = rv(el.name), img = rv(el.image);
            if (typeof name === 'string') out.push({ name, img: typeof img === 'string' ? img : null });
        }
    }
    return out;
}

async function isImage(url) {
    try {
        const res = await fetch(url, { headers: { 'User-Agent': UA } });
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
    if (PRODUCT_REGEX) filter.name = new RegExp(PRODUCT_REGEX, 'i');
    if (START_AFTER && !PRODUCT_REGEX) filter.name = { $gt: START_AFTER };
    let items;
    if (process.env.SAMPLE === '1') {
        items = await P.aggregate([{ $match: filter }, { $sample: { size: limit > 0 ? limit : 60 } }, { $project: { name: 1 } }]).toArray();
    } else {
        const all = await P.find(filter, { projection: { name: 1 } }).toArray();
        const isCyr = s => /^[*\s\d.,()-]*[А-Яа-яЁё]/.test(s || '');
        const cyr = [], lat = [];
        for (const p of all) (isCyr(p.name) ? cyr : lat).push(p);
        items = [...cyr, ...lat];
        if (limit > 0) items = items.slice(0, limit);
        console.log(`Tartib: kirill ${cyr.length} + lotin ${lat.length}`);
    }

    console.log(`Ishlov: ${items.length} ta | DRY_RUN=${DRY_RUN ? '1' : '0'}\n`);
    let ok = 0, miss = 0, n = 0;
    for (const prod of items) {
        n++;
        const label = prod.name.slice(0, 44).padEnd(44);
        try {
            const q = searchTerm(prod.name);
            const w = { word: nameWordRu(prod.name), latinBrands: latinBrandTokens(prod.name), doses: dosesRu(prod.name), form: formRu(prod.name), count: countRu(prod.name) };
            const results = await searchResults(q);
            if (!results.length) { miss++; console.log(`✗ ${label} | natija yo'q`); await sleep(DELAY_MS); continue; }

            // Natija NOMи (kirill) nom+doza+shakl bo'yicha mos kelса, rasmи bor variantни tanlaymiz
            let best = null, bestScore = -1;
            for (const r of results) {
                if (!r.img) continue;
                const sc = scoreAlt(r.name, w);
                if (sc > bestScore) { bestScore = sc; best = r; }
            }
            if (!best || bestScore < 2) { miss++; console.log(`✗ ${label} | aniq mos rasm yo'q`); await sleep(DELAY_MS); continue; }
            const url = 'https://main.apteka.uz/' + best.img.replace(/^\/+/, '');
            if (!validImg(url) || !(await isImage(url))) { miss++; console.log(`✗ ${label} | rasm ochilmadi`); await sleep(DELAY_MS); continue; }

            if (!DRY_RUN) await P.updateOne({ _id: prod._id }, { $set: { imageUrl: url } });
            ok++;
            if (n % 10 === 0 || ok <= 25) console.log(`${DRY_RUN ? '✓' : '✅'} ${label} | s=${bestScore} | ${best.name.slice(0, 40)}`);
        } catch (e) {
            miss++; console.log(`✗ ${label} | xato: ${e.message}`);
        }
        await sleep(DELAY_MS);
    }
    console.log(`\n=== TUGADI ===\n${DRY_RUN ? 'Yozilardi' : 'Topildi'}: ${ok}\nMos kelmadi: ${miss}\nJami: ${items.length}`);
    await client.close();
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
