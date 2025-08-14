const authService = require('../services/authService');
const userService = require('../services/userService');
const technicianService = require('../services/technicianService');

const { loginSchema,passwordSchema } = require('../validations/authValidation');
const { generateUserCode, generateCookie, generateCode } = require('../utils/generateCode');
const { createUserSchema } = require('../validations/userValidation');
const { createTechnicianSchema } = require('../validations/technicianValidation');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { generateToken, generateRefreshToken } = require('../utils/jwt');
const { sendVerificationEmail } = require('../utils/mail');
const { sendVerificationSMS } = require('../utils/sms');
const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
const Role = require('../models/Role');
const axios = require('axios');
const Technician = require('../models/Technician');
const mongoose = require('mongoose');

const oAuth2Client = new OAuth2Client(process.env.CLIENT_ID);

// New controller for the final, staged registration
exports.finalizeRegistration = async (req, res) => {
    try {
        const { fullName, emailOrPhone, password, role } = req.body;

        // Validate required fields
        if (!fullName || !emailOrPhone || !password || !role) {
            return res.status(400).json({ error: "Tất cả các trường là bắt buộc." });
        }

        // Determine if emailOrPhone is email or phone
        const isEmail = emailOrPhone.includes('@');

        // Check if user already exists
        const existingUser = isEmail
            ? await User.findOne({ email: emailOrPhone.toLowerCase() })
            : await User.findOne({ phone: emailOrPhone });

        if (existingUser) {
            return res.status(400).json({
                error: isEmail ? "Email đã được sử dụng." : "Số điện thoại đã được sử dụng."
            });
        }

        // Validate role
        const roleDoc = await Role.findOne({ name: role });
        if (!roleDoc) {
            return res.status(400).json({ error: "Vai trò không hợp lệ." });
        }

        // --- Create User ---
        const hashedPassword = await bcrypt.hash(password, 10);
        const verificationCode = isEmail ? generateCode() : undefined;
        const verificationCodeExpires = isEmail ? new Date(Date.now() + 5 * 60000) : undefined; // 5 minutes
        const userCode = await generateUserCode(); // Generate unique user code

        const newUser = new User({
            userCode, // Add the generated user code
            fullName,
            email: isEmail ? emailOrPhone : undefined,
            phone: !isEmail ? emailOrPhone : undefined,
            passwordHash: hashedPassword,
            role: roleDoc._id,
            emailVerified: false,
            phoneVerified: false,
            status: 'PENDING',
            verificationCode,
            verificationCodeExpires
        });

        await newUser.save();

        // Populate role for the response
        await newUser.populate('role');

        // --- Send Verification Email ---
        if (isEmail) {
            try {
                await sendVerificationEmail(emailOrPhone, verificationCode);
            } catch (emailError) {
                console.error("Failed to send verification email:", emailError);
                // Decide if you want to fail the whole registration or just log the error
                // For now, we'll just log it and continue
            }
        }

        // --- Tạo token đăng nhập tạm thời để người dùng có thể xác thực ngay ---
        const token = generateToken(newUser);
        const refreshToken = generateRefreshToken(newUser);
        generateCookie(token, res, refreshToken);

        // --- Return Response ---
        // Không tự động đăng nhập sau khi đăng ký.
        // Nếu cần xác thực (ví dụ email), frontend sẽ xử lý bằng cách yêu cầu người dùng đăng nhập.
        res.status(201).json({
            message: "Đăng ký thành công!",
            user: newUser,
            requiresVerification: !isEmail ? false : true, // Nếu là email thì sẽ cần xác thực
            registrationToken: verificationCode // Trả về mã (hoặc token) để frontend sử dụng nếu cần
        });

    } catch (error) {
        console.error("Finalize Registration Error:", error);
        res.status(500).json({ error: "Đăng ký thất bại: lỗi không xác định" });
    }
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

            const { user, token, technician, wasReactivated } = await authService.googleAuth(access_token);

            // Generate refresh token & set cookies
            const refreshTokenController = generateRefreshToken(user);
            generateCookie(token, res, refreshTokenController);

            // Populate role before sending to client
            await user.populate('role');
            console.log(user);
            
            // Return user data without token in body
            return res.status(200).json({ user, technician, wasReactivated });
        } catch (error) {
            return res.status(400).json({ error: "Invalid Google access token" });
        }
    } catch (error) {
        return res.status(error.statusCode || 500).json({ error: error.message });
    }
};

