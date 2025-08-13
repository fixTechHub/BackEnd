const rateLimit = require('express-rate-limit');

// Rate limiter cho API popular descriptions
const popularDescriptionsLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 phút
    max: 100, // Tối đa 100 requests trong 15 phút
    message: {
        success: false,
        message: 'Quá nhiều request, vui lòng thử lại sau 15 phút'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            message: 'Quá nhiều request, vui lòng thử lại sau 15 phút'
        });
    }
});

// Rate limiter cho API search descriptions
const searchDescriptionsLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 phút
    max: 200, // Tối đa 200 requests trong 15 phút
    message: {
        success: false,
        message: 'Quá nhiều request tìm kiếm, vui lòng thử lại sau 15 phút'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            message: 'Quá nhiều request tìm kiếm, vui lòng thử lại sau 15 phút'
        });
    }
});

module.exports = {
    popularDescriptionsLimiter,
    searchDescriptionsLimiter
};
