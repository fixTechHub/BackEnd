const bookingService = require('../services/bookingService');
const { addressToPoint } = require('../services/geocodingService');
const User = require('../models/User');
const { getIo } = require('../sockets/socketManager')
const couponService = require('../services/couponService')

const createBookingRequest = async (req, res) => {
    const io = getIo()
    try {
        const customerId = req.user.userId;
        // console.log('--- CUSTOMER ID ---', customerId);

        const { serviceId, description, startTime, endTime, address, type } = req.body;
        // console.log('Booking Text Data:', { customerId, serviceId, description, schedule, address });

        // Chuyển đổi địa chỉ string sang GeoJSON Point bằng Mapbox
        const locationPoint = await addressToPoint(address);

        // Nếu không thể tìm thấy tọa độ, trả về lỗi
        if (!locationPoint) {
            return res.status(400).json({
                success: false,
                message: 'Không thể tìm thấy vị trí từ địa chỉ bạn cung cấp. Vui lòng thử lại với địa chỉ chi tiết hơn.'
            });
        }

        const location = {
            address: address,
            geojson: locationPoint,
        }
        console.log('--- LOCATION ---', location);

        let schedule = {};
        let isUrgent = false;

        if (type === 'scheduled') {
            if (!startTime || !endTime) {
                return res.status(400).json({ success: false, message: 'Vui lòng chọn thời gian bắt đầu và kết thúc.' });
            }
            schedule.startTime = new Date(startTime);
            schedule.expectedEndTime = new Date(endTime);
            isUrgent = false;
        } else {
            const now = new Date();
            schedule.startTime = now;
            schedule.expectedEndTime = new Date(now.getTime() + 2 * 60 * 60 * 1000); // +2h
            isUrgent = true;
        }
        console.log('--- SCHEDULE ---', schedule);

        const imageUrls = req.s3FileUrls || [];
        console.log('Uploaded Image URLs:', imageUrls);

        const bookingData = {
            customerId,
            serviceId,
            location,
            description,
            schedule,
            images: imageUrls,
            isUrgent
        };
        // console.log('--- Booking Data ---', bookingData);

        const result = await bookingService.createRequestAndNotify(bookingData, io);
        console.log('Booking Request Result:', result);

        res.status(201).json({
            success: true,
            message: 'Tạo yêu cầu thành công. Hệ thống đang tìm kiếm kỹ thuật viên phù hợp.',
            booking: result.booking,
            technicians_found: result.technicians.data.length > 0 ? result.technicians.data : result.message
        });
    } catch (error) {
        console.error('Create Booking Request Error:', error);
        res.status(400).json({ success: false, message: error.message });
    }
};

const getBookingById = async (req, res) => {
    try {
        const bookingId = req.params.id;

        const booking = await bookingService.getBookingById(bookingId);

        res.status(200).json({
            success: true,
            message: 'Lấy thông tin đặt lịch thành công!',
            data: booking
        });
    } catch (error) {
        console.error('Create Booking Request Error:', error);
        res.status(400).json({
            success: false,
            message: 'Lấy thông tin đặt lịch thất bại.',
            error: error.message
        });
    }
};

const cancelBooking = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const { reason } = req.body;
        const userId = req.user.userId;
        const role = req.user.role;
        const io = getIo();
        // console.log('--- ROLE ---', role);
        console.log('--- ROLE ---', req.user);
        // const cancelBooking = async (req, res) => {
        //     try {
        //         const { bookingId } = req.params;
        //         const { reason } = req.body;
        //         const userId = req.user.userId;        
        //         const role = req.user.role;
        //         // console.log('--- ROLE ---', role);

        //         if (!reason) {
        //             return res.status(400).json({
        //                 message: 'Vui lòng cung cấp lý do hủy booking'
        //             });
        //         }

        const booking = await bookingService.cancelBooking(
            bookingId,
            userId,
            role,
            reason,
            io
        );
        //         const booking = await bookingService.cancelBooking(
        //             bookingId,
        //             userId,
        //             role,
        //             reason
        //         );

        res.status(200).json({
            message: 'Hủy booking thành công',
            data: booking
        });
    } catch (error) {
        console.error('Lỗi khi hủy booking:', error);
        return res.status(400).json({ success: false, message: error.message });
    }
};

const confirmJobDone = async (req, res) => {
    try {
        const { bookingId } = req.params;
        // const { userId } = req.body;
        const userId = req.user.userId;
        const role = user.role.name;

        const user = await User.findById(userId).populate('role'); console.log(user)

        const booking = await bookingService.confirmJobDone(
            bookingId,
            userId,
            role
        );

        res.status(200).json({
            message: 'Xác nhận thành công',
            data: booking
        });
    } catch (error) {
        console.error('Lỗi khi xác nhận hoàn thành:', error);
        res.json({
            message: error.message || 'Không thể xác nhận hoàn thành'
        });
    }
};

// Thợ gửi báo giá (quote)
const technicianSendQuote = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const technicianId = req.user.userId;
        const quoteData = req.body;
        const io = getIo();
        const booking = await bookingService.technicianSendQuote(bookingId, technicianId, quoteData, io);
        res.status(200).json({ success: true, message: 'Gửi báo giá thành công', data: booking });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// Khách đồng ý báo giá
const customerAcceptQuote = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const customerId = req.user.userId;
        const io = getIo();
        const booking = await bookingService.customerAcceptQuote(bookingId, customerId, io);
        res.status(200).json({ success: true, message: 'Đồng ý báo giá thành công', data: booking });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// Khách từ chối báo giá
