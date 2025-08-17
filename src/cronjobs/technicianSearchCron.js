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
        })

        if (searches.length === 0) {
            return;
        }

        console.log(`[${new Date().toISOString()}] Processing ${searches.length} technician searches`);

        for (const search of searches) {
            try {
                // Kiểm tra search document còn tồn tại không
                const existingSearch = await BookingTechnicianSearch.findById(search._id);
                if (!existingSearch) {
                    console.log(`Search document ${search._id} no longer exists, skipping...`);
                    continue;
                }

                const booking = await Booking.findById(search.bookingId);
                if (!booking) {
                    console.log(`Booking ${search.bookingId} no longer exists, removing search document...`);
                    // Xóa search document nếu booking không còn tồn tại
                    try {
                        await BookingTechnicianSearch.findByIdAndDelete(search._id);
                    } catch (deleteError) {
                        console.error(`Error deleting orphaned search document ${search._id}:`, deleteError.message);
                    }
                    continue;
                }
                
                // Chỉ tiếp tục quét khi booking còn ở trạng thái chọn thợ
                if (!['PENDING', 'AWAITING_CONFIRM'].includes(booking.status)) {
                    console.log(`Booking ${search.bookingId} status is ${booking.status}, marking search as completed...`);
                    // Đánh dấu search đã hoàn thành
                    try {
                        await BookingTechnicianSearch.findByIdAndUpdate(
                            search._id,
                            { 
                                $set: { 
                                    completed: true,
                                    lastSearchAt: new Date()
                                }
                            },
                            { new: true }
                        );
                    } catch (updateError) {
                        console.error(`Error updating search status for ${search._id}:`, updateError.message);
                    }
                    continue;
                }

                const searchParams = {
                    latitude: booking.location.geojson.coordinates[1],
                    longitude: booking.location.geojson.coordinates[0],
                    serviceId: booking.serviceId,
                    availability: ['FREE', 'ONJOB'],
                    status: 'APPROVED',
                    minBalance: 0
                };

                // Gọi lại hàm tìm thợ và lưu trạng thái
                const result = await bookingService.findTechniciansWithExpandingRadiusAndSave(
                    searchParams,
                    booking._id,
                    getIo()
                );

                console.log(`Successfully processed search ${search._id} for booking ${search.bookingId}, found ${result.data.length} technicians`);

            } catch (error) {
                console.error(`Error processing search ${search._id}:`, error.message);
                
                // Xử lý các loại lỗi cụ thể
                if (error.message.includes('No matching document found') || 
                    error.message.includes('version') ||
                    error.message.includes('modifiedPaths')) {
                    console.log(`Version conflict detected for search ${search._id}, attempting to refresh...`);
                    
                    try {
                        // Thử refresh search document
                        const refreshedSearch = await BookingTechnicianSearch.findById(search._id);
                        if (refreshedSearch) {
                            console.log(`Successfully refreshed search document ${search._id}`);
                        } else {
                            console.log(`Search document ${search._id} no longer exists, skipping...`);
                        }
                    } catch (refreshError) {
                        console.error(`Error refreshing search document ${search._id}:`, refreshError.message);
                    }
                }
                
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