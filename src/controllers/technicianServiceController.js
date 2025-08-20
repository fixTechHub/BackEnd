const TechnicianService = require('../models/TechnicianService');
const Technician = require('../models/Technician');
const Service = require('../models/Service');
const Booking = require('../models/Booking');
const mongoose = require('mongoose');

/**
 * Lấy danh sách dịch vụ và giá của kỹ thuật viên
 */
exports.getTechnicianServices = async (req, res) => {
    try {
        const userId = req.user.userId;

        // Tìm technician
        const technician = await Technician.findOne({ userId });
        if (!technician) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy thông tin kỹ thuật viên'
            });
        }

        // Lấy danh sách dịch vụ của kỹ thuật viên với category
        const technicianServices = await TechnicianService.find({
            technicianId: technician._id,
            isActive: true
        }).populate({
            path: 'serviceId',
            select: 'serviceName description categoryId',
            populate: {
                path: 'categoryId',
                select: 'categoryName'
            }
        });

        res.status(200).json({
            success: true,
            data: {
                services: technicianServices,
                lastUpdated: technician.pricesLastUpdatedAt
            }
        });
    } catch (error) {
        console.error('Error getting technician services:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy danh sách dịch vụ',
            error: error.message
        });
    }
};

/**
 * Cập nhật giá dịch vụ và bảo hành
 */
exports.updateServicePrices = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const userId = req.user.userId;
        const { services } = req.body; // Array of {serviceId, price, warrantyDuration}

        if (!services || !Array.isArray(services) || services.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Danh sách dịch vụ không hợp lệ'
            });
        }

        // Tìm technician
        const technician = await Technician.findOne({ userId }).session(session);
        if (!technician) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy thông tin kỹ thuật viên'
            });
        }

        // Kiểm tra validate 30 ngày 1 lần
        if (technician.pricesLastUpdatedAt) {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            
            if (technician.pricesLastUpdatedAt > thirtyDaysAgo) {
                const nextUpdateDate = new Date(technician.pricesLastUpdatedAt);
                nextUpdateDate.setDate(nextUpdateDate.getDate() + 30);
                
                return res.status(400).json({
                    success: false,
                    message: `Bạn chỉ được cập nhật giá 1 lần mỗi 30 ngày. Lần cập nhật tiếp theo: ${nextUpdateDate.toLocaleDateString('vi-VN')}`,
                    nextUpdateDate: nextUpdateDate
                });
            }
        }

        // Kiểm tra không có booking đang diễn ra
        const activeBookings = await Booking.find({
            technicianId: technician._id,
            status: { 
                $in: ['PENDING', 'AWAITING_CONFIRM', 'IN_PROGRESS', 'WAITING_CUSTOMER_CONFIRM_ADDITIONAL', 'CONFIRM_ADDITIONAL', 'AWAITING_DONE'] 
            }
        }).session(session);

        if (activeBookings.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Không thể cập nhật giá khi có đơn hàng đang thực hiện. Vui lòng hoàn thành tất cả đơn hàng trước khi cập nhật giá.',
                activeBookingsCount: activeBookings.length
            });
        }

        // Validate dữ liệu đầu vào
        for (const serviceData of services) {
            const { serviceId, price, warrantyDuration } = serviceData;

            if (!serviceId || !mongoose.Types.ObjectId.isValid(serviceId)) {
                return res.status(400).json({
                    success: false,
                    message: 'ID dịch vụ không hợp lệ'
                });
            }

            if (typeof price !== 'number' || price < 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Giá dịch vụ phải là số dương'
                });
            }

            if (typeof warrantyDuration !== 'number' || warrantyDuration < 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Thời gian bảo hành phải là số dương (tính theo tháng)'
                });
            }

            // Kiểm tra service có tồn tại không
            const service = await Service.findById(serviceId).session(session);
            if (!service) {
                return res.status(404).json({
                    success: false,
                    message: `Không tìm thấy dịch vụ với ID: ${serviceId}`
                });
            }
        }

        // Cập nhật hoặc tạo mới TechnicianService
        const updatePromises = services.map(async (serviceData) => {
            const { serviceId, price, warrantyDuration } = serviceData;
            
            const existingService = await TechnicianService.findOne({
                technicianId: technician._id,
                serviceId: serviceId
            }).session(session);

            if (existingService) {
                // Cập nhật
                existingService.price = price;
                existingService.warrantyDuration = warrantyDuration;
                existingService.isActive = true;
                return await existingService.save({ session });
            } else {
                // Tạo mới
                const newTechnicianService = new TechnicianService({
                    technicianId: technician._id,
                    serviceId: serviceId,
                    price: price,
                    warrantyDuration: warrantyDuration,
                    isActive: true
                });
                return await newTechnicianService.save({ session });
            }
        });

        await Promise.all(updatePromises);

        // Cập nhật thời gian cập nhật giá
        technician.pricesLastUpdatedAt = new Date();
        await technician.save({ session });

        await session.commitTransaction();

        // Lấy lại danh sách dịch vụ đã cập nhật
        const updatedServices = await TechnicianService.find({
            technicianId: technician._id,
            isActive: true
        }).populate('serviceId', 'serviceName description');

        res.status(200).json({
            success: true,
            message: 'Cập nhật giá dịch vụ thành công',
            data: {
                services: updatedServices,
                lastUpdated: technician.pricesLastUpdatedAt
            }
        });

    } catch (error) {
        await session.abortTransaction();
        console.error('Error updating service prices:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi cập nhật giá dịch vụ',
            error: error.message
        });
    } finally {
        session.endSession();
    }
};

/**
 * Kiểm tra có thể cập nhật giá không
 */
exports.checkUpdateEligibility = async (req, res) => {
    try {
        const userId = req.user.userId;

        // Tìm technician
        const technician = await Technician.findOne({ userId });
        if (!technician) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy thông tin kỹ thuật viên'
            });
        }

        // Kiểm tra thời gian cập nhật cuối
        let canUpdate = true;
        let nextUpdateDate = null;
        let message = 'Có thể cập nhật giá dịch vụ';

        if (technician.pricesLastUpdatedAt) {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            
            if (technician.pricesLastUpdatedAt > thirtyDaysAgo) {
                canUpdate = false;
                nextUpdateDate = new Date(technician.pricesLastUpdatedAt);
                nextUpdateDate.setDate(nextUpdateDate.getDate() + 30);
                message = `Bạn đã cập nhật giá trong 30 ngày qua. Lần cập nhật tiếp theo: ${nextUpdateDate.toLocaleDateString('vi-VN')}`;
            }
        }

        // Kiểm tra booking đang diễn ra
        const activeBookings = await Booking.find({
            technicianId: technician._id,
            status: { 
                $in: ['PENDING', 'AWAITING_CONFIRM', 'IN_PROGRESS', 'WAITING_CUSTOMER_CONFIRM_ADDITIONAL', 'CONFIRM_ADDITIONAL', 'AWAITING_DONE'] 
            }
        });

        if (activeBookings.length > 0) {
            canUpdate = false;
            message = `Không thể cập nhật giá khi có ${activeBookings.length} đơn hàng đang thực hiện`;
        }

        res.status(200).json({
            success: true,
            data: {
                canUpdate,
                message,
                lastUpdated: technician.pricesLastUpdatedAt,
                nextUpdateDate,
                activeBookingsCount: activeBookings.length
            }
        });

    } catch (error) {
        console.error('Error checking update eligibility:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi kiểm tra điều kiện cập nhật',
            error: error.message
        });
    }
};