exports.logout = async (req, res) => {
    try {
        // Clear auth cookies
        res.clearCookie('token', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
            domain: process.env.COOKIE_DOMAIN || undefined
        });
        res.clearCookie('refreshToken', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
            domain: process.env.COOKIE_DOMAIN || undefined
        });

        return res.status(200).json({ message: "Logged out successfully" });
    } catch (error) {
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

        // Generate refresh token & set cookies
        const refreshToken = generateRefreshToken(result.user);
        generateCookie(result.token, res, refreshToken);
        await result.user.populate('role');

        // Kiểm tra trạng thái xác thực
        const verificationStatus = await checkVerificationStatus(result.user);

        return res.status(200).json({
            message: "Đăng nhập thành công",
            user: result.user,
            technician: result.technician,
            verificationStatus,
            wasReactivated: result.wasReactivated
        });
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: error.message });
    }
};

exports.googleLogin = async (req, res) => {
    try {
        const { access_token } = req.body;
        if (!access_token) {
            return res.status(400).json({ error: "Access token is required" });
        }

        const result = await authService.googleAuth(access_token);

        // Generate refresh token & set cookies
        const refreshToken = generateRefreshToken(result.user);
        generateCookie(result.token, res, refreshToken);
        await result.user.populate('role');

        // console.log('--- GOOLE AUTHENTICATION ---', result.user);

        // Kiểm tra trạng thái xác thực
        const verificationStatus = await checkVerificationStatus(result.user);

        return res.status(200).json({
            message: "Đăng nhập thành công",
            user: result.user,
            technician: result.technician,
            verificationStatus,
            wasReactivated: result.wasReactivated
        });
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: error.message });
    }
};

// Helper function to check verification status
const checkVerificationStatus = async (user) => {
    // Kiểm tra xác thực email trước tiên
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

    // Sau khi đã xác thực email/phone, kiểm tra role
    if (!user.role) {
        return {
            step: 'CHOOSE_ROLE',
            redirectTo: '/choose-role',
            message: 'Vui lòng chọn vai trò của bạn'
        };
    }

    // Kiểm tra role PENDING - có thể là ObjectId hoặc object đã populate
    const pendingRole = await Role.findOne({ name: 'PENDING' });

    const isPendingRole = user.role?.name === 'PENDING' ||
        (user.role && pendingRole && user.role._id && user.role._id.toString() === pendingRole._id.toString()) ||
        (user.role && pendingRole && user.role.toString() === pendingRole._id.toString());

    if (isPendingRole) {
        return {
            step: 'CHOOSE_ROLE',
            redirectTo: '/choose-role',
            message: 'Vui lòng chọn vai trò của bạn'
        };
    }

    // Kiểm tra technician profile
    if (user.role?.name === 'TECHNICIAN') {
        try {
            const technician = await technicianService.findTechnicianByUserId(user._id);

            if (!technician) {
                return {
                    step: 'COMPLETE_PROFILE',
                    redirectTo: '/technician/complete-profile',
                    message: 'Vui lòng hoàn thành hồ sơ kỹ thuật viên'
                };
            }

            // Kiểm tra các trường bắt buộc
            const hasSpecialties = Array.isArray(technician.specialtiesCategories) && technician.specialtiesCategories.length > 0;
            // Certificates are optional; remove from mandatory checks.
            const hasCertificates = true;

            const hasIdentification = technician.identification && technician.identification.trim() !== '';
            const hasFrontIdImage = technician.frontIdImage && technician.frontIdImage.trim() !== '';
            const hasBackIdImage = technician.backIdImage && technician.backIdImage.trim() !== '';

            if (!hasSpecialties || !hasIdentification || !hasFrontIdImage || !hasBackIdImage) {
                return {
                    step: 'COMPLETE_PROFILE',
                    redirectTo: '/technician/complete-profile',
                    message: 'Vui lòng hoàn thành hồ sơ kỹ thuật viên'
                };
            }
        } catch (error) {
            console.error('Error checking technician profile:', error);
            return {
                step: 'COMPLETE_PROFILE',
                redirectTo: '/technician/complete-profile',
                message: 'Vui lòng hoàn thành hồ sơ kỹ thuật viên'
            };
        }
    }

    // User đã hoàn thành tất cả bước xác thực
    return {
        step: 'COMPLETED',
        redirectTo: null, // Không có redirectTo để frontend tự xử lý
        message: 'Xác thực hoàn tất'
    };
};

