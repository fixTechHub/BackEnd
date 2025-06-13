const authService = require('../services/authService');
const userService = require('../services/userService');
const technicianService = require('../services/technicianService');

const { loginSchema,passwordSchema } = require('../validations/authValidation');
const { generateCookie } = require('../utils/generateCode');
const { createUserSchema } = require('../validations/userValidation');
const { createTechnicianSchema } = require('../validations/technicianValidation');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { generateToken } = require('../utils/jwt');
const { sendVerificationEmail } = require('../utils/mail');
const { sendVerificationSMS } = require('../utils/sms');
const bcrypt = require('bcrypt');
const { OAuth2Client } = require('google-auth-library');

const oAuth2Client = new OAuth2Client(process.env.CLIENT_ID);

exports.getAuthenticatedUser = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { user, technician } = await authService.checkAuth(userId);
        return res.status(200).json({ user, technician });
    } catch (error) {
        console.error('Error fetching authenticated user:', error);
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};
exports.googleAuthController = async (req, res) => {
    try {
        const { access_token } = req.body;
        console.log('Google auth attempt with access_token:', access_token ? 'Exists' : 'Missing');

        if (!access_token) {
            return res.status(400).json({ error: "Missing access token" });
        }

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
            console.log('Google user info:', payload);

            const { user, token, technician } = await authService.googleAuth(access_token);
            generateCookie(token, res);
            return res.status(200).json({ user, token, technician });
        } catch (error) {
            console.error('Google API Error:', error);
            return res.status(400).json({ error: "Invalid Google access token" });
        }
    } catch (error) {
        console.error("GoogleAuthController Error:", error);
        return res.status(error.statusCode || 500).json({ error: error.message });
    }
};

exports.logout = async (req, res) => {
    try {
        res.clearCookie("token", {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: "Strict"
        });
        return res.json({ message: "Logged out successfully" });
    } catch (error) {
        console.error("Logout Error:", error);
        res.status(500).json({ error: "Logout failed" });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log('Login attempt:', { email }); // Log email để debug

        // Validate input
        if (!email || !password) {
            return res.status(400).json({ message: 'Email và mật khẩu là bắt buộc' });
        }

        // Tìm user
        const user = await User.findOne({ email });
        console.log('Found user:', user ? 'Yes' : 'No'); // Log kết quả tìm user

        if (!user) {
            return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng' });
        }

        // Kiểm tra mật khẩu
        if (!user.passwordHash) {
            console.log('User has no passwordHash'); // Log nếu không có passwordHash
            return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng' });
        }

        console.log('Comparing passwords...'); // Log trước khi so sánh mật khẩu
        const isMatch = await bcrypt.compare(password, user.passwordHash);
        console.log('Password match:', isMatch); // Log kết quả so sánh

        if (!isMatch) {
            return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng' });
        }

        // Log biến môi trường
        console.log('Environment variables:', {
            JWT_SECRET: process.env.JWT_SECRET ? 'Exists' : 'Missing'
        });

        // Tạo access token
        const accessToken = jwt.sign(
            { userId: user._id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '7d' } // Tăng thời hạn lên 7 ngày
        );

        // Set cookie
        res.cookie('token', accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 ngày
        });

        // Trả về thông tin user (không bao gồm password)
        const userResponse = {
            _id: user._id,
            email: user.email,
            fullName: user.fullName,
            role: user.role,
            isVerified: user.isVerified
        };

        res.json({
            message: 'Đăng nhập thành công',
            user: userResponse
        });
    } catch (error) {
        console.error('Login error details:', error); // Log chi tiết lỗi
        res.status(500).json({ message: 'Lỗi server' });
    }
};

