const User = require('../models/User');
const Role = require('../models/Role');
const {generateUserCode} = require('../utils/generateCode')
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Technician = require('../models/Technician');
const Receipt = require('../models/Receipt');
const Feedback = require('../models/Feedback');
const { sendDeactivateVerificationEmail, sendDeleteVerificationEmail } = require('../utils/mail');
const { sendVerificationSMS } = require('../utils/sms');

// Export generateUserCode function
exports.generateUserCode = generateUserCode;

exports.findUserByEmail = async (email) => {
    return await User.findOne({ email }) // Không cần populate role nữa
};

exports.findUserByPhone = async (phone) => {
    return await User.findOne({ phone }) // Không cần populate role nữa
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
    return await User.findById(userId) // Không cần populate role nữa
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

exports.deleteAccount = async (userId) => {
    try {
        const user = await User.findById(userId).populate('role');
        
        if (!user) {
            throw new Error('User not found');
        }

        // Kiểm tra quyền xóa tài khoản - Admin không thể xóa tài khoản
        if (user.role?.name === 'ADMIN') {
            throw new Error('Admin không thể xóa tài khoản');
        }

        // Kiểm tra trạng thái tài khoản - phải đang hoạt động
        if (user.status !== 'ACTIVE') {
            throw new Error('Chỉ có thể xóa tài khoản đang hoạt động');
        }

        // Kiểm tra booking đang diễn ra
        const activeBookings = await Booking.find({
            $or: [
                { customerId: userId, status: { $in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] } },
                { technicianId: userId, status: { $in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] } }
            ]
        });

        if (activeBookings.length > 0) {
            throw new Error('Không thể xóa tài khoản khi có booking đang diễn ra. Vui lòng hủy booking trước.');
        }

        // Kiểm tra giao dịch chưa hoàn thành (receipt với paymentStatus PENDING)
        const pendingReceipts = await Receipt.find({
            $or: [
                { customerId: userId, paymentStatus: 'PENDING' },
                { technicianId: userId, paymentStatus: 'PENDING' }
            ]
        });

        if (pendingReceipts.length > 0) {
            throw new Error('Không thể xóa tài khoản khi có giao dịch chưa hoàn thành');
        }

        // Kiểm tra feedback chưa được xử lý (feedback bị ẩn chưa có reply)
        const pendingFeedbacks = await Feedback.find({
            $or: [
                { fromUser: userId, isVisible: false, reply: { $exists: false } },
                { toUser: userId, isVisible: false, reply: { $exists: false } }
            ]
        });

        if (pendingFeedbacks.length > 0) {
            throw new Error('Không thể xóa tài khoản khi có feedback chưa được xử lý');
        }

        // Soft delete - đặt trạng thái PENDING_DELETION với thời gian chờ 30 ngày
        user.status = 'PENDING_DELETION';
        user.pendingDeletionAt = new Date();
        user.lastDeletionReminderSent = new Date(); // Gửi reminder đầu tiên ngay lập tức

        await user.save();

        // Nếu là technician, cập nhật thông tin technician
        if (user.role?.name === 'TECHNICIAN') {
            const technician = await Technician.findOne({ userId: userId });
            if (technician) {
                technician.status = 'PENDING_DELETION';
                technician.pendingDeletionAt = new Date();
                await technician.save();
            }
        }

        return { message: 'Tài khoản đã được đánh dấu để xóa. Bạn có 30 ngày để đăng nhập lại nếu muốn hủy bỏ việc xóa tài khoản.' };
    } catch (error) {
        throw new Error(`Lỗi khi xóa tài khoản: ${error.message}`);
    }
};

exports.requestDeleteVerification = async (userId, method) => {
    try {
        const user = await User.findById(userId).populate('role');
        
        if (!user) {
            throw new Error('User not found');
        }

        console.log('User info:', {
            id: user._id,
            email: user.email,
            phone: user.phone,
            role: user.role?.name
        }); // Debug log
        console.log('Method requested:', method); // Debug log

        // Kiểm tra quyền xóa tài khoản
        if (user.role?.name === 'ADMIN') {
            throw new Error('Admin không thể xóa tài khoản');
        }

        // Tạo mã OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpires = new Date(Date.now() + 5 * 60000); // 5 phút

        // Lưu OTP vào user
        user.verificationOTP = otp;
        user.otpExpires = otpExpires;
        await user.save();

        // Gửi OTP
        if (method === 'email' && user.email) {
            await sendDeleteVerificationEmail(user.email, otp);
        } else if (method === 'phone' && user.phone) {
            await sendVerificationSMS(user.phone, otp);
        } else {
            throw new Error('Không có thông tin liên hệ để gửi mã xác thực');
        }

        return { message: `Mã xác thực đã được gửi đến ${method === 'email' ? 'email' : 'số điện thoại'} của bạn` };
    } catch (error) {
        throw new Error(`Lỗi khi gửi mã xác thực: ${error.message}`);
    }
};

exports.verifyDeleteOTP = async (userId, otp) => {
    try {
        const user = await User.findById(userId).populate('role');
        
        if (!user) {
            throw new Error('User not found');
        }

        // Kiểm tra quyền xóa tài khoản
        if (user.role?.name === 'ADMIN') {
            throw new Error('Admin không thể xóa tài khoản');
        }

        // Kiểm tra OTP
        if (user.verificationOTP !== otp) {
            throw new Error('Mã xác thực không đúng');
        }

        if (user.otpExpires < new Date()) {
            throw new Error('Mã xác thực đã hết hạn');
        }

        // Xóa OTP sau khi xác thực thành công
        user.verificationOTP = undefined;
        user.otpExpires = undefined;
        await user.save();

        return { message: 'Xác thực thành công' };
    } catch (error) {
        throw new Error(`Lỗi khi xác thực: ${error.message}`);
    }
};

exports.restoreAccount = async (userId) => {
    try {
        const user = await User.findById(userId).populate('role');
        
        if (!user) {
            throw new Error('User not found');
        }

        // Kiểm tra xem tài khoản có đang trong trạng thái chờ xóa không
        if (user.status !== 'PENDING_DELETION') {
            throw new Error('Tài khoản không trong trạng thái chờ xóa');
        }

        // Khôi phục tài khoản
        user.status = 'ACTIVE';
        user.pendingDeletionAt = null;
        user.lastDeletionReminderSent = null;

        await user.save();

        // Nếu là technician, khôi phục thông tin technician
        if (user.role?.name === 'TECHNICIAN') {
            const technician = await Technician.findOne({ userId: userId });
            if (technician) {
                technician.status = 'ACTIVE';
                technician.pendingDeletionAt = null;
                await technician.save();
            }
        }

        return { message: 'Tài khoản đã được khôi phục thành công' };
    } catch (error) {
        throw new Error(`Lỗi khi khôi phục tài khoản: ${error.message}`);
    }
};