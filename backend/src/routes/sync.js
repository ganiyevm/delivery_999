const router = require('express').Router();
const crypto = require('crypto');
const SyncService = require('../services/sync.service');

function timingSafeEqual(a, b) {
    if (!a || !b) return false;
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ab.length !== bb.length) return false;
    return crypto.timingSafeEqual(ab, bb);
}

function authMiddleware(req, res, next) {
    const expected = process.env.SYNC_API_KEY;
    if (!expected) {
        return res.status(500).json({ error: 'SYNC_API_KEY o\'rnatilmagan' });
    }
    const provided = req.header('x-sync-key') || '';
    if (!timingSafeEqual(provided, expected)) {
        return res.status(401).json({ error: 'Noto\'g\'ri sync key' });
    }
    next();
}

router.post('/inbound', authMiddleware, async (req, res, next) => {
    try {
        const { branchNumber, syncStartedAt, chunkIndex, totalChunks, isLast, items } = req.body || {};

        if (typeof branchNumber !== 'number') {
            return res.status(400).json({ error: 'branchNumber kerak (number)' });
        }
        if (!syncStartedAt) {
            return res.status(400).json({ error: 'syncStartedAt kerak (ISO date)' });
        }
        if (!Array.isArray(items)) {
            return res.status(400).json({ error: 'items array bo\'lishi kerak' });
        }
        if (items.length > 2000) {
            return res.status(400).json({ error: 'Chunk juda katta (max 2000)' });
        }

        const result = await SyncService.applyChunk({
            branchNumber,
            syncStartedAt,
            chunkIndex: chunkIndex || 0,
            totalChunks: totalChunks || 1,
            isLast: !!isLast,
            items,
        });

        res.json({ ok: true, ...result });
    } catch (error) {
        next(error);
    }
});

router.get('/health', authMiddleware, (req, res) => {
    res.json({ ok: true, ts: new Date().toISOString() });
});

module.exports = router;
