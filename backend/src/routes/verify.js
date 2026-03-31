const router  = require('express').Router();
const Product = require('../models/Product');
const AslBelgisi = require('../services/aslbelgisi.service');

// ── GS1 DataMatrix parser ────────────────────────────────────────────────────
// Format: 01{GTIN-14} 21{serial} 17{YYMMDD} 10{batch}
function parseGS1(raw) {
    const result = {};
    // Tozalash: GS (\x1d), RS (\x1e), EOT (\x04) ajratuvchilarni olib tashlash
    let s = raw.replace(/[\x1d\x1e\x04]/g, '\x1d');
    let i = 0;

    while (i < s.length) {
        const ai2 = s.slice(i, i + 2);
        const ai3 = s.slice(i, i + 3);

        if (ai2 === '01') {
            result.gtin  = s.slice(i + 2, i + 16);
            result.ean13 = result.gtin.slice(1);
            i += 16;
        } else if (ai2 === '21') {
            const end = s.indexOf('\x1d', i + 2);
            result.serial = s.slice(i + 2, end === -1 ? i + 22 : end);
            i = end === -1 ? i + 22 : end + 1;
        } else if (ai2 === '17') {
            const d = s.slice(i + 2, i + 8);
            result.expiry = `20${d.slice(0, 2)}-${d.slice(2, 4)}-${d.slice(4, 6)}`;
            i += 8;
        } else if (ai2 === '10') {
            const end = s.indexOf('\x1d', i + 2);
            result.batch = s.slice(i + 2, end === -1 ? i + 22 : end);
            i = end === -1 ? i + 22 : end + 1;
        } else if (ai3 === '240') {
            const end = s.indexOf('\x1d', i + 3);
            result.additionalId = s.slice(i + 3, end === -1 ? s.length : end);
            i = end === -1 ? s.length : end + 1;
        } else {
            i++;
        }
    }
    return result;
}

// Stek: kodedan SGTIN (GTIN+serial) ni yig'ish
function buildSGTIN(gs1) {
    if (gs1.gtin && gs1.serial) return gs1.gtin + gs1.serial;
    return null;
}

// ── Markirovka tekshirish ────────────────────────────────────────────────────
router.post('/verify-marking', async (req, res, next) => {
    try {
        const { code } = req.body;
        if (!code?.trim()) return res.status(400).json({ status: 'error', message: 'Kod kiritilmagan' });

        const raw  = code.trim();
        const gs1  = parseGS1(raw);
        const sgtin = buildSGTIN(gs1);
        const ean  = gs1.ean13 || (raw.length === 13 && /^\d+$/.test(raw) ? raw : null);

        // ─── 1-qadam: Asl Belgisi rasmiy API ───────────────────────────────
        const apiResult = await AslBelgisi.verify(sgtin || raw);
        if (apiResult) {
            const msg = buildApiMessage(apiResult);
            return res.json({
                status:  apiResult.status,
                source:  'aslbelgisi',
                message: msg,
                product: {
                    ...apiResult.product,
                    expiry: apiResult.product.expiry || gs1.expiry || null,
                    serial: apiResult.product.serial || gs1.serial || null,
                    batch:  apiResult.product.batch  || gs1.batch  || null,
                },
            });
        }

        // ─── 2-qadam: O'z bazamiz (barcode bo'yicha) ────────────────────────
        const searchCodes = [raw, ean, gs1.gtin, sgtin].filter(Boolean);
        const product = await Product.findOne({ barcode: { $in: searchCodes } }).lean();

        if (product) {
            return res.json({
                status:  'authentic',
                source:  'local',
                message: `"${product.name}" aptekamiz assortimentida mavjud`,
                product: {
                    name:         product.name,
                    manufacturer: product.manufacturer || null,
                    expiry:       gs1.expiry || null,
                    serial:       gs1.serial || raw,
                    batch:        gs1.batch  || null,
                    gtin:         gs1.gtin   || null,
                },
            });
        }

        // ─── 3-qadam: GS1 parse natijasini ko'rsat ───────────────────────────
        if (gs1.gtin) {
            return res.json({
                status:  'unknown',
                source:  'gs1_parse',
                message: 'Dori kodi o\'qildi, lekin Asl Belgisi API sozlanmagan yoki mahsulot topilmadi',
                product: {
                    name:   null,
                    gtin:   gs1.gtin,
                    serial: gs1.serial || null,
                    expiry: gs1.expiry || null,
                    batch:  gs1.batch  || null,
                },
            });
        }

        // ─── 4-qadam: Umuman topilmadi ───────────────────────────────────────
        return res.json({
            status:  'unknown',
            source:  'none',
            message: 'Mahsulot hech qanday bazada topilmadi',
            product: { serial: raw },
        });

    } catch (error) { next(error); }
});

function buildApiMessage(r) {
    const { status, product } = r;
    if (status === 'authentic') {
        const name = product.name ? `"${product.name}" ` : '';
        return `${name}haqiqiy va muomaladadagi dori ✅`;
    }
    if (status === 'expired')  return 'Bu dorining amal qilish muddati o\'tgan yoki muomaladan chiqarilgan ⚠️';
    if (status === 'fake')     return 'Bu dori soxta yoki tekshiruv bazasida qora ro\'yxatda ❌';
    return `Holat: ${product.rawStatus || 'Noma\'lum'}`;
}

module.exports = router;
