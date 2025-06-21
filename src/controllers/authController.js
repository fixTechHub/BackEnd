const authService = require('../services/authService');
const userService = require('../services/userService');
const technicianService = require('../services/technicianService');
const contractService = require('../services/contractService');

const { loginSchema,passwordSchema } = require('../validations/authValidation');
const { generateCookie } = require('../utils/generateCode');
const { createUserSchema } = require('../validations/userValidation');
const { createTechnicianSchema } = require('../validations/technicianValidation');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { generateToken } = require('../utils/jwt');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/mail');
const { sendVerificationSMS } = require('../utils/sms');
const bcrypt = require('bcrypt');
const { OAuth2Client } = require('google-auth-library');
const Role = require('../models/Role');
const axios = require('axios');
const Technician = require('../models/Technician');
const mongoose = require('mongoose');

const oAuth2Client = new OAuth2Client(process.env.CLIENT_ID);

// Helper function to set auth cookie
const setAuthCookie = (res, token) => {
    res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
};

exports.getAuthenticatedUser = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { user, technician } = await authService.checkAuth(userId);
        
        // Thêm kiểm tra trạng thái xác thực
        const verificationStatus = await checkVerificationStatus(user);
        
        return res.status(200).json({ 
            user, 
            technician,
            verificationStatus 
        });
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
            
            // Set auth cookie
            setAuthCookie(res, token);

            // Return user data without token in body
            return res.status(200).json({ user, technician });
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
        // Clear the auth cookie
        res.clearCookie('token', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict'
        });
        
        return res.status(200).json({ message: "Logged out successfully" });
    } catch (error) {
        console.error("Logout Error:", error);
        return res.status(500).json({ error: "Logout failed" });
    }
};

exports.login = async (req, res) => {
    try {
        const { error } = loginSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }

        const { email, password } = req.body;
        const result = await authService.normalLogin(email, password);
        
        // Set auth cookie
        setAuthCookie(res, result.token);

        // Kiểm tra trạng thái xác thực
        const verificationStatus = await checkVerificationStatus(result.user);
        
        return res.status(200).json({
            message: "Đăng nhập thành công",
            user: result.user,
            technician: result.technician,
            verificationStatus
        });
    } catch (error) {
        console.error("Login Error:", error);
        res.status(error.statusCode || 500).json({ error: error.message });
    }
};

