const router = require('express').Router();
const axios = require('axios');

// Yandex geokoder kaliti — endi faqat serverda (frontend bundle'da emas).
// Railway env'da YANDEX_GEOCODER_KEY o'rnatish tavsiya etiladi.
const YANDEX_KEY = process.env.YANDEX_GEOCODER_KEY || 'b282d82a-e502-4d33-acb3-d5bd433af913';

// GET /api/geo/reverse?lat=..&lng=..  → { address }
router.get('/reverse', async (req, res) => {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
        return res.status(400).json({ error: 'lat va lng kerak', address: '' });
    }

    try {
        const { data } = await axios.get('https://geocode-maps.yandex.ru/1.x/', {
            params: {
                apikey: YANDEX_KEY,
                geocode: `${lng},${lat}`,
                format: 'json',
                results: 1,
                lang: 'uz_UZ',
            },
            timeout: 10000,
        });

        const geoObj = data?.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject;
        const formatted = geoObj?.metaDataProperty?.GeocoderMetaData?.Address?.formatted || '';
        const parts = formatted.split(',').map(s => s.trim()).filter(Boolean);
        // Mamlakat nomini (1-qism) tashlab, qolganini qaytaramiz
        const address = parts.length > 1 ? parts.slice(1).join(', ') : formatted;

        res.json({ address });
    } catch (err) {
        console.error('[geo] reverse xato:', err.message);
        res.status(502).json({ error: 'Geokodlash xatosi', address: '' });
    }
});

module.exports = router;
