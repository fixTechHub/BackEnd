const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Notification = require('../models/Notification');
const User = require('../models/User');
const technicianService = require('./technicianService');

const createRequestAndNotify = async (bookingData, customerId, io) => {
    const bookingCode = `BK-${Date.now()}${Math.floor(Math.random() * 1000)}`;
    // console.log('bookingCode:', bookingCode);

    // 1. Tạo yêu cầu booking 
    const newBooking = new Booking({
        bookingCode,
        ...bookingData,
        customerId,
        status: 'PENDING',
        technicianId: null
    });
    // console.log('Creating booking with data:', newBooking);
    
    // await newBooking.save();

    // 2. Tìm các thợ phù hợp ở gần
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

    // // 3. Tạo và gửi thông báo cho các thợ đã tìm thấy
    // const notificationPromises = nearbyTechnicians.map(tech => {
    //     const notifData = {
    //         userId: tech.userId, // ID của user thợ
    //         title: 'Yêu cầu công việc mới gần bạn',
    //         content: `Có một yêu cầu mới cách bạn khoảng ${(tech.distance / 1000).toFixed(1)} km. Nhấn để xem và báo giá.`,
    //         referenceId: newBooking._id,
    //         type: 'NEW_REQUEST'
    //     };
    //     return notificationService.createAndSend(notifData, io);
    // });

    // await Promise.all(notificationPromises);

    return { booking: newBooking, notifiedCount: nearbyTechnicians };
    // return { booking: newBooking};
};

const createBooking = async (bookingData, customerId, io) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { technicianId, serviceId, description, schedule, location, images } = bookingData;

        // Lấy thông tin khách hàng để gửi thông báo
        const customer = await User.findById(customerId).session(session);
        if (!customer) throw new Error('Khách hàng không tồn tại.');

        const randomSuffix = Math.floor(Math.random() * 1000);

        // Tạo booking
        const newBooking = new Booking({
            bookingCode: `BK-${Date.now()}${randomSuffix}`,
            customerId,
            technicianId,
            serviceId,
            description,
            schedule,
            location,
            images
        });
        const savedBooking = await newBooking.save({ session });

        // Tạo thông báo cho thợ

        await session.commitTransaction();

        // Gửi sự kiện real-time cho thợ
        // io.to(technicianId.toString()).emit('new_booking', savedBooking);

        return savedBooking;
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

module.exports = {
    createRequestAndNotify
};