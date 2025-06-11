const Technician = require('../models/Technician');
const Service = require('../models/Service');
const mongoose = require('mongoose');
const BookingItem = require('../models/BookingItem');
const BookingPrice = require('../models/BookingPrice');
const CommissionConfig = require('../models/CommissionConfig');

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
                    distance: 1,
                    ratingAverage: -1,
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
}

module.exports = {
    findNearbyTechnicians,
    sendQuotation,
};