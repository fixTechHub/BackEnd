const Technician = require('../models/Technician');
const Service = require('../models/Service');
const mongoose = require('mongoose');

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
                    as: 'categories'
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
                    categories: 1
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


module.exports = {
    findNearbyTechnicians,
};