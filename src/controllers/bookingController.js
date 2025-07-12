const bookingService = require('../services/bookingService');
const { addressToPoint } = require('../services/geocodingService');
const User = require('../models/User');
const { getIo } = require('../sockets/socketManager');

const createBookingRequest = async (req, res) => {
    const io = getIo()
    try {
        const customerId = req.user.userId;
        // console.log('--- CUSTOMER ID ---', customerId);

        const { serviceId, description, startTime, endTime, address } = req.body;
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

        const schedule = {
            startTime,
            endTime
        }
        console.log('--- SCHEDULE ---', schedule);

        if (!schedule?.startTime || !schedule?.endTime) {
            return res.status(400).json({ success: false, message: 'Vui lòng chọn thời gian bắt đầu và kết thúc.' });
        }

        const imageUrls = req.s3FileUrls || [];
        console.log('Uploaded Image URLs:', imageUrls);

        const bookingData = {
            customerId,
            serviceId,
            location,
            description,
            schedule,
            images: imageUrls,
        };
        // console.log('--- Booking Data ---', bookingData);

        const result = await bookingService.createRequestAndNotify(bookingData, io);
        // console.log('Booking Request Result:', result);

        res.status(201).json({
            success: true,
            message: 'Tạo yêu cầu thành công. Hệ thống đang tìm kiếm kỹ thuật viên phù hợp.',
            data: result.booking,
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
        const io = getIo()
        // console.log('--- ROLE ---', role);

        if (!reason) {
            return res.status(400).json({
                message: 'Vui lòng cung cấp lý do hủy booking'
            });
        }

        const booking = await bookingService.cancelBooking(
            bookingId,
            userId,
            role,
            reason,
            io
        );

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
        const { userId } = req.body;

        const user = await User.findById(userId).populate('role'); console.log(user)
        const role = user.role.name;

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
        const booking = await bookingService.technicianSendQuote(bookingId, technicianId, quoteData);
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
        const booking = await bookingService.customerAcceptQuote(bookingId, customerId);
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
        const booking = await bookingService.customerRejectQuote(bookingId, customerId);
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

module.exports = {
    createBookingRequest,
    getBookingById,
    cancelBooking,
    confirmJobDone,
    technicianSendQuote,
    customerAcceptQuote,
    customerRejectQuote,
    getTopBookedServices
};