const customerRejectQuote = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const customerId = req.user.userId;
        const io = getIo();
        const booking = await bookingService.customerRejectQuote(bookingId, customerId, io);
        res.status(200).json({ success: true, message: 'Từ chối báo giá thành công', data: booking });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const getTopBookedServices = async (req, res) => {
    try {
        const limit = 6;

        const topServices = await bookingService.getTopBookedServices(limit);

        res.status(200).json({
            success: true,
            message: `Lấy ${limit} dịch vụ hàng đầu thành công.`,
            data: topServices
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || "Đã có lỗi xảy ra ở server."
        });
    }
};

const selectTechnicianForBooking = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const { technicianId } = req.body;
        const customerId = req.user.userId;
        const io = getIo();

        const result = await bookingService.selectTechnicianForBooking(bookingId, technicianId, customerId, io);
        res.json(result);
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const technicianAcceptBooking = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const technicianId = req.user.userId;
        const io = getIo();

        console.log('--- DEBUG ---');
        console.log('bookingId:', bookingId);
        console.log('technicianId:', technicianId);

        const result = await bookingService.technicianAcceptBooking(bookingId, technicianId, io);
        res.json(result);
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

const technicianConfirm = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const technicianId = req.user.userId;

        const result = await bookingService.technicianConfirmBooking(bookingId, technicianId);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const getUserBookingHistory = async (req, res) => {
    try {
        const userId = req.user.userId
        const role = req.user.role
        // const role = 'CUSTOMER'
        
        

        const { limit = 20, skip = 0 } = req.query;

        const bookings = await bookingService.getUserBookingHistory(userId, role, limit, skip)
        
        res.status(200).json({ bookings });
    } catch (error) {
        console.error('Lỗi lấy lịch sử đặt lịch :', error.message);
        res.json({
            error: error.message || 'Không thể xác nhận hoàn thành'
        });
    }
}

const getAcceptedBooking = async (req, res) => {
    try {
        const user = req.user
        const { bookingId } = req.params
        const acceptedBooking = await bookingService.getAcceptedBooking(bookingId)
        const userCoupons = await couponService.getUserCoupon(user.userId)


        res.status(200).json({
            success: true,
            message: 'Lấy thông tin đặt lịch thành công',
            data: {
                acceptedBooking,
                userCoupons
            }
        });

    } catch (error) {
        console.error('Get Accepted Booking Error:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Lỗi khi lấy thông tin đặt lịch'
        });
    }
}
// Thợ từ chối booking
const technicianRejectBooking = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const technicianId = req.user.userId;
        const io = getIo();

        console.log('--- TECHNICIAN REJECT CONTROLLER DEBUG ---');
        console.log('Request params:', req.params);
        console.log('Request user:', req.user);
        console.log('Booking ID:', bookingId);
        console.log('Technician ID:', technicianId);

        const result = await bookingService.technicianRejectBooking(bookingId, technicianId, io);
        res.json(result);
    } catch (error) {
        console.log('--- TECHNICIAN REJECT CONTROLLER ERROR ---', error.message);
        res.status(400).json({ success: false, message: error.message });
    }
};

const getBookingTechnicianRequests = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const requests = await bookingService.getBookingTechnicianRequests(bookingId);
        res.status(200).json({ success: true, data: requests });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const getTechniciansFoundByBookingId = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const technicians = await bookingService.getTechniciansFoundByBookingId(bookingId);
        if (!technicians) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy kết quả tìm thợ cho booking này.' });
        }
        res.status(200).json({ success: true, data: technicians });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const getRequestStatusInfo = async (req, res) => {
    try {
        const { bookingId, technicianId } = req.params;
        const statusInfo = await bookingService.getRequestStatusInfo(bookingId, technicianId);
        res.status(200).json({ success: true, data: statusInfo });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// Lấy các mô tả booking phổ biến nhất
const getPopularDescriptions = async (req, res) => {
    try {
        const { limit = 10 } = req.query;
        const result = await bookingService.getPopularDescriptions(limit);

        if (result.success) {
            res.json(result);
        } else {
            res.status(500).json(result);
        }
    } catch (error) {
        console.error('Lỗi khi lấy mô tả phổ biến:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy mô tả phổ biến'
        });
    }
};

// Tìm kiếm mô tả theo từ khóa
const searchDescriptions = async (req, res) => {
    try {
        const { query, limit = 5 } = req.query;
        const result = await bookingService.searchDescriptions(query, limit);

        if (result.success) {
            res.json(result);
        } else {
            res.status(500).json(result);
        }
    } catch (error) {
        console.error('Lỗi khi tìm kiếm mô tả:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi tìm kiếm mô tả'
        });
    }
};

module.exports = {
    createBookingRequest,
    getBookingById,
    cancelBooking,
    confirmJobDone,
    getAcceptedBooking,
    technicianSendQuote,
    customerAcceptQuote,
    customerRejectQuote,
    getTopBookedServices,
    technicianConfirm,
    getUserBookingHistory,
    selectTechnicianForBooking,
    technicianAcceptBooking,
    technicianConfirm,
    technicianRejectBooking,
    getBookingTechnicianRequests,
    getTechniciansFoundByBookingId,
    getRequestStatusInfo,
    getPopularDescriptions,
    searchDescriptions,
};