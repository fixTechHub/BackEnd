const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const technicianService = require('./technicianService');
const BookingStatusLog = require('../models/BookingStatusLog');
const notificationService = require('../services/notificationService')
const couponService = require('../services/couponService')
const paymentService = require('../services/paymentService')
const commissionService = require('../services/commissionService')
const receiptService = require('../services/receiptService');
const Technician = require('../models/Technician');
const TechnicianServiceModel = require('../models/TechnicianService');
const BookingTechnicianSearch = require('../models/BookingTechnicianSearch');
const { getIo } = require('../sockets/socketManager');

const MAX_TECHNICIANS = 10;
const SEARCH_RADII = [5, 10, 15, 30];

const findTechniciansWithExpandingRadiusAndSave = async (searchParams, bookingId, io) => {
    let foundTechnicians = [];
    let foundTechnicianIds = new Set();

    // Lấy trạng thái tìm kiếm hiện tại
    let searchState = await BookingTechnicianSearch.findOne({ bookingId });
    if (searchState) {
        foundTechnicianIds = new Set(searchState.foundTechnicianIds.map(id => String(id)));
    } else {
        searchState = new BookingTechnicianSearch({ bookingId, foundTechnicianIds: [] });
    }

    for (const radius of SEARCH_RADII) {
        const result = await technicianService.findNearbyTechnicians(searchParams, radius);
        // console.log('--- TECHNICIAN FOUND ---', result);

        if (result && result.data && result.data.length > 0) {
            for (const tech of result.data) {
                if (!foundTechnicianIds.has(String(tech.userId))) {
                    foundTechnicians.push(tech);
                    foundTechnicianIds.add(String(tech.userId));
                }
            }
        }
        if (foundTechnicians.length >= MAX_TECHNICIANS) break;
    }

    // Lưu lại trạng thái
    searchState.foundTechnicianIds = Array.from(foundTechnicianIds);
    searchState.lastSearchAt = new Date();
    if (foundTechnicians.length >= MAX_TECHNICIANS) searchState.completed = true;
    await searchState.save();

    // // Gửi thông báo cho các thợ mới tìm được
    // if (io && bookingId && foundTechnicians.length > 0) {
    //     const notificationPromises = foundTechnicians.map(async tech => {
    //         const notifData = {
    //             userId: tech.userId,
    //             title: 'Yêu cầu công việc mới gần bạn',
    //             content: `Có một yêu cầu mới cách bạn khoảng ${(tech.distance / 1000).toFixed(1)} km. Nhấn để xem và báo giá.`,
    //             referenceModel: 'Booking',
    //             referenceId: bookingId,
    //             url: `/technician/send-quotation?bookingId=${bookingId}`,
    //             type: 'NEW_REQUEST'
    //         };
    //         const notify = await notificationService.createNotification(notifData);
    //         io.to(`user:${notify.userId}`).emit('receiveNotification', notify);
    //     });
    //     await Promise.all(notificationPromises);
    // }

    return {
        data: foundTechnicians,
        total: foundTechnicians.length,
        message: foundTechnicians.length < MAX_TECHNICIANS
            ? 'Đã tìm được một số thợ, hệ thống sẽ tiếp tục tìm thêm nếu cần.'
            : 'Đã tìm đủ thợ phù hợp.'
    };
};

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
            technicianId: null,
            quote: null
        });
        // console.log('--- LOCATION POINT ---', newBooking.location.geojson.coordinates);
        console.log('--- ĐẶT LỊCH MỚI ---', newBooking);

        await newBooking.save({ session });
        // console.log('--- ĐẶT LỊCH MỚI SAU SAVE ---', newBooking);

        const { location, serviceId } = bookingData;
        const searchParams = {
            latitude: location.geojson.coordinates[1],
            longitude: location.geojson.coordinates[0],
            serviceId: serviceId,
            availability: 'FREE',
            status: 'APPROVED',
            minBalance: 200000
        };

        // Tìm thợ lần đầu và lưu trạng thái
        const foundTechs = await findTechniciansWithExpandingRadiusAndSave(searchParams, newBooking._id, io);
        console.log('--- TECHNICIAN FOUND ---', foundTechs);

        await session.commitTransaction();
        session.endSession();

        return { booking: newBooking, technicians: foundTechs };
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
                populate: [
                    {
                        path: 'userId',
                    },
                    {
                        path: 'specialtiesCategories',
                        select: 'categoryName'
                    }
                ]
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

