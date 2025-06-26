const User = require('../models/User');

exports.generateCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

exports.generateCookie = async (token, res) => {
    res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // Only secure in production
        sameSite: "Strict",
        maxAge: 24 * 60 * 60 * 1000,
    });
};

exports.generateUserCode = async () => {
    const prefix = 'U';
    
    // Generate 10 random digits
    let randomDigits = '';
    for (let i = 0; i < 10; i++) {
        randomDigits += Math.floor(Math.random() * 10);
    }

    const userCode = `${prefix}${randomDigits}`;

    // Optional: ensure uniqueness in DB
    const existingUser = await User.findOne({ userCode });
    if (existingUser) {
        // Recursively generate a new one if already taken
        return exports.generateUserCode();
    }

    return userCode;
};

