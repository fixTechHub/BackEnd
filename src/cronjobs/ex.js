const cron = require('node-cron');
const User = require('../models/User');
const Technician = require('../models/Technician');
const { sendDeletionReminderEmail } = require('../utils/mail');

// Cron job để xử lý xóa tài khoản và gửi reminder
const handleAccountDeletion = async () => {
    try {
        
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000)); // 30 ngày trước
        const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000)); // 7 ngày trước
        
        // 1. Xóa vĩnh viễn các tài khoản đã chờ xóa quá 30 ngày
        const usersToDelete = await User.find({
            status: 'PENDING_DELETION',
            pendingDeletionAt: { $lte: thirtyDaysAgo }
        }).populate('role');
        
        for (const user of usersToDelete) {
            
            // Soft delete - ẩn thông tin cá nhân nhưng giữ lại dữ liệu quan trọng
            user.fullName = 'Đã xóa';
            user.email = `deleted_${user._id}@deleted.com`;
            user.phone = null;
            user.address = null;
            user.avatar = null;
            user.passwordHash = null;
            user.googleId = null;
            user.status = 'DELETED';
            user.deletedAt = new Date();
            user.pendingDeletionAt = null;
            user.lastDeletionReminderSent = null;
            
            await user.save();
            
            // Nếu là technician, cập nhật thông tin technician
            if (user.role?.name === 'TECHNICIAN') {
                const technician = await Technician.findOne({ userId: user._id });
                if (technician) {
                    technician.status = 'DELETED';
                    technician.deletedAt = new Date();
                    technician.pendingDeletionAt = null;
                    await technician.save();
                }
            }
        }
        
        // 2. Gửi email reminder cho các tài khoản đang chờ xóa
        const usersToRemind = await User.find({
            status: 'PENDING_DELETION',
            $or: [
                { lastDeletionReminderSent: { $lte: sevenDaysAgo } },
                { lastDeletionReminderSent: null }
            ]
        });
        
        for (const user of usersToRemind) {
            if (user.email) {
                try {
                    // Tính số ngày còn lại
                    const deletionDate = new Date(user.pendingDeletionAt.getTime() + (30 * 24 * 60 * 60 * 1000));
                    const daysLeft = Math.ceil((deletionDate - now) / (24 * 60 * 60 * 1000));
                    
                    if (daysLeft > 0) {
                        
                        // Gửi email reminder
                        await sendDeletionReminderEmail(user.email, daysLeft);
                        
                        // Cập nhật thời gian gửi reminder cuối cùng
                        user.lastDeletionReminderSent = now;
                        await user.save();
                    }
                } catch (error) {
                    console.error(`Error sending reminder to ${user.email}:`, error);
                }
            }
        }
        
        
    } catch (error) {
        console.error('Error in account deletion cron job:', error);
    }
};

// Chạy cron job mỗi ngày lúc 2:00 AM
cron.schedule('0 2 * * *', handleAccountDeletion, {
    scheduled: true,
    timezone: "Asia/Ho_Chi_Minh"
});


module.exports = { handleAccountDeletion };
