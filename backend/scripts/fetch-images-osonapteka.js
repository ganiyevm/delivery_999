/**
 * Dorilarga osonapteka.uz Product/Search API orqali mos rasm topib imageUrl ga yozadi.
 *
 * Ishlatish:
 *   MONGODB_URI=... DRY_RUN=1 SAMPLE=1 LIMIT=30 node scripts/fetch-images-osonapteka.js
 *   MONGODB_URI=... LIMIT=200 DELAY=400 node scripts/fetch-images-osonapteka.js
 *
 * Faqat imageUrl bo'sh mahsulotlarni oladi. OVERWRITE=1 mavjud rasmlarni ham yangilaydi.
 */
require('dotenv').config();
const { MongoClient } = require('mongodb');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const BASE = 'https://osonapteka.uz/api/web';
const DELAY_MS = parseInt(process.env.DELAY || '400', 10);
const LIMIT = parseInt(process.env.LIMIT || '0', 10);
const DRY_RUN = process.env.DRY_RUN === '1';
const OVERWRITE = process.env.OVERWRITE === '1';
const SAMPLE = process.env.SAMPLE === '1';
const MIN_SCORE = parseInt(process.env.MIN_SCORE || '5', 10);
const PRODUCT_REGEX = process.env.PRODUCT_REGEX || '';
const START_AFTER = process.env.START_AFTER || '';
const API_URL = (process.env.API_URL || '').replace(/\/+$/, '');
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin999';
const PAGE_LIMIT = parseInt(process.env.PAGE_LIMIT || '500', 10);
const RETRIES = parseInt(process.env.RETRIES || '5', 10);
const RETRY_DELAY_MS = parseInt(process.env.RETRY_DELAY_MS || '1000', 10);

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
            'kapli', 'glaznye', 'glaznie', 'glaz', 'draje', 'suspenziya',
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

function doseGroups(name) {
    const groups = [];
    const comboRanges = [];
    const comboRe = /(\d[\d\s]*(?:[.,]\d+)?(?:\s*[+/]\s*\d[\d\s]*(?:[.,]\d+)?)+)\s*(мг|мкг|ме|мл|%|г|доз(?:а|ы)?|ед)/gi;
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

    const re = /(\d[\d\s]*(?:[.,]\d+)?)\s*(мг|мкг|ме|мл|%|г|доз(?:а|ы)?|ед)/gi;
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

function doses(name) {
    return doseGroups(name).flat();
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
    ['drops', /капли|кап\.?|гл\/капли|глаз|гл\/кап/i],
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
        if (candCompact.includes('№' + srcCount) || candCompact.includes('no' + srcCount) || candCompact.includes('n' + srcCount)) score += 1;
    }

    return score;
}

async function searchResults(query) {
    let lastError;

    for (let attempt = 1; attempt <= RETRIES + 1; attempt++) {
        try {
            const res = await fetch(`${BASE}/Product/Search`, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'accept': 'application/json',
                    'user-agent': UA,
                    'accept-language': 'uz,ru;q=0.9,en;q=0.8',
                },
                body: JSON.stringify({
                    pageSize: 20,
                    page: 1,
                    searchText: query,
                    showOnlyExistOnStore: true,
                    regionList: [],
                }),
            });
            const data = await res.json();
            const messages = (data?.messages || []).join(' ');

            if (!res.ok || /too many requests/i.test(messages)) {
                const error = new Error(messages || `Product/Search -> ${res.status}`);
                error.status = /too many requests/i.test(messages) ? 429 : res.status;
                throw error;
            }

            return data?.data?.items || [];
        } catch (err) {
            lastError = err;
            const retryable = !err.status || err.status === 429 || err.status >= 500;
            if (!retryable || attempt > RETRIES) break;
            await sleep(RETRY_DELAY_MS * attempt);
        }
    }

    throw lastError;
}

