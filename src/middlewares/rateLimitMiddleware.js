const rateLimit = require('express-rate-limit');

// Hàm tạo key cho rate limiting
const createKeyGenerator = () => {
    return (req) => {
        // Sử dụng X-Forwarded-For nếu có, nếu không thì dùng IP trực tiếp
        const clientIP = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || req.connection.remoteAddress;
        return clientIP;
    };
};

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
    keyGenerator: createKeyGenerator(),
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
    keyGenerator: createKeyGenerator(),
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
