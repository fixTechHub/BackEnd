const cron = require('node-cron');
const mongoose = require('mongoose');
const Technician = require('../models/Technician');
const User = require('../models/User');
const Role = require('../models/Role');
const notificationService = require('../services/notificationService');

class DebCronJobService {
    constructor() {
        this.isRunning = false;
        this.cronScheduled = false;
        this.startCronJobs();
    }

    // Start all cron jobs
    startCronJobs() {
        if (this.cronScheduled) return;
        console.log('Bắt đầu công việc định kỳ kiểm tra số dư nợ...');

        // Run every day at midnight
        cron.schedule('0 0 * * *', () => {
            this.checkDebtBalances();
        });
        this.cronScheduled = true;
        console.log('Công việc định kỳ kiểm tra số dư nợ đã khởi động thành công');
    }

    // Check and process technicians with high debt balances
    async checkDebtBalances() {
        if (this.isRunning) {
            console.log('Kiểm tra số dư nợ đang chạy, bỏ qua...');
            return;
        }

        this.isRunning = true;
        console.log('Bắt đầu kiểm tra số dư nợ...');

        try {
            const debtThreshold = 300000;

            // Find technicians with debBalance > 300000 VND and isdebFree false
            const technicians = await Technician.find({
                debBalance: { $gt: debtThreshold },
                isDebFree: false
            }).populate('userId').limit(15);

            console.log(`Tìm thấy ${technicians.length} kỹ thuật viên có số dư nợ vượt quá ${debtThreshold.toLocaleString('vi-VN')} VND`);

            if (technicians.length === 0) {
                console.log('Không tìm thấy kỹ thuật viên nào có số dư nợ vượt quá ngưỡng');
                return;
            }

            // Find admin role and active admins
            const adminRole = await Role.findOne({ name: 'ADMIN' });
            if (!adminRole) {
                throw new Error('Vai trò quản trị viên không tìm thấy');
            }
            const admins = await User.find({ role: adminRole._id, status: 'ACTIVE' });

            for (const technician of technicians) {
                try {
                    // Start a MongoDB session for transaction
                    const session = await mongoose.startSession();
                    await session.withTransaction(async () => {
                        // Update isdebFree status
                        technician.isDebFree = true;
                        await technician.save({ session });

                        // Send notification to technician
                        await this.sendDebtNotification(technician, debtThreshold, session);

                        // Send notification to admins
                        for (const admin of admins) {
                            const adminNotificationData = {
                                userId: admin._id,
                                title: 'Cảnh Báo Nợ Kỹ Thuật Viên',
                                content: `Kỹ thuật viên ${technician.userId.fullName} (ID: ${technician._id}) có số dư nợ ${technician.debBalance.toLocaleString('vi-VN')} VND, vượt quá ngưỡng ${debtThreshold.toLocaleString('vi-VN')} VND.`,
                                referenceId: admin._id,
                                referenceModel: 'User',
                                type: 'PAYMENT'
                            };
                            await notificationService.createAndSend(adminNotificationData, session);
                            console.log(`Quản trị viên ${admin._id} đã được thông báo về trạng thái nợ của kỹ thuật viên ${technician._id}`);
                        }
                    });
                    session.endSession();
                    console.log(`Kỹ thuật viên ${technician._id} đã được xử lý thành công`);
                } catch (error) {
                    console.error(`Không thể xử lý kỹ thuật viên ${technician._id}:`, error.message);
                }
            }

            console.log('Kiểm tra số dư nợ hoàn tất');
        } catch (error) {
            console.error('Lỗi trong kiểm tra số dư nợ:', error.message);
        } finally {
            this.isRunning = false;
        }
    }

    // Send debt notification to technician
    async sendDebtNotification(technician, debtThreshold, session) {
        const notificationData = {
            userId: technician.userId._id,
            title: 'Cảnh Báo Số Dư Nợ',
            content: `Số dư nợ của bạn ${technician.debBalance.toLocaleString('vi-VN')} VND đã vượt quá ngưỡng ${debtThreshold.toLocaleString('vi-VN')} VND. Trạng thái tài khoản của bạn đã được cập nhật thành không nợ.`,
            referenceId: technician._id,
            referenceModel: 'Technician',
            type: 'DEBT_ALERT'
        };
        await notificationService.createAndSend(notificationData, session);
        console.log(`Kỹ thuật viên ${technician._id} đã được thông báo về trạng thái nợ`);
    }

    // Manual trigger for testing purposes
    async runManualCheck() {
        console.log('Chạy kiểm tra số dư nợ thủ công...');
        await this.checkDebtBalances();
        console.log('Kiểm tra số dư nợ thủ công hoàn tất');
    }

    // Stop all cron jobs (useful for graceful shutdown)
    stopCronJobs() {
        cron.getTasks().forEach(task => task.stop());
        console.log('Công việc định kỳ kiểm tra số dư nợ đã dừng');
    }
}

// Export singleton instance
const debCronJobService = new DebCronJobService();

module.exports = debCronJobService;