async function isImage(url) {
    try {
        const res = await fetch(url, { method: 'HEAD', headers: { 'user-agent': UA }, redirect: 'follow' });
        if (res.ok && /image/i.test(res.headers.get('content-type') || '')) return true;
        const get = await fetch(url, { method: 'GET', headers: { 'user-agent': UA }, redirect: 'follow' });
        if (!get.ok) return false;
        if (/image/i.test(get.headers.get('content-type') || '')) return true;
        const bytes = new Uint8Array(await get.arrayBuffer());
        const png = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
        const jpg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
        const webp = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
        return png || jpg || webp;
    } catch {
        return false;
    }
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

async function apiRequest(pathname, options = {}) {
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

async function apiLogin() {
    const body = await apiRequest('/api/auth/admin/login', {
        method: 'POST',
        body: JSON.stringify({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD }),
    });
    if (!body?.token) throw new Error('Admin token olinmadi');
    return body.token;
}

async function fetchAdminProducts(token) {
    const products = [];
    let page = 1;
    let pages = 1;

    do {
        const data = await apiRequest(`/api/admin/products?page=${page}&limit=${PAGE_LIMIT}`, {
            headers: { authorization: `Bearer ${token}` },
        });
        products.push(...(data.products || []));
        pages = data.pagination?.pages || 1;
        page++;
    } while (page <= pages);

    return products;
}

function hasImage(product) {
    return Boolean(String(product.imageUrl || '').trim());
}

function imageFilter() {
    const filter = OVERWRITE ? {} : { $or: [{ imageUrl: '' }, { imageUrl: null }, { imageUrl: { $exists: false } }] };
    if (PRODUCT_REGEX) filter.name = new RegExp(PRODUCT_REGEX, 'i');
    if (START_AFTER && !PRODUCT_REGEX) filter.name = { $gt: START_AFTER };
    return filter;
}

function productMatchesFilter(product) {
    if (!OVERWRITE && hasImage(product)) return false;
    if (PRODUCT_REGEX && !(new RegExp(PRODUCT_REGEX, 'i')).test(product.name || '')) return false;
    if (START_AFTER && !PRODUCT_REGEX && String(product.name || '') <= START_AFTER) return false;
    return true;
}

async function main() {
    let client = null;
    let productsCollection = null;
    let token = null;
    let items;

    if (API_URL) {
        token = await apiLogin();
        const all = await fetchAdminProducts(token);
        items = all.filter(productMatchesFilter).sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
        if (SAMPLE) {
            items = items.sort(() => Math.random() - 0.5).slice(0, LIMIT > 0 ? LIMIT : 50);
        } else if (LIMIT > 0) {
            items = items.slice(0, LIMIT);
        }
    } else {
        if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI yoki API_URL kerak');
        client = new MongoClient(process.env.MONGODB_URI);
        await client.connect();
        productsCollection = client.db('apteka999').collection('products');

        const filter = imageFilter();
        const projection = { name: 1, imageUrl: 1 };
        if (SAMPLE) {
            items = await productsCollection.aggregate([{ $match: filter }, { $sample: { size: LIMIT > 0 ? LIMIT : 50 } }, { $project: projection }]).toArray();
        } else {
            items = await productsCollection.find(filter, { projection }).sort({ name: 1 }).limit(LIMIT > 0 ? LIMIT : 0).toArray();
        }
    }

    console.log(`Ishlov: ${items.length} ta | DRY_RUN=${DRY_RUN ? '1' : '0'} | OVERWRITE=${OVERWRITE ? '1' : '0'} | source=${API_URL ? 'admin-api' : 'mongodb'}`);
    let checked = 0, matched = 0, updated = 0, missed = 0;

    for (const product of items) {
        checked++;
        const label = String(product.name || '').slice(0, 48).padEnd(48);
        const query = searchTerm(product.name);

        try {
            const results = await searchResults(query);
            let best = null;
            let bestScore = -1;

            for (const result of results) {
                if (!result.imageURI || !/^https:\/\/ref2\.osonapteka\.uz\/api\/ProductImage\/Show\//i.test(result.imageURI)) continue;
                const candidateName = [result.productName, result.productFullName, result.brandName, result.manufacturerName].filter(Boolean).join(' ');
                const score = scoreProduct(product.name, candidateName);
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

            if (!(await isImage(best.imageURI))) {
                missed++;
                console.log(`✗ ${label} | rasm ochilmadi | ${best.imageURI}`);
                await sleep(DELAY_MS);
                continue;
            }

            matched++;
            if (!DRY_RUN) {
                if (API_URL) {
                    await apiRequest(`/api/admin/products/${product._id}`, {
                        method: 'PUT',
                        headers: { authorization: `Bearer ${token}` },
                        body: JSON.stringify({ imageUrl: best.imageURI }),
                    });
                } else {
                    await productsCollection.updateOne({ _id: product._id }, { $set: { imageUrl: best.imageURI } });
                }
                updated++;
            }

            console.log(`${DRY_RUN ? '✓' : '✅'} ${label} | s=${bestScore} | ${best.productName} | ${best.imageURI}`);
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

    if (client) await client.close();
}

main().catch(err => {
    console.error('FATAL:', err.message);
    process.exit(1);
});
