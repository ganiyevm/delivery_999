const Branch = require('../../backend/src/models/Branch');

const ADMIN_IDS = (process.env.ADMIN_TELEGRAM_IDS || '')
    .split(',')
    .map(id => parseInt(id.trim()))
    .filter(Boolean);

module.exports = async (ctx, next) => {
    const userId = ctx.from?.id;
    if (!userId) return next();

    // Admin tekshirish
    ctx.isAdmin = ADMIN_IDS.includes(userId);

    // Operator tekshirish
    if (!ctx.isAdmin) {
        const operatorBranch = await Branch.findOne({
            operatorIds: userId,
        }).lean();
        ctx.isOperator = !!operatorBranch;
        ctx.operatorBranch = operatorBranch;
    }

    // Kuryer tekshirish
    if (!ctx.isAdmin && !ctx.isOperator) {
        const courierBranch = await Branch.findOne({
            courierIds: userId,
        }).lean();
        ctx.isCourier = !!courierBranch;
        ctx.courierBranch = courierBranch;
    }

    return next();
};