/*
// OLD REGISTRATION FLOW - Temporarily disabled to prevent conflicts
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

        // Populate role before generating token
        await user.populate('role');

        // Lấy lại user với role đã populate
        const populatedUser = await User.findById(user._id).populate('role');

        // Generate token
        const token = generateToken(populatedUser);
        setAuthCookie(res, token);

        // Send verification code
        if (isEmail) {
            await sendVerificationEmail(emailOrPhone, verificationCode);
        } else {
            await sendVerificationSMS(emailOrPhone, verificationCode);
        }

        // Kiểm tra trạng thái xác thực sau khi tạo user
        const verificationStatus = await checkVerificationStatus(populatedUser);

            verificationType: isEmail ? 'email' : 'phone',
            verificationStatus: verificationStatus
        });
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: error.message });
    }
};

exports.completeRegistration = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { role, specialties, experienceYears, identification } = req.body;
        const userId = req.user.userId;


        // Find and update user
        let user = await User.findById(userId).populate('role');
        if (!user) {
            return res.status(404).json({ message: "Không tìm thấy người dùng" });
        }
        // Kiểm tra nếu vai trò hiện tại không phải PENDING thì không được phép đổi
        if (user.role && user.role.name !== 'PENDING') {
            return res.status(400).json({ message: "Vai trò đã được chọn" });
        }

        const roleDoc = await Role.findOne({ name: role }).session(session);
        if (!roleDoc) {
            return res.status(400).json({ message: "Vai trò không hợp lệ" });
        }

        user.role = roleDoc._id;
        
        // Nếu role là CUSTOMER và đã xác thực email, cập nhật status thành ACTIVE
        if (role === 'CUSTOMER' && user.emailVerified) {
            user.status = 'ACTIVE';
        }

        await user.save({ session });
        await session.commitTransaction();
        session.endSession();

        const token = generateToken(user);
        setAuthCookie(res, token);
        
        await user.save();
        await user.populate('role');

        // Lấy lại user với role đã populate
        const populatedUser = await User.findById(userId).populate('role');

        // Generate new token with updated role
        const newToken = generateToken(populatedUser);
        setAuthCookie(res, newToken);

        // Kiểm tra trạng thái xác thực sau khi cập nhật role
        const verificationStatus = await checkVerificationStatus(populatedUser);

        return res.status(200).json({ 
            message: 'Cập nhật role thành công',
            user: populatedUser,
            verificationStatus: verificationStatus
        });
    } catch (error) {
        return res.status(500).json({ message: 'Lỗi server' });
    }
};
*/

