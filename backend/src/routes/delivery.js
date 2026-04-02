const router   = require('express').Router();
const adminAuth = require('../middleware/adminAuth');
const Branch    = require('../models/Branch');
const { getDeliverySettings, setDeliverySettings } = require('../models/Settings');

// Haversine (km)
function haversine(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calcDeliveryCost(distKm, s) {
    if (!s.enabled) return 0;
    if (distKm > s.maxDeliveryKm) return null; // yetkazib bo'lmaydi
    if (distKm <= s.baseKm) return s.basePrice;
    const extra = Math.ceil(distKm - s.baseKm) * s.pricePerKm;
    return s.basePrice + extra;
}

// ── Public: narx hisoblash ──────────────────────────────────────
// POST /api/delivery/calculate
// Body: { userLat, userLng, branchId, orderTotal }
router.post('/calculate', async (req, res, next) => {
    try {
        const { userLat, userLng, branchId, orderTotal = 0 } = req.body;

        const s = await getDeliverySettings();

        // Koordinata yo'q — standart baza narx
        if (!userLat || !userLng || !branchId) {
            return res.json({
                cost:    s.freeThreshold && orderTotal >= s.freeThreshold ? 0 : s.basePrice,
                distKm:  null,
                free:    s.freeThreshold && orderTotal >= s.freeThreshold,
                outOfRange: false,
                settings: s,
            });
        }

        const branch = await Branch.findById(branchId).select('location').lean();
        if (!branch?.location?.lat) {
            return res.json({
                cost:       s.freeThreshold && orderTotal >= s.freeThreshold ? 0 : s.basePrice,
                distKm:     null,
                free:       false,
                outOfRange: false,
                settings:   s,
            });
        }

        const distKm = haversine(
            parseFloat(userLat), parseFloat(userLng),
            branch.location.lat, branch.location.lng
        );

        // Bepul chegara
        if (s.freeThreshold && orderTotal >= s.freeThreshold) {
            return res.json({ cost: 0, distKm: +distKm.toFixed(2), free: true, outOfRange: false, settings: s });
        }

        const cost = calcDeliveryCost(distKm, s);

        res.json({
            cost:       cost === null ? null : cost,
            distKm:     +distKm.toFixed(2),
            free:       false,
            outOfRange: cost === null,  // chegara tashqarida
            settings:   s,
        });
    } catch (err) { next(err); }
});

// ── Admin: sozlamalarni olish ───────────────────────────────────
router.get('/settings', adminAuth, async (req, res, next) => {
    try {
        const s = await getDeliverySettings();
        res.json(s);
    } catch (err) { next(err); }
});

// ── Admin: sozlamalarni saqlash ─────────────────────────────────
router.put('/settings', adminAuth, async (req, res, next) => {
    try {
        const { baseKm, basePrice, pricePerKm, maxDeliveryKm, freeThreshold, enabled } = req.body;
        const val = {
            baseKm:        parseFloat(baseKm),
            basePrice:     parseInt(basePrice),
            pricePerKm:    parseInt(pricePerKm),
            maxDeliveryKm: parseFloat(maxDeliveryKm),
            freeThreshold: parseInt(freeThreshold) || 0,
            enabled:       !!enabled,
        };
        await setDeliverySettings(val);
        res.json({ ok: true, settings: val });
    } catch (err) { next(err); }
});

module.exports = router;
