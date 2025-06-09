const { OAuth2Client } = require("google-auth-library");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const { generateToken, decodeToken } = require('../utils/jwt');
const HttpError = require('../utils/error');
const userService = require('./userService');
const technicianService = require('./technicianService');
const { sendVerificationEmail, sendResetPassword } = require('../utils/mail');
const { token } = require("morgan");
const { hashingPassword,comparePassword } = require('../utils/password');
const { passwordSchema } = require("../validations/authValidation");
const oAuth2Client = new OAuth2Client(process.env.CLIENT_ID);

// Google Auth
exports.googleAuth = async (credential) => {
    if (!credential) throw new HttpError(400, "Missing credential token");

    try {
        const ticket = await oAuth2Client.verifyIdToken({
            idToken: credential,
            audience: process.env.CLIENT_ID,
        });

        const payload = ticket.getPayload();
        const googleId = payload.sub;

        let user = await userService.findUserByEmail(payload.email);

        if (user) {
            if (!user.googleId) {
                user = await userService.updateUserGoogleId(user, googleId);
            }
        } else {
            user = await userService.createNewUser({
                fullName: payload.name,
                email: payload.email,
                googleId,
                status: 'ACTIVE',
                emailVerified: true
            });
        }
        
        let technician = null
        if(user.role && user.role.name==='Technician'){
            technician = await technicianService.findTechnicianByUserId(user._id)
        }
        const token = generateToken(user);

        return { user, token,technician };
    } catch (error) {
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
exports.register = async (userData, technicianData = null) => {
    try {
        const hashedPassword = await hashingPassword(userData.password)
        userData.password = hashedPassword
        const user = await userService.createNewUser(userData);

        if (userData.role === "Technician" && technicianData) {
            await technicianService.createNewTechnician(user._id, technicianData);
        }

        const verificationToken = generateToken(user);
        await sendVerificationEmail(user.email, verificationToken);
    } catch (error) {
        throw new HttpError(500, `Registration failed: ${error.message}`);
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