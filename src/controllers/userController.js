const User = require('../models/User');
const userService = require('../services/userService');
const s3Service = require('../services/s3Service');
const bcrypt = require('bcrypt');

exports.getProfile = async (req, res) => {
    try {
        const userId = req.user.userId;
        const user = await User.findById(userId)
            .populate('role')
            .select('-passwordHash -verificationCode -verificationCodeExpires -verificationOTP -otpExpires');

        if (!user) {
            return res.status(404).json({ message: 'Không tìm thấy thông tin người dùng' });
        }

        res.status(200).json({
            success: true,
            data: user
        });
    } catch (error) {
        console.error('Error in getProfile:', error);
        res.status(500).json({ 
            success: false,
            message: 'Lỗi khi lấy thông tin profile',
            error: error.message 
        });
    }
};

exports.updateProfile = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { fullName, phone, address } = req.body;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'Không tìm thấy thông tin người dùng' });
        }

        // Update user information
        if (fullName) user.fullName = fullName;
        if (phone) user.phone = phone;
        if (address) user.address = address;

        await user.save();

        // Get updated user with populated role
        const updatedUser = await User.findById(userId)
            .populate('role')
            .select('-passwordHash -verificationCode -verificationCodeExpires -verificationOTP -otpExpires');

        res.status(200).json({
            success: true,
            data: updatedUser
        });
    } catch (error) {
        console.error('Error in updateProfile:', error);
        res.status(500).json({ 
            success: false,
            message: 'Lỗi khi cập nhật thông tin profile',
            error: error.message 
        });
    }
};

exports.updateAvatar = async (req, res) => {
    try {
        const userId = req.user.userId;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ message: 'Không tìm thấy file ảnh' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'Không tìm thấy thông tin người dùng' });
        }

        // Upload to S3
        const avatarUrl = await s3Service.uploadFileToS3(
            file.buffer,
            file.originalname,
            file.mimetype,
            'avatars'
        );

        // Update user avatar
        user.avatar = avatarUrl;
        await user.save();

        // Get updated user with populated role
        const updatedUser = await User.findById(userId)
            .populate('role')
            .select('-passwordHash -verificationCode -verificationCodeExpires -verificationOTP -otpExpires');

        res.status(200).json({
            success: true,
            data: updatedUser
        });
    } catch (error) {
        console.error('Error in updateAvatar:', error);
        res.status(500).json({ 
            success: false,
            message: 'Lỗi khi cập nhật ảnh đại diện',
            error: error.message 
        });
    }
};

exports.changePassword = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { currentPassword, newPassword } = req.body;

        // Validate input
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ 
                success: false,
                message: 'Vui lòng nhập đầy đủ thông tin' 
            });
        }

        // Find user
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ 
                success: false,
                message: 'Không tìm thấy thông tin người dùng' 
            });
        }

        // Verify current password
        const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!isPasswordValid) {
            return res.status(400).json({ 
                success: false,
                message: 'Mật khẩu hiện tại không đúng' 
            });
        }

        // Hash new password
        const newPasswordHash = await bcrypt.hash(newPassword, 10);

        // Update password
        user.passwordHash = newPasswordHash;
        await user.save();

        res.status(200).json({
            success: true,
            message: 'Đổi mật khẩu thành công'
        });
    } catch (error) {
        console.error('Error in changePassword:', error);
        res.status(500).json({ 
            success: false,
            message: 'Lỗi khi đổi mật khẩu',
            error: error.message 
        });
    }
};
