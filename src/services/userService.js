const User = require('../models/User');
const Role = require('../models/Role');
const {generateUserCode} = require('../utils/generateCode')
const mongoose = require('mongoose');

// Export generateUserCode function
exports.generateUserCode = generateUserCode;

exports.findUserByEmail = async (email) => {
    return await User.findOne({ email }).populate('role')
};

exports.findUserByPhone = async (phone) => {
    return await User.findOne({ phone }).populate('role')
};

exports.updateUserGoogleId = async (user, googleId) => {
    user.googleId = googleId;
    return await user.save();
};

exports.findRoleByName = async (role) => {
    try {
        // Nếu role là ObjectId, tìm trực tiếp
        if (mongoose.Types.ObjectId.isValid(role)) {
            const roleDoc = await Role.findById(role);
            if (!roleDoc) {
                throw new Error(`Role with ID ${role} not found`);
            }
            return roleDoc;
        }
        
        // Nếu role là string, tìm theo tên
        const roleDoc = await Role.findOne({ name: role.toUpperCase() });
        if (!roleDoc) {
            throw new Error(`Role ${role} not found`);
        }
        return roleDoc;
    } catch (error) {
        console.error('Error in findRoleByName:', error);
        throw error;
    }
};

exports.findRoleById = async (roleId) => {
    return await Role.findById({roleId})
};

exports.findUserById = async (userId) => {
    return await User.findById(userId).populate('role') 
};

exports.createNewUser = async (userData) => {
    const {
        fullName,
        emailOrPhone,
        googleId = null,
        status = 'PENDING',
        password = null,
        emailVerified = false,
        role = null,
        verificationCode = null,
        verificationCodeExpires = null
    } = userData;   
    
    const userCode = await generateUserCode();

    // Kiểm tra xem emailOrPhone là email hay số điện thoại
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailOrPhone);

    const newUser = new User({
        userCode,
        fullName,
        email: isEmail ? emailOrPhone : undefined,
        phone: !isEmail ? emailOrPhone : undefined,
        googleId: googleId || undefined,
        passwordHash: password || undefined,
        status,
        emailVerified: emailVerified,
        role: role, // Sử dụng role được truyền vào
        verificationCode,
        verificationCodeExpires
    });

    return await newUser.save();
};

exports.getUserById = async (id) => {
    try {
        const user = await User.findById(id).select('-password'); // omit password
        return user;
    } catch (error) {
        console.error('Error in getUserById:', error);
        throw error;
    }
};