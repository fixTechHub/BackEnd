const cron = require('node-cron');
const Booking = require('../models/Booking');
const BookingTechnicianSearch = require('../models/BookingTechnicianSearch');
const bookingService = require('../services/bookingService');
const { getIo } = require('../sockets/socketManager');

const MAX_TECHNICIANS = 10;
const SEARCH_TIMEOUT_MINUTES = 60;

cron.schedule('*/10 * * * * *', async () => {
    // console.log('Technician Status CronJob Start');
    
    // Chạy mỗi 10 giây
    const now = new Date();
    // Lấy các booking đang tìm thợ, chưa đủ 10 thợ, chưa quá 60 phút
    const searches = await BookingTechnicianSearch.find({
        completed: false,
        createdAt: { $gte: new Date(now.getTime() - SEARCH_TIMEOUT_MINUTES * 60 * 1000) }
    });

    for (const search of searches) {
        const booking = await Booking.findById(search.bookingId);
        if (!booking) continue;
        if (search.foundTechnicianIds.length >= MAX_TECHNICIANS) {
            search.completed = true;
            await search.save();
            continue;
        }

        const searchParams = {
            latitude: booking.location.geojson.coordinates[1],
            longitude: booking.location.geojson.coordinates[0],
            serviceId: booking.serviceId,
            availability: 'FREE',
            status: 'APPROVED',
            minBalance: 200000
        };

        // Gọi lại hàm tìm thợ và lưu trạng thái
        await bookingService.findTechniciansWithExpandingRadiusAndSave(
            searchParams,
            booking._id,
            getIo()
        );
    }
});