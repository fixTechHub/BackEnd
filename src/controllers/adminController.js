const adminService = require('../services/adminService'); 
const User = require('../models/User');
const Booking = require('../models/Booking');
const Receipt = require('../models/Receipt');
const Feedback = require('../models/Feedback');
const technicianService = require('../services/technicianService');

exports.deactivateUserAccount = async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await User.findById(userId).populate('role');
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy người dùng'
            });
        }

        // Kiểm tra không cho phép vô hiệu hóa tài khoản admin khác
        if (user.role?.name === 'ADMIN') {
            return res.status(400).json({
                success: false,
                message: 'Không thể vô hiệu hóa tài khoản admin khác'
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

        // Vô hiệu hóa tài khoản với trạng thái INACTIVE_ADMIN
        user.status = 'INACTIVE_ADMIN';
        await user.save();

        // Nếu là technician thì đặt trạng thái INACTIVE
        if (user.role?.name === 'TECHNICIAN') {
            const technician = await require('../models/Technician').findOne({ userId });
            if (technician) {
                technician.status = 'INACTIVE';
                await technician.save();
            }
        }

        res.status(200).json({
            success: true,
            message: 'Tài khoản người dùng đã được vô hiệu hóa thành công.'
        });
    } catch (error) {
        console.error('Error in deactivateUserAccount:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi vô hiệu hóa tài khoản người dùng',
            error: error.message
        });
    }
};

exports.activateUserAccount = async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy người dùng'
            });
        }

        // Kích hoạt lại tài khoản
        user.status = 'ACTIVE';
        await user.save();

        // Nếu là technician thì đặt lại trạng thái APPROVED
        if (user.role?.name === 'TECHNICIAN') {
            const technician = await require('../models/Technician').findOne({ userId });
            if (technician) {
                technician.status = 'APPROVED';
                await technician.save();
            }
        }

        res.status(200).json({
            success: true,
            message: 'Tài khoản người dùng đã được kích hoạt lại thành công.'
        });
    } catch (error) {
        console.error('Error in activateUserAccount:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi kích hoạt lại tài khoản người dùng',
            error: error.message
        });
    }
};

exports.sendContractTechnician = async (req, res) => {
    try {
        const { id } = req.params;
        const technician = await adminService.sendContractTechnician(id);
        res.status(200).json({
            message: 'Technician approved successfully',
            data: technician
        });
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

exports.approveWithdraw = async (req, res) => {
  try {
    const logId = req.params.logId;
    const result = await adminService.approveWithdrawRequest(logId);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
exports.findTechnicians = async (req, res) => {
    try {
        const technicians = await technicianService.getAllTechnicians
        if(technicians==null) {
            res.status(404).json({message: 'Không tìm thấy Service'})
        }
        res.status(200).json({data: technicians})
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message });
    }
}
