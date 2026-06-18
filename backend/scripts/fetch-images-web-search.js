/**
 * Qolgan rasmsiz mahsulotlarga web qidiruv orqali rasm topadi.
 *
 * Google Custom Search kalitlari bo'lsa Google JSON API ishlatiladi:
 *   GOOGLE_API_KEY=... GOOGLE_CSE_ID=... DRY_RUN=1 LIMIT=20 node scripts/fetch-images-web-search.js
 *
 * Kalit bo'lmasa DuckDuckGo lite ishlatiladi. Faqat sahifa nomi/matni doza-shakl bo'yicha
 * qat'iy mos kelsa va sahifadan ochiladigan product image topilsa yozadi.
 */
require('dotenv').config();
const { MongoClient } = require('mongodb');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const DELAY_MS = parseInt(process.env.DELAY || '900', 10);
const LIMIT = parseInt(process.env.LIMIT || '0', 10);
const DRY_RUN = process.env.DRY_RUN === '1';
const SAMPLE = process.env.SAMPLE === '1';
const PRODUCT_REGEX = process.env.PRODUCT_REGEX || '';
const START_AFTER = process.env.START_AFTER || '';
const MIN_SCORE = parseInt(process.env.MIN_SCORE || '6', 10);
const MAX_PAGES = parseInt(process.env.MAX_PAGES || '5', 10);

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const TR = { а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'j',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'x',ц:'ts',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'i',ь:'',э:'e',ю:'yu',я:'ya' };
const translit = s => String(s || '').toLowerCase().split('').map(c => (c in TR ? TR[c] : c)).join('');
const alnum = s => translit(s).replace(/[^a-z0-9]/g, '');
const normRu = s => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/,/g, '.').replace(/\s+/g, '');

const FORM_STOP = /^(таблетки|таблетка|табл|таб|ампулы|ампула|амп|капсулы|капсула|капс|сироп|свеча|свечи|свеч|св|крем|мазь|гель|раствор|р-р|флакон|флаконы|флак|пакетики|пакет|порошок|пор|спрей|капли|драже|суспензия|сусп|шт|n|мл|мг|г|мкг|ме|ед)$/i;
const BAD_DOMAINS = /(youtube|youtu\.be|facebook|instagram|tiktok|telegram|pinterest|wikipedia|wikimedia|reddit|olx|avito|amazon|ebay)\./i;
const BAD_IMAGES = /(logo|favicon|sprite|placeholder|default|no[-_]?image|avatar|banner|icon)/i;

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
        if (out.length >= 4) break;
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
            'kapli', 'draje', 'suspenziya', 'ofitsialnyj', 'instruktsiya',
            'primeneniyu', 'kupit', 'tsena', 'aptekah',
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
        if (candCompact.includes('№' + srcCount) || candCompact.includes('no' + srcCount) || candCompact.includes('n' + srcCount)) score += 1;
    }

    return score;
}

function htmlDecode(str) {
    return String(str || '')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
}

async function getText(url) {
    try {
        const res = await fetch(url, {
            headers: { 'user-agent': UA, 'accept-language': 'ru,uz;q=0.9,en;q=0.8' },
            redirect: 'follow',
        });
        if (!res.ok) return null;
        const type = res.headers.get('content-type') || '';
        if (!/text\/html|application\/xhtml/i.test(type)) return null;
        return res.text();
    } catch {
        return null;
    }
}

async function isImage(url) {
    try {
        const res = await fetch(url, { method: 'HEAD', headers: { 'user-agent': UA }, redirect: 'follow' });
        return res.ok && /image/i.test(res.headers.get('content-type') || '');
    } catch {
        return false;
    }
}

function absoluteUrl(url, pageUrl) {
    try {
        return new URL(htmlDecode(url), pageUrl).href;
    } catch {
        return null;
    }
}

function searchQuery(productName) {
    const q = searchTerm(productName);
    const dose = doseGroups(productName).map(g => g[0]).slice(0, 3).join(' ');
    return [q, dose, 'официальный сайт фото'].filter(Boolean).join(' ');
}

