const jwt = require('jsonwebtoken');

/**
 * Generates a JWT token for a given user.
 * @param {Object} user - The user object containing _id, email, and role.
 * @param {string} expiresIn - Token expiration time (default: '15m').
 * @returns {string} - Signed JWT token.
 */
const generateToken = (user, expiresIn = '15m') => {
    // Lấy tên role từ user object
    const roleName = user.role && user.role.name ? user.role.name : user.role;
    
    return jwt.sign(
        { 
            userId: user._id, 
            email: user.email, 
            role: roleName,
            fullName: user.fullName
        },
        process.env.JWT_SECRET,
        { expiresIn }
    );
};
const decodeToken = (token) => {
    return jwt.verify(token, process.env.JWT_SECRET);
}

/**
 * Generates a long-lived refresh token (default 7 days).
 * Only stores userId to keep payload small.
 * @param {Object} user – Mongoose user document (must have _id).
 * @param {string} expiresIn – Expiration string, default '7d'.
 */
const generateRefreshToken = (user, expiresIn = '7d') => {
    return jwt.sign(
        { userId: user._id },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn }
    );
};

module.exports = {generateToken, decodeToken, generateRefreshToken};
