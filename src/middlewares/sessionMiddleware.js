const jwt = require("jsonwebtoken");
const User = require("../models/User");

exports.handleTemporarySession = async (req, res, next) => {
    const token = req.cookies.token;
    const isTemporarySession = req.headers['x-session-type'] === 'temporary';

    // Nếu không có token, chỉ xóa lastVerificationStep cookie nếu có
    if (!token) {
        if (req.cookies.lastVerificationStep) {
            res.clearCookie('lastVerificationStep');
        }
        return next();
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Sử dụng role từ token thay vì populate từ database
        const user = await User.findById(decoded.userId);
        
        if (!user) {
            res.clearCookie('token');
            if (req.cookies.lastVerificationStep) {
                res.clearCookie('lastVerificationStep');
            }
            return next();
        }

        // Thêm role từ token vào user object để tương thích với code cũ
        user.role = { name: decoded.role };

        // Kiểm tra trạng thái xác thực
        let isIncomplete = false;
        let lastStep = null;

        if (decoded.role === 'PENDING') {
            isIncomplete = true;
            lastStep = 'CHOOSE_ROLE';
        } else if (user.email && !user.emailVerified) {
            isIncomplete = true;
            lastStep = 'VERIFY_EMAIL';
        } else if (user.phone && !user.phoneVerified) {
            isIncomplete = true;
            lastStep = 'VERIFY_PHONE';
        } else if (decoded.role === 'TECHNICIAN' && (!user.status || user.status === 'PENDING')) {
            isIncomplete = true;
            lastStep = 'COMPLETE_PROFILE';
        }

        // Nếu là session tạm thời, cho phép tiếp tục
        if (isTemporarySession) {
            return next();
        }

        // Nếu có bước chưa hoàn thành và không phải đang ở các route xác thực
        const authRoutes = ['/auth/verify-email', '/auth/verify-otp', '/auth/complete-registration'];
        if (isIncomplete && !authRoutes.some(route => req.path.includes(route))) {
            // Xóa cookie và lưu bước cuối cùng vào session
            res.clearCookie('token');
            res.cookie('lastVerificationStep', lastStep, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 24 * 60 * 60 * 1000 // 24 hours
            });
        }

        next();
    } catch (error) {
        res.clearCookie('token');
        if (req.cookies.lastVerificationStep) {
            res.clearCookie('lastVerificationStep');
        }
        next();
    }
}; 