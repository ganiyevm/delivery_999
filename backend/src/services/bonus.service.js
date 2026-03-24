const Order = require('../models/Order');
const User = require('../models/User');
const BonusTransaction = require('../models/BonusTransaction');
const Stock = require('../models/Stock');

class BonusService {
    /**
     * Buyurtma yetkazilganda bonus ball yozish
     * Har 10,000 so'mga 100 ball
     */
    static async earnBonus(order) {
        const { BONUS_RATE } = require('../config/constants').BUSINESS;
        const points = Math.floor(order.total / 10000) * BONUS_RATE;

        if (points <= 0) return 0;

        const user = await User.findById(order.user);
        if (!user) return 0;

        user.bonusPoints += points;
        user.totalOrders += 1;
        user.totalSpent += order.total;
        await user.save();

        await BonusTransaction.create({
            user: user._id,
            order: order._id,
            type: 'earn',
            points,
            balance: user.bonusPoints,
            description: {
                uz: `Buyurtma #${order.orderNumber} uchun +${points} ball`,
                ru: `Заказ #${order.orderNumber}: +${points} баллов`,
            },
        });

        return points;
    }

    /**
     * Bonus ball ishlatish
     */
    static async useBonus(userId, orderId, pointsToUse) {
        const user = await User.findById(userId);
        if (!user || user.bonusPoints < pointsToUse) {
            throw new Error('Yetarli bonus ball mavjud emas');
        }

        user.bonusPoints -= pointsToUse;
        await user.save();

        await BonusTransaction.create({
            user: user._id,
            order: orderId,
            type: 'use',
            points: -pointsToUse,
            balance: user.bonusPoints,
            description: {
                uz: `Buyurtma uchun −${pointsToUse} ball ishlatildi`,
                ru: `Использовано −${pointsToUse} баллов`,
            },
        });

        return pointsToUse;
    }

    /**
     * Refund bonus (rad etilganda)
     */
    static async refundBonus(order) {
        if (order.bonusDiscount > 0) {
            const user = await User.findById(order.user);
            if (!user) return;

            const pointsBack = order.bonusDiscount;
            user.bonusPoints += pointsBack;
            await user.save();

            await BonusTransaction.create({
                user: user._id,
                order: order._id,
                type: 'refund',
                points: pointsBack,
                balance: user.bonusPoints,
                description: {
                    uz: `Buyurtma #${order.orderNumber} rad etildi — ${pointsBack} ball qaytarildi`,
                    ru: `Заказ #${order.orderNumber} отменён — возврат ${pointsBack} баллов`,
                },
            });
        }
    }

    /**
     * Promo bonus (admin tomonidan qo'lda)
     */
    static async addPromoBonus(userId, points, description) {
        const user = await User.findById(userId);
        if (!user) throw new Error('Foydalanuvchi topilmadi');

        user.bonusPoints += points;
        await user.save();

        await BonusTransaction.create({
            user: user._id,
            type: 'promo',
            points,
            balance: user.bonusPoints,
            description: description || {
                uz: `Promo bonus: +${points} ball`,
                ru: `Промо бонус: +${points} баллов`,
            },
        });

        return user.bonusPoints;
    }
}

module.exports = BonusService;
