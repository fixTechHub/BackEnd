const authService = require('../services/authService');
const { loginSchema } = require('../validations/authValidation');
const { generateCookie } = require('../utils/generateCode');
const { createUserSchema } = require('../validations/userValidation');

exports.googleAuthController = async (req, res) => {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ error: "Missing credential token" });

    try {
        const { user, token } = await authService.googleAuth(credential);
        generateCookie(token, res);
        return res.status(200).json({ user });
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

exports.getMe = async (req, res) => {
    try {
        return res.status(200).json({ user: req.user });
    } catch (error) {
        console.error("GetMe Error:", error);
        res.status(500).json({ error: 'Failed to fetch user' });
    }
};

exports.login = async (req, res) => {
    const { error } = loginSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    try {
        const { email, password } = req.body;
        const { user, token } = await authService.normalLogin(email, password);
        generateCookie(token, res);
        return res.status(200).json({ user });
    } catch (error) {
        console.error("Login Error:", error);
        return res.status(error.statusCode || 401).json({ error: error.message });
    }
};

exports.register = async (req, res) => {
    const { userData } = req.body;
    const { error } = createUserSchema.validate(userData);
    if (error) return res.status(400).json({ error: error.details[0].message });

    try {
        await authService.register(userData);
        return res.status(201).json({ message: "Registration successful. Please check your email to verify your account." });
    } catch (error) {
        console.error("Register Error:", error);
        res.status(error.statusCode || 500).json({ error: error.message });
    }
};

exports.verifyEmail = async (req, res) => {
    try {
        const { token } = req.query;
        const redirectUrl = await authService.verifyEmail(token);
        return res.redirect(redirectUrl);
    } catch (error) {
        console.error("Verify Email Error:", error);
        res.status(error.statusCode || 500).json({ error: error.message });
    }
};
