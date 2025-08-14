const cron = require('node-cron');
const BookingTechnicianRequest = require('../models/BookingTechnicianRequest');

// Hàm expire các request hết hạn với timeout
const expireExpiredRequests = async () => {
    try {
        console.log(`[${new Date().toISOString()}] Starting request expiration check...`);
        
        const result = await BookingTechnicianRequest.updateMany(
            { 
                status: 'PENDING', 
                expiresAt: { $lt: new Date() } 
            },
            { 
                $set: { status: 'EXPIRED' } 
            }
        );

        if (result.modifiedCount > 0) {
            console.log(`[${new Date().toISOString()}] Đã expire ${result.modifiedCount} request hết hạn`);
        } else {
            console.log(`[${new Date().toISOString()}] Không có request nào cần expire`);
        }
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Lỗi khi expire requests:`, error.message);
    }
};

// Chạy mỗi 10 phút thay vì 5 phút để giảm tải
const startRequestExpirationCron = () => {
    cron.schedule('*/10 * * * *', expireExpiredRequests, {
        scheduled: true,
        timezone: "Asia/Ho_Chi_Minh"
    });
    
    console.log('Cronjob expire requests đã được khởi động (chạy mỗi 10 phút)');
};

module.exports = {
    startRequestExpirationCron,
    expireExpiredRequests
}; 