async function searchGoogle(query) {
    const key = process.env.GOOGLE_API_KEY;
    const cx = process.env.GOOGLE_CSE_ID;
    if (!key || !cx) return null;

    const url = `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(key)}&cx=${encodeURIComponent(cx)}&num=6&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items || []).map(item => ({
        title: item.title || '',
        snippet: item.snippet || '',
        url: item.link || '',
    })).filter(item => /^https?:\/\//i.test(item.url));
}

function extractDdgLinks(html) {
    const links = [];
    const re = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let m;
    while ((m = re.exec(html)) !== null) {
        let href = htmlDecode(m[1]);
        const title = htmlDecode(m[2].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
        if (href.startsWith('//duckduckgo.com/l/?')) href = 'https:' + href;
        if (/duckduckgo\.com\/l\//i.test(href)) {
            try {
                const u = new URL(href);
                href = u.searchParams.get('uddg') || href;
            } catch {}
        }
        if (!/^https?:\/\//i.test(href)) continue;
        if (BAD_DOMAINS.test(href)) continue;
        if (links.some(link => link.url === href)) continue;
        links.push({ title, snippet: '', url: href });
    }
    return links.slice(0, 8);
}

async function searchDdg(query) {
    const res = await fetch('https://lite.duckduckgo.com/lite/', {
        method: 'POST',
        headers: {
            'user-agent': UA,
            'content-type': 'application/x-www-form-urlencoded',
            'accept-language': 'ru,en;q=0.8',
        },
        body: 'q=' + encodeURIComponent(query),
    });
    const html = await res.text();
    if (res.status === 202 || /anomaly|unusual traffic/i.test(html)) return [];
    return extractDdgLinks(html);
}

async function searchPages(query) {
    const google = await searchGoogle(query);
    if (google) return google;
    return searchDdg(query);
}

async function searchBingImages(query) {
    const url = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&safeSearch=Strict`;
    const res = await fetch(url, {
        headers: {
            'user-agent': UA,
            'accept-language': 'ru,uz;q=0.9,en;q=0.8',
        },
    });
    if (!res.ok) return [];
    const html = await res.text();
    const out = [];
    const re = /<a[^>]+class=["'][^"']*\biusc\b[^"']*["'][^>]+m=["']([^"']+)["'][^>]*>/gi;
    let m;
    while ((m = re.exec(html)) !== null) {
        try {
            const data = JSON.parse(htmlDecode(m[1]));
            const image = htmlDecode(data.murl || '');
            const pageUrl = htmlDecode(data.purl || '');
            const name = htmlDecode(data.t || '');
            if (!/^https?:\/\//i.test(image)) continue;
            if (BAD_IMAGES.test(image)) continue;
            if (pageUrl && BAD_DOMAINS.test(pageUrl)) continue;
            if (out.some(item => item.image === image)) continue;
            out.push({ name, image, pageUrl });
        } catch {}
    }
    return out.slice(0, 12);
}

function metaContent(html, re) {
    const m = html.match(re);
    return m ? htmlDecode(m[1].trim()) : '';
}

function extractJsonLdImages(html, pageUrl) {
    const out = [];
    const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let m;
    while ((m = re.exec(html)) !== null) {
        try {
            const data = JSON.parse(htmlDecode(m[1]));
            const stack = Array.isArray(data) ? [...data] : [data];
            while (stack.length) {
                const item = stack.pop();
                if (!item || typeof item !== 'object') continue;
                if (item.image) {
                    const images = Array.isArray(item.image) ? item.image : [item.image];
                    for (const img of images) {
                        const raw = typeof img === 'string' ? img : img.url;
                        const url = raw && absoluteUrl(raw, pageUrl);
                        if (url) out.push(url);
                    }
                }
                for (const value of Object.values(item)) {
                    if (Array.isArray(value)) stack.push(...value);
                    else if (value && typeof value === 'object') stack.push(value);
                }
            }
        } catch {}
    }
    return out;
}

function extractCandidates(html, pageUrl) {
    const title = metaContent(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
    const ogTitle = metaContent(html, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["'][^>]*>/i);
    const h1 = metaContent(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i).replace(/<[^>]+>/g, ' ');
    const description = metaContent(html, /<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']+)["'][^>]*>/i);
    const textName = [ogTitle, title, h1, description].filter(Boolean).join(' | ');

    const images = [];
    for (const re of [
        /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["'][^>]*>/gi,
        /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["'][^>]*>/gi,
        /<img[^>]+(?:src|data-src|data-original)=["']([^"']+)["'][^>]*>/gi,
    ]) {
        let m;
        while ((m = re.exec(html)) !== null) {
            const url = absoluteUrl(m[1], pageUrl);
            if (url && !BAD_IMAGES.test(url) && !images.includes(url)) images.push(url);
        }
    }
    for (const url of extractJsonLdImages(html, pageUrl)) {
        if (!BAD_IMAGES.test(url) && !images.includes(url)) images.push(url);
    }

    return images.slice(0, 8).map(image => ({ name: textName, image, pageUrl }));
}

async function bestFromPage(productName, page) {
    if (!page.url || BAD_DOMAINS.test(page.url)) return null;
    const html = await getText(page.url);
    if (!html) return null;

    let best = null;
    let bestScore = -1;
    for (const c of extractCandidates(html, page.url)) {
        const combinedName = [c.name, page.title, page.snippet].filter(Boolean).join(' | ');
        const score = scoreProduct(productName, combinedName);
        if (score > bestScore) {
            best = { ...c, name: combinedName, score };
            bestScore = score;
        }
    }
    if (!best || bestScore < MIN_SCORE) return null;
    if (!(await isImage(best.image))) return null;
    return best;
}

async function bestFromBingImages(productName, query) {
    const images = await searchBingImages(query);
    let best = null;
    let bestScore = -1;

    for (const item of images) {
        const combinedName = [item.name, item.pageUrl].filter(Boolean).join(' | ');
        const score = scoreProduct(productName, combinedName);
        if (score > bestScore) {
            best = { ...item, score };
            bestScore = score;
        }
    }

    if (!best || bestScore < MIN_SCORE) return null;
    if (!(await isImage(best.image))) return null;
    return best;
}

function imageFilter() {
    const filter = { $or: [{ imageUrl: '' }, { imageUrl: null }, { imageUrl: { $exists: false } }] };
    if (PRODUCT_REGEX) filter.name = new RegExp(PRODUCT_REGEX, 'i');
    if (START_AFTER && !PRODUCT_REGEX) filter.name = { $gt: START_AFTER };
    return filter;
}

async function main() {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI kerak');

    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const products = client.db('apteka999').collection('products');

    const filter = imageFilter();
    const projection = { name: 1, imageUrl: 1 };
    let items;
    if (SAMPLE) {
        items = await products.aggregate([{ $match: filter }, { $sample: { size: LIMIT > 0 ? LIMIT : 40 } }, { $project: projection }]).toArray();
    } else {
        items = await products.find(filter, { projection }).sort({ name: 1 }).limit(LIMIT > 0 ? LIMIT : 0).toArray();
    }

    console.log(`Ishlov: ${items.length} ta | DRY_RUN=${DRY_RUN ? '1' : '0'} | provider=${process.env.GOOGLE_API_KEY ? 'google' : 'ddg'}`);
    let checked = 0, matched = 0, updated = 0, missed = 0;

    for (const product of items) {
        checked++;
        const label = String(product.name || '').slice(0, 48).padEnd(48);
        const query = searchQuery(product.name);

        try {
            const pages = await searchPages(query);
            let best = await bestFromBingImages(product.name, query);
            for (const page of pages.slice(0, MAX_PAGES)) {
                if (best) break;
                best = await bestFromPage(product.name, page);
                if (best) break;
                await sleep(Math.max(150, Math.floor(DELAY_MS / 3)));
            }

            if (!best) {
                missed++;
                console.log(`✗ ${label} | mos emas | q="${query}"`);
                await sleep(DELAY_MS);
                continue;
            }

            matched++;
            if (!DRY_RUN) {
                await products.updateOne({ _id: product._id }, { $set: { imageUrl: best.image } });
                updated++;
            }
            console.log(`${DRY_RUN ? '✓' : '✅'} ${label} | s=${best.score} | ${best.pageUrl} | ${best.image}`);
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
