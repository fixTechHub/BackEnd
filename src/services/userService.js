const User = require('../models/User');
const Role = require('../models/Role');
const {generateUserCode} = require('../utils/generateCode')
exports.findUserByEmail = async (email) => {
    return await User.findOne({ email }).select('-passwordHash');
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
exports.populateUserRole = async (user) => {
    return await user.populate('role,-passwordHash')
}
exports.findUserById = async (userId) => {
    return await User.findById(userId)
}
exports.createNewUser = async (userData) => {
    const {
        fullName,
        email,
        googleId = null, // default null
        status = 'INACTIVE',
        role = null, //default
        password = null // for google Login
    } = userData;

    const userRole = await this.findRoleByName(role)
    
    const userCode = await generateUserCode(role);

    const newUser = new User({
        userCode,
        fullName,
        email,
        googleId: googleId || null,
        password: password || null,
        status,
        role: userRole ? userRole._id : null,
    });

    return await newUser.save();
};