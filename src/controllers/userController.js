const User = require('../models/User');
const userService = require('../services/userService');
const s3Service = require('../services/s3Service');
const bcrypt = require('bcrypt');
const { sendVerificationEmail, sendPasswordResetEmail, sendDeactivateVerificationEmail, sendDeleteVerificationEmail } = require('../utils/mail');
const { sendVerificationSMS } = require('../utils/sms');
const Booking = require('../models/Booking');
const Receipt = require('../models/Receipt');
const Feedback = require('../models/Feedback');

exports.getProfile = async (req, res) => {
    try {
        const userId = req.user.userId;                

        const user = await User.findById(userId)
            .populate('role', 'name') // Populate the 'role' field and select only the 'name'
            .select('-passwordHash -verificationCode -verificationCodeExpires -verificationOTP -otpExpires');

        if (!user) {
            return res.status(404).json({ message: 'Không tìm thấy thông tin người dùng' });
        }

        // Kiểm tra nếu tài khoản đang trong trạng thái chờ xóa
        if (user.status === 'PENDING_DELETION') {
            // Khôi phục tài khoản
            const result = await userService.restoreAccount(userId);
            
            // Lấy lại thông tin user sau khi khôi phục
            const restoredUser = await User.findById(userId)
                .populate('role', 'name')
                .select('-passwordHash -verificationCode -verificationCodeExpires -verificationOTP -otpExpires');
            
            return res.status(200).json({
                success: true,
                data: restoredUser,
                message: 'Tài khoản đã được khôi phục thành công!'
            });
        }

        res.status(200).json({
            success: true,
            data: user
        });
    } catch (error) {
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

        const updatedUser = await User.findById(userId)
            .populate('role', 'name') // Populate the 'role' field
            .select('-passwordHash -verificationCode -verificationCodeExpires -verificationOTP -otpExpires');

        res.status(200).json({
            success: true,
            data: updatedUser
        });
    } catch (error) {
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

        const updatedUser = await User.findById(userId)
            .populate('role', 'name') // Populate the 'role' field
            .select('-passwordHash -verificationCode -verificationCodeExpires -verificationOTP -otpExpires');

        res.status(200).json({
            success: true,
            data: updatedUser
        });
    } catch (error) {
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

        // Kiểm tra nếu user đăng nhập bằng Google
        if (user.googleId) {
            return res.status(400).json({ 
                success: false,
                message: 'Không thể đổi mật khẩu cho tài khoản đăng nhập bằng Google' 
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

exports.requestDeactivateVerification = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { verificationMethod } = req.body; // 'email' hoặc 'phone'

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ 
                success: false,
                message: 'Không tìm thấy thông tin người dùng' 
            });
        }

        // Kiểm tra xem user có thông tin liên hệ không
        if (!user.email && !user.phone) {
            return res.status(400).json({ 
                success: false,
                message: 'Không có thông tin email hoặc số điện thoại để xác thực' 
            });
        }

        // Nếu chỉ có một phương thức, sử dụng phương thức đó
        let method = verificationMethod;
        if (!user.email) {
            method = 'phone';
        } else if (!user.phone) {
            method = 'email';
        }

        // Tạo mã OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 phút

        // Lưu OTP vào database
        user.verificationOTP = otp;
        user.otpExpires = otpExpires;
        await user.save();

        // Gửi OTP
        if (method === 'email') {
            await sendDeactivateVerificationEmail(user.email, otp);
        } else {
            await sendVerificationSMS(user.phone, otp);
        }

        res.status(200).json({
            success: true,
            message: `Mã xác thực đã được gửi đến ${method === 'email' ? 'email' : 'số điện thoại'} của bạn`,
            verificationMethod: method
        });
    } catch (error) {
        console.error('Error in requestDeactivateVerification:', error);
        res.status(500).json({ 
            success: false,
            message: 'Lỗi khi gửi mã xác thực',
            error: error.message 
        });
    }
};

exports.verifyDeactivateAccount = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { otp } = req.body;

        if (!otp) {
            return res.status(400).json({ 
                success: false,
                message: 'Vui lòng nhập mã xác thực' 
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ 
                success: false,
                message: 'Không tìm thấy thông tin người dùng' 
            });
        }

        // Kiểm tra OTP
        if (!user.verificationOTP || user.verificationOTP !== otp) {
            return res.status(400).json({ 
                success: false,
                message: 'Mã xác thực không đúng' 
            });
        }

        // Kiểm tra OTP có hết hạn không
        if (user.otpExpires < new Date()) {
            return res.status(400).json({ 
                success: false,
                message: 'Mã xác thực đã hết hạn' 
            });
        }

        // Vô hiệu hóa tài khoản
        user.status = 'INACTIVE_USER';
        user.verificationOTP = null;
        user.otpExpires = null;
        await user.save();

        res.status(200).json({
            success: true,
            message: 'Tài khoản đã được vô hiệu hóa thành công. Bạn có thể đăng nhập lại bất cứ lúc nào để kích hoạt lại tài khoản.'
        });
    } catch (error) {
        console.error('Error in verifyDeactivateAccount:', error);
        res.status(500).json({ 
            success: false,
            message: 'Lỗi khi vô hiệu hóa tài khoản',
            error: error.message 
        });
    }
};

