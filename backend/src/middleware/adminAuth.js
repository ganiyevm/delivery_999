const jwt = require('jsonwebtoken');

const adminAuth = (req, res, next) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ error: 'Admin token taqdim etilmagan' });
        }

        const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET);
        if (!decoded.isAdmin) {
            return res.status(403).json({ error: 'Admin huquqi yo\'q' });
        }

        req.adminId = decoded.adminId;
        req.adminUsername = decoded.username;
        req.isAdmin = true;
        req.isSuperAdmin = decoded.isSuperAdmin || false;
        req.adminRole = decoded.role || (decoded.isSuperAdmin ? 'super_admin' : 'admin');
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Admin token noto\'g\'ri' });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Admin token muddati tugagan' });
        }
        next(error);
    }
};

module.exports = adminAuth;
