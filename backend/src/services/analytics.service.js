const Order = require('../models/Order');
const User = require('../models/User');
const AnalyticsDaily = require('../models/AnalyticsDaily');

class AnalyticsService {
    // Dashboard overview — bugungi statistika
    static async getOverview() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        const [todayStats, yesterdayStats] = await Promise.all([
            this.getDayStats(today, tomorrow),
            this.getDayStats(yesterday, today),
        ]);

        // O'zgarish foizi
        const orderChange = yesterdayStats.totalOrders > 0
            ? Math.round(((todayStats.totalOrders - yesterdayStats.totalOrders) / yesterdayStats.totalOrders) * 100)
            : 0;
        const revenueChange = yesterdayStats.totalRevenue > 0
            ? Math.round(((todayStats.totalRevenue - yesterdayStats.totalRevenue) / yesterdayStats.totalRevenue) * 100)
            : 0;

        return {
            today: todayStats,
            changes: { orderChange, revenueChange },
        };
    }

    static async getDayStats(from, to) {
        const [orders, newUsers] = await Promise.all([
            Order.find({ createdAt: { $gte: from, $lt: to } }).lean(),
            User.countDocuments({ registeredAt: { $gte: from, $lt: to } }),
        ]);

        const completed = orders.filter(o => o.status === 'delivered');
        const cancelled = orders.filter(o => ['cancelled', 'rejected'].includes(o.status));
        const totalRevenue = completed.reduce((sum, o) => sum + o.total, 0);

        return {
            totalOrders: orders.length,
            completedOrders: completed.length,
            cancelledOrders: cancelled.length,
            totalRevenue,
            newUsers,
            conversionRate: orders.length > 0 ? Math.round((completed.length / orders.length) * 100) : 0,
        };
    }

    // Kunlik grafik ma'lumotlari
    static async getDailyStats(from, to) {
        return AnalyticsDaily.find({
            date: { $gte: new Date(from), $lte: new Date(to) },
        }).sort({ date: 1 }).lean();
    }

    // Top mahsulotlar
    static async getTopProducts(limit = 10, days = 7) {
        const from = new Date();
        from.setDate(from.getDate() - days);

        return Order.aggregate([
            { $match: { createdAt: { $gte: from }, status: 'delivered' } },
            { $unwind: '$items' },
            {
                $group: {
                    _id: '$items.product',
                    name: { $first: '$items.productName' },
                    totalQty: { $sum: '$items.qty' },
                    totalRevenue: { $sum: { $multiply: ['$items.price', '$items.qty'] } },
                },
            },
            { $sort: { totalQty: -1 } },
            { $limit: parseInt(limit) },
        ]);
    }

    // Filial statistikasi
    static async getBranchStats() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return Order.aggregate([
            { $match: { createdAt: { $gte: today } } },
            {
                $group: {
                    _id: '$branch',
                    totalOrders: { $sum: 1 },
                    completedOrders: {
                        $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] },
                    },
                    totalRevenue: {
                        $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, '$total', 0] },
                    },
                },
            },
            {
                $lookup: {
                    from: 'branches',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'branch',
                },
            },
            { $unwind: '$branch' },
            {
                $project: {
                    branchId: '$_id',
                    name: '$branch.name',
                    number: '$branch.number',
                    totalOrders: 1,
                    completedOrders: 1,
                    totalRevenue: 1,
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

    // To'lov statistikasi
    static async getPaymentStats() {
        const today = new Date();
        today.setDate(today.getDate() - 30);

        return Order.aggregate([
            { $match: { createdAt: { $gte: today }, paymentStatus: 'paid' } },
            {
                $group: {
                    _id: '$paymentMethod',
                    count: { $sum: 1 },
                    total: { $sum: '$total' },
                },
            },
        ]);
    }

    // Foydalanuvchi statistikasi
    static async getUserStats() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);

        const [total, todayNew, weekNew, monthNew, active] = await Promise.all([
            User.countDocuments(),
            User.countDocuments({ registeredAt: { $gte: today } }),
            User.countDocuments({ registeredAt: { $gte: weekAgo } }),
            User.countDocuments({ registeredAt: { $gte: monthAgo } }),
            User.countDocuments({ lastActiveAt: { $gte: weekAgo } }),
        ]);

        return { total, todayNew, weekNew, monthNew, activeWeek: active };
    }

    // Buyurtma funnel
    static async getOrderFunnel() {
        const thirtyDays = new Date();
        thirtyDays.setDate(thirtyDays.getDate() - 30);

        const result = await Order.aggregate([
            { $match: { createdAt: { $gte: thirtyDays } } },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                },
            },
        ]);

        const map = {};
        result.forEach(r => { map[r._id] = r.count; });

        return {
            created: Object.values(map).reduce((a, b) => a + b, 0),
            paid: (map.pending_operator || 0) + (map.confirmed || 0) + (map.on_the_way || 0) + (map.delivered || 0),
            confirmed: (map.confirmed || 0) + (map.on_the_way || 0) + (map.delivered || 0),
            on_the_way: (map.on_the_way || 0) + (map.delivered || 0),
            delivered: map.delivered || 0,
            cancelled: (map.cancelled || 0) + (map.rejected || 0),
        };
    }

    // Kunlik analytics ma'lumotini yozish (cron job uchun)
    static async writeDailyAnalytics() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const stats = await this.getDayStats(today, tomorrow);
        const topProducts = await this.getTopProducts(10, 1);
        const branchStats = await this.getBranchStats();
        const paymentStats = await this.getPaymentStats();

        const paymentMap = {};
        paymentStats.forEach(p => { paymentMap[p._id] = p.count; });

        await AnalyticsDaily.findOneAndUpdate(
            { date: today },
            {
                ...stats,
                topProducts: topProducts.map(p => ({
                    productId: p._id,
                    name: p.name,
                    qty: p.totalQty,
                })),
                topBranches: branchStats.slice(0, 10).map(b => ({
                    branchId: b.branchId,
                    name: b.name,
                    orders: b.totalOrders,
                })),
                paymentStats: {
                    click: paymentMap.click || 0,
                    payme: paymentMap.payme || 0,
                },
            },
            { upsert: true }
        );

        console.log(`📊 Kunlik analytics yozildi: ${today.toISOString().split('T')[0]}`);
    }
}

module.exports = AnalyticsService;
