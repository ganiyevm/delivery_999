// Pilot: 7 ta tanilgan doriga eapteka.ru rasm URL'ini qo'yish.
// Ishlatish:  MONGODB_URI=... node scripts/pilot-images.js
const https = require('https');
const { MongoClient, ObjectId } = require('mongodb');

const MAP = {
    '69c24429d132a67a3b1d690c': 'https://cdn.eapteka.ru/upload/offer_photo/218/055/resized/450_450_1_fbe8eee9d93c0b6e2e25ce6214e87e39.png', // НО-ШПА
    '69c2442ad132a67a3b1d6922': 'https://cdn.eapteka.ru/upload/offer_photo/250/621/resized/450_450_1_29f308ee498a81f9d2c74353468efbac.png', // НУРОФЕН детский
    '69c2441bd132a67a3b1d5860': 'https://cdn.eapteka.ru/upload/offer_photo/226/87/resized/450_450_1_7d3e495857b604324dc8b3f10597df96.png',  // АСПИРИН-С
    '69c24433d132a67a3b1d7392': 'https://cdn.eapteka.ru/upload/offer_photo/106/111/resized/450_450_1_e30d5f4acc0b0272fa75c6bd250a1c35.png', // ЦИТРАМОН П
    '69c2442fd132a67a3b1d6eae': 'https://cdn.eapteka.ru/upload/offer_photo/217/54/resized/450_450_1_451b608f0b30c394124f7b85fddbd3a7.png',  // СУПРАСТИН
    '69c24427d132a67a3b1d66e6': 'https://cdn.eapteka.ru/upload/offer_photo/223/23/resized/450_450_1_7887214856f5f4df72229ed7f335ecf5.png',  // МЕЗИМ ФОРТЕ
    '69c2442fd132a67a3b1d6f62': 'https://cdn.eapteka.ru/upload/offer_photo/322/69/resized/450_450_1_736751a13d2a8c98d09050a7436dc0da.png',  // ТЕРАФЛЮ
};

function check(url) {
    return new Promise(resolve => {
        const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
            res.resume();
            resolve({ code: res.statusCode, type: res.headers['content-type'] || '' });
        });
        req.on('error', () => resolve({ code: 0, type: 'err' }));
        req.setTimeout(15000, () => { req.destroy(); resolve({ code: 0, type: 'timeout' }); });
    });
}

async function main() {
    const uri = process.env.MONGODB_URI;
    const client = new MongoClient(uri);
    await client.connect();
    const P = client.db('apteka999').collection('products');

    let ok = 0;
    for (const [id, url] of Object.entries(MAP)) {
        const chk = await check(url);
        const valid = chk.code === 200 && /image/.test(chk.type);
        const prod = await P.findOne({ _id: new ObjectId(id) }, { projection: { name: 1 } });
        const label = prod ? prod.name.slice(0, 45) : id;
        if (valid) {
            await P.updateOne({ _id: new ObjectId(id) }, { $set: { imageUrl: url } });
            ok++;
            console.log(`✓ ${label}  [${chk.code} ${chk.type}]`);
        } else {
            console.log(`✗ SKIP ${label}  [${chk.code} ${chk.type}]`);
        }
    }
    console.log(`\nYangilandi: ${ok} / ${Object.keys(MAP).length}`);
    await client.close();
}

main().catch(e => { console.error('XATO:', e.message); process.exit(1); });
