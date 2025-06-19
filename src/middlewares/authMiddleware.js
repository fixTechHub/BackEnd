const jwt = require("jsonwebtoken");

exports.authenticateToken = async (req, res, next) => {
    const token = req.cookies.token;
    const isTemporarySession = req.headers['x-session-type'] === 'temporary';

    if (!token) {
        return res.status(401).json({ message: "Unauthorized - No token provided" });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        
        // Nếu là session tạm thời, cho phép tiếp tục
        if (isTemporarySession) {
            return next();
        }
        
        // Kiểm tra thêm các điều kiện khác nếu không phải session tạm thời
        next();
    } catch (error) {
        return res.status(403).json({ message: "Forbidden - Invalid token" });
    }
};