exports.deactivateAccount = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { password } = req.body;

        const user = await User.findById(userId).populate('role');
        if (!user) {
            return res.status(404).json({ 
                success: false,
                message: 'Không tìm thấy thông tin người dùng' 
            });
        }

        // Kiểm tra trạng thái tài khoản - phải đang hoạt động
        if (user.status !== 'ACTIVE') {
            return res.status(400).json({ 
                success: false,
                message: 'Chỉ có thể vô hiệu hóa tài khoản đang hoạt động' 
            });
        }

        // Kiểm tra booking đang diễn ra
        const activeBookings = await Booking.find({
            $or: [
                { customerId: userId, status: { $in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] } },
                { technicianId: userId, status: { $in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] } }
            ]
        });

        if (activeBookings.length > 0) {
            return res.status(400).json({ 
                success: false,
                message: 'Không thể vô hiệu hóa tài khoản khi có booking đang diễn ra. Vui lòng hủy booking trước.' 
            });
        }

        // Kiểm tra giao dịch chưa hoàn thành (receipt với paymentStatus PENDING)
        const pendingReceipts = await Receipt.find({
            $or: [
                { customerId: userId, paymentStatus: 'PENDING' },
                { technicianId: userId, paymentStatus: 'PENDING' }
            ]
        });

        if (pendingReceipts.length > 0) {
            return res.status(400).json({ 
                success: false,
                message: 'Không thể vô hiệu hóa tài khoản khi có giao dịch chưa hoàn thành' 
            });
        }

        // Kiểm tra feedback chưa được xử lý (feedback bị ẩn chưa có reply)
        const pendingFeedbacks = await Feedback.find({
            $or: [
                { fromUser: userId, isVisible: false, reply: { $exists: false } },
                { toUser: userId, isVisible: false, reply: { $exists: false } }
            ]
        });

        if (pendingFeedbacks.length > 0) {
            return res.status(400).json({ 
                success: false,
                message: 'Không thể vô hiệu hóa tài khoản khi có feedback chưa được xử lý' 
            });
        }

        // Nếu user đăng nhập bằng Google (có googleId), không cần kiểm tra mật khẩu
        if (user.googleId) {
            // Vô hiệu hóa tài khoản với trạng thái INACTIVE_USER
            user.status = 'INACTIVE_USER';
            await user.save();

            return res.status(200).json({
                success: true,
                message: 'Tài khoản đã được vô hiệu hóa thành công. Bạn có thể đăng nhập lại bất cứ lúc nào để kích hoạt lại tài khoản.'
            });
        }

        // Nếu user đăng nhập bằng email/password, yêu cầu mật khẩu
        if (!password) {
            return res.status(400).json({ 
                success: false,
                message: 'Vui lòng nhập mật khẩu để xác nhận' 
            });
        }

        // Xác thực mật khẩu
        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
        if (!isPasswordValid) {
            return res.status(400).json({ 
                success: false,
                message: 'Mật khẩu không đúng' 
            });
        }

        // Vô hiệu hóa tài khoản với trạng thái INACTIVE_USER
        user.status = 'INACTIVE_USER';
        await user.save();

        res.status(200).json({
            success: true,
            message: 'Tài khoản đã được vô hiệu hóa thành công. Bạn có thể đăng nhập lại bất cứ lúc nào để kích hoạt lại tài khoản.'
        });
    } catch (error) {
        console.error('Error in deactivateAccount:', error);
        res.status(500).json({ 
            success: false,
            message: 'Lỗi khi vô hiệu hóa tài khoản',
            error: error.message 
        });
    }
};

exports.requestDeleteVerification = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { method } = req.body; // 'email' hoặc 'phone'

        console.log('Request body:', req.body); // Debug log
        console.log('Method:', method); // Debug log

        if (!method || !['email', 'phone'].includes(method)) {
            return res.status(400).json({ 
                success: false,
                message: 'Phương thức xác thực không hợp lệ' 
            });
        }

        const result = await userService.requestDeleteVerification(userId, method);
        
        res.status(200).json({
            success: true,
            message: result.message
        });
    } catch (error) {
        console.error('Request delete verification error:', error);
        res.status(400).json({ 
            success: false,
            message: error.message 
        });
    }
};

exports.verifyDeleteOTP = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { otp } = req.body;

        if (!otp) {
            return res.status(400).json({ 
                success: false,
                message: 'Mã xác thực không được để trống' 
            });
        }

        const result = await userService.verifyDeleteOTP(userId, otp);
        
        res.status(200).json({
            success: true,
            message: result.message
        });
    } catch (error) {
        console.error('Verify delete OTP error:', error);
        res.status(400).json({ 
            success: false,
            message: error.message 
        });
    }
};

exports.deleteAccount = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { password, confirmText } = req.body;

        // Kiểm tra xác nhận cuối cùng
        if (confirmText !== 'DELETE') {
            return res.status(400).json({ 
                success: false,
                message: 'Vui lòng nhập chính xác "DELETE" để xác nhận xóa tài khoản' 
            });
        }

        // Kiểm tra mật khẩu nếu không phải user Google
        const user = await User.findById(userId);
        if (!user.googleId && password) {
            const bcrypt = require('bcrypt');
            const isMatch = await bcrypt.compare(password, user.passwordHash);
            if (!isMatch) {
                return res.status(400).json({ 
                    success: false,
                    message: 'Mật khẩu không đúng' 
                });
            }
        }

        const result = await userService.deleteAccount(userId);
        
        res.status(200).json({
            success: true,
            message: result.message
        });
    } catch (error) {
        console.error('Delete account error:', error);
        res.status(400).json({ 
            success: false,
            message: error.message 
        });
    }
};
