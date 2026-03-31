const router = require('express').Router();
const Product = require('../models/Product');

// GS1 DataMatrix dan GTIN ajratib olish
// Format: 01{14 raqam}21{serial}...
function parseGS1(code) {
    const result = {};
    let i = 0;
    const clean = code.replace(/\x1d/g, '').replace(/\x1e/g, '').replace(/\x04/g, '');
    while (i < clean.length) {
        const ai = clean.slice(i, i + 2);
        if (ai === '01') {
            result.gtin = clean.slice(i + 2, i + 16);
            result.ean13 = result.gtin.slice(1); // 14 dan 13 raqamli EAN
            i += 16;
        } else if (ai === '21') {
            const end = clean.indexOf('\x1d', i + 2);
            result.serial = clean.slice(i + 2, end === -1 ? i + 22 : end);
            i = end === -1 ? i + 22 : end + 1;
        } else if (ai === '17') {
            const d = clean.slice(i + 2, i + 8);
            result.expiry = `20${d.slice(0, 2)}-${d.slice(2, 4)}-${d.slice(4, 6)}`;
            i += 8;
        } else if (ai === '10') {
            const end = clean.indexOf('\x1d', i + 2);
            result.batch = clean.slice(i + 2, end === -1 ? i + 22 : end);
            i = end === -1 ? i + 22 : end + 1;
        } else {
            i++;
        }
    }
    return result;
}

// Tashqi API dan barcode ma'lumot olish
async function fetchBarcodeInfo(ean) {
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        const resp = await fetch(
            `https://api.upcitemdb.com/prod/trial/lookup?upc=${ean}`,
            { signal: controller.signal, headers: { 'Accept': 'application/json' } }
        );
        clearTimeout(timer);
        if (!resp.ok) return null;
        const data = await resp.json();
        const item = data?.items?.[0];
        if (!item) return null;
        return {
            name: item.title || null,
            manufacturer: item.brand || null,
            description: item.description || null,
        };
    } catch { return null; }
}

// Markirofka / barcode tekshirish
router.post('/verify-marking', async (req, res, next) => {
    try {
        const { code } = req.body;
        if (!code) return res.status(400).json({ status: 'error', message: 'Kod kiritilmagan' });

        const clean = code.trim();

        // GS1 DataMatrix parse qilish
        const gs1 = parseGS1(clean);
        const ean = gs1.ean13 || (clean.length === 13 && /^\d+$/.test(clean) ? clean : null);
        const searchCodes = [clean, ean, gs1.gtin].filter(Boolean);

        // 1. O'z bazamizdan qidirish
        const product = await Product.findOne({
            barcode: { $in: searchCodes }
        }).lean();

        if (product) {
            return res.json({
                status: 'authentic',
                message: `"${product.name}" aptekamiz assortimentida mavjud`,
                product: {
                    name: product.name,
                    manufacturer: product.manufacturer || null,
                    expiry: gs1.expiry || null,
                    serial: gs1.serial || clean,
                },
            });
        }

        // 2. Tashqi barcode API (EAN-13 uchun)
        if (ean) {
            const ext = await fetchBarcodeInfo(ean);
            if (ext?.name) {
                // Mahsulot tashqi bazada topildi — bazamizda yo'q lekin haqiqiy
                return res.json({
                    status: 'authentic',
                    message: 'Mahsulot barcode bazasida topildi',
                    product: {
                        name: ext.name,
                        manufacturer: ext.manufacturer || null,
                        expiry: gs1.expiry || null,
                        serial: gs1.serial || clean,
                    },
                });
            }
        }

        // 3. GS1 ma'lumotlari bor bo'lsa — hech bo'lmaganda parse qilinganini ko'rsat
        if (gs1.gtin) {
            return res.json({
                status: 'unknown',
                message: `Markirofka kodi o'qildi, lekin mahsulot ma'lumoti topilmadi. GTIN: ${gs1.gtin}`,
                product: {
                    name: null,
                    serial: gs1.serial || null,
                    expiry: gs1.expiry || null,
                    batch: gs1.batch || null,
                },
            });
        }

        // 4. Umuman topilmadi
        return res.json({
            status: 'unknown',
            message: 'Bu mahsulot hech qanday bazada topilmadi. Iltimos, dorixonaga murojaat qiling.',
            product: { serial: clean },
        });

    } catch (error) { next(error); }
});

module.exports = router;