exports.verifyEmail = async (req, res) => {
    try {
        const { code } = req.body;
        const userId = req.user.userId;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        if (user.verificationCode !== code) {
            return res.status(400).json({ error: "Invalid verification code" });
        }

        if (new Date() > user.verificationCodeExpires) {
            return res.status(400).json({ error: "Verification code has expired" });
        }

        user.emailVerified = true;

        // Lấy thông tin role để đảm bảo có name
        await user.populate('role');

        // Nếu role là CUSTOMER, sau khi xác thực email thì kích hoạt tài khoản
        if (user.role && user.role.name === 'CUSTOMER') {
            user.status = 'ACTIVE';
        }

        user.verificationCode = undefined;
        user.verificationCodeExpires = undefined;
        await user.save();

        // Populate role for verification status check
        await user.populate('role');

        // Generate new token
        const newToken = generateToken(user);
        // Keep existing refreshToken cookie if any
        const existingRefresh = req.cookies.refreshToken;
        generateCookie(newToken, res, existingRefresh);

        // Check verification status
        const verificationStatus = await checkVerificationStatus(user);

        return res.status(200).json({
            message: "Email verified successfully",
            user: user,
            verificationStatus: verificationStatus
        });

    } catch (error) {
        console.error('Email verification error:', error);
        return res.status(500).json({ error: "Email verification failed" });
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
        res.status(error.statusCode || 500).json({
            error: error.message || "Có lỗi xảy ra khi đặt lại mật khẩu"
        });
    }
};

exports.verifyOTP = async (req, res) => {
    try {
        const { otp } = req.body;
        const userId = req.user.userId;

        const user = await User.findById(userId);
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

        await user.save();

        // Lấy lại user với role đã populate
        const populatedUser = await User.findById(userId).populate('role');

        // Nếu user có role là CUSTOMER và đã xác thực số điện thoại, cập nhật status thành ACTIVE
        if (populatedUser.role && populatedUser.role.name === 'CUSTOMER') {
            populatedUser.status = 'ACTIVE';
            await populatedUser.save();
        }

        // Generate new token
        const newToken = generateToken(populatedUser);
        const existingRefresh = req.cookies.refreshToken;
        generateCookie(newToken, res, existingRefresh);

        // Kiểm tra trạng thái xác thực sau khi xác thực OTP
        const verificationStatus = await checkVerificationStatus(populatedUser);

        return res.status(200).json({
            message: "Phone number verified successfully",
            user: populatedUser,
            verificationStatus: verificationStatus
        });
    } catch (error) {
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

        // Populate role trước khi gửi về
        await user.populate('role');

        return res.status(200).json({
            message: "Role updated successfully",
            user: user
        });
    } catch (error) {
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
        res.status(500).json({ error: "Lỗi kiểm tra tồn tại" });
    }
};

exports.refreshToken = async (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken;

        if (!refreshToken) {
            return res.status(401).json({ message: 'Không tìm thấy refresh token' });
        }

        // Verify refresh token (fallback to JWT_SECRET if refresh secret undefined)
        const secret = process.env.JWT_SECRET;
        const decoded = jwt.verify(refreshToken, secret);

        // Tìm user
        const user = await User.findById(decoded.userId).populate('role');
        if (!user) {
            return res.status(401).json({ message: 'Người dùng không tồn tại' });
        }

        // Tạo access token mới (bao gồm role và các thông tin cần thiết)
        const accessToken = generateToken(user);

        // Set cookie
        res.cookie('token', accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
            domain: process.env.COOKIE_DOMAIN || undefined,
            maxAge: 15 * 60 * 1000 // 15 phút
        });

        return res.json({ message: 'Refresh token thành công' });
    } catch (error) {
        return res.status(401).json({ message: 'Refresh token không hợp lệ' });
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
        const verificationCode = generateCode();
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
        const verificationOTP = generateCode();
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
        res.status(500).json({ error: "Failed to resend OTP" });
    }
};

// === Verify current password ===
exports.verifyPassword = async (req, res) => {
  try {
    const { currentPassword } = req.body;
    if (!currentPassword) {
      return res.status(400).json({ message: 'Thiếu mật khẩu' });
    }

    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Không xác thực' });
    }

    const user = await User.findById(userId).select('+passwordHash');
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    return res.status(200).json({ valid: isMatch });
  } catch (error) {
    console.error('verifyPassword error:', error);
    return res.status(500).json({ message: 'Lỗi máy chủ' });
  }
};