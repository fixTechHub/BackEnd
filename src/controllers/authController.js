const authService = require('../services/authService');
const userService = require('../services/userService');

const { loginSchema,passwordSchema } = require('../validations/authValidation');
const { generateCookie } = require('../utils/generateCode');
const { createUserSchema } = require('../validations/userValidation');
const { createTechnicianSchema } = require('../validations/technicianValidation');
exports.getAuthenticatedUser = async (req, res) => {
    try {
        const userId = req.user.userId; // You stored this in `req.user` via middleware
        console.log('id',userId);
        
        const user = await userService.getUserById(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        return res.status(200).json(user);
    } catch (error) {
        console.error('Error fetching authenticated user:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
exports.googleAuthController = async (req, res) => {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ error: "Missing credential token" });

    try {
        const { user, token,technician } = await authService.googleAuth(credential);
        generateCookie(token, res);
        return res.status(200).json({ user,technician });
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
    const { error } = loginSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    try {
        const { email, password } = req.body;
        const { user, token,technician } = await authService.normalLogin(email, password);
        generateCookie(token, res);
        return res.status(200).json({ user,technician });
    } catch (error) {
        console.error("Login Error:", error);
        return res.status(error.statusCode || 401).json({ error: error.message });
    }
};

exports.register = async (req, res) => {
    const { userData, technicianData } = req.body;
    console.log(req.body);
    
    // Validate userData
    const { error: userError } = createUserSchema.validate(userData);
    if (userError) return res.status(400).json({ error: userError.details[0].message });
    
    // If role is TECHNICIAN, validate technicianData
   
    
    if (userData.role === 'TECHNICIAN') {
        
        const { error: technicianError } = createTechnicianSchema.validate(technicianData);
        if (technicianError) return res.status(400).json({ error: technicianError.details[0].message });
    }

    try {
        await authService.register(userData, technicianData);
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