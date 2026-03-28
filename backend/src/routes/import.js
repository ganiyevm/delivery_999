const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const adminAuth = require('../middleware/adminAuth');
const ImportService = require('../services/import.service');
const ImportLog = require('../models/ImportLog');

const upload = multer({
    dest: path.join(__dirname, '../../uploads/'),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (['.xlsx', '.xls'].includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Faqat Excel fayllar (.xlsx, .xls) qabul qilinadi'));
        }
    },
});

// Excel import
router.post('/excel', adminAuth, upload.single('file'), (req, res, next) => {
    req.setTimeout(600000); // 10 daqiqa — 57000+ qator uchun
    res.setTimeout(600000);
    next();
}, async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Fayl yuklanmadi' });
        }

        const result = await ImportService.importExcel(req.file.path, req.adminId);

        // Vaqtinchalik faylni o'chirish
        fs.unlink(req.file.path, () => { });

        res.json({
            message: 'Import tugadi',
            ...result,
        });
    } catch (error) {
        if (req.file) fs.unlink(req.file.path, () => { });
        next(error);
    }
});

// Import tarixi
router.get('/logs', adminAuth, async (req, res, next) => {
    try {
        const logs = await ImportLog.find()
            .sort({ importDate: -1 })
            .limit(50)
            .lean();
        res.json(logs);
    } catch (error) {
        next(error);
    }
});

module.exports = router;
