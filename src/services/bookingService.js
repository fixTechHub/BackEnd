const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Notification = require('../models/Notification');
const User = require('../models/User');
const technicianService = require('./technicianService');
const BookingPrice = require('../models/BookingPrice');

const createRequestAndNotify = async (bookingData, io) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const bookingCode = `BK-${Date.now()}${Math.floor(Math.random() * 1000)}`;
        // console.log('bookingCode:', bookingCode);
        const newBooking = new Booking({
            bookingCode,
            ...bookingData,
            status: 'PENDING',
            technicianId: null
        });

        await newBooking.save({ session });
        console.log('--- ĐẶT LỊCH MỚI ---', newBooking);

        const { location, serviceId } = bookingData;
        const searchParams = {
            latitude: location.coordinates[1],
            longitude: location.coordinates[0],
            serviceId: serviceId,
            availability: 'FREE',
            status: 'APPROVED',
            minBalance: 100000
        };

        const nearbyTechnicians = await technicianService.findNearbyTechnicians(searchParams, 10);
        console.log('--- KẾT QUẢ TÌM THỢ ---', nearbyTechnicians);

        if (!nearbyTechnicians || !nearbyTechnicians.data || nearbyTechnicians.total === 0) {
            console.log('Không tìm thấy thợ nào phù hợp');
            await session.commitTransaction();
            return {
                booking: newBooking,
                technicians: { data: [], total: 0 },
                message: 'Hiện tại chưa tìm thấy thợ nào phù hợp. Vui lòng thử lại sau.'
            };
        }

        // 3. Tạo và gửi thông báo cho các thợ đã tìm thấy
        const notificationPromises = nearbyTechnicians.data.map(tech => {
            const notifData = {
                userId: tech.userId,
                title: 'Yêu cầu công việc mới gần bạn',
                content: `Có một yêu cầu mới cách bạn khoảng ${(tech.distance / 1000).toFixed(1)} km. Nhấn để xem và báo giá.`,
                referenceId: newBooking._id,
                type: 'NEW_REQUEST'
            };
            // return notificationService.createAndSend(notifData, io);
            console.log('--- THONG BAO CHO THO ---', notifData);
        });

        // await Promise.all(notificationPromises);

        await session.commitTransaction();
        session.endSession();

        return { booking: newBooking, technicians: nearbyTechnicians };
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
    }
};

const getBookingById = async (bookingId) => {
    try {
        // Kiểm tra ID hợp lệ
        if (!mongoose.Types.ObjectId.isValid(bookingId)) {
            throw new Error('ID đặt lịch không hợp lệ');
        }
        const bookingss = await Booking.findById(bookingId)
        console.log(bookingss.customerId);
        

        const booking = await Booking.findById(bookingId)
            .populate('customerId')
            .populate('technicianId')
            .populate('serviceId')
            .populate('cancelledBy');

        if (!booking) {
            throw new Error('Không tìm thấy đặt lịch');
        }

        return booking;
    } catch (error) {
        throw error;
    }
};

module.exports = {
    createRequestAndNotify,
    getBookingById,
};