const cancelBooking = async (bookingId, userId, role, reason, io) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Tìm booking
        const booking = await Booking.findById(bookingId);
        if (!booking) {
            throw new Error('Không tìm thấy booking');
        }
        console.log('--- BOOKING ---', booking);


        const technician = await Technician.findById(booking.technicianId).populate('userId');
        console.log('--- TECHNICIAN ---', technician);


        if (role === "TECHNICIAN" && !technician) {
            throw new Error('Không tìm thấy thông tin kỹ thuật viên');
        }
        const technicianId = technician?._id;
        console.log('--- TECHNICIAN ID ---', technician?.userId?._id);


        // Kiểm tra quyền hủy
        if (role === 'CUSTOMER' && booking.customerId.toString() !== userId) {
            throw new Error('Bạn không có quyền hủy booking này');
        }
        if (role === 'TECHNICIAN' && booking.technicianId?.toString() !== technicianId.toString()) {
            throw new Error('Bạn không có quyền hủy booking này');
        }

        // Kiểm tra trạng thái hiện tại
        if (booking.status === 'CANCELLED') {
            throw new Error('Đơn này đã bị hủy trước đó');
        }
        if (booking.status === 'DONE') {
            throw new Error('Không thể hủy đơn đã hoàn thành');
        }
        if (booking.status === 'WAITING_CONFIRM') {
            throw new Error('Không thể hủy đơn khi thợ đã xác nhận hoàn thành');
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

        if (booking.status === 'IN_PROGRESS' && booking.technicianId) {
            await Technician.findByIdAndUpdate(
                booking.technicianId,
                { $set: { availability: 'FREE' } },
                { session }
            );
        }

        io.to(`user:${booking.customerId}`).emit('booking:statusUpdate', {
            bookingId: booking._id.toString(),
            status: 'CANCELLED'
        });
        if (technician && technician.userId) {
            io.to(`user:${technician.userId._id}`).emit('booking:statusUpdate', {
                bookingId: booking._id.toString(),
                status: 'CANCELLED'
            });
        }

        if (role === 'CUSTOMER') {
            const notifData = {
                userId: booking.customerId._id,
                title: 'Đơn đã bị hủy',
                content: `Đơn này đã bị hủy vì lí do ${reason}`,
                referenceModel: 'Booking',
                referenceId: bookingId,
                url: '/',
                type: 'NEW_REQUEST'
            };
            const notify = await notificationService.createNotification(notifData);
            io.to(`user:${notify.userId}`).emit('receiveNotification', notify);
        }

        if (role === 'TECHNICIAN') {
            const notifData = {
                userId: booking.technicianId._id,
                title: 'Đơn đã bị hủy',
                content: `Đơn này đã bị hủy vì lí do ${reason}`,
                referenceModel: 'Booking',
                referenceId: bookingId,
                url: '/',
                type: 'NEW_REQUEST'
            };
            const notify = await notificationService.createNotification(notifData);
            io.to(`user:${notify.userId}`).emit('receiveNotification', notify);
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

// const getDetailBookingById = async (bookingId) => {
//     try {
//         if (!mongoose.Types.ObjectId.isValid(bookingId)) {
//             throw new Error('ID đặt lịch không hợp lệ');
//         }

//         const booking = await Booking.findById(bookingId)
//             .populate({
//                 path: 'customerId',
//                 select: 'fullName email phone avatar'
//             })
//             .populate({
//                 path: 'technicianId',
//                 populate: [
//                     {
//                         path: 'userId',
//                         select: 'fullName email phone avatar'
//                     },
//                     {
//                         path: 'specialtiesCategories',
//                         select: 'categoryName'
//                     }
//                 ]
//             })
//             .populate({ path: 'serviceId' })
//             .populate('cancelledBy');

//         if (!booking) {
//             throw new Error('Không tìm thấy đặt lịch');
//         }

//         return {
//             booking,

//         };
//     } catch (error) {
//         throw error;
//     }
// };

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

// Thợ gửi báo giá (quote)
const technicianSendQuote = async (bookingId, technicianId, quoteData) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const booking = await Booking.findById(bookingId).session(session);
        if (!booking) throw new Error('Không tìm thấy booking');
        if (!booking.technicianId || booking.technicianId.toString() !== technicianId) {
            throw new Error('Bạn không có quyền gửi báo giá cho booking này');
        }
        if (booking.status !== 'PENDING' && booking.status !== 'IN_PROGRESS') {
            throw new Error('Không thể gửi báo giá ở trạng thái hiện tại');
        }
        // Cập nhật báo giá
        booking.quote = {
            ...booking.quote,
            ...quoteData,
            status: 'PENDING',
            quotedAt: new Date(),
        };
        booking.status = 'IN_PROGRESS';
        await booking.save({ session });
        await session.commitTransaction();
        return booking;
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

// Khách đồng ý báo giá
const customerAcceptQuote = async (bookingId, customerId) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const booking = await Booking.findById(bookingId).session(session);
        if (!booking) throw new Error('Không tìm thấy booking');
        if (booking.customerId.toString() !== customerId) {
            throw new Error('Bạn không có quyền duyệt báo giá cho booking này');
        }
        if (!booking.quote || booking.quote.status !== 'PENDING') {
            throw new Error('Không có báo giá chờ duyệt');
        }
        booking.quote.status = 'ACCEPTED';
        booking.status = 'WAITING_CONFIRM';
        // Tính finalPrice (laborPrice + parts)
        let partsTotal = 0;
        if (Array.isArray(booking.quote.items)) {
            partsTotal = booking.quote.items.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0);
        }
        booking.finalPrice = (booking.quote.laborPrice || 0) + partsTotal;
        // TODO: Tính commissionAmount, technicianEarning nếu cần
        await booking.save({ session });
        await session.commitTransaction();
        return booking;
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

// Khách từ chối báo giá
const customerRejectQuote = async (bookingId, customerId) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const booking = await Booking.findById(bookingId).session(session);
        if (!booking) throw new Error('Không tìm thấy booking');
        if (booking.customerId.toString() !== customerId) {
            throw new Error('Bạn không có quyền từ chối báo giá cho booking này');
        }
        if (!booking.quote || booking.quote.status !== 'PENDING') {
            throw new Error('Không có báo giá chờ duyệt');
        }
        booking.quote.status = 'REJECTED';
        // Trừ inspectionFee vào finalPrice
        // Lấy inspectionFee từ technician
        const technician = await Technician.findById(booking.technicianId);
        const inspectionFee = technician?.rates?.inspectionFee || 0;
        booking.finalPrice = inspectionFee;
        booking.status = 'CANCELLED';
        booking.paymentStatus = 'PENDING';
        await booking.save({ session });
        await session.commitTransaction();
        return booking;
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

const getTopBookedServices = async (limit) => {
    try {
        const topServices = await Booking.aggregate([
            // 1. Chỉ lọc các booking đã "HOÀN THÀNH"
            { $match: { status: 'DONE' } },

            // 2. Nhóm theo mã dịch vụ và đếm số lượng
            { $group: { _id: '$serviceId', bookingCount: { $sum: 1 } } },

            // 3. Sắp xếp theo số lượt đặt giảm dần
            { $sort: { bookingCount: -1 } },

            // 4. Giới hạn số lượng kết quả
            { $limit: limit },

            // 5. Nối bảng để lấy thông tin chi tiết dịch vụ
            {
                $lookup: {
                    from: 'services',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'serviceDetails'
                }
            },

            // 6. Mở mảng kết quả
            { $unwind: '$serviceDetails' },

            // 7. Định dạng lại đầu ra
            {
                $project: {
                    _id: 0,
                    serviceId: '$_id',
                    service: '$serviceDetails',
                    bookingCount: '$bookingCount'
                }
            }
        ]);

        return topServices;
    } catch (error) {
        console.error("Error fetching top booked services:", error);
        throw new Error("Không thể lấy dữ liệu thống kê dịch vụ.");
    }
};

const selectTechnicianForBooking = async (bookingId, technicianId, customerId, io) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const booking = await Booking.findById(bookingId).session(session);
        const technician = await Technician.findById(technicianId).populate('userId');
        console.log('--- TECHNICIAN ---', technician);

        if (!booking) throw new Error('Không tìm thấy booking');
        if (booking.customerId.toString() !== customerId) throw new Error('Bạn không có quyền chọn thợ cho booking này');
        if (booking.status !== 'PENDING') throw new Error('Chỉ chọn thợ khi booking đang chờ xử lý');

        booking.technicianId = technicianId;
        booking.status = 'AWAITING_CONFIRM';
        await booking.save({ session });

        // Gửi thông báo cho thợ
        const notifData = {
            userId: technician?.userId?._id,
            title: 'Bạn được chọn cho đơn mới',
            content: `Khách hàng đã chọn bạn cho đơn ${booking.bookingCode}`,
            referenceModel: 'Booking',
            referenceId: bookingId,
            url: `/booking/booking-processing?bookingId=${bookingId}`,
            type: 'NEW_REQUEST'
        };
        const notify = await notificationService.createNotification(notifData);
        io.to(`user:${notify.userId}`).emit('receiveNotification', notify);

        await session.commitTransaction();
        return { success: true, message: 'Đã gửi yêu cầu xác nhận đến kỹ thuật viên!' };
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

const technicianConfirmBooking = async (bookingId, technicianId) => {
      const io = getIo();
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const booking = await Booking.findById(bookingId).session(session);
        const technician = await Technician.findOne({ userId: technicianId });
        console.log('--- TEST TECHID ---', technician);
        console.log('--- TEST BOOKING ---', booking);
        
        if (!booking) throw new Error('Không tìm thấy booking');
        if (!booking.technicianId || booking.technicianId.toString() !== technician._id.toString()) throw new Error('Bạn không có quyền xác nhận booking này');
        if (booking.status !== 'AWAITING_CONFIRM') throw new Error('Trạng thái booking không hợp lệ');

        booking.status = 'IN_PROGRESS';
        booking.isChatAllowed = true;
        booking.isVideoCallAllowed = true;
        await booking.save({ session });

        // Gửi thông báo cho khách
        await notificationService.createNotification({
            userId: booking.customerId,
            title: 'Kỹ thuật viên đã xác nhận',
            content: `Kỹ thuật viên đã xác nhận đơn ${booking.bookingCode}`,
            referenceModel: 'Booking',
            referenceId: bookingId,
            url: `/booking/${bookingId}`,
            type: 'NEW_REQUEST'
        });
        console.log(technician.userId);
        console.log(booking.customerId);
        
        io.to(`user:${booking.customerId.toString()}`).emit('booking:statusUpdate', {
            bookingId: booking._id,
            status: 'IN_PROGRESS'
          });
          io.to(`user:${technician.userId.toString()}`).emit('booking:statusUpdate', {
            bookingId: booking._id,
            status: 'IN_PROGRESS'
          });
        await session.commitTransaction();
        return { success: true, message: 'Kỹ thuật viên đã xác nhận nhận đơn!' };
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
            status: 'AWAITING_DONE',
            // status: 'CONFIRMED',

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
            // const technicianServiceModel = await TechnicianServiceModel.findOne({ serviceId: updatedBooking.serviceId })
            // console.log(technicianServiceModel);
            
            const receiptData = {
                bookingId: updatedBooking._id,
                customerId: updatedBooking.customerId,
                technicianId: updatedBooking.technicianId,
                totalAmount: updatedBooking.finalPrice + updatedBooking.discountValue,
                // serviceAmount: technicianServiceModel.price,
                discountAmount: updatedBooking.discountValue,
                paidAmount: updatedBooking.finalPrice,
                paymentMethod: 'CASH',
                paymentStatus: 'PAID',
                holdingAmount: updatedBooking.finalPrice*0.2,
               
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
    getAcceptedBooking,
    updateBookingAddCoupon,
    findTechniciansWithExpandingRadiusAndSave,
    // getDetailBookingById,
    technicianSendQuote,
    customerAcceptQuote,
    customerRejectQuote,
    getTopBookedServices,
    selectTechnicianForBooking,
    technicianConfirmBooking,
    getUserBookingHistory
};