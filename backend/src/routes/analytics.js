const router = require('express').Router();
const adminAuth = require('../middleware/adminAuth');
const AnalyticsService = require('../services/analytics.service');

// Barcha analytics endpointlar admin JWT talab qiladi
router.use(adminAuth);

router.get('/overview', async (req, res, next) => {
    try {
        const data = await AnalyticsService.getOverview();
        res.json(data);
    } catch (error) { next(error); }
});

router.get('/daily', async (req, res, next) => {
    try {
        const { from, to } = req.query;
        const data = await AnalyticsService.getDailyStats(from, to);
        res.json(data);
    } catch (error) { next(error); }
});

router.get('/products/top', async (req, res, next) => {
    try {
        const { limit = 10, period = '7d' } = req.query;
        const days = parseInt(period) || 7;
        const data = await AnalyticsService.getTopProducts(limit, days);
        res.json(data);
    } catch (error) { next(error); }
});

router.get('/branches/stats', async (req, res, next) => {
    try {
        const data = await AnalyticsService.getBranchStats();
        res.json(data);
    } catch (error) { next(error); }
});

router.get('/payments/stats', async (req, res, next) => {
    try {
        const data = await AnalyticsService.getPaymentStats();
        res.json(data);
    } catch (error) { next(error); }
});

router.get('/users/stats', async (req, res, next) => {
    try {
        const data = await AnalyticsService.getUserStats();
        res.json(data);
    } catch (error) { next(error); }
});

router.get('/orders/funnel', async (req, res, next) => {
    try {
        const data = await AnalyticsService.getOrderFunnel();
        res.json(data);
    } catch (error) { next(error); }
});

module.exports = router;
