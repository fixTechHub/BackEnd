const mongoose = require('mongoose');
const Technician = require('../models/Technician');
const Service = require('../models/Service');
const BookingItem = require('../models/BookingItem');
const BookingPrice = require('../models/BookingPrice');
const CommissionConfig = require('../models/CommissionConfig');
const Booking = require('../models/Booking');
const BookingStatusLog = require('../models/BookingStatusLog');
const Technician = require('../models/Technician')

exports.createNewTechnician = async (userId, technicianData) => {
    const technician = new Technician({
        userId,
        identification: technicianData.identification,
        specialties: technicianData.specialties || '',
        certificate: technicianData.certificate || [],
        certificateVerificationStatus: false,
        jobCompleted: 0,
        availability: 'FREE',
        contractAccepted: false,
        balance: 0,
        isAvailableForAssignment: false,
    });
    
    return await technician.save();
};
exports.findTechnicianByUserId = async (userId) => {
    return await Technician.findOne({userId})
}

const findNearbyTechnicians = async (searchParams, radiusInKm) => {
    const { latitude, longitude, serviceId, availability, status, minBalance } = searchParams;
    const service = await Service.findById(serviceId).select('categoryId').lean();
    // console.log(service);

    if (!service) {
        console.log(`Không tìm thấy service nào với ID: ${serviceId}`);
        return null;
    }
    const categoryId = service.categoryId;
    // console.log("Tìm thấy categoryId:", categoryId);

    const maxDistanceInMeters = radiusInKm * 1000;

    try {
        // Tạo query object
        let matchQuery = {
            availability: availability,
            status: status,
            balance: { $gte: minBalance },
        };
        if (categoryId) {
            matchQuery.specialtiesCategories = new mongoose.Types.ObjectId(categoryId);
        }

        // Sử dụng currentLocation và chỉ định index cụ thể
        const technicians = await Technician.aggregate([
            {
                $geoNear: {
                    near: {
                        type: "Point",
                        coordinates: [longitude, latitude]
                    },
                    distanceField: "distance",
                    maxDistance: maxDistanceInMeters,
                    spherical: true,
                    key: "currentLocation",
                    query: matchQuery
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'userId',
                    foreignField: '_id',
                    as: 'userInfo'
                }
            },
            {
                $lookup: {
                    from: 'categories',
                    localField: 'specialtiesCategories',
                    foreignField: '_id',
                    as: 'category'
                }
            },
            {
                $project: {
                    userId: 1,
                    currentLocation: 1,
                    status: 1,
                    ratingAverage: 1,
                    jobCompleted: 1,
                    experienceYears: 1,
                    specialtiesCategories: 1,
                    availability: 1,
                    balance: 1,
                    distance: 1,
                    // Chuyển đổi distance từ meters sang km
                    distanceInKm: { $round: [{ $divide: ["$distance", 1000] }, 2] },
                    // Thêm thông tin user
                    userInfo: { $arrayElemAt: ["$userInfo", 0] },
                    // category: 1
                }
            },
            {
                $sort: {
                    distance: 1
                }
            },
            {
                $limit: 10
            }
        ]);

        return {
            success: true,
            data: technicians,
            total: technicians.length
        };

    } catch (error) {
        console.error('Lỗi khi tìm thợ:', error);
        return {
            success: false,
            error: error.message,
            data: []
        };
    }
};

const sendQuotation = async (bookingPriceData) => {
    const { bookingId, technicianId, laborPrice, warrantiesDuration, items } = bookingPriceData;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const booking = await Booking.findById(bookingId).session(session);
        if (!booking) {
            throw new Error('Không tìm thấy đặt lịch');
        }
        // if (booking.status !== 'PENDING') {
        //     throw new Error('Không thể tạo báo giá cho đặt lịch này');
        // }

        // Set exprire time
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        // Get current commission applied
        const activeConfig = await CommissionConfig.findOne({ isApplied: true }).session(session);
        if (!activeConfig) {
            throw new Error("Chưa có cấu hình hoa hồng nào được áp dụng!");
        }

        // Calulate the total of items
        const totalItemPrice = (items && Array.isArray(items))
            ? items.reduce((total, item) => total + (item.price * item.quantity), 0)
            : 0;
        const finalPrice = laborPrice + totalItemPrice;

        const newBookingPrice = new BookingPrice({
            bookingId,
            technicianId,
            laborPrice,
            warrantiesDuration,
            finalPrice,
            commissionConfigId: activeConfig._id,
            expiresAt: expiresAt
        });
        const savedBookingPrice = await newBookingPrice.save({ session });
        console.log('--- NEW BOOKING PRICE ---', savedBookingPrice);

        let savedBookingItems = [];
        if (items && Array.isArray(items) && items.length > 0) {
            const bookingItems = items.map(item => ({
                bookingPriceId: savedBookingPrice._id,
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                note: item.note
            }));
            savedBookingItems = await BookingItem.insertMany(bookingItems, { session });
        }

        await BookingStatusLog.create([{
            bookingId,
            fromStatus: booking.status,
            toStatus: 'QUOTED',
            changedBy: technicianId,
            role: 'TECHNICIAN',
            note: reason
        }], { session });
        
        booking.status = 'QUOTED';
        await booking.save({ session });

        await session.commitTransaction();
        return {
            message: 'Gửi báo giá thành công',
            bookingPrice: savedBookingPrice,
            bookingItems: savedBookingItems,
            totalItems: totalItemPrice
        };
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error("Lỗi trong quá trình gửi báo giá:", error);
        throw new Error(`Lỗi gửi báo giá: ${error.message}`);
    }
};

const confirmJobDoneByTechnician = async (bookingId, userId, role) => {
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
        if (role === 'TECHNICIAN' && booking.technicianId?.toString() !== userId.toString()) {
            throw new Error('Bạn không có quyền xác nhận booking này');
        }

        // Kiểm tra trạng thái hiện tại
        if (booking.status === 'CANCELLED') {
            throw new Error('Booking đã bị hủy trước đó');
        }
        if (booking.status === 'PENDING') {
            throw new Error('Không thể hoàn thành booking khi chưa chọn thợ');
        }
        if (booking.status === 'WAITING_CONFIRM') {
            throw new Error('Bạn đã xác nhận hoàn thành rồi!!');
        }

        // Cập nhật trạng thái booking
        await Booking.findByIdAndUpdate(
            bookingId,
            {
                $set: {
                    status: 'WAITING_CONFIRM',
                    technicianConfirmedDone: true,
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
            toStatus: 'WAITING_CONFIRM',
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
    findNearbyTechnicians,
    sendQuotation,
    confirmJobDoneByTechnician
};