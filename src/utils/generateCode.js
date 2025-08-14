const User = require('../models/User');
const Contract = require('../models/Contract');
const Receipt = require('../models/Receipt');

exports.generateCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Set auth cookies (access & optionally refresh).
 * @param {string} accessToken Access JWT
 * @param {object} res Express response
 * @param {string} [refreshToken] Optional refresh JWT
 */
exports.generateCookie = (accessToken, res, refreshToken) => {
    // Access token – 15 phút
    res.cookie("token", accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
        // domain: process.env.COOKIE_DOMAIN || undefined,
        maxAge: 15 * 60 * 1000,
    });

    // Refresh token – 7 ngày
    if (refreshToken) {
        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
            // domain: process.env.COOKIE_DOMAIN || undefined,
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });
    }
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

exports.generateContractCode = async () => {
    const prefix = 'CT';
    let contractCode;
    let existingContract;
    do {
        let randomDigits = '';
        for (let i = 0; i < 10; i++) {
            randomDigits += Math.floor(Math.random() * 10);
        }
        contractCode = `${prefix}${randomDigits}`;
        existingContract = await Contract.findOne({ contractCode });
    } while (existingContract);
    return contractCode;
};

exports.generateReceiptCode = async () => {
    const prefix = 'REC';
    let receiptCode;
    let existingReceipt;
    do {
        let randomDigits = '';
        for (let i = 0; i < 10; i++) {
            randomDigits += Math.floor(Math.random() * 10);
        }
        receiptCode = `${prefix}${randomDigits}`;
        existingReceipt = await Receipt.findOne({ receiptCode });
    } while (existingReceipt);
    return receiptCode;
};

exports.generateOrderCode = async () => {
    const timestamp = Date.now(); // milliseconds since epoch
    const randomPart = Math.floor(Math.random() * 1000000); // 6-digit random number
    const orderCode = (timestamp * 1000000 + randomPart) % Number.MAX_SAFE_INTEGER;
    return orderCode;
}
