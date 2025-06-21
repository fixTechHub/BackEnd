const User = require('../models/User');
const userService = require('../services/userService');
const s3Service = require('../services/s3Service');
const bcrypt = require('bcrypt');

exports.getProfile = async (req, res) => {
    try {
        const userId = req.user.userId;
        console.log('=== getProfile Debug ===');
        console.log('req.user:', req.user);
        console.log('req.user.role:', req.user?.role);
        console.log('userId:', userId);
        
        const user = await User.findById(userId)
            .select('-passwordHash -verificationCode -verificationCodeExpires -verificationOTP -otpExpires');

        if (!user) {
            return res.status(404).json({ message: 'Không tìm thấy thông tin người dùng' });
        }

        // Thêm role từ token vào user object để tương thích với frontend
        const roleFromToken = req.user?.role || 'CUSTOMER';
        console.log('roleFromToken:', roleFromToken);
        user.role = { name: roleFromToken };

        console.log('Final user object:', user);

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

        // Không cần populate role nữa, thêm role từ token
        const updatedUser = await User.findById(userId)
            .select('-passwordHash -verificationCode -verificationCodeExpires -verificationOTP -otpExpires');

        // Thêm role từ token vào user object
        updatedUser.role = { name: req.user?.role || 'CUSTOMER' };

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

        // Không cần populate role nữa, thêm role từ token
        const updatedUser = await User.findById(userId)
            .select('-passwordHash -verificationCode -verificationCodeExpires -verificationOTP -otpExpires');

        // Thêm role từ token vào user object
        updatedUser.role = { name: req.user?.role || 'CUSTOMER' };

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
