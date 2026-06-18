/**
 * Dorilarga gopharm.uz'dan nom/doza/shakl bo'yicha mos rasm topib imageUrl ga yozadi.
 *
 * Ishlatish:
 *   MONGODB_URI=... DRY_RUN=1 LIMIT=50 node scripts/fetch-images-gopharm.js
 *   MONGODB_URI=... LIMIT=200 DELAY=500 node scripts/fetch-images-gopharm.js
 *
 * Faqat imageUrl bo'sh mahsulotlarni oladi. Mavjud rasmlarni o'zgartirish uchun OVERWRITE=1.
 */
require('dotenv').config();
const { MongoClient } = require('mongodb');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const BASE = 'https://gopharm.uz';
const DELAY_MS = parseInt(process.env.DELAY || '500', 10);
const LIMIT = parseInt(process.env.LIMIT || '0', 10);
const DRY_RUN = process.env.DRY_RUN === '1';
const OVERWRITE = process.env.OVERWRITE === '1';
const SAMPLE = process.env.SAMPLE === '1';
const MIN_SCORE = parseInt(process.env.MIN_SCORE || '5', 10);
const PRODUCT_REGEX = process.env.PRODUCT_REGEX || '';
const START_AFTER = process.env.START_AFTER || '';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const TR = { а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'j',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'x',ц:'ts',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'i',ь:'',э:'e',ю:'yu',я:'ya' };
const translit = s => String(s || '').toLowerCase().split('').map(c => (c in TR ? TR[c] : c)).join('');
const alnum = s => translit(s).replace(/[^a-z0-9]/g, '');
const normRu = s => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/,/g, '.').replace(/\s+/g, '');

const FORM_STOP = /^(таблетки|таблетка|табл|таб|ампулы|ампула|амп|капсулы|капсула|капс|сироп|свеча|свечи|свеч|св|крем|мазь|гель|раствор|р-р|флакон|флаконы|флак|пакетики|пакет|порошок|пор|спрей|капли|драже|суспензия|сусп|шт|n|мл|мг|г|мкг|ме|ед)$/i;

