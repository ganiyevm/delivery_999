const router = require('express').Router();
const adminAuth = require('../middleware/adminAuth');
const AnalyticsService = require('../services/analytics.service');

router.use(adminAuth);

router.get('/overview', async (req, res, next) => {
    try { res.json(await AnalyticsService.getOverview()); } catch (e) { next(e); }
});

// Legacy daily endpoint
router.get('/daily', async (req, res, next) => {
    try {
        const { from, to } = req.query;
        res.json(await AnalyticsService.getDailyStats(from, to));
    } catch (e) { next(e); }
});

// Period-aware chart data: ?period=week|month|quarter|year
router.get('/period-chart', async (req, res, next) => {
    try {
        const { period = 'month' } = req.query;
        res.json(await AnalyticsService.getPeriodChartData(period));
    } catch (e) { next(e); }
});

// Period KPI summary: ?period=week|month|quarter|year
router.get('/period-summary', async (req, res, next) => {
    try {
        const { period = 'month' } = req.query;
        res.json(await AnalyticsService.getPeriodSummary(period));
    } catch (e) { next(e); }
});

router.get('/products/top', async (req, res, next) => {
    try {
        const { limit = 10, period = '7' } = req.query;
        const days = parseInt(period) || 7;
        res.json(await AnalyticsService.getTopProducts(limit, days));
    } catch (e) { next(e); }
});

router.get('/branches/stats', async (req, res, next) => {
    try {
        const { period = 'today' } = req.query;
        res.json(await AnalyticsService.getBranchStats(period));
    } catch (e) { next(e); }
});

router.get('/payments/stats', async (req, res, next) => {
    try {
        const { period = 'month' } = req.query;
        res.json(await AnalyticsService.getPaymentStats(period));
    } catch (e) { next(e); }
});

router.get('/users/stats', async (req, res, next) => {
    try { res.json(await AnalyticsService.getUserStats()); } catch (e) { next(e); }
});

// Funnel: ?period=week|month|quarter|year
router.get('/orders/funnel', async (req, res, next) => {
    try {
        const { period = 'month' } = req.query;
        res.json(await AnalyticsService.getOrderFunnel(period));
    } catch (e) { next(e); }
});

module.exports = router;
