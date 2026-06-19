const router = require('express').Router();
const multer = require('multer');
const auth = require('../middleware/auth');
const Product = require('../models/Product');
const Stock = require('../models/Stock');
const Branch = require('../models/Branch');
const { buildSearchRegex } = require('../utils/translit');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 8 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (!/^image\/(png|jpe?g|webp)$/i.test(file.mimetype)) {
            return cb(new Error('Faqat JPG, PNG yoki WEBP rasm yuklang'));
        }
        cb(null, true);
    },
});

const STOP_WORDS = new Set([
    'таб', 'табл', 'таблетки', 'капс', 'капсулы', 'сироп', 'мазь', 'гель',
    'амп', 'ампулы', 'флакон', 'спрей', 'капли', 'свечи', 'супп', 'мг', 'мл',
    'гр', 'г', '№', 'n',
]);

function normalizeText(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/ё/g, 'е')
        .replace(/[^a-zа-я0-9+ -]/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function tokens(value) {
    return normalizeText(value)
        .split(/\s+/)
        .filter(token => token.length >= 3 && !STOP_WORDS.has(token) && !/^\d+$/.test(token));
}

function compactName(value) {
    return normalizeText(value).replace(/\s+/g, '');
}

function scoreProduct(query, productName) {
    const queryTokens = tokens(query);
    const productTokens = new Set(tokens(productName));
    if (!queryTokens.length) return 0;

    let score = 0;
    for (const token of queryTokens) {
        if (productTokens.has(token)) score += 3;
        else if (compactName(productName).includes(token)) score += 1;
    }
    const qCompact = compactName(query);
    const pCompact = compactName(productName);
    if (qCompact && pCompact.includes(qCompact.slice(0, Math.min(qCompact.length, 12)))) score += 3;
    return score;
}

function outputTextFromResponse(body) {
    if (body?.output_text) return body.output_text;
    const chunks = [];
    for (const item of body?.output || []) {
        for (const part of item.content || []) {
            if (part.type === 'output_text' && part.text) chunks.push(part.text);
            if (part.text) chunks.push(part.text);
        }
    }
    return chunks.join('\n').trim();
}

function parseJsonLoose(text) {
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch (_) {
        const match = text.match(/\{[\s\S]*\}/);
        if (!match) return null;
        return JSON.parse(match[0]);
    }
}

async function extractPrescription(file) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        const error = new Error('Retsept tekshirish uchun OPENAI_API_KEY sozlanmagan');
        error.statusCode = 503;
        throw error;
    }

    const model = process.env.OPENAI_VISION_MODEL || 'gpt-5.5';
    const imageUrl = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    const prompt = [
        'Siz dorixona retsept OCR yordamchisisiz.',
        'Rasm odatda Toshkentdagi Dmed retsepti yoki chek bo‘lishi mumkin.',
        'Faqat retseptda yozilgan dori/mahsulot nomlarini ajrating.',
        'Doza, shakl va miqdor ko‘rinsa alohida qaytaring.',
        'Tavsiya, diagnoz yoki tibbiy maslahat bermang.',
        'Faqat JSON qaytaring: {"items":[{"name":"", "dose":"", "form":"", "quantity":1}], "rawText":""}',
    ].join('\n');

    const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
            authorization: `Bearer ${apiKey}`,
            'content-type': 'application/json',
        },
        body: JSON.stringify({
            model,
            input: [{
                role: 'user',
                content: [
                    { type: 'input_text', text: prompt },
                    { type: 'input_image', image_url: imageUrl },
                ],
            }],
        }),
    });
    const text = await response.text();
    let body;
    try { body = JSON.parse(text); } catch (_) { body = { raw: text }; }

    if (!response.ok) {
        const message = body?.error?.message || `OpenAI OCR xatosi: ${response.status}`;
        const error = new Error(message);
        error.statusCode = response.status;
        throw error;
    }

    const parsed = parseJsonLoose(outputTextFromResponse(body));
    const items = Array.isArray(parsed?.items) ? parsed.items : [];
    return {
        rawText: String(parsed?.rawText || '').slice(0, 4000),
        items: items
            .map(item => ({
                name: String(item.name || '').trim(),
                dose: String(item.dose || '').trim(),
                form: String(item.form || '').trim(),
                quantity: Math.max(1, Math.min(20, parseInt(item.quantity || '1', 10) || 1)),
            }))
            .filter(item => item.name.length >= 2)
            .slice(0, 20),
    };
}

async function stocksForProducts(productIds) {
    if (!productIds.length) return new Map();
    const branches = await Branch.find({ isActive: true, isSynced: true }, '_id').lean();
    const branchIds = branches.map(branch => branch._id);
    const stockAgg = await Stock.aggregate([
        { $match: { product: { $in: productIds }, branch: { $in: branchIds }, qty: { $gt: 0 } } },
        {
            $group: {
                _id: '$product',
                minPrice: { $min: '$price' },
                totalQty: { $sum: '$qty' },
                branchCount: { $sum: 1 },
            },
        },
    ]);
    return new Map(stockAgg.map(item => [String(item._id), item]));
}

async function findMatches(extractedItems) {
    const results = [];

    for (const item of extractedItems) {
        const query = [item.name, item.dose, item.form].filter(Boolean).join(' ');
        const regex = buildSearchRegex(item.name);
        const candidates = regex
            ? await Product.find({
                isActive: true,
                $or: [
                    { name: regex },
                    { ingredient: regex },
                    { analogs: regex },
                    { manufacturer: regex },
                ],
            }).limit(12).lean()
            : [];

        const scored = candidates
            .map(product => ({ product, score: scoreProduct(query, product.name) }))
            .filter(row => row.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);

        const productIds = scored.map(row => row.product._id);
        const stockMap = await stocksForProducts(productIds);
        const alternatives = scored.map(row => {
            const stock = stockMap.get(String(row.product._id));
            return {
                _id: row.product._id,
                name: row.product.name,
                category: row.product.category,
                imageType: row.product.imageType,
                imageUrl: row.product.imageUrl,
                price: stock?.minPrice || 0,
                totalQty: stock?.totalQty || 0,
                branchCount: stock?.branchCount || 0,
                inStock: Boolean(stock?.totalQty > 0),
                score: row.score,
            };
        });

        const best = alternatives.find(product => product.inStock) || alternatives[0] || null;
        results.push({
            requestedName: item.name,
            dose: item.dose,
            form: item.form,
            quantity: item.quantity,
            found: Boolean(best?.inStock),
            product: best,
            alternatives,
        });
    }

    return results;
}

router.post('/analyze', auth, upload.single('image'), async (req, res, next) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Retsept rasmi yuklanmagan' });
        const extracted = await extractPrescription(req.file);
        if (!extracted.items.length) {
            return res.json({
                items: [],
                message: 'Retseptdan dori nomlarini aniqlab bo‘lmadi. Iltimos, Dmed retsept rasmini tiniqroq yuklang.',
            });
        }

        const items = await findMatches(extracted.items);
        const foundCount = items.filter(item => item.found).length;
        res.json({
            items,
            rawText: extracted.rawText,
            summary: {
                extractedCount: extracted.items.length,
                foundCount,
                unavailableCount: items.length - foundCount,
            },
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
