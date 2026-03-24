const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ error: 'Token taqdim etilmagan' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);

        if (!user) {
            return res.status(401).json({ error: 'Foydalanuvchi topilmadi' });
        }

        if (user.isBlocked) {
            return res.status(403).json({ error: 'Hisobingiz bloklangan' });
        }

        // Oxirgi faollik vaqtini yangilash
        user.lastActiveAt = new Date();
        await user.save();

        req.user = user;
        req.userId = user._id;
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Token noto\'g\'ri' });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token muddati tugagan' });
        }
        next(error);
    }
};

module.exports = auth;