exports.googleLogin = async (req, res) => {
    try {
        const { access_token } = req.body;
        if (!access_token) {
            return res.status(400).json({ error: "Access token is required" });
        }

        // Verify Google token
        const response = await axios.get(
            `https://www.googleapis.com/oauth2/v1/userinfo?access_token=${access_token}`,
            {
                headers: {
                    Authorization: `Bearer ${access_token}`,
                    Accept: 'application/json'
                }
            }
        );

        if (!response.data) {
            return res.status(400).json({ error: "Invalid Google access token" });
        }

        const { email, name, picture, id: googleId } = response.data;

        // Check if user exists
        let user = await User.findOne({ email }).populate('role');
        let isNewUser = false;

        if (!user) {
            // Generate unique userCode
            const latestUser = await User.findOne({}, {}, { sort: { 'createdAt': -1 } });
            let userCode = 'U0001';
            
            if (latestUser && latestUser.userCode) {
                const lastNumber = parseInt(latestUser.userCode.slice(1));
                userCode = `U${String(lastNumber + 1).padStart(4, '0')}`;
            }

            // Create new user with PENDING role
            const pendingRole = await Role.findOne({ name: 'PENDING' });
            user = await User.create({
                email,
                fullName: name,
                userCode,
                avatar: picture,
                googleId,
                emailVerified: true,
                role: pendingRole._id
            });
            isNewUser = true;
        } else if (!user.googleId) {
            // If existing user doesn't have googleId, update it
            user.googleId = googleId;
            await user.save();
        }

        // Generate JWT token
        const token = jwt.sign(
            { userId: user._id },   
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Populate role if not populated
        if (!user.role.name) {
            await user.populate('role');
        }

        let technician = null;
        if (user.role && user.role.name === 'TECHNICIAN') {
            technician = await technicianService.findTechnicianByUserId(user._id);
        }

        // Set cookie
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        // Add verification status check
        const verificationStatus = await checkVerificationStatus(user);

        return res.status(200).json({ 
            message: "Đăng nhập thành công",
            user, 
            technician,
            verificationStatus
        });
    } catch (error) {
        console.error("Google Login Error:", error);
        if (error.response?.data?.error) {
            return res.status(400).json({ error: error.response.data.error });
        }
        res.status(error.statusCode || 500).json({ error: error.message });
    }
};

// Helper function to check verification status
const checkVerificationStatus = async (user) => {
    // Kiểm tra theo thứ tự ưu tiên
    if (!user.role) {
        return {
            step: 'CHOOSE_ROLE',
            redirectTo: '/choose-role',
            message: 'Vui lòng chọn vai trò của bạn'
        };
    }

    if (user.role?.name === 'PENDING') {
        return {
            step: 'CHOOSE_ROLE',
            redirectTo: '/choose-role',
            message: 'Vui lòng chọn vai trò của bạn'
        };
    }

    if (user.email && !user.emailVerified) {
        return {
            step: 'VERIFY_EMAIL',
            redirectTo: '/verify-email',
            message: 'Vui lòng xác thực email của bạn'
        };
    }

    if (user.phone && !user.phoneVerified && !user.email) {
        return {
            step: 'VERIFY_PHONE',
            redirectTo: '/verify-otp',
            message: 'Vui lòng xác thực số điện thoại của bạn'
        };
    }

    if (user.role?.name === 'TECHNICIAN' && (!user.status || user.status === 'PENDING')) {
        return {
            step: 'COMPLETE_PROFILE',
            redirectTo: '/technician/complete-profile',
            message: 'Vui lòng hoàn thành hồ sơ kỹ thuật viên'
        };
    }

    return {
        step: 'COMPLETED',
        redirectTo: '/',
        message: 'Xác thực hoàn tất'
    };
};

exports.register = async (req, res) => {
    try {
        const { error } = createUserSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }

        const { fullName, emailOrPhone, password } = req.body;
    
        // Kiểm tra xem emailOrPhone là email hay số điện thoại
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const isEmail = emailRegex.test(emailOrPhone);

        // Kiểm tra tồn tại
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

        // Tìm role PENDING
        const pendingRole = await Role.findOne({ name: 'PENDING' });
        if (!pendingRole) {
            return res.status(500).json({ error: "Lỗi hệ thống: Role PENDING không tồn tại" });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Generate verification code
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        const verificationCodeExpires = new Date(Date.now() + 5 * 60000); // 5 minutes

        // Create user
        const user = await userService.createNewUser({
            fullName,
            emailOrPhone,
            password: hashedPassword,
            role: pendingRole._id,
            status: 'PENDING',
            verificationCode,
            verificationCodeExpires
        });

        // Generate token
        const token = generateToken(user);
        setAuthCookie(res, token);

        // Send verification code
        if (isEmail) {
            await sendVerificationEmail(emailOrPhone, verificationCode);
            console.log('Verification code sent to email:', verificationCode); // Debug log
        } else {
            await sendVerificationSMS(emailOrPhone, verificationCode);
            console.log('Verification code sent to phone:', verificationCode); // Debug log
        }

        // Return response
        return res.status(201).json({
            message: `Mã xác thực đã được gửi đến ${isEmail ? 'email' : 'số điện thoại'} của bạn`,
            user: await user.populate('role'),
            verificationType: isEmail ? 'email' : 'phone'
        });
    } catch (error) {
        console.error('Register Error:', error);
        res.status(error.statusCode || 500).json({ error: error.message });
    }
};

exports.completeRegistration = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { role, specialties, experienceYears, identification } = req.body;
        const userId = req.user.userId;

        const user = await User.findById(userId).session(session);
        if (!user) {
            return res.status(404).json({ message: "Không tìm thấy người dùng" });
        }
        if (user.role.name !== 'PENDING') {
            return res.status(400).json({ message: "Vai trò đã được chọn" });
        }

        const roleDoc = await Role.findOne({ name: role }).session(session);
        if (!roleDoc) {
            return res.status(400).json({ message: "Vai trò không hợp lệ" });
        }

        user.role = roleDoc._id;

        let technician = null;
        if (role === 'TECHNICIAN') {
            if (!identification) {
                return res.status(400).json({ message: "Cần có CMND/CCCD cho kỹ thuật viên" });
            }
            
            const newTechnician = new Technician({
                userId: user._id,
                specialtiesCategories: specialties,
                experienceYears: experienceYears,
                identification: identification,
                status: 'PENDING',
                currentLocation: { // Default location, update as needed
                    type: 'Point',
                    coordinates: [108.2234, 16.0748]
                }
            });
            technician = await newTechnician.save({ session });
            
            // Automatically generate the contract in the background
            await contractService.generateContractOnRegistration(technician._id);

        }

        await user.save({ session });
        await session.commitTransaction();
        session.endSession();

        const token = generateToken(user);
        setAuthCookie(res, token);
        
        const verificationStatus = await checkVerificationStatus(user);

        res.status(200).json({
            message: "Hoàn tất đăng ký thành công",
            user,
            technician,
            verificationStatus
        });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error("Complete Registration Error:", error);
        res.status(500).json({ message: "Lỗi khi hoàn tất đăng ký", error: error.message });
    }
};

