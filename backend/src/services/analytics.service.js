const Order = require('../models/Order');
const User = require('../models/User');
const AnalyticsDaily = require('../models/AnalyticsDaily');

class AnalyticsService {

    // ─── Period helper ─────────────────────────────────────────
    static getPeriodDates(period = 'month') {
        const to = new Date();
        const from = new Date();
        switch (period) {
            case 'week':    from.setDate(from.getDate() - 7);            break;
            case 'month':   from.setDate(from.getDate() - 30);           break;
            case 'quarter': from.setDate(from.getDate() - 90);           break;
            case 'year':    from.setFullYear(from.getFullYear() - 1);    break;
            default:        from.setDate(from.getDate() - 30);
        }
        from.setHours(0, 0, 0, 0);
        return { from, to };
    }

    // ─── Overview (today vs yesterday) ─────────────────────────
    static async getOverview() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
        const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);

        const [todayStats, yesterdayStats] = await Promise.all([
            this.getDayStats(today, tomorrow),
            this.getDayStats(yesterday, today),
        ]);

        const pct = (a, b) => b > 0 ? Math.round(((a - b) / b) * 100) : 0;
        return {
            today: todayStats,
            changes: {
                orderChange:   pct(todayStats.totalOrders,  yesterdayStats.totalOrders),
                revenueChange: pct(todayStats.totalRevenue, yesterdayStats.totalRevenue),
            },
        };
    }

    static async getDayStats(from, to) {
        const [orders, newUsers] = await Promise.all([
            Order.find({ createdAt: { $gte: from, $lt: to } }).lean(),
            User.countDocuments({ registeredAt: { $gte: from, $lt: to } }),
        ]);
        const completed  = orders.filter(o => o.status === 'delivered');
        const cancelled  = orders.filter(o => ['cancelled', 'rejected'].includes(o.status));
        const totalRevenue = completed.reduce((s, o) => s + o.total, 0);
        return {
            totalOrders: orders.length,
            completedOrders: completed.length,
            cancelledOrders: cancelled.length,
            totalRevenue, newUsers,
            conversionRate: orders.length > 0 ? Math.round((completed.length / orders.length) * 100) : 0,
        };
    }

    // ─── Chart data — period-aware ──────────────────────────────
    static async getPeriodChartData(period = 'month') {
        const { from, to } = this.getPeriodDates(period);

        if (period === 'week' || period === 'month') {
            // Day-by-day directly from Orders (includes today's live data)
            return Order.aggregate([
                { $match: { createdAt: { $gte: from, $lte: to } } },
                {
                    $group: {
                        _id: {
                            year:  { $year: '$createdAt' },
                            month: { $month: '$createdAt' },
                            day:   { $dayOfMonth: '$createdAt' },
                        },
                        totalRevenue: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, '$total', 0] } },
                        totalOrders:  { $sum: 1 },
                        date:         { $first: '$createdAt' },
                    },
                },
                { $project: { date: 1, totalRevenue: 1, totalOrders: 1 } },
                { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
            ]);
        }

        if (period === 'quarter') {
            // Weekly buckets — group by ISO week start (Monday)
            return Order.aggregate([
                { $match: { createdAt: { $gte: from, $lte: to } } },
                {
                    $group: {
                        _id: {
                            $subtract: [
                                { $subtract: ['$createdAt', { $multiply: [{ $subtract: [{ $dayOfWeek: '$createdAt' }, 2] }, 86400000] }] },
                                { $mod: [{ $subtract: ['$createdAt', 0] }, 86400000] },
                            ],
                        },
                        totalRevenue: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, '$total', 0] } },
                        totalOrders:  { $sum: 1 },
                    },
                },
                { $project: { date: { $toDate: '$_id' }, totalRevenue: 1, totalOrders: 1 } },
                { $sort: { date: 1 } },
            ]);
        }

        // Year — monthly buckets
        return Order.aggregate([
            { $match: { createdAt: { $gte: from, $lte: to } } },
            {
                $group: {
                    _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
                    totalRevenue: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, '$total', 0] } },
                    totalOrders:  { $sum: 1 },
                    date:         { $first: '$createdAt' },
                },
            },
            { $project: { date: 1, totalRevenue: 1, totalOrders: 1 } },
            { $sort: { '_id.year': 1, '_id.month': 1 } },
        ]);
    }

    // Legacy (kept for backward compat)
    static async getDailyStats(from, to) {
        return AnalyticsDaily.find({
            date: { $gte: new Date(from), $lte: new Date(to) },
        }).sort({ date: 1 }).lean();
    }

    // ─── Top products — period-aware ───────────────────────────
    static async getTopProducts(limit = 10, days = 7) {
        const from = new Date();
        from.setDate(from.getDate() - days);

        return Order.aggregate([
            { $match: { createdAt: { $gte: from }, status: 'delivered' } },
            { $unwind: '$items' },
            {
                $group: {
                    _id:          '$items.product',
                    name:         { $first: '$items.productName' },
                    totalQty:     { $sum: '$items.qty' },
                    totalRevenue: { $sum: { $multiply: ['$items.price', '$items.qty'] } },
                },
            },
            { $sort: { totalQty: -1 } },
            { $limit: parseInt(limit) },
        ]);
    }

    // ─── Branch stats — period-aware ───────────────────────────
    static async getBranchStats(period = 'today') {
        let from;
        if (period === 'today') {
            from = new Date(); from.setHours(0, 0, 0, 0);
        } else {
            ({ from } = this.getPeriodDates(period));
        }

        return Order.aggregate([
            { $match: { createdAt: { $gte: from } } },
            {
                $group: {
                    _id: '$branch',
                    totalOrders:     { $sum: 1 },
                    completedOrders: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
                    totalRevenue:    { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, '$total', 0] } },
                },
            },
            { $lookup: { from: 'branches', localField: '_id', foreignField: '_id', as: 'branch' } },
            { $unwind: '$branch' },
            {
                $project: {
                    branchId: '$_id', name: '$branch.name', number: '$branch.number',
                    totalOrders: 1, completedOrders: 1, totalRevenue: 1,
                    completionRate: {
                        $cond: [
                            { $gt: ['$totalOrders', 0] },
                            { $multiply: [{ $divide: ['$completedOrders', '$totalOrders'] }, 100] },
                            0,
                        ],
                    },
                },
            },
            { $sort: { totalOrders: -1 } },
        ]);
    }

    // ─── Payment stats — period-aware ──────────────────────────
    static async getPaymentStats(period = 'month') {
        const { from } = this.getPeriodDates(period);
        return Order.aggregate([
            { $match: { createdAt: { $gte: from }, paymentStatus: 'paid' } },
            { $group: { _id: '$paymentMethod', count: { $sum: 1 }, total: { $sum: '$total' } } },
        ]);
    }

    // ─── User stats ────────────────────────────────────────────
    static async getUserStats() {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const weekAgo  = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);
        const monthAgo = new Date(today); monthAgo.setMonth(monthAgo.getMonth() - 1);

        const [total, todayNew, weekNew, monthNew, active] = await Promise.all([
            User.countDocuments(),
            User.countDocuments({ registeredAt: { $gte: today } }),
            User.countDocuments({ registeredAt: { $gte: weekAgo } }),
            User.countDocuments({ registeredAt: { $gte: monthAgo } }),
            User.countDocuments({ lastActiveAt: { $gte: weekAgo } }),
        ]);
        return { total, todayNew, weekNew, monthNew, activeWeek: active };
    }

    // ─── Order funnel — period-aware ───────────────────────────
    static async getOrderFunnel(period = 'month') {
        const { from } = this.getPeriodDates(period);

        const result = await Order.aggregate([
            { $match: { createdAt: { $gte: from } } },
            { $group: { _id: '$status', count: { $sum: 1 } } },
        ]);

        const map = {};
        result.forEach(r => { map[r._id] = r.count; });

        const total    = Object.values(map).reduce((a, b) => a + b, 0);
        const paid     = (map.pending_operator || 0) + (map.confirmed || 0) + (map.on_the_way || 0) + (map.delivered || 0);
        const confirmed = (map.confirmed || 0) + (map.on_the_way || 0) + (map.delivered || 0);
        const on_the_way = (map.on_the_way || 0) + (map.delivered || 0);
        const delivered = map.delivered || 0;
        const cancelled = (map.cancelled || 0) + (map.rejected || 0);

        return { total, paid, confirmed, on_the_way, delivered, cancelled, raw: map };
    }

    // ─── Period summary (KPI totals for a period) ──────────────
    static async getPeriodSummary(period = 'month') {
        const { from, to } = this.getPeriodDates(period);

        // Previous period for comparison
        const diff = to - from;
        const prevFrom = new Date(from - diff);
        const prevTo   = new Date(from);

        const aggregate = async (f, t) => {
            const [orders, users] = await Promise.all([
                Order.find({ createdAt: { $gte: f, $lt: t } }).lean(),
                User.countDocuments({ registeredAt: { $gte: f, $lt: t } }),
            ]);
            const delivered = orders.filter(o => o.status === 'delivered');
            return {
                totalOrders:  orders.length,
                totalRevenue: delivered.reduce((s, o) => s + o.total, 0),
                newUsers:     users,
                conversionRate: orders.length > 0 ? Math.round((delivered.length / orders.length) * 100) : 0,
            };
        };

        const [curr, prev] = await Promise.all([aggregate(from, to), aggregate(prevFrom, prevTo)]);
        const pct = (a, b) => b > 0 ? Math.round(((a - b) / b) * 100) : 0;

        return {
            current: curr,
            changes: {
                orderChange:   pct(curr.totalOrders,  prev.totalOrders),
                revenueChange: pct(curr.totalRevenue, prev.totalRevenue),
                userChange:    pct(curr.newUsers,     prev.newUsers),
            },
        };
    }

    // ─── Write daily analytics (cron) ──────────────────────────
    static async writeDailyAnalytics() {
        const today    = new Date(); today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

        const [stats, topProducts, branchStats, paymentStats] = await Promise.all([
            this.getDayStats(today, tomorrow),
            this.getTopProducts(10, 1),
            this.getBranchStats('today'),
            this.getPaymentStats('month'),
        ]);

        const paymentMap = {};
        paymentStats.forEach(p => { paymentMap[p._id] = p.count; });

        await AnalyticsDaily.findOneAndUpdate(
            { date: today },
            {
                ...stats,
                topProducts: topProducts.map(p => ({ productId: p._id, name: p.name, qty: p.totalQty })),
                topBranches: branchStats.slice(0, 10).map(b => ({ branchId: b.branchId, name: b.name, orders: b.totalOrders })),
                paymentStats: { click: paymentMap.click || 0, payme: paymentMap.payme || 0 },
            },
            { upsert: true }
        );
        console.log(`📊 Kunlik analytics yozildi: ${today.toISOString().split('T')[0]}`);
    }
}

module.exports = AnalyticsService;
