const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Notification = require('../models/Notification');
const technicianService = require('./technicianService');
const BookingPrice = require('../models/BookingPrice');
const BookingStatusLog = require('../models/BookingStatusLog');

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
        // console.log('--- LOCATION POINT ---', newBooking.location.geojson.coordinates);
        console.log('--- ĐẶT LỊCH MỚI ---', newBooking);

        await newBooking.save({ session });
        console.log('--- ĐẶT LỊCH MỚI ---', newBooking);

        const { location, serviceId } = bookingData;
        const searchParams = {
            latitude: location.geojson.coordinates[1],
            longitude: location.geojson.coordinates[0],
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
        if (!mongoose.Types.ObjectId.isValid(bookingId)) {
            throw new Error('ID đặt lịch không hợp lệ');
        }

        const booking = await Booking.findById(bookingId)
            .populate({
                path: 'customerId',
                select: 'fullName email phone avatar' 
            })
            .populate({
                path: 'technicianId',
                populate: {
                    path: 'userId',
                    select: 'fullName email phone avatar'
                }
            })
            .populate({
                path: 'serviceId',
            })
            
            .populate('cancelledBy');

        if (!booking) {
            throw new Error('Không tìm thấy đặt lịch');
        }

        return booking;
    } catch (error) {
        throw error;
    }
};

const cancelBooking = async (bookingId, userId, role, reason) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Tìm booking
        const booking = await Booking.findById(bookingId);
        if (!booking) {
            throw new Error('Không tìm thấy booking');
        }

        // Kiểm tra quyền hủy
        if (role === 'CUSTOMER' && booking.customerId.toString() !== userId) {
            throw new Error('Bạn không có quyền hủy booking này');
        }
        if (role === 'TECHNICIAN' && booking.technicianId?.toString() !== userId) {
            throw new Error('Bạn không có quyền hủy booking này');
        }

        // Kiểm tra trạng thái hiện tại
        if (booking.status === 'CANCELLED') {
            throw new Error('Booking đã bị hủy trước đó');
        }
        if (booking.status === 'DONE') {
            throw new Error('Không thể hủy booking đã hoàn thành');
        }
        if (booking.status === 'WAITING_CONFIRM') {
            throw new Error('Không thể hủy booking đã hoàn thành');
        }

        // Cập nhật trạng thái booking
        await Booking.findByIdAndUpdate(
            bookingId,
            {
                $set: {
                    status: 'CANCELLED',
                    cancelledBy: userId,
                    cancellationReason: reason,
                    isChatAllowed: false,
                    isVideoCallAllowed: false
                }
            },
            { session }
        );

        // Lưu log trạng thái
        await BookingStatusLog.create([{
            bookingId,
            fromStatus: booking.status,
            toStatus: 'CANCELLED',
            changedBy: userId,
            role,
            note: reason
        }], { session });

        // Nếu booking đang có báo giá, cập nhật trạng thái báo giá
        if (booking.status === 'QUOTED') {
            await BookingPrice.updateMany(
                { bookingId, status: 'PENDING' },
                { status: 'REJECTED' },
                { session }
            );
        }

        await session.commitTransaction();

        // Lấy lại booking sau khi cập nhật
        const updatedBooking = await Booking.findById(bookingId);
        return updatedBooking;
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

const confirmJobDone = async (bookingId, userId, role) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const booking = await Booking.findById(bookingId);
        if (!booking) {
            throw new Error('Không tìm thấy booking');
        }

        // Kiểm tra quyền
        if (role === 'CUSTOMER' && booking.customerId.toString() !== userId) {
            throw new Error('Bạn không có quyền xác nhận booking này');
        }
        if (role === 'TECHNICIAN' && booking.technicianId?.toString() !== userId) {
            throw new Error('Bạn không có quyền xác nhận booking này');
        }

        // Kiểm tra trạng thái hiện tại
        if (booking.status === 'CANCELLED') {
            throw new Error('Booking đã bị hủy trước đó');
        }
        if (booking.status === 'PENDING') {
            throw new Error('Không thể hoàn thành booking khi chưa chọn thợ');
        }
        if (booking.paymentStatus !== 'PAID') {
            throw new Error('Không thể hoàn thành booking khi chưa thanh toán');
        }

        // Cập nhật trạng thái booking
        await Booking.findByIdAndUpdate(
            bookingId,
            {
                $set: {
                    status: 'DONE',
                    customerConfirmedDone: true,
                    isChatAllowed: false,
                    isVideoCallAllowed: false
                }
            },
            { session }
        );

        // Lưu log trạng thái
        await BookingStatusLog.create([{
            bookingId,
            fromStatus: booking.status,
            toStatus: 'DONE',
            changedBy: userId,
            role
        }], { session });

        await session.commitTransaction();

        // Lấy lại booking sau khi cập nhật
        const updatedBooking = await Booking.findById(bookingId);
        return updatedBooking;
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

module.exports = {
    createRequestAndNotify,
    getBookingById,
    cancelBooking,
    confirmJobDone
};