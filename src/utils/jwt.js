const jwt = require('jsonwebtoken');

/**
 * Generates a JWT token for a given user.
 * @param {Object} user - The user object containing _id, email, and role.
 * @param {string} expiresIn - Token expiration time (default: '2h').
 * @returns {string} - Signed JWT token.
 */
const generateToken = (user, expiresIn = '2h') => {
    return jwt.sign(
        { userId: user._id, email: user.email, role: user.role,fullName: user.fullName},
        process.env.JWT_SECRET,
        { expiresIn }
    );
};
const decodeToken = (token) => {
    return jwt.verify(token, process.env.JWT_SECRET);
}
module.exports = {generateToken, decodeToken};
