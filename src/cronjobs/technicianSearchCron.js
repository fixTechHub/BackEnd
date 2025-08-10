const cron = require('node-cron');
const Booking = require('../models/Booking');
const BookingTechnicianSearch = require('../models/BookingTechnicianSearch');
const bookingService = require('../services/bookingService');
const { getIo } = require('../sockets/socketManager');

const MAX_TECHNICIANS = 10;
const SEARCH_TIMEOUT_MINUTES = 60;

// Thêm timeout và error handling để tránh blocking
const processTechnicianSearch = async () => {
    try {
        const now = new Date();
        
        // Lấy các booking đang tìm thợ, chưa đủ 10 thợ, chưa quá 60 phút
        const searches = await BookingTechnicianSearch.find({
            createdAt: { $gte: new Date(now.getTime() - SEARCH_TIMEOUT_MINUTES * 60 * 1000) }
        }).limit(5); // Giới hạn số lượng để xử lý mỗi lần

        if (searches.length === 0) {
            return;
        }

        console.log(`[${new Date().toISOString()}] Processing ${searches.length} technician searches`);

        for (const search of searches) {
            try {
                const booking = await Booking.findById(search.bookingId);
                if (!booking) continue;
                
                // Chỉ tiếp tục quét khi booking còn ở trạng thái chọn thợ
                if (!['PENDING', 'AWAITING_CONFIRM'].includes(booking.status)) continue;

                const searchParams = {
                    latitude: booking.location.geojson.coordinates[1],
                    longitude: booking.location.geojson.coordinates[0],
                    serviceId: booking.serviceId,
                    availability: ['FREE', 'ONJOB'],
                    status: 'APPROVED',
                    minBalance: 200000
                };

                // Gọi lại hàm tìm thợ và lưu trạng thái
                await bookingService.findTechniciansWithExpandingRadiusAndSave(
                    searchParams,
                    booking._id,
                    getIo()
                );
            } catch (error) {
                console.error(`Error processing search ${search._id}:`, error.message);
                // Tiếp tục xử lý các search khác thay vì dừng toàn bộ
                continue;
            }
        }
    } catch (error) {
        console.error('Error in technician search cron:', error.message);
    }
};

// Giảm tần suất từ 10 giây xuống 30 giây để giảm tải
cron.schedule('*/30 * * * * *', processTechnicianSearch, {
    scheduled: true,
    timezone: "Asia/Ho_Chi_Minh"
});

console.log('Technician search cron job started (runs every 30 seconds)');