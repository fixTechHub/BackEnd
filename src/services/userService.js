const User = require('../models/User');
const Role = require('../models/Role');
const {generateUserCode} = require('../utils/generateCode')
exports.findUserByEmail = async (email) => {
    return await User.findOne({ email }).populate('role')
};

exports.updateUserGoogleId = async (user, googleId) => {
    user.googleId = googleId;
    return await user.save();
};
exports.findRoleByName = async (role) => {
    return await Role.findOne({ name: role });
      
}
exports.findRoleById = async (roleId) => {
    return await Role.findById({roleId})
      
}

exports.findUserById = async (userId) => {
    return await User.findById(userId)
}
exports.createNewUser = async (userData) => {
    const {
        fullName,
        email,
        googleId = null, // default null
        status = 'PENDING',
        role = null, //default
        password = null, // for google Login
        emailVerified = false,
    } = userData;   

    const userRole = await this.findRoleByName(role)
    
    const userCode = await generateUserCode();

    const newUser = new User({
        userCode,
        fullName,
        email,
        googleId: googleId || undefined,
        passwordHash: password || undefined,
        status,
        emailVerified: emailVerified,
        role: userRole ? userRole._id : undefined,
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