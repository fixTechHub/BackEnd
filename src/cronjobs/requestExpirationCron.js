const cron = require('node-cron');
const BookingTechnicianRequest = require('../models/BookingTechnicianRequest');

// Hàm expire các request hết hạn
const expireExpiredRequests = async () => {
    try {
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
        }
    } catch (error) {
        console.error('Lỗi khi expire requests:', error);
    }
};

// Chạy mỗi 5 phút
const startRequestExpirationCron = () => {
    cron.schedule('*/5 * * * *', () => {
        console.log('Chạy cronjob expire requests...');
        expireExpiredRequests();
    });
    
    console.log('Cronjob expire requests đã được khởi động (chạy mỗi 5 phút)');
};

module.exports = {
    startRequestExpirationCron,
    expireExpiredRequests
}; 