exports.register = async (req, res) => {
    try {
        const { fullName, emailOrPhone, password } = req.body;
        
        // Validate userData
        const { error: userError } = createUserSchema.validate({ 
            fullName, 
            emailOrPhone, 
            password,
            confirmPassword: password
        });
        if (userError) return res.status(400).json({ error: userError.details[0].message });

        // Kiểm tra xem email/phone đã tồn tại chưa
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const isEmail = emailRegex.test(emailOrPhone);
        
        let existingUser;
        if (isEmail) {
            existingUser = await userService.findUserByEmail(emailOrPhone);
            if (existingUser) {
                return res.status(400).json({ error: "Email đã được sử dụng" });
            }
        } else {
            existingUser = await userService.findUserByPhone(emailOrPhone);
            if (existingUser) {
                return res.status(400).json({ error: "Số điện thoại đã được sử dụng" });
            }
        }

        // Tạo token tạm thời chứa thông tin đăng ký
        const tempUser = {
            fullName,
            emailOrPhone,
            password
        };
        const token = jwt.sign(tempUser, process.env.JWT_SECRET, { expiresIn: '15m' });
            
        return res.status(200).json({ 
            message: "Vui lòng chọn vai trò của bạn",
            token 
        });
    } catch (error) {
        console.error("Register Error:", error);
        res.status(error.statusCode || 500).json({ error: error.message });
    }
};

exports.completeRegistration = async (req, res) => {
    try {
        const { role } = req.body;
        // Lấy token từ header Authorization
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'Token không hợp lệ' });
        }
        const token = authHeader.split(' ')[1];

        console.log('Complete registration request:', { role, token }); // Log để debug

        // Tìm role trong database
        const roleDoc = await userService.findRoleByName(role);
        if (!roleDoc) {
            return res.status(400).json({ message: 'Role không hợp lệ' });
        }

        // Verify token và lấy thông tin user
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        let user;
        let isGoogleAuth = false;

        if (decoded.userId) {
            // Trường hợp đăng nhập Google
            isGoogleAuth = true;
            user = await User.findById(decoded.userId);
            if (!user) {
                return res.status(404).json({ message: 'Không tìm thấy người dùng' });
            }
            // Cập nhật role cho user
            user.role = roleDoc._id;
            await user.save();
        } else {
            // Trường hợp đăng ký thường
            const { fullName, emailOrPhone, password } = decoded;
            
            // Kiểm tra xem email/phone đã tồn tại chưa
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            const isEmail = emailRegex.test(emailOrPhone);
            
            let existingUser;
            if (isEmail) {
                existingUser = await userService.findUserByEmail(emailOrPhone);
                if (existingUser) {
                    return res.status(400).json({ message: "Email đã được sử dụng" });
                }
            } else {
                existingUser = await userService.findUserByPhone(emailOrPhone);
                if (existingUser) {
                    return res.status(400).json({ message: "Số điện thoại đã được sử dụng" });
                }
            }

            // Hash password
            const hashedPassword = await bcrypt.hash(password, 10);

            // Generate userCode
            const userCode = await userService.generateUserCode();

            // Generate verification code
            const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
            const verificationCodeExpires = new Date(Date.now() + 15 * 60000); // 15 minutes

            // Tạo user mới
            user = await User.create({
                userCode,
                fullName,
                [isEmail ? 'email' : 'phone']: emailOrPhone,
                passwordHash: hashedPassword,
                role: roleDoc._id,
                status: 'PENDING',
                emailVerified: false,
                verificationCode,
                verificationCodeExpires
            });

            // Gửi mã xác thực
            if (isEmail) {
                await sendVerificationEmail(emailOrPhone, verificationCode);
            } else {
                await sendVerificationSMS(emailOrPhone, verificationCode);
            }
        }

        // Populate role trước khi trả về
        await user.populate('role');

        // Tạo token mới với role đã cập nhật
        const newToken = generateToken(user);

        res.json({
            message: 'Hoàn tất đăng ký thành công',
            user,
            token: newToken,
            isGoogleAuth
        });
    } catch (error) {
        console.error('Complete registration error:', error);
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Token không hợp lệ' });
        }
        res.status(500).json({ message: 'Lỗi server' });
    }
};

exports.verifyEmail = async (req, res) => {
    try {
        const { email, code } = req.body;
        if (!email || !code) {
            return res.status(400).json({ error: "Email và mã xác thực là bắt buộc" });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ error: "Không tìm thấy người dùng" });
        }

        if (user.emailVerified) {
            return res.status(400).json({ error: "Email đã được xác thực" });
        }

        if ((user.verificationCode || '').toString().trim() !== (code || '').toString().trim()) {
            return res.status(400).json({ error: "Mã xác thực không đúng" });
        }

        if (user.verificationCodeExpires < Date.now()) {
            return res.status(400).json({ error: "Mã xác thực đã hết hạn" });
        }

        user.emailVerified = true;
        user.verificationCode = undefined;
        user.verificationCodeExpires = undefined;
        await user.save();

        res.status(200).json({ message: "Xác thực email thành công" });
    } catch (error) {
        console.error("Verify Email Error:", error);
        res.status(500).json({ error: "Lỗi xác thực email" });
    }
};

exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

       await authService.forgotPassword(email)
        
        // Generate a reset token (expires in 15 minutes)
        return res.status(201).json({ message: "Send Email successful. Please check your email to reset your password." });
    } catch (error) {
        console.error("Forgot Password Error:", error.message);
        res.status(500).json({  error : error.message});
    }
};

exports.resetPassword = async (req,res) => {
    try {
        const { token, password } = req.body;
        console.log(req.body);
        
        const { error } = passwordSchema.validate(password);
        if (error) return res.status(400).json({ error: error.details[0].message });
        await authService.resetPassword(token,password)
        return res.status(201).json({ message: "Reset Password successful. Please try to log in again." });
    } catch (error) {
        
    }
}

exports.verifyOTP = async (req, res) => {
    try {
        const { phone, otp } = req.body;
        if (!phone || !otp) {
            return res.status(400).json({ error: "Số điện thoại và mã OTP là bắt buộc" });
        }

        const user = await User.findOne({ phone });
        if (!user) {
            return res.status(404).json({ error: "Không tìm thấy người dùng" });
        }

        if (user.phoneVerified) {
            return res.status(400).json({ error: "Số điện thoại đã được xác thực" });
        }

        if (user.verificationOTP !== otp) {
            return res.status(400).json({ error: "Mã OTP không đúng" });
        }

        if (user.otpExpires < Date.now()) {
            return res.status(400).json({ error: "Mã OTP đã hết hạn" });
        }

        user.phoneVerified = true;
        user.verificationOTP = undefined;
        user.otpExpires = undefined;
        await user.save();

        res.status(200).json({ message: "Xác thực số điện thoại thành công" });
    } catch (error) {
        console.error("Verify OTP Error:", error);
        res.status(500).json({ error: "Lỗi xác thực số điện thoại" });
    }
};

exports.updateUserRole = async (req, res) => {
    try {
        const { role } = req.body;
        const userId = req.user.userId;

        const user = await userService.findUserById(userId);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const userRole = await userService.findRoleByName(role);
        if (!userRole) {
            return res.status(400).json({ error: "Invalid role" });
        }

        user.role = userRole._id;
        await user.save();

        return res.status(200).json({ 
            message: "Role updated successfully",
            user: await user.populate('role')
        });
    } catch (error) {
        console.error("Update Role Error:", error);
        res.status(error.statusCode || 500).json({ error: error.message });
    }
};

exports.checkExist = async (req, res) => {
    try {
        const { emailOrPhone } = req.body;
        if (!emailOrPhone) {
            return res.status(400).json({ error: "Thiếu thông tin cần kiểm tra" });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const isEmail = emailRegex.test(emailOrPhone);

        let existingUser;
        if (isEmail) {
            existingUser = await userService.findUserByEmail(emailOrPhone);
            if (existingUser) {
                return res.json({ exists: true, type: "email", message: "Email đã được sử dụng" });
            }
        } else {
            existingUser = await userService.findUserByPhone(emailOrPhone);
            if (existingUser) {
                return res.json({ exists: true, type: "phone", message: "Số điện thoại đã được sử dụng" });
            }
        }
        return res.json({ exists: false, message: "Email/Số điện thoại có thể sử dụng" });
    } catch (error) {
        console.error("Check Exist Error:", error);
        res.status(500).json({ error: "Lỗi kiểm tra tồn tại" });
    }
};

exports.refreshToken = async (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken;
        
        if (!refreshToken) {
            return res.status(401).json({ message: 'Không tìm thấy refresh token' });
        }

        // Verify refresh token
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        
        // Tìm user
        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(401).json({ message: 'Người dùng không tồn tại' });
        }

        // Tạo access token mới
        const accessToken = jwt.sign(
            { userId: user._id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '15m' }
        );

        // Set cookie
        res.cookie('token', accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 15 * 60 * 1000 // 15 phút
        });

        res.json({ message: 'Refresh token thành công' });
    } catch (error) {
        console.error('Refresh token error:', error);
        res.status(401).json({ message: 'Refresh token không hợp lệ' });
    }
};