const { OAuth2Client } = require("google-auth-library");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const { generateToken, decodeToken } = require('../utils/jwt');
const HttpError = require('../utils/error');
const userService = require('./userService');
const technicianService = require('./technicianService');
const { sendVerificationEmail, sendResetPassword } = require('../utils/mail');
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
        const googleId = payload.sub;

        let user = await userService.findUserByEmail(payload.email);

        if (user) {
            if (!user.googleId) {
                user = await userService.updateUserGoogleId(user, googleId);
            }
        } else {
            // Tìm role PENDING
            const pendingRole = await Role.findOne({ name: 'PENDING' });
            if (!pendingRole) {
                throw new Error('Pending role not found');
            }

            // Tạo user mới với role PENDING
            user = await userService.createNewUser({
                fullName: payload.name,
                email: payload.email,
                googleId,
                status: 'ACTIVE',
                emailVerified: true,
                role: pendingRole._id
            });
        }
        
        // Populate role trước khi trả về
        user = await User.findById(user._id).populate('role');
        
        let technician = null;
        if(user.role && user.role.name==='TECHNICIAN'){
            technician = await technicianService.findTechnicianByUserId(user._id);
        }
        const token = generateToken(user);
        
        return { user, token, technician };
    } catch (error) {
        console.error('Google auth error:', error);
        throw new HttpError(500, `Google authentication failed: ${error.message}`);
    }
};

// Normal login
exports.normalLogin = async (email, password) => {
    try {
        const user = await userService.findUserByEmail(email);
        if (!user) throw new HttpError(400, "Invalid email");

        if (user.emailVerified === false) {
            throw new HttpError(400, "Please verify your email before logging in.");
        }

        const isMatch = await comparePassword(password, user.passwordHash)

        if (!isMatch) throw new HttpError(400, "Invalid password");
        
        const token = generateToken(user);
        let technician = null
        if(user.role.name==='Technician'){
            technician = await technicianService.findTechnicianByUserId(user._id)
        }
        console.log(technician);
        
        return { user, token, technician };
    } catch (error) {
        console.log(error.message);

        throw new HttpError(error.statusCode || 500, error.message);
    }
};

// Register
exports.register = async (userData) => {
    try {
        const hashedPassword = await hashingPassword(userData.password);
        userData.password = hashedPassword;

        // Tạo user với role đã chọn
        const user = await userService.createNewUser({
            ...userData,
            role: userData.role // Role đã được tìm và xác thực ở controller
        });

        // Không gửi email/OTP ở đây nữa
        return user;
    } catch (error) {
        throw new HttpError(500, `Registration failed: ${error.message}`);
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

exports.forgotPassword = async (email) => {
    try {
        const user = await userService.findUserByEmail(email)

        if (!user) {
            throw new HttpError(404, "User not found");
        }

        // Generate a reset token (expires in 15 minutes)
        const resetToken = generateToken(user)
        const resetLink = `${process.env.FRONT_END_URL}/reset-password?token=${resetToken}`

        await sendResetPassword(user.email, resetLink);


    } catch (error) {
        console.error("Forgot Password Error:", error.message);
        throw new HttpError(500, `Failed to process request  ${error.message}`);

    }
}

exports.resetPassword = async (token, password) => {
    const decoded = await decodeToken(token)
    const user = await userService.findUserByEmail(decoded.email)
    
    if (!user) {
        throw new HttpError(400, "Invalid or expired token");
    }
    const hashedPassword = await hashingPassword(password)
    user.passwordHash = hashedPassword
    await user.save()

}

// Check Authentication
exports.checkAuth = async (userId) => {
    try {
        const user = await userService.getUserById(userId);
        if (!user) {
            throw new HttpError(404, "User not found");
        }

        let technician = null;
        if (user.role && user.role.name === 'Technician') {
            technician = await technicianService.findTechnicianByUserId(user._id);
        }

        return { user, technician };
    } catch (error) {
        throw new HttpError(error.statusCode || 500, error.message);
    }
};
