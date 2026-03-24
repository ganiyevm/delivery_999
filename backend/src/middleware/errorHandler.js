const errorHandler = (err, req, res, _next) => {
    console.error('❌ Xato:', err);

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        const messages = Object.values(err.errors).map(e => e.message);
        return res.status(400).json({
            error: 'Validatsiya xatosi',
            details: messages,
        });
    }

    // Mongoose duplicate key
    if (err.code === 11000) {
        const field = Object.keys(err.keyPattern)[0];
        return res.status(409).json({
            error: `"${field}" allaqachon mavjud`,
        });
    }

    // Mongoose CastError (noto'g'ri ObjectId)
    if (err.name === 'CastError') {
        return res.status(400).json({
            error: 'Noto\'g\'ri ID format',
        });
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
        return res.status(401).json({
            error: 'Autentifikatsiya xatosi',
        });
    }

    // Custom errors with statusCode
    if (err.statusCode) {
        return res.status(err.statusCode).json({
            error: err.message,
        });
    }

    // Default server error
    res.status(500).json({
        error: 'Ichki server xatosi',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
};

module.exports = errorHandler;