exports.verifyEmail = async (req, res) => {
    try {
        const { code } = req.body;
        const userId = req.user.userId;

        console.log('Verifying email with:', { code, userId }); // Debug log

        const user = await User.findById(userId).populate('role');
        if (!user) {
            console.log('User not found:', userId); // Debug log
            return res.status(404).json({ error: "User not found" });
        }

        console.log('User verification data:', { // Debug log
            storedCode: user.verificationCode,
            codeExpires: user.verificationCodeExpires,
            now: new Date()
        });

        if (user.verificationCode !== code) {
            console.log('Invalid code:', { // Debug log
                provided: code,
                stored: user.verificationCode
            });
            return res.status(400).json({ error: "Invalid verification code" });
        }

        if (new Date() > user.verificationCodeExpires) {
            console.log('Code expired:', { // Debug log
                expires: user.verificationCodeExpires,
                now: new Date()
            });
            return res.status(400).json({ error: "Verification code has expired" });
        }

        user.emailVerified = true;
        user.verificationCode = undefined;
        user.verificationCodeExpires = undefined;

        // Nếu user có role là CUSTOMER và đã xác thực email, cập nhật status thành ACTIVE
        if (user.role && user.role.name === 'CUSTOMER') {
            user.status = 'ACTIVE';
        }

        await user.save();

        console.log('Email verified successfully for user:', userId); // Debug log

        return res.status(200).json({ 
            message: "Email verified successfully",
            user: await user.populate('role')
        });
    } catch (error) {
        console.error("Verify Email Error:", error);
        res.status(500).json({ error: "Email verification failed" });
    }
};

exports.forgotPassword = async (req, res) => {
    try {
        const { emailOrPhone } = req.body;
        if (!emailOrPhone) {
            return res.status(400).json({ 
                error: "Vui lòng nhập email hoặc số điện thoại" 
            });
        }

        const result = await authService.handleForgotPassword(emailOrPhone);
        
        return res.status(200).json({
            message: result.type === 'email' 
                ? "Đã gửi hướng dẫn đặt lại mật khẩu qua email"
                : "Đã gửi mã xác thực qua SMS",
            type: result.type
        });
    } catch (error) {
        console.error("Forgot Password Error:", error);
        res.status(error.statusCode || 500).json({ 
            error: error.message || "Có lỗi xảy ra khi xử lý yêu cầu đặt lại mật khẩu" 
        });
    }
};

exports.resetPassword = async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        // Validate password
        const { error } = passwordSchema.validate({ password: newPassword });
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }

        await authService.handleResetPassword(token, newPassword);

        return res.status(200).json({ 
            message: "Đặt lại mật khẩu thành công" 
        });
    } catch (error) {
        console.error("Reset Password Error:", error);
        res.status(error.statusCode || 500).json({ 
            error: error.message || "Có lỗi xảy ra khi đặt lại mật khẩu" 
        });
    }
};

exports.verifyOTP = async (req, res) => {
    try {
        const { otp } = req.body;
        const userId = req.user.userId;

        const user = await User.findById(userId).populate('role');
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        if (user.verificationOTP !== otp) {
            return res.status(400).json({ error: "Invalid OTP" });
        }

        if (new Date() > user.otpExpires) {
            return res.status(400).json({ error: "OTP has expired" });
        }

        user.phoneVerified = true;
        user.verificationOTP = undefined;
        user.otpExpires = undefined;

        // Nếu user có role là CUSTOMER và đã xác thực số điện thoại, cập nhật status thành ACTIVE
        if (user.role && user.role.name === 'CUSTOMER') {
            user.status = 'ACTIVE';
        }

        await user.save();

        return res.status(200).json({ 
            message: "Phone number verified successfully",
            user: await user.populate('role')
        });
    } catch (error) {
        console.error("Verify OTP Error:", error);
        res.status(500).json({ error: "Phone verification failed" });
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

exports.resendEmailCode = async (req, res) => {
    try {
        const userId = req.user.userId;
        const user = await User.findById(userId);
        
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        if (!user.email) {
            return res.status(400).json({ error: "No email associated with this account" });
        }

        if (user.emailVerified) {
            return res.status(400).json({ error: "Email is already verified" });
        }

        // Generate new verification code
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        const verificationCodeExpires = new Date(Date.now() + 5 * 60000); // 5 minutes

        user.verificationCode = verificationCode;
        user.verificationCodeExpires = verificationCodeExpires;
        await user.save();

        // Send new verification code
        await sendVerificationEmail(user.email, verificationCode);

        return res.status(200).json({ 
            message: "New verification code sent successfully",
            expiresIn: 300 // 5 minutes in seconds
        });
    } catch (error) {
        console.error("Resend Email Code Error:", error);
        res.status(500).json({ error: "Failed to resend verification code" });
    }
};

exports.resendOTP = async (req, res) => {
    try {
        const userId = req.user.userId;
        const user = await User.findById(userId);
        
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        if (!user.phone) {
            return res.status(400).json({ error: "No phone number associated with this account" });
        }

        if (user.phoneVerified) {
            return res.status(400).json({ error: "Phone number is already verified" });
        }

        // Generate new OTP
        const verificationOTP = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpires = new Date(Date.now() + 5 * 60000); // 5 minutes

        user.verificationOTP = verificationOTP;
        user.otpExpires = otpExpires;
        await user.save();

        // Send new OTP
        await sendVerificationSMS(user.phone, verificationOTP);

        return res.status(200).json({ 
            message: "New OTP sent successfully",
            expiresIn: 300 // 5 minutes in seconds
        });
    } catch (error) {
        console.error("Resend OTP Error:", error);
        res.status(500).json({ error: "Failed to resend OTP" });
    }
};