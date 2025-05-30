const { OAuth2Client } = require("google-auth-library");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const generateToken = require('../utils/jwt');
const HttpError = require('../utils/error');
const userService = require('./userService');
const technicianService = require('./technicianService');
const { sendVerificationEmail } = require('../utils/mail');

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
            });
        }

        const populatedUser = await userService.populateUserRole(user);
        const token = generateToken(user);

        return { user: populatedUser, token };
    } catch (error) {
        throw new HttpError(500, `Google authentication failed: ${error.message}`);
    }
};

// Normal login
exports.normalLogin = async (email, password) => {
    try {
        const user = await userService.findUserByEmail(email);
        if (!user) throw new HttpError(400, "Invalid email");

        if (user.status === "PENDING") {
            throw new HttpError(400, "Please verify your email before logging in.");
        }

        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) throw new HttpError(400, "Invalid password");

        const token = generateToken(user);
        return { user, token };
    } catch (error) {
        throw new HttpError(error.statusCode || 500, error.message);
    }
};

// Register
exports.register = async (userData) => {
    try {
        const user = await userService.createNewUser(userData);
        const populatedUser = await userService.populateUserRole(user);

        if (populatedUser.role.name === "TECHNICIAN") {
            await technicianService.createNewTechnician(populatedUser._id);
        }

        const verificationToken = generateToken(user);
        await sendVerificationEmail(populatedUser.email, verificationToken);
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
        if (user.status === "ACTIVE") throw new HttpError(400, "Email already verified");

        user.status = "ACTIVE";
        await user.save();

        return `${process.env.FRONT_END_URL}/login`;
    } catch (error) {
        throw new HttpError(500, `Email verification failed: ${error.message}`);
    }
};
