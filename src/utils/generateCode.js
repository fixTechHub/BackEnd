const User = require('../models/User');
exports.generateCookie = async (token, res) => {
    res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // Only secure in production
        sameSite: "Strict",
        maxAge: 24 * 60 * 60 * 1000,
    });
};
exports.generateUserCode = async (roleName) => {
    let prefix;
    if (roleName === 'CUSTOMER') {
        prefix = 'C';
    } else if (roleName === 'TECHNICIAN') {
        prefix = 'T';
    } else if (roleName === 'ADMIN'){
        prefix = 'A'
    }

    const lastUser = await User.findOne({ userCode: new RegExp(`^${prefix}\\d{3}$`) })
        .sort({ userCode: -1 })
        .collation({ locale: "en", numericOrdering: true });

    let nextNumber = 1;
    if (lastUser) {
        const currentNumber = parseInt(lastUser.userCode.substring(1), 10);
        nextNumber = currentNumber + 1;
    }

    const userCode = `${prefix}${String(nextNumber).padStart(3, '0')}`;
    return userCode;
};
