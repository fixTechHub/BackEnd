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

        // Nếu là session tạm thời, cho phép tiếp tục mà không kiểm tra trạng thái xác thực
        if (isTemporarySession) {
            return next();
        }

        // Kiểm tra trạng thái xác thực chỉ khi không phải session tạm thời
        let isIncomplete = false;
        let lastStep = null;

        if (decoded.role === 'PENDING') {
            isIncomplete = true;
            lastStep = 'CHOOSE_ROLE';
        } else if (user.email && !user.emailVerified) {
            isIncomplete = true;
            lastStep = 'VERIFY_EMAIL';
        } else if (user.phone && !user.phoneVerified && !user.email) {
            isIncomplete = true;
            lastStep = 'VERIFY_PHONE';
        } else if (decoded.role === 'TECHNICIAN' && (!user.status || user.status === 'PENDING')) {
            isIncomplete = true;
            lastStep = 'COMPLETE_PROFILE';
        }

        // Nếu có bước chưa hoàn thành và không phải đang ở các route xác thực
        const authRoutes = ['/auth/verify-email', '/auth/verify-otp', '/auth/complete-registration', '/auth/resend-email-code', '/auth/resend-otp'];
        if (isIncomplete && !authRoutes.some(route => req.path.includes(route))) {
            // Xóa cookie và lưu bước cuối cùng vào session
            res.clearCookie('token');
            res.cookie('lastVerificationStep', lastStep, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
                domain: process.env.COOKIE_DOMAIN || undefined,
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