const { OAuth2Client } = require("google-auth-library");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const { generateToken, decodeToken } = require('../utils/jwt');
const HttpError = require('../utils/error');
const userService = require('./userService');
const technicianService = require('./technicianService');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/mail');
const { sendVerificationSMS } = require('../utils/sms');
const { hashingPassword, comparePassword } = require('../utils/password');
const { passwordSchema } = require("../validations/authValidation");
const oAuth2Client = new OAuth2Client(process.env.CLIENT_ID);
const Role = require('../models/Role');
const User = require('../models/User');

// Google Auth
exports.googleAuth = async (access_token) => {
    if (!access_token) throw new HttpError(400, "Missing access token");

    try {
        // Lấy thông tin user từ Google API
            const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: {
                'Authorization': `Bearer ${access_token}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to get user info from Google');
            }

            const payload = await response.json();
        const { sub: googleId, email, name: fullName, picture: avatar } = payload;

        let user = await userService.findUserByEmail(email);
        let wasReactivated = false;

            if (user) {
                if (!user.googleId) {
                    user = await userService.updateUserGoogleId(user, googleId);
                }
                
                // Kiểm tra trạng thái tài khoản
                if (user.status === 'INACTIVE_ADMIN') {
                    throw new HttpError(403, "Tài khoản của bạn đã bị vô hiệu hóa bởi quản trị viên. Vui lòng liên hệ với quản trị viên để được hỗ trợ.");
                }

                // Kiểm tra xem tài khoản có vừa được kích hoạt lại không
                if (user.status === 'INACTIVE_USER') {
                    user.status = 'ACTIVE';
                    await user.save();
                    wasReactivated = true;
                }
                
                // Kiểm tra và khôi phục tài khoản đang chờ xóa
                if (user.status === 'PENDING_DELETION') {
                    user.status = 'ACTIVE';
                    user.deletionRequestedAt = undefined;
                    user.deletionScheduledAt = undefined;
                    await user.save();
                    wasReactivated = true;
                }
            } else {
            // Tìm role PENDING
            const pendingRole = await Role.findOne({ name: 'PENDING' });
            if (!pendingRole) {
                throw new Error('Pending role not found');
            }

            // Tạo user mới với role PENDING
                user = await userService.createNewUser({
                fullName,
                email,
                    googleId,
                avatar,
                    status: 'ACTIVE',
                emailVerified: true,
                role: pendingRole._id
                });
            }
        
            
            let technician = null;
            if(user.role && user.role.name==='TECHNICIAN'){
                technician = await technicianService.findTechnicianByUserId(user._id);
            }
            const token = generateToken(user);
            
            return { user, token, technician, wasReactivated };
    } catch (error) {
        console.error('Google auth error:', error);
        throw new HttpError(500, `Google authentication failed: ${error.message}`);
    }
};

// Normal login
exports.normalLogin = async (email, password) => {
    try {
        const user = await userService.findUserByEmail(email);

        // Check if user exists
        if (!user) {
            throw new HttpError(400, "Email không tồn tại trong hệ thống");
        }

        // Check if user was registered via Google (has googleId but no passwordHash)
        if (user.googleId && !user.passwordHash) {
            throw new HttpError(400, "Tài khoản này được đăng ký bằng Google. Vui lòng sử dụng đăng nhập Google.");
        }

        // Check if user has a password
        if (!user.passwordHash) {
            throw new HttpError(400, "Email hoặc mật khẩu không đúng.");
        }

        const isMatch = await comparePassword(password, user.passwordHash);
        if (!isMatch) {
            throw new HttpError(400, "Mật khẩu không đúng");
        }

        // Kiểm tra trạng thái tài khoản
        if (user.status === 'INACTIVE_ADMIN') {
            throw new HttpError(403, "Tài khoản của bạn đã bị vô hiệu hóa bởi quản trị viên. Vui lòng liên hệ với quản trị viên để được hỗ trợ.");
        }

        // Kiểm tra xem tài khoản có vừa được kích hoạt lại không
        let wasReactivated = false;
        if (user.status === 'INACTIVE_USER') {
            user.status = 'ACTIVE';
            await user.save();
            wasReactivated = true;
        }
        
        // Kiểm tra và khôi phục tài khoản đang chờ xóa
        if (user.status === 'PENDING_DELETION') {
            user.status = 'ACTIVE';
            user.deletionRequestedAt = undefined;
            user.deletionScheduledAt = undefined;
            await user.save();
            wasReactivated = true;
        }
        
        // Đảm bảo user thường không có googleId
        if (user.googleId) {
            user.googleId = undefined;
            await user.save();
        }
        
        const token = generateToken(user);
        let technician = null;
        if (user.role && user.role.name === 'TECHNICIAN') {
            technician = await technicianService.findTechnicianByUserId(user._id);
        }
        
        return { user, token, technician, wasReactivated };
    } catch (error) {
        throw new HttpError(error.statusCode || 500, error.message);
    }
};

// Register
exports.register = async (userData) => {
    try {
        // Hash mật khẩu trước khi lưu
        userData.passwordHash = await hashingPassword(userData.password);
        delete userData.password;

        // Tạo user với role đã chọn
        const user = await userService.createNewUser(userData);
        return user;
    } catch (error) {
        throw new HttpError(500, `Đăng ký thất bại: ${error.message}`);
    }
};

// Verify OTP
exports.verifyOTP = async (phone, otp) => {
    try {
        const user = await userService.findUserByPhone(phone);
        if (!user) throw new HttpError(400, "Invalid phone number");

        if (user.verificationOTP !== otp) {
            throw new HttpError(400, "Invalid OTP");
        }

        if (user.otpExpires < new Date()) {
            throw new HttpError(400, "OTP has expired");
        }

        user.phoneVerified = true;
        user.verificationOTP = undefined;
        user.otpExpires = undefined;
        await user.save();

        return user;
    } catch (error) {
        throw new HttpError(500, `OTP verification failed: ${error.message}`);
    }
};

// Email verification
exports.verifyEmail = async (token) => {
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await userService.findUserById(decoded.userId);

        if (!user) throw new HttpError(400, "Invalid token");
        if (user.emailVerified === true) throw new HttpError(400, "Email already verified");

        user.emailVerified = true;
        await user.save();

        return `${process.env.FRONT_END_URL}/login`;
    } catch (error) {
        throw new HttpError(500, `Email verification failed: ${error.message}`);
    }
};

exports.handleForgotPassword = async (emailOrPhone) => {
    try {
        // Kiểm tra xem input là email hay số điện thoại
        const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailOrPhone);
        const user = isEmail 
            ? await userService.findUserByEmail(emailOrPhone)
            : await userService.findUserByPhone(emailOrPhone);

        if (!user) {
            throw new HttpError(404, "Không tìm thấy tài khoản");
        }

        if (isEmail) {
            // Tạo JWT token cho link đặt lại mật khẩu
            const resetToken = jwt.sign(
                { 
                    userId: user._id,
                    purpose: 'password-reset'
                },
                process.env.JWT_SECRET,
                { expiresIn: '5m' }
            );

            // Gửi email với link đặt lại mật khẩu
            await sendPasswordResetEmail(user.email, resetToken);
            return { type: 'email' };
        } else {
            // Tạo mã OTP cho reset qua SMS
            const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
            const expiryTime = new Date(Date.now() + 5 * 60 * 1000); // 5 phút

            user.phoneVerificationCode = verificationCode;
            user.phoneVerificationExpiry = expiryTime;
            await user.save();

            // Gửi SMS
            await sendVerificationSMS(user.phone, verificationCode);
            return { type: 'phone' };
        }
    } catch (error) {
        throw new HttpError(error.statusCode || 500, error.message);
    }
};

exports.handleResetPassword = async (token, newPassword) => {
    try {
        let user;

        // Kiểm tra xem token có phải là JWT token không
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            if (decoded.purpose !== 'password-reset') {
                throw new Error('Token không hợp lệ');
            }
            user = await User.findById(decoded.userId);
        } catch (jwtError) {
            // Nếu không phải JWT token, kiểm tra xem có phải là mã OTP không
            user = await User.findOne({
                phoneVerificationCode: token,
                phoneVerificationExpiry: { $gt: new Date() }
            });
        }
    
    if (!user) {
            throw new HttpError(404, "Token không hợp lệ hoặc đã hết hạn");
    }

        // Hash và lưu mật khẩu mới
        user.passwordHash = await hashingPassword(newPassword);
        user.phoneVerificationCode = undefined;
        user.phoneVerificationExpiry = undefined;
        
        await user.save();
        return user;
    } catch (error) {
        throw new HttpError(error.statusCode || 500, error.message);
    }
};

// Check Authentication
exports.checkAuth = async (userId) => {
    try {
        const user = await userService.findUserById(userId);
        if (!user) {
            throw new HttpError(404, "Không tìm thấy người dùng");
        }

        // Kiểm tra trạng thái tài khoản
        if (user.status === 'INACTIVE_ADMIN') {
            throw new HttpError(403, "Tài khoản của bạn đã bị vô hiệu hóa bởi quản trị viên. Vui lòng liên hệ với quản trị viên để được hỗ trợ.");
        }

        let technician = null;
        if (user.role && user.role.name === 'TECHNICIAN') {
            technician = await technicianService.findTechnicianByUserId(user._id);
        }

        return { user, technician };
    } catch (error) {
        throw new HttpError(error.statusCode || 500, error.message);
    }
};