function cleanName(name) {
    return String(name || '')
        .replace(/^\*+/, ' ')
        .replace(/\\/g, ' ')
        .replace(/[«»"']/g, ' ')
        .replace(/[(),.;]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function searchTerm(name) {
    const tokens = cleanName(name)
        .replace(/[№N]\s*\d+/gi, ' ')
        .split(/\s+/)
        .filter(Boolean);
    const out = [];

    for (const token of tokens) {
        if (/\d/.test(token)) break;
        if (FORM_STOP.test(token)) break;
        out.push(token);
        if (out.length >= 3) break;
    }

    return out.join(' ') || tokens[0] || '';
}

function firstKey(name) {
    const tokens = cleanName(name).split(/[\s/]+/);
    for (const token of tokens) {
        const letters = token.replace(/[^A-Za-zА-Яа-яЁё-]/g, '');
        if (alnum(letters).length >= 4) return alnum(letters);
    }
    return alnum(tokens.find(Boolean) || '');
}

function latinBrandTokens(name) {
    return cleanName(name)
        .split(/\s+/)
        .map(token => token.replace(/[^A-Za-z0-9-]/g, '').toLowerCase())
        .filter(token => token.length >= 3)
        .filter(token => !/^(for|men|iii?|iv|vi|u-?100|no|ml|mg|n\d*)$/i.test(token))
        .filter(token => !/^\d+$/.test(token));
}

function significantTokens(name) {
    return cleanName(name)
        .split(/[\s/+]+/)
        .map(token => alnum(token.replace(/[^A-Za-zА-Яа-яЁё0-9-]/g, '')))
        .filter(token => token.length >= 4)
        .filter(token => ![
            'tabletki', 'tabletka', 'tabl', 'kapsuly', 'kapsula', 'kaps',
            'ampuly', 'ampula', 'amp', 'sirop', 'svechi', 'krem', 'maz',
            'gel', 'rastvor', 'flakon', 'poroshok', 'paketiki', 'sprej',
            'kapli', 'draje', 'suspenziya',
        ].includes(token));
}

function hasEnoughTokenOverlap(sourceName, candidateName) {
    const sourceTokens = [...new Set(significantTokens(sourceName))];
    if (sourceTokens.length < 2) return true;

    const candidateTokens = new Set(significantTokens(candidateName));
    const overlap = sourceTokens.filter(token => candidateTokens.has(token)).length;
    const required = sourceTokens.length >= 5 ? 4 : (sourceTokens.length >= 4 ? 3 : 2);

    return overlap >= required;
}

function doses(name) {
    return doseGroups(name).flat();
}

function doseGroups(name) {
    const groups = [];
    const comboRanges = [];
    const comboRe = /(\d[\d\s]*(?:[.,]\d+)?(?:\s*[+/]\s*\d[\d\s]*(?:[.,]\d+)?)+)\s*(мг|мкг|ме|мл|%|г|доз(?:а|ы)?)/gi;
    let combo;
    while ((combo = comboRe.exec(name)) !== null) {
        comboRanges.push([combo.index, combo.index + combo[0].length]);
        const unit = combo[2].toLowerCase().replace(/доза|дозы/g, 'доз');
        for (const part of combo[1].split(/[+/]/)) {
            const set = new Set();
            const raw = part.replace(/\s+/g, '').replace(',', '.');
            const value = parseFloat(raw);
            set.add(normRu(raw + unit));
            if (unit === 'мг') set.add(normRu((value / 1000) + 'г'));
            if (unit === 'г') set.add(normRu((value * 1000) + 'мг'));
            groups.push([...set]);
        }
    }

    const re = /(\d[\d\s]*(?:[.,]\d+)?)\s*(мг|мкг|ме|мл|%|г|доз(?:а|ы)?)/gi;
    let m;
    while ((m = re.exec(name)) !== null) {
        if (comboRanges.some(([start, end]) => m.index >= start && m.index < end)) continue;
        const set = new Set();
        const raw = m[1].replace(/\s+/g, '').replace(',', '.');
        const value = parseFloat(raw);
        const unit = m[2].toLowerCase().replace(/доза|дозы/g, 'доз');
        set.add(normRu(raw + unit));
        if (unit === 'мг') set.add(normRu((value / 1000) + 'г'));
        if (unit === 'г') set.add(normRu((value * 1000) + 'мг'));
        groups.push([...set]);
    }
    return groups;
}

function count(name) {
    const m = String(name || '').match(/[№N]\s*(\d+)/i);
    return m ? m[1] : null;
}

const FORM_GROUPS = [
    ['tab', /таблет|табл|таб\.?/i],
    ['caps', /капсул|капс\.?/i],
    ['amp', /ампул|амп\.?|инъ|ин\.|инъек/i],
    ['syrup', /сироп/i],
    ['drops', /капли|кап\.?/i],
    ['spray', /спрей|аэроз/i],
    ['cream', /крем/i],
    ['gel', /гель/i],
    ['ointment', /мазь/i],
    ['solution', /раствор|р-р/i],
    ['powder', /порош|пакет|саше/i],
    ['supp', /свеч|суппозит/i],
    ['flakon', /флакон|флак/i],
];

function forms(name) {
    const out = new Set();
    for (const [key, re] of FORM_GROUPS) {
        if (re.test(name)) out.add(key);
    }
    return [...out];
}

function scoreProduct(sourceName, candidateName) {
    const srcKey = firstKey(sourceName);
    const candKey = firstKey(candidateName);
    if (!srcKey || !candKey || srcKey !== candKey) return -1;

    const srcBrands = latinBrandTokens(sourceName);
    if (srcBrands.length) {
        const haystack = alnum(candidateName);
        if (!srcBrands.every(token => haystack.includes(alnum(token)))) return -1;
    }

    if (!hasEnoughTokenOverlap(sourceName, candidateName)) return -1;

    const candCompact = normRu(candidateName);
    const srcDoseGroups = doseGroups(sourceName);
    const candDoses = new Set(doses(candidateName));
    const srcForms = forms(sourceName);
    const candForms = forms(candidateName);
    const srcCount = count(sourceName);
    const candCount = count(candidateName);
    let score = 3;

    if (srcDoseGroups.length) {
        if (!srcDoseGroups.every(group => group.some(d => candDoses.has(d)))) return -1;
        if (!/[+/]/.test(sourceName) && /[+/]/.test(candidateName) && candDoses.size > srcDoseGroups.length) return -1;
        score += 2;
    }

    if (srcForms.length) {
        if (!srcForms.some(f => candForms.includes(f))) return -1;
        score += 1;
    }

    if (srcCount) {
        if (candCount && candCount !== srcCount) return -1;
        if (candCompact.includes('№' + srcCount) || candCompact.includes('no' + srcCount) || candCompact.includes('n' + srcCount)) {
            score += 1;
        }
    }

    return score;
}

async function getText(url) {
    const res = await fetch(url, {
        headers: { 'user-agent': UA, 'accept-language': 'ru,uz;q=0.9,en;q=0.8' },
        redirect: 'follow',
    });
    if (!res.ok) return null;
    return res.text();
}

function resolveNuxt(value, arr) {
    return Number.isInteger(value) && value >= 0 && value < arr.length ? arr[value] : value;
}

function parseProducts(html) {
    const m = html.match(/<script[^>]*id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (!m) return [];

    let arr;
    try { arr = JSON.parse(m[1]); } catch { return []; }
    if (!Array.isArray(arr)) return [];

    const out = [];
    for (const el of arr) {
        if (!el || typeof el !== 'object' || Array.isArray(el)) continue;
        if (!('name' in el) || !('image_thumbnail' in el) || !('slug' in el)) continue;

        const name = resolveNuxt(el.name, arr);
        const image = resolveNuxt(el.image_thumbnail, arr);
        const slug = resolveNuxt(el.slug, arr);

        if (typeof name !== 'string') continue;
        if (typeof image !== 'string') continue;
        if (!/^https:\/\/cdn\.gopharm\.uz\/drugs\//i.test(image)) continue;
        if (/\/default\.png$/i.test(image)) continue;

        out.push({ name, image, slug });
    }

    return out;
}

async function searchResults(query) {
    const html = await getText(`${BASE}/search?q=${encodeURIComponent(query)}`);
    if (!html) return [];
    return parseProducts(html);
}

async function isImage(url) {
    try {
        const res = await fetch(url, { method: 'HEAD', headers: { 'user-agent': UA } });
        return res.ok && /image/i.test(res.headers.get('content-type') || '');
    } catch {
        return false;
    }
}

function imageFilter() {
    const filter = OVERWRITE ? {} : { $or: [{ imageUrl: '' }, { imageUrl: null }, { imageUrl: { $exists: false } }] };
    if (PRODUCT_REGEX) filter.name = new RegExp(PRODUCT_REGEX, 'i');
    if (START_AFTER && !PRODUCT_REGEX) filter.name = { $gt: START_AFTER };
    return filter;
}

async function main() {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI kerak');

    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const products = client.db('apteka999').collection('products');

    let items;
    const filter = imageFilter();
    const projection = { name: 1, imageUrl: 1 };
    if (SAMPLE) {
        items = await products.aggregate([{ $match: filter }, { $sample: { size: LIMIT > 0 ? LIMIT : 50 } }, { $project: projection }]).toArray();
    } else {
        items = await products.find(filter, { projection }).sort({ name: 1 }).limit(LIMIT > 0 ? LIMIT : 0).toArray();
    }

    console.log(`Ishlov: ${items.length} ta | DRY_RUN=${DRY_RUN ? '1' : '0'} | OVERWRITE=${OVERWRITE ? '1' : '0'}`);
    let updated = 0, matched = 0, missed = 0, checked = 0;

    for (const product of items) {
        checked++;
        const label = String(product.name || '').slice(0, 48).padEnd(48);
        const query = searchTerm(product.name);

        try {
            const results = await searchResults(query);
            let best = null;
            let bestScore = -1;

            for (const result of results) {
                const score = scoreProduct(product.name, result.name);
                if (score > bestScore) {
                    best = result;
                    bestScore = score;
                }
            }

            if (!best || bestScore < MIN_SCORE) {
                missed++;
                console.log(`✗ ${label} | mos emas | q="${query}"`);
                await sleep(DELAY_MS);
                continue;
            }

            if (!(await isImage(best.image))) {
                missed++;
                console.log(`✗ ${label} | rasm ochilmadi | ${best.image}`);
                await sleep(DELAY_MS);
                continue;
            }

            matched++;
            if (!DRY_RUN) {
                await products.updateOne({ _id: product._id }, { $set: { imageUrl: best.image } });
                updated++;
            }

            console.log(`${DRY_RUN ? '✓' : '✅'} ${label} | s=${bestScore} | ${best.name} | ${best.image}`);
        } catch (err) {
            missed++;
            console.log(`✗ ${label} | xato: ${err.message}`);
        }

        await sleep(DELAY_MS);
    }

    console.log('\n=== TUGADI ===');
    console.log(`Tekshirildi: ${checked}`);
    console.log(`Mos topildi: ${matched}`);
    console.log(DRY_RUN ? `Yozilardi: ${matched}` : `Yozildi: ${updated}`);
    console.log(`Mos kelmadi: ${missed}`);

    await client.close();
}

main().catch(err => {
    console.error('FATAL:', err.message);
    process.exit(1);
});
