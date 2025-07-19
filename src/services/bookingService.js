const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Notification = require('../models/Notification');
const technicianService = require('./technicianService');
const BookingPrice = require('../models/BookingPrice');
const BookingStatusLog = require('../models/BookingStatusLog');
const notificationService = require('../services/notificationService')
const couponService = require('../services/couponService')
const paymentService = require('../services/paymentService')
const commissionService = require('../services/commissionService')
const receiptService = require('../services/receiptService');
const Service = require('../models/Service');
const Technician = require('../models/Technician');
const TechnicianServiceModel = require('../models/TechnicianService');
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
        const notificationPromises = nearbyTechnicians.data.map(async tech => {
            const notifData = {
                userId: tech.userId,
                title: 'Yêu cầu công việc mới gần bạn',
                content: `Có một yêu cầu mới cách bạn khoảng ${(tech.distance / 1000).toFixed(1)} km. Nhấn để xem và báo giá.`,
                referenceModel: 'Booking',
                referenceId: newBooking._id,
                url: `/technician/send-quotation?bookingId=${newBooking._id}`,
                type: 'NEW_REQUEST'
            };
            console.log('--- THONG BAO CHO THO ---', notifData);
            const notify = await notificationService.createNotification(notifData);
            io.to(`user:${notify.userId}`).emit('receiveNotification', notify);
        });

        await Promise.all(notificationPromises);

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
            })
            .populate({
                path: 'technicianId',
                populate: {
                    path: 'userId',        
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

const getUserBookingHistory = async (userId, role, limit, skip) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            throw new Error('ID khách không hợp lệ');
        }
   
        let query = {};
        if (role === 'CUSTOMER') {
            query.customerId = userId;
        } else if (role === 'TECHNICIAN') {
            query.technicianId = userId;
        } else {
            throw new Error('Vai trò không hợp lệ');
        }
        const bookings = await Booking.find(query)
            .populate({
                path: 'technicianId',
                populate: {
                    path: 'userId'  // This means: inside technicianId, populate userId
                }
            })
            .populate('customerId', 'fullName')
            .populate('serviceId', 'serviceName')
            .limit(Number(limit))
            .skip(Number(skip))
            .sort({ createdAt: -1 });
        return bookings;
    } catch (error) {
        console.error('Lỗi khi lấy lịch sử đặt chỗ:', error.message);
        throw error;
    }
}

const getAcceptedBooking = async (bookingId) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(bookingId)) {
            throw new Error('ID đặt lịch không hợp lệ');
        }

        const booking = await Booking.findOne({
            _id: bookingId,
            status: 'CONFIRMED',
            technicianId: { $exists: true, $ne: null }
        })
            .populate({
                path: 'technicianId',
                populate: {
                    path: 'userId'
                }
            })
            .populate('serviceId')
            .populate('customerId')
            .lean();

        if (!booking) {
            throw new Error('Không tìm thấy đơn hàng đã được xác nhận');
        }


        return booking;
    } catch (error) {
        throw error;
    }
}

const updateBookingAddCoupon = async (bookingId, couponCode, discountValue, finalPrice, paymentMethod) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        if (!mongoose.Types.ObjectId.isValid(bookingId)) {
            throw new Error('ID báo giá không hợp lệ');
        }
        const update = {};
        let booking = await getBookingById(bookingId)

        if (!booking) {
            throw new Error('Không tìm thấy báo giá để cập nhật');
        }
        if (couponCode) {
            update.discountCode = couponCode;
            update.discountValue = discountValue;
            update.finalPrice = finalPrice;
            // Find coupon document
            const couponDoc = await couponService.getCouponByCouponCode(couponCode)
            if (!couponDoc) {
                throw new Error('Không tìm thấy mã giảm giá');
            }
            couponDoc.usedCount += 1;
            await couponDoc.save({ session });
            // Find userId from booking
            const customerId = booking.customerId

            if (!customerId) {
                throw new Error('Không tìm thấy userId để lưu CouponUsage');
            }
            // Create CouponUsage if not already used
            const existingUsage = await CouponUsage.findOne({ couponId: couponDoc._id, userId: customerId }).session(session);
            if (!existingUsage) {
                await CouponUsage.create([{ couponId: couponDoc._id, userId: customerId, bookingId: booking._id }], { session });
            }
        } else {
            update.discountCode = null;
            update.discountValue = 0;
            update.finalPrice = finalPrice;
            update.holdingAmount = finalPrice * 0.2;
            update.comissionAmount = finalPrice * 0.1;
        }
        const updatedBooking = await Booking.findByIdAndUpdate(
            booking._id,
            { $set: update },
            { new: true, session }
        )
        const technician = await Technician.findById(updatedBooking.technicianId)
        if (!updatedBooking) {
            throw new Error('Không tìm thấy báo giá để cập nhật');
        }

        let paymentUrl = null;
        if (paymentMethod === 'PAYOS') {
            paymentUrl = await paymentService.createPayOsPayment(bookingId);
        } else if (paymentMethod === 'CASH') {
            // Handle cash payment:
            // 1. Update booking status and create receipt


            updatedBooking.paymentStatus = 'PAID';
            updatedBooking.status = 'DONE';
            updatedBooking.isChatAllowed = false
            updatedBooking.isVideoCallAllowed = false
            updatedBooking.completedAt = new Date();
            // Set warrantyExpiresAt based on warrantiesDuration (in days)
            updatedBooking.warrantyExpiresAt = new Date();
            updatedBooking.warrantyExpiresAt.setDate(
                updatedBooking.warrantyExpiresAt.getDate() + updatedBooking.quote.warrantiesDuration
            );
            await updatedBooking.save({ session });
            const technician = await technicianService.getTechnicianById(updatedBooking.technicianId)
            technician.availability = 'FREE'
            await technician.save({ session })
            const technicianServiceModel = await TechnicianServiceModel.findOne({ serviceId: updatedBooking.serviceId })
            
            const receiptData = {
                bookingId: updatedBooking._id,
                customerId: updatedBooking.customerId,
                technicianId: updatedBooking.technicianId,
                totalAmount: updatedBooking.finalPrice + updatedBooking.discountValue,
                serviceAmount: technicianServiceModel.price,
                discountAmount: updatedBooking.discountValue,
                paidAmount: updatedBooking.finalPrice,
                paymentMethod: 'CASH',
                paymentStatus: 'PAID',
                holdingAmount: updatedBooking.finalPrice*0.2,
                commissionAmount: updatedBooking.finalPrice*0.1
               
            };
            await receiptService.createReceipt(receiptData, session);

            // 2. Deduct commission from technician's balance
            await commissionService.deductCommission(
                updatedBooking.technicianId,
                updatedBooking.finalPrice,
                session
            );

        }

        await session.commitTransaction();
        session.endSession();

        return { booking: updatedBooking, paymentUrl: paymentUrl };
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.log(error.message);

        throw error;
        
    }
};

module.exports = {
    createRequestAndNotify,
    getBookingById,
    cancelBooking,
    confirmJobDone,
    getUserBookingHistory,
    getAcceptedBooking,
    updateBookingAddCoupon
};